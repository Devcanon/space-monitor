document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'https://hub.spacestation14.com/api/servers';
    const serversListContainer = document.getElementById('servers-list');

    const detailsPanel = document.getElementById('details-panel');
    const detailsOverlay = document.getElementById('details-overlay');
    const panelTitle = document.getElementById('panel-title');
    const detailsServerList = document.getElementById('details-server-list');
    const closePanelBtn = document.getElementById('close-panel-btn');

    let previousProjectState = {};
    let previousServerState = {};
    let groupedServers = {};
    let currentlyOpenProject = null;

    const SERVER_GROUPS = {
        'Корвакс': ['Corvax'], 'Санрайз': ['РЫБЬЯ', 'LUST', 'SUNRISE', 'FIRE', 'PRIME'],
        'Империал': ['Imperial'], 'Спейс Сторис': ['Stories'], 'Мёртвый Космос': ['МЁРТВЫЙ'],
        'Губы': ['Goob'], 'Визарды': ["Wizard's"], 'СС220': ['SS220'],
        'Время Приключений': ['Время']
    };

    async function fetchData() { try { const response = await fetch(API_URL); if (!response.ok) throw new Error(`Сетевая ошибка: ${response.status}`); const allServers = await response.json(); processData(allServers); } catch (error) { console.warn("Не удалось обновить данные.", error); } }
    function processData(allServers) { const currentProjectState = {}; const currentServerState = {}; groupedServers = {}; for (const projectName in SERVER_GROUPS) { groupedServers[projectName] = []; currentProjectState[projectName] = 0; } for (const server of allServers) { if (server && server.statusData && server.statusData.name && typeof server.statusData.players === 'number') { const status = server.statusData; currentServerState[status.name] = status.players; const serverNameLower = status.name.toLowerCase(); for (const [projectName, keywords] of Object.entries(SERVER_GROUPS)) { if (keywords.some(keyword => serverNameLower.includes(keyword.toLowerCase()))) { groupedServers[projectName].push(status); currentProjectState[projectName] += status.players; break; } } } } const sortedProjects = Object.entries(currentProjectState).sort(([, a], [, b]) => b - a); renderProjectList(sortedProjects, previousProjectState); if (currentlyOpenProject) { renderDetailsPanel(currentlyOpenProject); } previousProjectState = { ...currentProjectState }; previousServerState = { ...currentServerState }; }
    function createGhost(wrapper, type, sign) { const ghostEl = document.createElement('div'); ghostEl.className = `player-count-ghost ${type}`; ghostEl.innerHTML = `${sign} <i class="fa-solid fa-user"></i>`; wrapper.appendChild(ghostEl); const animationDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--animation-duration')) * 1000; setTimeout(() => { if (ghostEl.parentNode === wrapper) { wrapper.removeChild(ghostEl); } }, animationDuration); }

    function renderProjectList(sortedProjects, oldState) {
        const fragment = document.createDocumentFragment();
        sortedProjects.forEach(([projectName, currentOnline]) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'server-entry';
            entryDiv.dataset.projectName = projectName;

            const iconHtml = currentOnline === 0
                ? '☠'
                : '<i class="fa-solid fa-user"></i>'; 

            entryDiv.innerHTML = `<div class="server-name-container"><span class="server-name-text">${projectName}</span></div><div class="player-count-wrapper"><div class="player-count">${currentOnline} ${iconHtml}</div></div>`;

            const wrapper = entryDiv.querySelector('.player-count-wrapper');
            const previousOnline = oldState[projectName];
            if (typeof previousOnline !== 'undefined') {
                if (currentOnline > previousOnline) {
                    entryDiv.classList.add('flash-up');
                    createGhost(wrapper, 'ghost-up', '+');
                } else if (currentOnline < previousOnline) {
                    entryDiv.classList.add('flash-down');
                    createGhost(wrapper, 'ghost-down', '-');
                }
            }
            fragment.appendChild(entryDiv);
        });
        serversListContainer.innerHTML = '';
        serversListContainer.appendChild(fragment);
    }

    function renderDetailsPanel(projectName) {
        const servers = groupedServers[projectName].sort((a, b) => b.players - a.players);
        detailsServerList.innerHTML = '';
        panelTitle.textContent = projectName;
        if (servers.length === 0) {
            detailsServerList.innerHTML = '<p class="loading-text">Нет активных серверов.</p>';
            return;
        }
        servers.forEach(server => {
            const currentOnline = server.players;
            const entryDiv = document.createElement('div');
            entryDiv.className = 'server-entry';
            entryDiv.style.cursor = 'default';

            const iconHtml = currentOnline === 0
                ? '☠' 
                : '<i class="fa-solid fa-user"></i>'; 

            entryDiv.innerHTML = `<div class="server-name-container"><span class="server-name-text">${server.name}</span></div><div class="player-count-wrapper"><div class="player-count">${currentOnline} ${iconHtml}</div></div>`;

            const wrapper = entryDiv.querySelector('.player-count-wrapper');
            const previousOnline = previousServerState[server.name];
            if (typeof previousOnline !== 'undefined') {
                if (currentOnline > previousOnline) {
                    entryDiv.classList.add('flash-up');
                    createGhost(wrapper, 'ghost-up', '+');
                } else if (currentOnline < previousOnline) {
                    entryDiv.classList.add('flash-down');
                    createGhost(wrapper, 'ghost-down', '-');
                }
            }
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

    fetchData();
    setInterval(fetchData, 3000);
});
