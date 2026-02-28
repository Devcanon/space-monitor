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

  let previousProjectState = {};
  let previousServerState = {};
  let groupedServers = {};
  let currentlyOpenProject = null;
  let minecraftServerData = null;

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

  async function fetchMinecraftStatus() {
    try {
      const response = await fetch(MINECRAFT_API_URL);
      if (!response.ok) throw new Error(`Ошибка: ${response.status}`);
      minecraftServerData = await response.json();
    } catch (error) {
      console.warn("Не удалось получить данные Minecraft сервера.", error);
      minecraftServerData = null;
    }
  }

  async function fetchData() {
    try {
      await Promise.all([
        fetch(API_URL).then(res => {
          if (!res.ok) throw new Error(`Сетевая ошибка: ${res.status}`);
          return res.json();
        }).then(data => processData(data)),
        fetchMinecraftStatus()
      ]);
      renderFinalList();
    } catch (error) {
      console.warn("Не удалось обновить данные.", error);
      serversListContainer.innerHTML = '<p class="loading-text">Не удалось загрузить данные. Попробуйте обновить страницу.</p>';
    }
  }

  let processedProjectState = {};

  function processData(allServers) {
    const currentProjectState = {};
    const currentServerState = {};
    groupedServers = {};

    for (const projectName in SERVER_GROUPS) {
      groupedServers[projectName] = [];
      currentProjectState[projectName] = 0;
    }

    for (const server of allServers) {
      if (server && server.statusData && server.statusData.name && typeof server.statusData.players === 'number') {
        const status = server.statusData;
        currentServerState[status.name] = status.players;

        const serverNameLower = status.name.toLowerCase();
        for (const [projectName, keywords] of Object.entries(SERVER_GROUPS)) {
          if (keywords.some(keyword => serverNameLower.includes(keyword.toLowerCase()))) {
            groupedServers[projectName].push(status);
            currentProjectState[projectName] += status.players;
            break;
          }
        }
      }
    }

    processedProjectState = currentProjectState;
    previousServerState = { ...currentServerState };
  }

  function renderFinalList() {
    const currentProjectState = { ...processedProjectState };

    if (minecraftServerData && minecraftServerData.online) {
      const mcPlayers = minecraftServerData.players.online;
      currentProjectState['Корвакс'] = (currentProjectState['Корвакс'] || 0) + mcPlayers;

      if (!groupedServers['Корвакс']) groupedServers['Корвакс'] = [];

      groupedServers['Корвакс'] = groupedServers['Корвакс'].filter(s => s.name !== 'Corvax Craft');
      groupedServers['Корвакс'].push({ name: 'Corvax Craft', players: mcPlayers, isMinecraft: true });
      previousServerState['Corvax Craft'] = mcPlayers;
    }

    const sortedProjects = Object.entries(currentProjectState).sort(([, a], [, b]) => b - a);
    renderProjectList(sortedProjects, previousProjectState);

    if (currentlyOpenProject) {
      if (
        currentProjectState[currentlyOpenProject] === 0 ||
        !groupedServers[currentlyOpenProject] ||
        groupedServers[currentlyOpenProject].length === 0
      ) {
        hideDetailsPanel();
      } else {
        renderDetailsPanel(currentlyOpenProject);
      }
    }

    previousProjectState = { ...currentProjectState };
  }

  // Применяет анимацию к элементу .player-count
  function applyCountAnimation(entryDiv, currentOnline, previousOnline) {
    if (typeof previousOnline === 'undefined') return;
    const countEl = entryDiv.querySelector('.player-count');
    if (!countEl) return;

    if (currentOnline > previousOnline) {
      entryDiv.classList.add('flash-up');
      countEl.classList.add('anim-increase');
    } else if (currentOnline < previousOnline) {
      entryDiv.classList.add('flash-down');
      countEl.classList.add('anim-decrease');
    }
  }

  function renderProjectList(sortedProjects, oldState) {
    const fragment = document.createDocumentFragment();
    if (sortedProjects.length === 0) {
      serversListContainer.innerHTML = '<p class="loading-text">Нет доступных проектов.</p>';
      return;
    }
    sortedProjects.forEach(([projectName, currentOnline], index) => {
      const entryDiv = document.createElement('div');
      entryDiv.className = 'server-entry';
      entryDiv.dataset.projectName = projectName;

      if (currentOnline === 0) entryDiv.classList.add('offline');

      const rankClass =
        index === 0 ? 'rank-gold' :
        index === 1 ? 'rank-silver' :
        index === 2 ? 'rank-bronze' : '';

      const iconHtml = currentOnline === 0 ? '☠' : '<i class="fa-solid fa-user"></i>';

      entryDiv.innerHTML = `
        <div class="server-name-container">
          <span class="rank-badge ${rankClass}">${index + 1}</span>
          <span class="server-name-text">${projectName}</span>
        </div>
        <div class="player-count-wrapper">
          <div class="player-count">${currentOnline} ${iconHtml}</div>
        </div>`;

      applyCountAnimation(entryDiv, currentOnline, oldState[projectName]);
      fragment.appendChild(entryDiv);
    });
    serversListContainer.innerHTML = '';
    serversListContainer.appendChild(fragment);
  }

  function renderDetailsPanel(projectName) {
    const servers = (groupedServers[projectName] || []).sort((a, b) => b.players - a.players);
    detailsServerList.innerHTML = '';
    panelTitle.textContent = projectName;

    if (servers.length === 0) {
      detailsServerList.innerHTML = '<p class="loading-text">Нет активных серверов в этом проекте.</p>';
      return;
    }

    servers.forEach(server => {
      const currentOnline = server.players;
      const entryDiv = document.createElement('div');
      entryDiv.className = 'server-entry';
      if (server.isMinecraft) entryDiv.classList.add('minecraft-server');
      if (currentOnline === 0) entryDiv.classList.add('offline');
      entryDiv.style.cursor = 'default';

      const iconHtml = currentOnline === 0 ? '☠' : '<i class="fa-solid fa-user"></i>';
      const namePrefix = server.isMinecraft
        ? '<i class="fa-solid fa-cube" style="color: #cd7f32; margin-right: 4px;"></i>'
        : '';

      entryDiv.innerHTML = `
        <div class="server-name-container">
          ${namePrefix}
          <span class="server-name-text">${server.name}</span>
        </div>
        <div class="player-count-wrapper">
          <div class="player-count">${currentOnline} ${iconHtml}</div>
        </div>`;

      applyCountAnimation(entryDiv, currentOnline, previousServerState[server.name]);
      detailsServerList.appendChild(entryDiv);
    });
  }

  function showDetailsPanel(projectName) {
    currentlyOpenProject = projectName;
    renderDetailsPanel(projectName);
    detailsPanel.classList.add('is-open');
    detailsOverlay.classList.add('is-open');
  }

  function hideDetailsPanel() {
    currentlyOpenProject = null;
    detailsPanel.classList.remove('is-open');
    detailsOverlay.classList.remove('is-open');
  }

  serversListContainer.addEventListener('click', (event) => {
    const serverEntry = event.target.closest('.server-entry');
    if (serverEntry && serverEntry.dataset.projectName) {
      const newProjectName = serverEntry.dataset.projectName;
      if (!groupedServers[newProjectName] || groupedServers[newProjectName].length === 0) return;

      if (detailsPanel.classList.contains('is-open')) {
        if (currentlyOpenProject !== newProjectName) {
          currentlyOpenProject = newProjectName;
          renderDetailsPanel(newProjectName);
        }
      } else {
        showDetailsPanel(newProjectName);
      }
    }
  });

  closePanelBtn.addEventListener('click', hideDetailsPanel);
  detailsOverlay.addEventListener('click', hideDetailsPanel);

  function updateClock() {
    const now = new Date();
    const optionsDate = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow' };
    const mskDate = now.toLocaleDateString('ru-RU', optionsDate);
    const mskTime = now.toLocaleTimeString('ru-RU', optionsTime);
    currentTimeElement.textContent = `${mskDate} ${mskTime}`;
  }

  fetchData();
  setInterval(fetchData, 5000);
  updateClock();
  setInterval(updateClock, 1000);
});
