document.addEventListener('DOMContentLoaded', () => {

  const API_URL           = 'https://hub.spacestation14.com/api/servers';
  const MINECRAFT_API_URL = 'https://api.mcstatus.io/v2/status/java/corvaxcraft.ru';
  const HISTORY_URL       = 'data/history.json';

  // ─── DOM refs ─────────────────────────────────────────────────────────────

  const serversListContainer = document.getElementById('servers-list');
  const currentTimeElement   = document.getElementById('current-time');
  const detailsPanel         = document.getElementById('details-panel');
  const detailsOverlay       = document.getElementById('details-overlay');
  const panelTitle           = document.getElementById('panel-title');
  const detailsServerList    = document.getElementById('details-server-list');
  const closePanelBtn        = document.getElementById('close-panel-btn');
  const tabProjects          = document.getElementById('tab-projects');
  const tabHub               = document.getElementById('tab-hub');
  const chartPanel           = document.getElementById('chart-panel');
  const chartPanelTitle      = document.getElementById('chart-panel-title');
  const closeChartBtn        = document.getElementById('close-chart-btn');
  const onlineChartCanvas    = document.getElementById('online-chart');

  if (closeChartBtn) closeChartBtn.style.display = 'none';

  // ─── State ────────────────────────────────────────────────────────────────

  let currentMode            = 'projects';
  let previousProjectState   = {};
  let previousServerState    = {};
  let pendingServerState     = {};
  let groupedServers         = {};
  let currentlyOpenProject   = null;
  let currentlyOpenHubServer = null;
  let minecraftServerData    = null;
  let allServersRaw          = [];
  let processedProjectState  = {};
  let chartInstance          = null;
  let chartLastLiveValue     = -1;
  let chartLastHistoryLen    = -1;
  let previousFirstProject   = null;
  let sharedHistory          = null;

  const SERVER_GROUPS = {
    'Корвакс':           ['Corvax'],
    'Санрайз':           ['РЫБЬЯ', 'LUST', 'SUNRISE', 'FIRE', 'PRIME'],
    'Империал':          ['Imperial', 'Spellward'],
    'Спейс Сторис':      ['Stories'],
    'Мёртвый Космос':    ['МЁРТВЫЙ'],
    'Губы':              ['Goob'],
    'Визарды':           ["Wizard's"],
    'СС220':             ['SS220'],
    'Время Приключений': ['Время'],
    'Сталкер':           ['Stalker'],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 1 — История (GitHub Actions → history.json)
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadSharedHistory() {
    try {
      const res = await fetch(HISTORY_URL + '?t=' + Math.floor(Date.now() / 30000));
      if (!res.ok) throw new Error();
      sharedHistory = await res.json();
    } catch {
      sharedHistory = null;
    }
  }

  function loadHistory(projectName) {
    if (!sharedHistory?.projects) return [];
    return sharedHistory.projects[projectName] || [];
  }

  function getMoscowDateStr() {
    return new Date().toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  }

  function getMoscowMidnight() {
    const str = getMoscowDateStr();
    const [day, month, year] = str.split('.').map(Number);
    return new Date(
      `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00+03:00`
    ).getTime();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 2 — Временная шкала (от 00:00 до сейчас + зеркальный отступ справа)
  // ═══════════════════════════════════════════════════════════════════════════

  function buildDayTimeline(history) {
    const sorted = [...history].sort((a, b) => a[0] - b[0]);
    const now    = Date.now();
    const live   = getLiveValue(currentlyOpenProject);
  
    // Если истории нет — одна живая точка
    if (sorted.length === 0) {
      const timeStr = new Date(now).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
      });
      return { labels: [timeStr, '', ''], data: [live, null, null] };
    }
  
    const labels = [];
    const data   = [];
  
    // Только реальные точки из Actions
    for (const [ts, val] of sorted) {
      labels.push(new Date(ts).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
      }));
      data.push(val);
    }
  
    // Живая точка "сейчас" если она новее последней записи
    const lastTs = sorted[sorted.length - 1][0];
    if (now - lastTs > 60_000) {
      labels.push(new Date(now).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
      }));
      data.push(live);
    } else {
      // Обновляем последнюю точку живым значением
      data[data.length - 1] = live;
    }
  
    // Правый отступ = столько же точек сколько реальных → линия по центру
    const realCount = data.length;
    for (let p = 1; p <= realCount; p++) {
      const ts = now + p * 5 * 60_000;
      labels.push(new Date(ts).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
      }));
      data.push(null);
    }
  
    return { labels, data };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 3 — Плагин пунктирных проекций на графике
  // ═══════════════════════════════════════════════════════════════════════════

  const projectionLinesPlugin = {
    id: 'projectionLines',
    afterDraw(chart) {
      const dataset = chart.data.datasets[0];
      if (!dataset) return;

      let lastIdx = -1;
      for (let i = dataset.data.length - 1; i >= 0; i--) {
        if (dataset.data[i] !== null && dataset.data[i] !== undefined) {
          lastIdx = i; break;
        }
      }
      if (lastIdx === -1) return;

      const meta  = chart.getDatasetMeta(0);
      const point = meta.data[lastIdx];
      if (!point) return;

      const px        = point.x;
      const py        = point.y;
      const ctx       = chart.ctx;
      const chartArea = chart.chartArea;

      ctx.save();

      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(59,165,93,0.30)';
      ctx.lineWidth   = 1;

      // Вертикальная линия вниз
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, chartArea.bottom);
      ctx.stroke();

      // Горизонтальная линия влево
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(chartArea.left, py);
      ctx.stroke();

      // Засечка на оси X
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(59,165,93,0.45)';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(px, chartArea.bottom - 4);
      ctx.lineTo(px, chartArea.bottom + 4);
      ctx.stroke();

      // Засечка на оси Y
      ctx.beginPath();
      ctx.moveTo(chartArea.left - 4, py);
      ctx.lineTo(chartArea.left + 4, py);
      ctx.stroke();

      // Кружок на точке
      ctx.fillStyle   = '#3ba55d';
      ctx.shadowColor = 'rgba(59,165,93,0.6)';
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 4 — Конфети при смене лидера
  // ═══════════════════════════════════════════════════════════════════════════

  function triggerConfetti(targetElement) {
    const rect    = targetElement.getBoundingClientRect();
    const centerX = rect.left + rect.width  / 2;
    const centerY = rect.top  + rect.height / 2;

    const canvas  = document.createElement('canvas');
    canvas.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      'width:100%', 'height:100%',
      'pointer-events:none', 'z-index:99999',
    ].join(';');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx2    = canvas.getContext('2d');
    const palette = [
      '#f0a500','#3ba55d','#ed4245','#e879f9',
      '#5865f2','#ffffff','#00b0f4','#ffd700','#ff6b6b',
    ];

    const particles = Array.from({ length: 72 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 7;
      return {
        x:     centerX,
        y:     centerY,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 2.5,
        color: palette[Math.floor(Math.random() * palette.length)],
        w:     4 + Math.random() * 7,
        h:     2 + Math.random() * 4,
        rot:   Math.random() * Math.PI * 2,
        rotV:  (Math.random() - 0.5) * 0.25,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
      };
    });

    const DURATION = 1600;
    let start = null;

    function animateConfetti(ts) {
      if (!start) start = ts;
      const elapsed  = ts - start;
      const progress = elapsed / DURATION;
      ctx2.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += 0.18;
        p.vx  *= 0.99;
        p.rot += p.rotV;
        const alpha = Math.max(0, 1 - progress * 1.1);
        ctx2.save();
        ctx2.globalAlpha = alpha;
        ctx2.fillStyle   = p.color;
        ctx2.translate(p.x, p.y);
        ctx2.rotate(p.rot);
        if (p.shape === 'rect') {
          ctx2.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx2.beginPath();
          ctx2.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx2.fill();
        }
        ctx2.restore();
      }

      if (elapsed < DURATION) requestAnimationFrame(animateConfetti);
      else canvas.remove();
    }

    requestAnimationFrame(animateConfetti);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 5 — График
  // ═══════════════════════════════════════════════════════════════════════════

  function getLiveValue(projectName) {
    let v = processedProjectState[projectName] ?? 0;
    if (projectName === 'Корвакс' && minecraftServerData?.online) {
      v += minecraftServerData.players.online;
    }
    return v;
  }

  function showChartPanel(projectName) {
    chartPanelTitle.textContent = projectName;
    chartPanel.classList.add('is-open');
    chartLastLiveValue  = -1;
    chartLastHistoryLen = -1;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    buildChart(projectName);
  }

  function hideChartPanel() {
    chartPanel.classList.remove('is-open');
    chartLastLiveValue  = -1;
    chartLastHistoryLen = -1;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  }

  function refreshChartIfOpen() {
    if (!currentlyOpenProject || !chartPanel.classList.contains('is-open')) return;
    const live    = getLiveValue(currentlyOpenProject);
    const histLen = loadHistory(currentlyOpenProject).length;
    if (live === chartLastLiveValue && histLen === chartLastHistoryLen) return;
    chartLastLiveValue  = live;
    chartLastHistoryLen = histLen;
    buildChart(currentlyOpenProject);
  }

  function updateChartStats(history, live) {
    const histValues = history.map(([, v]) => v);
    const maxStat    = histValues.length ? Math.max(...histValues, live) : live;
    const avgStat    = histValues.length
      ? Math.round(histValues.reduce((a, b) => a + b, 0) / histValues.length)
      : live;

    const elCurrent = document.getElementById('chart-stat-current');
    const elMax     = document.getElementById('chart-stat-max');
    const elAvg     = document.getElementById('chart-stat-avg');
    const elDate    = document.getElementById('chart-date-label');

    if (elCurrent) elCurrent.textContent = live;
    if (elMax)     elMax.textContent     = maxStat;
    if (elAvg)     elAvg.textContent     = avgStat;
    if (elDate) elDate.innerHTML = `График обновляется каждые 5 минут<br>Сутки МСК: ${getMoscowDateStr()}`;
  }

  function buildChart(projectName) {
    const history          = loadHistory(projectName);
    const live             = getLiveValue(projectName);
    const { labels, data } = buildDayTimeline(history);

    // Если график уже есть — просто обновляем данные без пересоздания
    if (chartInstance) {
      chartInstance.data.labels           = labels;
      chartInstance.data.datasets[0].data = data;

      const nonNullData = data.filter(v => v !== null);
      const maxVal      = nonNullData.length ? Math.max(...nonNullData, 1) : 10;
      const yMax        = Math.ceil(maxVal * 1.3) || 10;
      const stepSz      = Math.max(1, Math.ceil(maxVal / 5));
      chartInstance.options.scales.y.max              = yMax;
      chartInstance.options.scales.y.ticks.stepSize   = stepSz;
      chartInstance.update('none');

      updateChartStats(history, live);
      return;
    }

    // Первый рендер
    const ctx  = onlineChartCanvas.getContext('2d');
    const h    = onlineChartCanvas.offsetHeight || 200;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(59,165,93,0.38)');
    grad.addColorStop(1, 'rgba(59,165,93,0.02)');

    const nonNullData = data.filter(v => v !== null);
    const maxVal      = nonNullData.length ? Math.max(...nonNullData, 1) : 10;
    const yMax        = Math.ceil(maxVal * 1.3) || 10;
    const stepSz      = Math.max(1, Math.ceil(maxVal / 5));

    chartInstance = new Chart(ctx, {
      type: 'line',
      plugins: [projectionLinesPlugin],
      data: {
        labels,
        datasets: [{
          label:                'Онлайн',
          data,
          borderColor:          '#3ba55d',
          backgroundColor:      grad,
          borderWidth:          2,
          pointRadius:          0,
          pointHoverRadius:     5,
          pointBackgroundColor: '#3ba55d',
          fill:                 true,
          tension:              0.3,
          spanGaps:             false,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation:           false,
        interaction:         { mode: 'index', intersect: false },
        scales: {
          x: {
            ticks: {
              color:         '#484848',
              font:          { size: 10, family: 'Roboto' },
              maxTicksLimit: 13,
              maxRotation:   0,
              autoSkip:      true,
            },
            grid:   { color: 'rgba(255,255,255,0.03)' },
            border: { color: '#2a2a2a' },
          },
          y: {
            min:  0,
            max:  yMax,
            ticks: {
              color:    '#484848',
              font:     { size: 10, family: 'Roboto' },
              stepSize: stepSz,
            },
            grid:   { color: 'rgba(255,255,255,0.06)' },
            border: { color: '#2a2a2a' },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1a',
            borderColor:     '#303030',
            borderWidth:     1,
            titleColor:      '#888',
            bodyColor:       '#f0f0f0',
            titleFont:       { size: 11 },
            bodyFont:        { size: 13, weight: '700' },
            padding:         10,
            filter:          item => item.parsed.y !== null,
            callbacks: {
              title: items => items[0].label,
              label: ctx   => ` ${ctx.parsed.y} игроков`,
            },
          },
        },
      },
    });

    updateChartStats(history, live);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 6 — Fetch
  // ═══════════════════════════════════════════════════════════════════════════

  async function fetchMinecraftStatus() {
    try {
      const res = await fetch(MINECRAFT_API_URL);
      if (!res.ok) throw new Error();
      minecraftServerData = await res.json();
    } catch { minecraftServerData = null; }
  }

  async function fetchData() {
    try {
      await Promise.all([
        fetch(API_URL)
          .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json(); })
          .then(data => processData(data)),
        fetchMinecraftStatus(),
        loadSharedHistory(),
      ]);
      renderStats();
      if (currentMode === 'projects') renderFinalList();
      else renderHubList();
    } catch (err) {
      console.warn('Не удалось обновить данные.', err);
      serversListContainer.innerHTML =
        '<p class="loading-text">Не удалось загрузить данные. Попробуйте обновить страницу.</p>';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 7 — Process
  // ═══════════════════════════════════════════════════════════════════════════

  function processData(allServers) {
    allServersRaw = allServers;
    const currentProjectState = {};
    const newServerState      = {};
    groupedServers            = {};

    for (const name in SERVER_GROUPS) {
      groupedServers[name]      = [];
      currentProjectState[name] = 0;
    }

    for (const server of allServers) {
      if (!server?.statusData?.name || typeof server.statusData.players !== 'number') continue;
      const s = server.statusData;
      newServerState[s.name] = s.players;
      const nameLow = s.name.toLowerCase();
      for (const [proj, kws] of Object.entries(SERVER_GROUPS)) {
        if (kws.some(kw => nameLow.includes(kw.toLowerCase()))) {
          groupedServers[proj].push(s);
          currentProjectState[proj] += s.players;
          break;
        }
      }
    }

    processedProjectState = currentProjectState;
    pendingServerState    = newServerState;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 8 — Stats
  // ═══════════════════════════════════════════════════════════════════════════

  function renderStats() {
    let totalPlayers = 0, activeCount = 0, inactiveCount = 0, plus18Count = 0;
    for (const server of allServersRaw) {
      if (!server?.statusData) continue;
      const s       = server.statusData;
      const players = s.players || 0;
      const tags    = s.tags || [];
      const name    = (s.name || '').toLowerCase();
      totalPlayers += players;
      if (players > 0) activeCount++; else inactiveCount++;
      if (tags.includes('18+') || name.includes('18+')) plus18Count++;
    }
    if (minecraftServerData?.online) totalPlayers += minecraftServerData.players.online;
    document.getElementById('stat-total').textContent    = totalPlayers;
    document.getElementById('stat-active').textContent   = activeCount;
    document.getElementById('stat-inactive').textContent = inactiveCount;
    document.getElementById('stat-18plus').textContent   = plus18Count;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 9 — Projects mode
  // ═══════════════════════════════════════════════════════════════════════════

  function renderFinalList() {
    const cur = { ...processedProjectState };

    if (minecraftServerData?.online) {
      const mc = minecraftServerData.players.online;
      cur['Корвакс'] = (cur['Корвакс'] || 0) + mc;
      if (!groupedServers['Корвакс']) groupedServers['Корвакс'] = [];
      groupedServers['Корвакс'] = groupedServers['Корвакс'].filter(s => s.name !== 'Corvax Craft');
      groupedServers['Корвакс'].push({ name: 'Corvax Craft', players: mc, isMinecraft: true });
      pendingServerState['Corvax Craft'] = mc;
    }

    const sorted = Object.entries(cur).sort(([, a], [, b]) => b - a);
    renderProjectList(sorted, previousProjectState);

    if (currentlyOpenProject) {
      if (!cur[currentlyOpenProject] && !groupedServers[currentlyOpenProject]?.length) {
        hideDetailsPanel();
      } else {
        renderDetailsPanel(currentlyOpenProject);
        refreshChartIfOpen();
      }
    }

    previousProjectState = { ...cur };
    previousServerState  = { ...pendingServerState };
  }

  function renderProjectList(sortedProjects, oldState) {
    if (sortedProjects.length === 0) {
      serversListContainer.innerHTML = '<p class="loading-text">Нет доступных проектов.</p>';
      previousFirstProject = null;
      return;
    }

    // FLIP шаг 1 — запоминаем старые позиции
    const oldPositions = new Map();
    const oldRanks     = new Map();
    serversListContainer
      .querySelectorAll('.server-entry[data-project-name]')
      .forEach((el, i) => {
        oldPositions.set(el.dataset.projectName, el.getBoundingClientRect());
        oldRanks.set(el.dataset.projectName, i);
      });

    const frag = document.createDocumentFragment();
    sortedProjects.forEach(([name, online], i) => {
      const div = document.createElement('div');
      div.className = 'server-entry';
      div.dataset.projectName = name;
      if (online === 0) div.classList.add('offline');

      const rankClass = i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : '';
      const icon = online === 0 ? '☠' : '<i class="fa-solid fa-user"></i>';

      div.innerHTML = `
        <div class="server-name-container">
          <span class="rank-badge ${rankClass}">${i + 1}</span>
          <span class="server-name-text">${name}</span>
        </div>
        <div class="player-count-wrapper">
          <div class="player-count">${online} ${icon}</div>
        </div>`;

      applyAnim(div, online, oldState[name]);
      frag.appendChild(div);
    });

    serversListContainer.innerHTML = '';
    serversListContainer.appendChild(frag);

    // FLIP шаг 2 — анимируем перемещения
    const newElements = [...serversListContainer.querySelectorAll('.server-entry[data-project-name]')];
    newElements.forEach((el, newIdx) => {
      const name   = el.dataset.projectName;
      const oldPos = oldPositions.get(name);
      if (!oldPos) return;
      const newPos = el.getBoundingClientRect();
      const deltaY = oldPos.top - newPos.top;
      if (Math.abs(deltaY) < 1) return;

      const oldRank  = oldRanks.has(name) ? oldRanks.get(name) : newIdx;
      const movingUp = newIdx < oldRank;

      el.style.position   = 'relative';
      el.style.zIndex     = movingUp ? '3' : '1';
      el.style.transition = 'none';
      el.style.transform  = `translateY(${deltaY}px) scale(${movingUp ? 1.04 : 0.96})`;

      void el.offsetHeight;

      el.style.transition = 'transform 0.44s cubic-bezier(0.4, 0, 0.2, 1)';
      el.style.transform  = 'translateY(0) scale(1)';

      setTimeout(() => {
        el.style.transition = '';
        el.style.transform  = '';
        el.style.zIndex     = '';
        el.style.position   = '';
      }, 450);
    });

    // Конфети при смене лидера
    const newFirst = sortedProjects[0]?.[0] ?? null;
    if (previousFirstProject !== null && newFirst && newFirst !== previousFirstProject) {
      const firstEl = newElements[0];
      if (firstEl) setTimeout(() => triggerConfetti(firstEl), 30);
    }
    previousFirstProject = newFirst ?? previousFirstProject;
  }

  function renderDetailsPanel(projectName) {
    const servers = (groupedServers[projectName] || []).slice().sort((a, b) => b.players - a.players);
    detailsServerList.innerHTML = '';
    panelTitle.textContent = projectName;

    if (servers.length === 0) {
      detailsServerList.innerHTML = '<p class="loading-text">Нет активных серверов.</p>';
      return;
    }
    servers.forEach(server => {
      const online = server.players;
      const div    = document.createElement('div');
      div.className = 'server-entry';
      if (server.isMinecraft) div.classList.add('minecraft-server');
      if (online === 0) div.classList.add('offline');
      div.style.cursor = 'default';

      const icon   = online === 0 ? '☠' : '<i class="fa-solid fa-user"></i>';
      const prefix = server.isMinecraft
        ? '<i class="fa-solid fa-cube" style="color:#cd7f32;margin-right:4px"></i>' : '';

      div.innerHTML = `
        <div class="server-name-container">${prefix}
          <span class="server-name-text">${server.name}</span>
        </div>
        <div class="player-count-wrapper">
          <div class="player-count">${online} ${icon}</div>
        </div>`;

      applyAnim(div, online, previousServerState[server.name]);
      detailsServerList.appendChild(div);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 10 — Hub mode
  // ═══════════════════════════════════════════════════════════════════════════

  function renderHubList() {
    let servers = allServersRaw
      .filter(s => s?.statusData?.name)
      .map(s => ({ ...s.statusData, address: s.address }))
      .sort((a, b) => (b.players || 0) - (a.players || 0));

    if (minecraftServerData?.online) {
      const mc = {
        name: 'Corvax Craft', players: minecraftServerData.players.online,
        isMinecraft: true, address: 'corvaxcraft.ru', map: 'Minecraft', tags: [],
      };
      const idx = servers.findIndex(s => (s.players || 0) < mc.players);
      if (idx === -1) servers.push(mc); else servers.splice(idx, 0, mc);
      pendingServerState['Corvax Craft'] = mc.players;
    }

    if (servers.length === 0) {
      serversListContainer.innerHTML = '<p class="loading-text">Нет серверов.</p>';
      previousServerState = { ...pendingServerState };
      return;
    }

    const frag = document.createDocumentFragment();
    servers.forEach(server => {
      const online = server.players || 0;
      const tags   = server.tags || [];
      const is18   = tags.includes('18+') || (server.name || '').toLowerCase().includes('18+');

      const div = document.createElement('div');
      div.className = 'server-entry hub-entry';
      if (online === 0) div.classList.add('offline');

      const icon   = online === 0 ? '☠' : '<i class="fa-solid fa-user"></i>';
      const mcIcon = server.isMinecraft
        ? '<i class="fa-solid fa-cube" style="color:#cd7f32;margin-right:5px"></i>' : '';

      const displayTags = tags
        .filter(t => t !== '18+').slice(0, 4)
        .map(t => `<span class="hub-tag-small">${t}</span>`).join('');
      const badge18 = is18 ? '<span class="badge-18">18+</span>' : '';

      div.innerHTML = `
        <div class="server-name-container hub-name-col">
          ${mcIcon}
          <div class="hub-name-wrap">
            <span class="server-name-text">${server.name}</span>
            <div class="hub-meta-row">${displayTags}${badge18}</div>
          </div>
        </div>
        <div class="player-count-wrapper">
          <div class="player-count">${online} ${icon}</div>
        </div>`;

      applyAnim(div, online, previousServerState[server.name]);
      div.addEventListener('click', () => showHubServerDetails(server));
      frag.appendChild(div);
    });

    serversListContainer.innerHTML = '';
    serversListContainer.appendChild(frag);

    if (currentlyOpenHubServer && detailsPanel.classList.contains('is-open')) {
      const updated = servers.find(s => s.name === currentlyOpenHubServer);
      if (updated) showHubServerDetails(updated); else hideDetailsPanel();
    }

    previousServerState = { ...pendingServerState };
  }

  function showHubServerDetails(server) {
    currentlyOpenHubServer = server.name;
    const tags     = server.tags || [];
    const is18     = tags.includes('18+') || (server.name || '').toLowerCase().includes('18+');
    const runMap   = { 0: 'Лобби', 1: 'Идёт раунд', 2: 'Конец раунда' };
    const runLevel = typeof server.run_level !== 'undefined' ? (runMap[server.run_level] ?? '—') : null;

    const tagsHtml = tags.length
      ? tags.map(t => `<span class="tag-badge">${t}</span>`).join('')
      : '<span class="no-data">нет тегов</span>';

    const roundStart = server.round_start_time
      ? (() => {
          const diff = Math.floor((Date.now() - new Date(server.round_start_time)) / 60000);
          return diff < 60 ? `${diff} мин` : `${Math.floor(diff / 60)}ч ${diff % 60} мин`;
        })()
      : null;

    panelTitle.textContent = 'О сервере';
    detailsServerList.innerHTML = `
      <div class="hub-detail">
        <div class="hub-detail-name">
          ${server.isMinecraft ? '<i class="fa-solid fa-cube" style="color:#cd7f32;margin-right:7px"></i>' : ''}
          ${server.name}
        </div>
        ${is18 ? '<div class="hub-18badge">🔞 ЕРП сервер (18+)</div>' : ''}
        <div class="hub-detail-grid">
          <div class="hub-detail-row">
            <span class="hdl"><i class="fa-solid fa-users"></i> Игроки</span>
            <span class="hdv">${server.players}${server.soft_max_players ? ' / ' + server.soft_max_players : ''}</span>
          </div>
          ${server.map ? `<div class="hub-detail-row"><span class="hdl"><i class="fa-solid fa-map"></i> Карта</span><span class="hdv">${server.map}</span></div>` : ''}
          ${server.preset ? `<div class="hub-detail-row"><span class="hdl"><i class="fa-solid fa-dice"></i> Пресет</span><span class="hdv">${server.preset}</span></div>` : ''}
          ${runLevel ? `<div class="hub-detail-row"><span class="hdl"><i class="fa-solid fa-circle-play"></i> Статус</span><span class="hdv">${runLevel}</span></div>` : ''}
          ${roundStart ? `<div class="hub-detail-row"><span class="hdl"><i class="fa-solid fa-clock"></i> Раунд идёт</span><span class="hdv">${roundStart}</span></div>` : ''}
          ${server.round_id ? `<div class="hub-detail-row"><span class="hdl"><i class="fa-solid fa-hashtag"></i> Раунд</span><span class="hdv">#${server.round_id}</span></div>` : ''}
          ${typeof server.panic_bunker !== 'undefined' ? `
          <div class="hub-detail-row">
            <span class="hdl"><i class="fa-solid fa-shield-halved"></i> Паник-бункер</span>
            <span class="hdv ${server.panic_bunker ? 'hdv-danger' : 'hdv-safe'}">${server.panic_bunker ? '⚠ Включён' : 'Выключен'}</span>
          </div>` : ''}
        </div>
        <div class="hub-detail-section">
          <div class="hub-section-lbl">Теги</div>
          <div class="hub-tags-wrap">${tagsHtml}</div>
        </div>
        ${server.address ? `<div class="hub-detail-section"><div class="hub-section-lbl">Адрес</div><div class="hub-address-text">${server.address}</div></div>` : ''}
      </div>`;

    detailsPanel.classList.add('is-open');
    detailsOverlay.classList.add('is-open');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 11 — Animations
  // ═══════════════════════════════════════════════════════════════════════════

  function applyAnim(div, current, previous) {
    if (typeof previous === 'undefined') return;
    const countEl = div.querySelector('.player-count');
    if (!countEl) return;
    if (current > previous) {
      div.classList.add('flash-up');
      countEl.classList.add('anim-increase');
    } else if (current < previous) {
      div.classList.add('flash-down');
      countEl.classList.add('anim-decrease');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 12 — Panel helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function showDetailsPanel(projectName) {
    currentlyOpenProject = projectName;
    renderDetailsPanel(projectName);
    detailsPanel.classList.add('is-open');
    detailsOverlay.classList.add('is-open');
    showChartPanel(projectName);
  }

  function hideDetailsPanel() {
    currentlyOpenProject   = null;
    currentlyOpenHubServer = null;
    detailsPanel.classList.remove('is-open');
    detailsOverlay.classList.remove('is-open');
    hideChartPanel();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 13 — Click handlers
  // ═══════════════════════════════════════════════════════════════════════════

  serversListContainer.addEventListener('click', event => {
    if (currentMode === 'hub') return;
    const entry = event.target.closest('.server-entry');
    if (!entry?.dataset.projectName) return;
    const name = entry.dataset.projectName;
    if (!groupedServers[name]?.length) return;

    if (detailsPanel.classList.contains('is-open')) {
      if (currentlyOpenProject !== name) {
        currentlyOpenProject = name;
        renderDetailsPanel(name);
        showChartPanel(name);
      }
    } else {
      showDetailsPanel(name);
    }
  });

  tabProjects.addEventListener('click', () => {
    if (currentMode === 'projects') return;
    currentMode = 'projects';
    tabProjects.classList.add('active');
    tabHub.classList.remove('active');
    hideDetailsPanel();
    renderFinalList();
  });

  tabHub.addEventListener('click', () => {
    if (currentMode === 'hub') return;
    currentMode = 'hub';
    tabHub.classList.add('active');
    tabProjects.classList.remove('active');
    hideDetailsPanel();
    if (allServersRaw.length > 0) renderHubList();
    else serversListContainer.innerHTML = '<p class="loading-text">Загрузка...</p>';
  });

  closePanelBtn.addEventListener('click',  hideDetailsPanel);
  detailsOverlay.addEventListener('click', hideDetailsPanel);

  // ═══════════════════════════════════════════════════════════════════════════
  // БЛОК 14 — Clock
  // ═══════════════════════════════════════════════════════════════════════════

  function updateClock() {
    const now = new Date();
    const d   = now.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow',
    });
    const t   = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow',
    });
    currentTimeElement.textContent = `${d} ${t}`;
  }

  fetchData();
  setInterval(fetchData, 5000);
  updateClock();
  setInterval(updateClock, 1000);
});


