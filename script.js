document.addEventListener('DOMContentLoaded', () => {

  const API_URL = 'https://hub.spacestation14.com/api/servers';
  const MINECRAFT_API_URL = 'https://api.mcstatus.io/v2/status/java/corvaxcraft.ru';

  const serversListContainer = document.getElementById('servers-list');
  const currentTimeElement = document.getElementById('current-time');
  const detailsPanel = document.getElementById('details-panel');
  const detailsOverlay = document.getElementById('details-overlay');
  const panelTitle = document.getElementById('panel-title');
  const detailsServerList = document.getElementById('details-server-list');
  const closePanelBtn = document.getElementById('close-panel-btn');
  const tabProjects = document.getElementById('tab-projects');
  const tabHub = document.getElementById('tab-hub');

  let currentMode = 'projects';
  let previousProjectState = {};
  let previousServerState = {};
  let pendingServerState = {};
  let groupedServers = {};
  let currentlyOpenProject = null;
  let currentlyOpenHubServer = null;
  let minecraftServerData = null;
  let allServersRaw = [];
  let processedProjectState = {};

  const SERVER_GROUPS = {
    'Корвакс': ['Corvax'],
    'Санрайз': ['РЫБЬЯ', 'LUST', 'SUNRISE', 'FIRE', 'PRIME'],
    'Империал': ['Imperial', 'Spellward'],
    'Спейс Сторис': ['Stories'],
    'Мёртвый Космос': ['МЁРТВЫЙ'],
    'Губы': ['Goob'],
    'Визарды': ["Wizard's"],
    'СС220': ['SS220'],
    'Время Приключений': ['Время']
  };

  // ─── Fetch ────────────────────────────────────────────────────────────────

  async function fetchMinecraftStatus() {
    try {
      const res = await fetch(MINECRAFT_API_URL);
      if (!res.ok) throw new Error();
      minecraftServerData = await res.json();
    } catch {
      minecraftServerData = null;
    }
  }

  async function fetchData() {
    try {
      await Promise.all([
        fetch(API_URL).then(res => {
          if (!res.ok) throw new Error(`${res.status}`);
          return res.json();
        }).then(data => processData(data)),
        fetchMinecraftStatus()
      ]);

      renderStats();

      if (currentMode === 'projects') renderFinalList();
      else renderHubList();

    } catch (err) {
      console.warn('Не удалось обновить данные.', err);
      serversListContainer.innerHTML = '<p class="loading-text">Не удалось загрузить данные. Попробуйте обновить страницу.</p>';
    }
  }

  // ─── Process ──────────────────────────────────────────────────────────────

  function processData(allServers) {
    allServersRaw = allServers;
    const currentProjectState = {};
    const newServerState = {};
    groupedServers = {};

    for (const name in SERVER_GROUPS) {
      groupedServers[name] = [];
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
    pendingServerState = newServerState;
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  function renderStats() {
    let totalPlayers = 0, activeCount = 0, inactiveCount = 0, plus18Count = 0;

    for (const server of allServersRaw) {
      if (!server?.statusData) continue;
      const s = server.statusData;
      const players = s.players || 0;
      const tags = s.tags || [];
      const name = (s.name || '').toLowerCase();

      totalPlayers += players;
      if (players > 0) activeCount++; else inactiveCount++;
      if (tags.includes('18+') || name.includes('18+')) plus18Count++;
    }

    if (minecraftServerData?.online) {
      totalPlayers += minecraftServerData.players.online;
    }

    document.getElementById('stat-total').textContent = totalPlayers;
    document.getElementById('stat-active').textContent = activeCount;
    document.getElementById('stat-inactive').textContent = inactiveCount;
    document.getElementById('stat-18plus').textContent = plus18Count;
  }

  // ─── Projects mode ────────────────────────────────────────────────────────

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
      if (!cur[currentlyOpenProject] || !groupedServers[currentlyOpenProject]?.length) {
        hideDetailsPanel();
      } else {
        renderDetailsPanel(currentlyOpenProject);
      }
    }

    previousProjectState = { ...cur };
    previousServerState = { ...pendingServerState };
  }

  function renderProjectList(sortedProjects, oldState) {
    if (sortedProjects.length === 0) {
      serversListContainer.innerHTML = '<p class="loading-text">Нет доступных проектов.</p>';
      return;
    }
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
      const div = document.createElement('div');
      div.className = 'server-entry';
      if (server.isMinecraft) div.classList.add('minecraft-server');
      if (online === 0) div.classList.add('offline');
      div.style.cursor = 'default';

      const icon = online === 0 ? '☠' : '<i class="fa-solid fa-user"></i>';
      const prefix = server.isMinecraft
        ? '<i class="fa-solid fa-cube" style="color:#cd7f32;margin-right:4px"></i>'
        : '';

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

  // ─── Hub mode ─────────────────────────────────────────────────────────────

  function renderHubList() {
    let servers = allServersRaw
      .filter(s => s?.statusData?.name)
      .map(s => ({ ...s.statusData, address: s.address }))
      .sort((a, b) => (b.players || 0) - (a.players || 0));

    if (minecraftServerData?.online) {
      const mc = {
        name: 'Corvax Craft', players: minecraftServerData.players.online,
        isMinecraft: true, address: 'corvaxcraft.ru', map: 'Minecraft', tags: []
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
      const tags = server.tags || [];
      const is18 = tags.includes('18+') || (server.name || '').toLowerCase().includes('18+');

      const div = document.createElement('div');
      div.className = 'server-entry hub-entry';
      if (online === 0) div.classList.add('offline');

      const icon = online === 0 ? '☠' : '<i class="fa-solid fa-user"></i>';
      const mcIcon = server.isMinecraft
        ? '<i class="fa-solid fa-cube" style="color:#cd7f32;margin-right:5px"></i>'
        : '';

      // Теги без 18+ (у него отдельный бейдж), до 4 штук
      const displayTags = tags
        .filter(t => t !== '18+')
        .slice(0, 4)
        .map(t => `<span class="hub-tag-small">${t}</span>`)
        .join('');

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
      if (updated) showHubServerDetails(updated);
      else hideDetailsPanel();
    }

    previousServerState = { ...pendingServerState };
  }

  function showHubServerDetails(server) {
    currentlyOpenHubServer = server.name;
    const tags = server.tags || [];
    const is18 = tags.includes('18+') || (server.name || '').toLowerCase().includes('18+');
    const runMap = { 0: 'Лобби', 1: 'Идёт раунд', 2: 'Конец раунда' };
    const runLevel = typeof server.run_level !== 'undefined'
      ? (runMap[server.run_level] ?? '—')
      : null;

    const tagsHtml = tags.length
      ? tags.map(t => `<span class="tag-badge">${t}</span>`).join('')
      : '<span class="no-data">нет тегов</span>';

    const roundStart = server.round_start_time
      ? (() => {
          const diff = Math.floor((Date.now() - new Date(server.round_start_time)) / 60000);
          return diff < 60
            ? `${diff} мин`
            : `${Math.floor(diff / 60)}ч ${diff % 60} мин`;
        })()
      : null;

    panelTitle.textContent = 'О сервере';
    detailsServerList.innerHTML = `
      <div class="hub-detail">
        <div class="hub-detail-name">
          ${server.isMinecraft ? '<i class="fa-solid fa-cube" style="color:#cd7f32;margin-right:7px"></i>' : ''}
          ${server.name}
        </div>
        ${is18 ? '<div class="hub-18badge">🔞 Сервер для взрослых (18+)</div>' : ''}

        <div class="hub-detail-grid">
          <div class="hub-detail-row">
            <span class="hdl"><i class="fa-solid fa-users"></i> Игроки</span>
            <span class="hdv">${server.players}${server.soft_max_players ? ' / ' + server.soft_max_players : ''}</span>
          </div>
          ${server.map ? `<div class="hub-detail-row">
            <span class="hdl"><i class="fa-solid fa-map"></i> Карта</span>
            <span class="hdv">${server.map}</span>
          </div>` : ''}
          ${server.preset ? `<div class="hub-detail-row">
            <span class="hdl"><i class="fa-solid fa-dice"></i> Пресет</span>
            <span class="hdv">${server.preset}</span>
          </div>` : ''}
          ${runLevel ? `<div class="hub-detail-row">
            <span class="hdl"><i class="fa-solid fa-circle-play"></i> Статус</span>
            <span class="hdv">${runLevel}</span>
          </div>` : ''}
          ${roundStart ? `<div class="hub-detail-row">
            <span class="hdl"><i class="fa-solid fa-clock"></i> Раунд идёт</span>
            <span class="hdv">${roundStart}</span>
          </div>` : ''}
          ${server.round_id ? `<div class="hub-detail-row">
            <span class="hdl"><i class="fa-solid fa-hashtag"></i> Раунд</span>
            <span class="hdv">#${server.round_id}</span>
          </div>` : ''}
          ${typeof server.panic_bunker !== 'undefined' ? `<div class="hub-detail-row">
            <span class="hdl"><i class="fa-solid fa-shield-halved"></i> Паник-бункер</span>
            <span class="hdv ${server.panic_bunker ? 'hdv-danger' : 'hdv-safe'}">${server.panic_bunker ? '⚠ Включён' : 'Выключен'}</span>
          </div>` : ''}
        </div>

        <div class="hub-detail-section">
          <div class="hub-section-lbl">Теги</div>
          <div class="hub-tags-wrap">${tagsHtml}</div>
        </div>

        ${server.address ? `<div class="hub-detail-section">
          <div class="hub-section-lbl">Адрес</div>
          <div class="hub-address-text">${server.address}</div>
        </div>` : ''}
      </div>`;

    detailsPanel.classList.add('is-open');
    detailsOverlay.classList.add('is-open');
  }

  // ─── Animations ───────────────────────────────────────────────────────────

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

  // ─── Panel helpers ────────────────────────────────────────────────────────

  function showDetailsPanel(projectName) {
    currentlyOpenProject = projectName;
    renderDetailsPanel(projectName);
    detailsPanel.classList.add('is-open');
    detailsOverlay.classList.add('is-open');
  }

  function hideDetailsPanel() {
    currentlyOpenProject = null;
    currentlyOpenHubServer = null;
    detailsPanel.classList.remove('is-open');
    detailsOverlay.classList.remove('is-open');
  }

  // ─── Click handlers ───────────────────────────────────────────────────────

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

  closePanelBtn.addEventListener('click', hideDetailsPanel);
  detailsOverlay.addEventListener('click', hideDetailsPanel);

  // ─── Clock ────────────────────────────────────────────────────────────────

  function updateClock() {
    const now = new Date();
    const d = now.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow'
    });
    const t = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow'
    });
    currentTimeElement.textContent = `${d} ${t}`;
  }

  fetchData();
  setInterval(fetchData, 5000);
  updateClock();
  setInterval(updateClock, 1000);
});

