const fs   = require('fs');
const path = require('path');

const API_URL        = 'https://hub.spacestation14.com/api/servers';
const RESERVE_API_URL = 'https://lena.reserve-station.space/v1/misc/server-data';
const DATA_FILE  = path.join(__dirname, '../data/history.json');
const MAX_POINTS = 288;  // ~24 часа при шаге ~5 мин

function getMoscowDateStr() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
    .toISOString().slice(0, 10); // "гггг-мм-дд"
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

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function main() {
  let stored = {};
  if (fs.existsSync(DATA_FILE)) {
    try {
      stored = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
      stored = {};
    }
  }

  const today = getMoscowDateStr();
  if (stored.date !== today) {
    stored = { date: today, projects: {} };
  }
  if (!stored.projects) stored.projects = {};

  // ── запрос к API с таймаутом 8 секунд ──
  const res = await fetchWithTimeout(API_URL, 8000);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const servers = await res.json();

  // ── суммируем онлайн по проектам ──
  const totals = {};
  for (const name in SERVER_GROUPS) totals[name] = 0;
  totals['Резерв'] = 0;

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

  // ── запрос к Reserve API ──
  try {
    const resReserve = await fetchWithTimeout(RESERVE_API_URL, 8000);
    if (resReserve.ok) {
      const reserveData = await resReserve.json();
      if (typeof reserveData.players === 'number') {
        totals['Резерв'] = reserveData.players;
      }
    }
  } catch (e) {
    console.warn('Reserve API fetch failed:', e.message);
    totals['Резерв'] = 0;
  }

  // ── добавляем новую точку ──
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
  console.log(`✓ Saved stats for ${today} at ${new Date(now).toISOString()}`);
}

main().catch(err => {
  console.error('Fetcher failed:', err);
  process.exit(1);
});
