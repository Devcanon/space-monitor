const fs   = require('fs');
const path = require('path');

const API_URL    = 'https://hub.spacestation14.com/api/servers';
const DATA_FILE  = path.join(__dirname, '../data/history.json');
const MAX_POINTS = 288;  // 5 мин × 288 = 24 часа

function getMoscowDateStr() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
}

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

async function main() {
  let stored = {};
  if (fs.existsSync(DATA_FILE)) {
    try { stored = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { stored = {}; }
  }

  const today = getMoscowDateStr();
  if (stored.date !== today) {
    stored = { date: today, projects: {} };
  }
  if (!stored.projects) stored.projects = {};

  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const servers = await res.json();

  const totals = {};
  for (const name in SERVER_GROUPS) totals[name] = 0;

  for (const server of servers) {
    if (!server?.statusData?.name || typeof server.statusData.players !== 'number') continue;
    const s       = server.statusData;
    const nameLow = s.name.toLowerCase();
    for (const [proj, kws] of Object.entries(SERVER_GROUPS)) {
      if (kws.some(kw => nameLow.includes(kw.toLowerCase()))) {
        totals[proj] += s.players;
        break;
      }
    }
  }

  const now = Date.now();
  for (const [name, players] of Object.entries(totals)) {
    if (!stored.projects[name]) stored.projects[name] = [];
    stored.projects[name].push([now, players]);
    if (stored.projects[name].length > MAX_POINTS) {
      stored.projects[name] = stored.projects[name].slice(-MAX_POINTS);
    }
  }

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(stored));
  console.log(`✓ Saved — ${today} — ${new Date(now).toISOString()}`);
}

main().catch(err => { console.error(err); process.exit(1); });
