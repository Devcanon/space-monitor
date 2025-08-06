document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'https://hub.spacestation14.com/api/servers';
    const serversListContainer = document.getElementById('servers-list');

    let previousOnlineState = {};

    const SERVER_GROUPS = {
        'Корвакс': ['Corvax'],
        'Санрайз': ['РЫБЬЯ', 'LUST', 'SUNRISE', 'FIRE', 'PRIME'],
        'Империал': ['Imperial'],
        'Спейс Сторис': ['Stories'],
        'Мёртвый Космос': ['МЁРТВЫЙ'],
        'Губы': ['Goob'],
        'Визарды': ["Wizard's"],
        'СС220': ['SS220'],
        'Время Приключений': ['Время']
    };

    async function fetchAndDisplayServers() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error(`Сетевая ошибка: ${response.status}`);
            }
            const allServers = await response.json();

            const projectOnline = {};
            for (const projectName in SERVER_GROUPS) {
                projectOnline[projectName] = 0;
            }

            for (const server of allServers) {
                if (server && server.statusData) {
                    const status = server.statusData;
                    if (status.name && typeof status.players === 'number') {
                        const serverNameLower = status.name.toLowerCase();
                        const playerCount = status.players;
                        for (const [projectName, keywords] of Object.entries(SERVER_GROUPS)) {
                            if (keywords.some(keyword => serverNameLower.includes(keyword.toLowerCase()))) {
                                projectOnline[projectName] += playerCount;
                                break;
                            }
                        }
                    }
                }
            }

            const sortedProjects = Object.entries(projectOnline).sort(([, a], [, b]) => b - a);
            
            renderServerList(sortedProjects, previousOnlineState);
            
            previousOnlineState = { ...projectOnline };

        } catch (error) {
            console.warn("Не удалось обновить данные. Будет предпринята новая попытка при следующем цикле.", error);
        }
    }

    function renderServerList(sortedProjects, oldState) {
        const fragment = document.createDocumentFragment();

        sortedProjects.forEach(([projectName, currentOnline], index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'server-entry';

            entryDiv.innerHTML = `
                <span class="server-name">${projectName}</span>
                <span class="player-count">${currentOnline} <i class="fa-solid fa-user"></i></span>
            `;

            const countSpan = entryDiv.querySelector('.player-count');

            const rank = index + 1;
            if (rank <= 3) countSpan.classList.add('top');
            else if (rank <= 6) countSpan.classList.add('mid');
            else if (rank <= 9) countSpan.classList.add('low');
            
            const previousOnline = oldState[projectName];
            if (typeof previousOnline !== 'undefined') {
                if (currentOnline > previousOnline) {
                    entryDiv.classList.add('flash-up');
                } else if (currentOnline < previousOnline) {
                    entryDiv.classList.add('flash-down');
                }
            }
            
            fragment.appendChild(entryDiv);
        });

        serversListContainer.innerHTML = '';
        serversListContainer.appendChild(fragment);
    }

    fetchAndDisplayServers();
    setInterval(fetchAndDisplayServers, 2000);
});
