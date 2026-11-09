'use strict';

/* =========================================================
   PC Parts Tycoon — an idle game about running a PC superstore
   ========================================================= */

const SAVE_KEY = 'pcPartsTycoon_save_v1';
const OFFLINE_CAP_SECONDS = 8 * 3600;      // offline earnings cap
const STAR_BONUS = 0.02;                    // +2% profit per Franchise Star

// ---------- Store sections ----------
// Level N -> N+1 costs baseCost * growth^N. Buying level 1 = unlocking the section.
// Each sale earns baseRevenue * level * multipliers, every `time` seconds.
const SECTIONS = [
  {
    id: 'acc', name: 'Accessories', icon: '🖱️', color: '#7fd4ff',
    baseCost: 4, growth: 1.07, baseRevenue: 1, time: 1.2,
    manager: { name: 'Kev the Cable Guy', icon: '🧑‍🔧', cost: 1000 },
    tiers: [
      [1, 'USB Cables'], [10, 'Gaming Mice'], [25, 'Mech Keyboards'], [50, 'Gaming Headsets'],
      [100, 'Webcams'], [200, 'Streaming Mics'], [400, 'Pro Peripheral Bundles'],
    ],
  },
  {
    id: 'case', name: 'PC Cases', icon: '🗄️', color: '#c3a6ff',
    baseCost: 250, growth: 1.15, baseRevenue: 60, time: 3,
    manager: { name: 'Tina Tower', icon: '👩‍💼', cost: 15000 },
    tiers: [
      [1, 'Budget Towers'], [10, 'Mid Towers'], [25, 'Airflow Mesh Cases'], [50, 'Glass RGB Cases'],
      [100, 'Full Towers'], [200, 'Custom Loop Cases'], [400, 'Showcase Chassis'],
    ],
  },
  {
    id: 'mon', name: 'Monitors', icon: '🖥️', color: '#8ff0c4',
    baseCost: 5000, growth: 1.14, baseRevenue: 900, time: 6,
    manager: { name: 'Pixel Pete', icon: '🧑‍💻', cost: 120000 },
    tiers: [
      [1, '24" 1080p Monitors'], [10, '27" 1440p Monitors'], [25, '144Hz Gaming Monitors'], [50, 'Ultrawides'],
      [100, '4K HDR Monitors'], [200, 'OLED 240Hz Monitors'], [400, 'Pro Dual-Screen Setups'],
    ],
  },
  {
    id: 'gpu', name: 'Graphics Cards', icon: '🎮', color: '#ffb36b',
    baseCost: 75000, growth: 1.13, baseRevenue: 9000, time: 12,
    manager: { name: 'Frames Fiona', icon: '👩‍🎤', cost: 1.5e6 },
    tiers: [
      [1, 'Entry GPUs'], [10, 'Mainstream GPUs'], [25, 'Performance GPUs'], [50, 'Enthusiast GPUs'],
      [100, 'Flagship GPUs'], [200, 'Workstation GPUs'], [400, 'Quantum GPUs'],
    ],
  },
  {
    id: 'svc', name: 'Service Station', icon: '🛠️', color: '#ff8fb1',
    baseCost: 1e6, growth: 1.12, baseRevenue: 120000, time: 24,
    manager: { name: 'Builder Bo', icon: '👷', cost: 2.5e7 },
    tiers: [
      [1, 'Basic Repairs'], [10, 'Office PC Builds'], [25, 'Gaming PC Builds'], [50, 'Streaming Rigs'],
      [100, 'Creator Workstations'], [200, 'Liquid-Cooled Beasts'], [400, 'Server Racks'],
    ],
  },
];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.id, s]));

// Milestones: every milestone doubles profit; some also double speed.
const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000];
const SPEED_MILESTONES = new Set([25, 50, 100, 200]);

// ---------- Cash upgrades ----------
const UPGRADES = (() => {
  const targets = [
    { t: 'acc', base: 25e3, names: ['Impulse-Buy Racks', 'RGB Cable Wall', 'Influencer Unboxings', 'Peripheral Megastore'] },
    { t: 'case', base: 1e5, names: ['Showroom Lighting', 'Build-Your-Own Display', 'Tempered Glass Deals', 'Case Mod Contest'] },
    { t: 'mon', base: 1e6, names: ['Demo Wall', 'Calibration Service', 'Esports Sponsorship', 'Holo Display Lab'] },
    { t: 'gpu', base: 1e7, names: ['Restock Alerts', 'Benchmark Kiosk', 'Launch Day Lines', 'Direct Factory Deal'] },
    { t: 'svc', base: 1e8, names: ['Pro Toolkits', 'Cable Management Pros', 'Same-Day Builds', 'Robot Assembly Line'] },
    { t: 'all', base: 1e9, names: ['Grand Opening Ad', 'Loyalty Card', 'Weekend Mega Sale', 'Tech Expo Booth'] },
  ];
  const rounds = [{ mult: 3, costMul: 1 }, { mult: 3, costMul: 1e4 }, { mult: 5, costMul: 1e8 }, { mult: 9, costMul: 1e13 }];
  const list = [];
  rounds.forEach((r, ri) => targets.forEach(tg => list.push({
    id: `${tg.t}_${ri}`, target: tg.t, mult: r.mult, cost: tg.base * r.costMul, name: tg.names[ri],
  })));
  return list.sort((a, b) => a.cost - b.cost);
})();

// ---------- Build Station customers ----------
const CUSTOMERS = [
  { face: '🧑‍💻', name: 'Dev Dana', line: 'I need a rig that compiles fast!' },
  { face: '👩‍🎤', name: 'Streamer Sky', line: 'Building my first streaming setup!' },
  { face: '🧔', name: 'Big Mike', line: 'Gotta max out every game. Hook me up.' },
  { face: '👵', name: 'Grandma June', line: 'My grandson says I need a "gaming PC".' },
  { face: '🧑‍🎓', name: 'Student Sam', line: 'Need something for school... and games.' },
  { face: '🧑‍🎨', name: 'Artist Ari', line: 'Rendering 3D art all day long!' },
  { face: '🕵️', name: 'Agent X', line: 'Build it quick. No questions.' },
  { face: '👨‍🚀', name: 'Captain Nova', line: 'Mission control needs an upgrade!' },
];
const PART_SECTIONS = ['case', 'gpu', 'mon', 'acc'];

// ---------- State ----------
function freshRun(keep = {}) {
  const sections = {};
  for (const s of SECTIONS) sections[s.id] = { level: s.id === 'acc' ? 1 : 0, progress: 0, running: false, manager: false };
  return {
    money: 0,
    runEarned: 0,
    lifetime: keep.lifetime || 0,
    stars: keep.stars || 0,
    starsClaimed: keep.starsClaimed || 0,
    franchises: keep.franchises || 0,
    buildsDone: keep.buildsDone || 0,
    storeName: keep.storeName || 'Byte Depot',
    sound: keep.sound !== undefined ? keep.sound : true,
    sections,
    upgrades: [],
    buyMode: 0,
    build: null,
    nextBuildAt: 0,
    lastSeen: Date.now(),
  };
}

const loaded = load();
const isNewPlayer = !loaded;
let state = loaded || freshRun();
let tab = 'store';
const BUY_MODES = [1, 10, 100, 'MAX'];

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const base = freshRun(s);
    const merged = Object.assign(base, s);
    for (const sec of SECTIONS) merged.sections[sec.id] = Object.assign(base.sections[sec.id], (s.sections || {})[sec.id] || {});
    return merged;
  } catch (e) { return null; }
}
function save() {
  state.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

// ---------- Math ----------
function milestonesReached(level) { return MILESTONES.filter(m => level >= m); }
function nextMilestone(level) { return MILESTONES.find(m => level < m) || null; }
function prevMilestone(level) { let p = 0; for (const m of MILESTONES) if (level >= m) p = m; return p; }

function starMult() { return 1 + state.stars * STAR_BONUS; }
function upgradeMult(id) {
  let m = 1;
  for (const u of UPGRADES) if (state.upgrades.includes(u.id) && (u.target === id || u.target === 'all')) m *= u.mult;
  return m;
}
function profitMult(id) {
  const lvl = state.sections[id].level;
  return Math.pow(2, milestonesReached(lvl).length) * upgradeMult(id) * starMult();
}
function revenue(id) { return SEC[id].baseRevenue * state.sections[id].level * profitMult(id); }
function cycleTime(id) {
  let t = SEC[id].time;
  for (const m of milestonesReached(state.sections[id].level)) if (SPEED_MILESTONES.has(m)) t /= 2;
  return t;
}
function incomePerSec(onlyManaged = true) {
  let total = 0;
  for (const s of SECTIONS) {
    const st = state.sections[s.id];
    if (st.level > 0 && (st.manager || !onlyManaged)) total += revenue(s.id) / cycleTime(s.id);
  }
  return total;
}
function costFor(id, n) {
  const s = SEC[id], L = state.sections[id].level;
  const first = s.baseCost * Math.pow(s.growth, L);
  return first * (Math.pow(s.growth, n) - 1) / (s.growth - 1);
}
function maxAffordable(id) {
  const s = SEC[id], L = state.sections[id].level;
  const first = s.baseCost * Math.pow(s.growth, L);
  const n = Math.floor(Math.log(state.money * (s.growth - 1) / first + 1) / Math.log(s.growth));
  return Math.max(0, n);
}
function buyCount(id) {
  const mode = BUY_MODES[state.buyMode];
  if (mode === 'MAX') return Math.max(1, maxAffordable(id));
  return mode;
}
function currentTier(id) {
  const lvl = Math.max(1, state.sections[id].level);
  let t = SEC[id].tiers[0][1];
  for (const [l, n] of SEC[id].tiers) if (lvl >= l) t = n;
  return t;
}

// ---------- Formatting ----------
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return n < 100 && n % 1 !== 0 ? n.toFixed(2).replace(/\.?0+$/, '') : Math.floor(n).toString();
  const tier = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3));
  const v = n / Math.pow(1000, tier);
  return (v >= 100 ? v.toFixed(1) : v.toFixed(2)) + SUFFIX[tier];
}
const money$ = n => '$' + fmt(n);
function fmtTime(sec) {
  if (sec < 1) return sec.toFixed(1) + 's';
  if (sec < 60) return Math.ceil(sec) + 's';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  if (m < 60) return `${m}m ${s}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ---------- Sound ----------
let audioCtx = null;
function beep(freq = 880, dur = 0.07, type = 'sine', vol = 0.05) {
  if (!state.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* no audio */ }
}
const sfx = {
  coin: () => beep(1320, 0.06, 'triangle', 0.03),
  buy: () => { beep(660, 0.05, 'square', 0.025); setTimeout(() => beep(990, 0.07, 'square', 0.025), 50); },
  unlock: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.05), i * 90)),
  wrong: () => beep(160, 0.18, 'sawtooth', 0.04),
  good: () => beep(1047, 0.08, 'triangle', 0.04),
};

// ---------- Actions ----------
function earn(amount) {
  state.money += amount;
  state.runEarned += amount;
  state.lifetime += amount;
}
function spend(amount) {
  if (state.money + 1e-9 < amount) return false;
  state.money = Math.max(0, state.money - amount);
  return true;
}

function levelUp(id, n) {
  const st = state.sections[id];
  const before = st.level;
  n = n || buyCount(id);
  const cost = costFor(id, n);
  if (!spend(cost)) return false;
  st.level += n;
  const tierBefore = before > 0 ? currentTierAt(id, before) : null;
  if (before === 0) {
    sfx.unlock();
    toast(`${SEC[id].icon} ${SEC[id].name} unlocked!`);
    confetti();
    render();
  } else {
    sfx.buy();
    const gained = MILESTONES.filter(m => before < m && st.level >= m);
    if (gained.length) {
      const speed = gained.some(m => SPEED_MILESTONES.has(m));
      toast(`🏆 ${SEC[id].name} Lv ${gained[gained.length - 1]}! Profit x${Math.pow(2, gained.length)}${speed ? ' & speed x2' : ''}`);
    }
    const tierNow = currentTier(id);
    if (tierBefore !== tierNow) toast(`✨ Now selling ${tierNow}!`);
  }
  return true;
}
function currentTierAt(id, lvl) {
  let t = SEC[id].tiers[0][1];
  for (const [l, n] of SEC[id].tiers) if (lvl >= l) t = n;
  return t;
}

function startSale(id) {
  const st = state.sections[id];
  if (st.level <= 0 || st.running) return;
  st.running = true;
  sfx.coin();
}

function hireManager(id) {
  const st = state.sections[id];
  if (st.manager || st.level <= 0) return;
  if (!spend(SEC[id].manager.cost)) return;
  st.manager = true;
  st.running = true;
  sfx.unlock();
  toast(`${SEC[id].manager.icon} ${SEC[id].manager.name} now runs ${SEC[id].name}!`);
  render();
}

function buyUpgrade(uid) {
  const u = UPGRADES.find(x => x.id === uid);
  if (!u || state.upgrades.includes(uid)) return;
  if (!spend(u.cost)) return;
  state.upgrades.push(uid);
  sfx.unlock();
  toast(`🚀 ${u.name}: ${u.target === 'all' ? 'All sections' : SEC[u.target].name} profit x${u.mult}`);
  render();
}

// ---------- Franchise (prestige) ----------
function totalStarsEarned() { return Math.floor(10 * Math.sqrt(state.lifetime / 1e9)); }
function claimableStars() { return Math.max(0, totalStarsEarned() - state.starsClaimed); }
function franchise() {
  const gain = claimableStars();
  if (gain <= 0) return;
  const keep = {
    lifetime: state.lifetime, stars: state.stars + gain, starsClaimed: state.starsClaimed + gain,
    franchises: state.franchises + 1, buildsDone: state.buildsDone, storeName: state.storeName, sound: state.sound,
  };
  state = freshRun(keep);
  save();
  closeModal();
  tab = 'store';
  render();
  confetti();
  toast(`⭐ New store opened! +${gain} Stars (profit x${starMult().toFixed(2)})`);
}

// ---------- Build Station mini-game ----------
function buildReward() {
  return Math.max(revenue('svc') * 4, incomePerSec(false) * 45);
}
const singular = n => n.replace(/([^si])s$/, '$1');
function newBuild() {
  const cust = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
  const wants = [];
  const tray = [];
  for (const sid of PART_SECTIONS) {
    const tiers = SEC[sid].tiers;
    const pick = Math.floor(Math.random() * tiers.length);
    let decoy = Math.floor(Math.random() * (tiers.length - 1));
    if (decoy >= pick) decoy++;
    const want = { key: `${sid}:${pick}`, sid, name: singular(tiers[pick][1]) };
    wants.push(want);
    tray.push(want, { key: `${sid}:${decoy}`, sid, name: singular(tiers[decoy][1]) });
  }
  for (let i = tray.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tray[i], tray[j]] = [tray[j], tray[i]]; }
  state.build = { face: cust.face, name: cust.name, line: cust.line, wants, tray, picked: [], mistakes: 0, reward: buildReward() };
}
function pickPart(idx, el) {
  const b = state.build;
  if (!b) return;
  const part = b.tray[idx];
  if (b.picked.includes(part.key)) return;
  if (b.wants.some(w => w.key === part.key)) {
    b.picked.push(part.key);
    sfx.good();
    if (b.picked.length === b.wants.length) completeBuild();
    else render();
  } else {
    b.mistakes++;
    sfx.wrong();
    if (el) { el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong'); }
    const rewardEl = document.getElementById('buildReward');
    if (rewardEl) rewardEl.textContent = rewardText();
  }
}
function rewardText() {
  const b = state.build;
  const pct = Math.max(0.4, 1 - b.mistakes * 0.15);
  return `Reward: ${money$(b.reward * pct)}${b.mistakes ? ` (−${Math.round((1 - pct) * 100)}% for mistakes)` : ''}`;
}
function completeBuild() {
  const b = state.build;
  const pay = b.reward * Math.max(0.4, 1 - b.mistakes * 0.15);
  earn(pay);
  state.buildsDone++;
  state.build = null;
  state.nextBuildAt = Date.now() + (state.sections.svc.manager ? 8000 : 15000);
  sfx.unlock();
  confetti();
  toast(`${b.face} ${b.name} loved the build! +${money$(pay)}`);
  render();
}

// ---------- Game loop ----------
let lastFrame = performance.now();
const floatAcc = {};   // accumulate floating text for very fast sections
function update(dt) {
  for (const s of SECTIONS) {
    const st = state.sections[s.id];
    if (st.level <= 0) continue;
    if (st.manager) st.running = true;
    if (!st.running) continue;
    const t = cycleTime(s.id);
    st.progress += dt / t;
    if (st.progress >= 1) {
      const cycles = st.manager ? Math.floor(st.progress) : 1;
      const amt = revenue(s.id) * cycles;
      earn(amt);
      st.progress = st.manager ? st.progress - cycles : 0;
      if (!st.manager) st.running = false;
      floatAcc[s.id] = (floatAcc[s.id] || 0) + amt;
    }
  }
  // Build station customers
  if (state.sections.svc.level > 0 && !state.build && Date.now() >= state.nextBuildAt) {
    newBuild();
    if (tab === 'store') render();
    toast('🛎️ A customer wants a custom PC built!');
  }
}

let lastFloat = 0, lastSave = Date.now(), lastAlerts = 0;
function frame(now) {
  const dt = Math.min(1, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  refresh();
  if (now - lastFloat > 450) { flushFloats(); lastFloat = now; }
  if (now - lastAlerts > 500) { updateAlerts(); lastAlerts = now; }
  if (Date.now() - lastSave > 5000) { save(); lastSave = Date.now(); }
  requestAnimationFrame(frame);
}

function applyOffline() {
  const away = Math.min(OFFLINE_CAP_SECONDS, (Date.now() - (state.lastSeen || Date.now())) / 1000);
  state.lastSeen = Date.now();
  if (away < 30) return;
  const earned = incomePerSec(true) * away;
  if (earned <= 0) return;
  earn(earned);
  showModal(`
    <div class="emoji">🌙</div>
    <h2>Welcome back!</h2>
    <p>Your managers kept the store running for ${fmtTime(away)}.</p>
    <div style="font-size:30px;font-weight:700;color:var(--green-dark)">+${money$(earned)}</div>
    <button class="btn green" data-act="close">Collect</button>`);
}

// ---------- Rendering ----------
const $ = sel => document.querySelector(sel);
const screen = $('#screen');
let refs = {};

function render() {
  refs = {};
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('#storeName').textContent = state.storeName;
  $('#buyModeBtn').textContent = 'x' + BUY_MODES[state.buyMode];
  $('#buyModeBtn').style.visibility = tab === 'store' ? 'visible' : 'hidden';
  if (tab === 'store') renderStore();
  else if (tab === 'managers') renderManagers();
  else if (tab === 'upgrades') renderUpgrades();
  else renderFranchise();
  refresh(true);
}

function renderStore() {
  let html = '';
  let shownLocked = false;
  for (const s of SECTIONS) {
    const st = state.sections[s.id];
    if (st.level > 0) {
      html += `
      <div class="card" style="--c:${s.color}" id="card-${s.id}">
        ${st.manager ? `<div class="mgr-tag">${s.manager.icon} AUTO</div>` : ''}
        <button class="sec-icon" data-act="sell" data-id="${s.id}" aria-label="Sell ${s.name}">
          <svg class="ring" viewBox="0 0 94 94"><circle class="bg" cx="47" cy="47" r="44"/><circle class="fg" cx="47" cy="47" r="44" stroke-dasharray="276.5" stroke-dashoffset="276.5"/></svg>
          ${s.icon}<span class="lvl">Lv 0</span>
        </button>
        <div>
          <div class="sec-head"><div class="sec-name">${s.name}</div><div class="sec-price"></div></div>
          <div class="sec-product"></div>
        </div>
        <div class="bar"><div class="fill"></div><div class="bar-text"><span class="bar-money"></span><span class="bar-time"></span></div></div>
        <div class="row">
          <button class="btn lvlbtn" data-act="level" data-id="${s.id}"><span class="lvl-label">Level Up</span><small class="lvl-cost"></small></button>
        </div>
      </div>`;
    } else if (!shownLocked) {
      shownLocked = true;   // only show the next locked section, idle-game style
      html += `
      <div class="card locked" style="--c:${s.color}" id="card-${s.id}">
        <div class="sec-icon">${s.icon}</div>
        <div>
          <div class="sec-name">🔒 ${s.name}</div>
          <div class="lock-text">Unlock to start selling ${s.tiers[0][1]}</div>
        </div>
        <div class="lock-text">Earns ${money$(s.baseRevenue)} every ${s.time}s</div>
        <div class="row"><button class="btn lvlbtn" data-act="unlock" data-id="${s.id}">Unlock<small>${money$(s.baseCost)}</small></button></div>
      </div>`;
    }
  }
  const locked = SECTIONS.filter(s => state.sections[s.id].level <= 0).length;
  if (locked > 1) html += `<div class="empty">🔒 ${locked - 1} more section${locked > 2 ? 's' : ''} to discover…</div>`;
  if (state.sections.svc.level > 0) html += buildHtml();
  screen.innerHTML = html;

  for (const s of SECTIONS) {
    const card = document.getElementById('card-' + s.id);
    if (!card) continue;
    refs[s.id] = {
      card,
      icon: card.querySelector('.sec-icon'),
      lvl: card.querySelector('.lvl'),
      ring: card.querySelector('.ring .fg'),
      price: card.querySelector('.sec-price'),
      product: card.querySelector('.sec-product'),
      fill: card.querySelector('.fill'),
      barMoney: card.querySelector('.bar-money'),
      barTime: card.querySelector('.bar-time'),
      btn: card.querySelector('.lvlbtn'),
      btnLabel: card.querySelector('.lvl-label'),
      btnCost: card.querySelector('.lvl-cost'),
    };
  }
}

function buildHtml() {
  const b = state.build;
  if (!b) {
    return `<div class="build"><h3>🧰 Custom Build Desk <small>${state.buildsDone} builds done</small></h3>
      <div class="build-wait">⏳ Next customer in <span id="buildTimer">…</span></div></div>`;
  }
  const wants = b.wants.map(w => `<span class="want ${b.picked.includes(w.key) ? 'done' : ''}">${SEC[w.sid].icon} ${w.name}</span>`).join('');
  const tray = b.tray.map((p, i) => `<button class="part ${b.picked.includes(p.key) ? 'picked' : ''}" data-act="part" data-idx="${i}"><span>${SEC[p.sid].icon}</span>${p.name}</button>`).join('');
  return `<div class="build"><h3>🧰 Custom Build Desk <small>${state.buildsDone} builds done</small></h3>
    <div class="customer"><div class="face">${b.face}</div><div class="bubble"><b>${b.name}:</b> “${b.line}”</div></div>
    <div class="lock-text">Grab these parts from the shelves:</div>
    <div class="wants">${wants}</div>
    <div class="tray">${tray}</div>
    <div class="reward-line" id="buildReward" style="margin-top:10px">${rewardText()}</div></div>`;
}

function renderManagers() {
  let html = `<div class="screen-title">👔 Managers</div><div class="screen-sub">Managers run a section for you — even while you're away.</div>`;
  for (const s of SECTIONS) {
    const st = state.sections[s.id], m = s.manager;
    const unlocked = st.level > 0;
    html += `<div class="item ${st.manager ? 'done' : ''}">
      <div class="avatar" style="--c:${s.color}">${m.icon}</div>
      <div class="info"><div class="title">${m.name}</div><div class="desc">${unlocked ? `Runs ${s.name} automatically` : `Unlock ${s.name} first`}</div></div>
      ${st.manager ? `<button class="btn owned" disabled>Hired ✓</button>`
        : `<button class="btn green" data-act="manager" data-id="${s.id}" data-cost="${m.cost}" ${unlocked ? '' : 'data-locked="1"'}>Hire<small>${money$(m.cost)}</small></button>`}
    </div>`;
  }
  screen.innerHTML = html;
}

function renderUpgrades() {
  const avail = UPGRADES.filter(u => !state.upgrades.includes(u.id)).slice(0, 12);
  let html = `<div class="screen-title">🚀 Upgrades</div><div class="screen-sub">Boost your profits. ${state.upgrades.length}/${UPGRADES.length} purchased.</div>`;
  if (!avail.length) html += `<div class="empty">You bought every upgrade! 🎉</div>`;
  for (const u of avail) {
    const target = u.target === 'all' ? { icon: '🏪', name: 'All sections', color: '#ffe17a' } : SEC[u.target];
    html += `<div class="item">
      <div class="avatar" style="--c:${target.color}">${target.icon}</div>
      <div class="info"><div class="title">${u.name}</div><div class="desc">${target.name} profit x${u.mult}</div></div>
      <button class="btn green" data-act="upgrade" data-id="${u.id}" data-cost="${u.cost}">Buy<small>${money$(u.cost)}</small></button>
    </div>`;
  }
  screen.innerHTML = html;
}

function renderFranchise() {
  const gain = claimableStars();
  const nextStarAt = Math.pow((totalStarsEarned() + 1) / 10, 2) * 1e9;
  screen.innerHTML = `<div class="screen-title">⭐ Franchise</div>
    <div class="screen-sub">Sell this store and open a bigger one. You keep your Stars — each gives +${STAR_BONUS * 100}% profit forever.</div>
    <div class="big-card">
      <div class="stars">⭐ ${fmt(state.stars)}</div>
      <p>Current bonus: profit x${starMult().toFixed(2)}</p>
      <div style="font-size:18px;font-weight:700">Open a new store for <span style="color:var(--green-dark)">+${fmt(gain)} ⭐</span></div>
      <p>Next Star at ${money$(nextStarAt)} lifetime earnings</p>
      <button class="btn ${gain > 0 ? 'green' : 'disabled'}" data-act="franchise" style="width:100%">${gain > 0 ? 'Franchise!' : 'Earn more to franchise'}<small>Resets cash, sections, managers & upgrades</small></button>
    </div>
    <div class="big-card"><div class="stat-grid">
      <div class="stat">Lifetime earnings<b>${money$(state.lifetime)}</b></div>
      <div class="stat">This store<b>${money$(state.runEarned)}</b></div>
      <div class="stat">Stores opened<b>${state.franchises + 1}</b></div>
      <div class="stat">Custom builds<b>${state.buildsDone}</b></div>
    </div></div>`;
}

// Per-frame updates of dynamic values (no DOM rebuild)
let lastMoneyText = '';
function refresh(force) {
  const mt = fmt(state.money);
  if (mt !== lastMoneyText || force) { $('#moneyVal').textContent = mt; lastMoneyText = mt; }
  $('#incomeVal').textContent = money$(incomePerSec(true));

  if (tab === 'store') {
    for (const s of SECTIONS) {
      const r = refs[s.id];
      if (!r) continue;
      const st = state.sections[s.id];
      if (st.level <= 0) {
        setBtn(r.btn, state.money >= s.baseCost);
        continue;
      }
      const t = cycleTime(s.id);
      const fast = st.manager && t < 0.3;
      r.fill.classList.toggle('fast', fast);
      if (!fast) r.fill.style.width = (st.progress * 100).toFixed(1) + '%';
      r.barMoney.textContent = money$(revenue(s.id));
      r.barTime.textContent = fast ? 'MAX SPEED' : st.running ? fmtTime(t * (1 - st.progress)) : (st.manager ? '' : 'Tap icon!');
      r.icon.classList.toggle('idle-hint', !st.running && !st.manager);
      r.lvl.textContent = 'Lv ' + st.level;
      const nm = nextMilestone(st.level), pm = prevMilestone(st.level);
      const frac = nm ? (st.level - pm) / (nm - pm) : 1;
      r.ring.style.strokeDashoffset = (276.5 * (1 - frac)).toFixed(1);
      r.product.textContent = `Selling: ${currentTier(s.id)}${nm ? ` · next bonus Lv ${nm}` : ''}`;
      r.price.textContent = money$(revenue(s.id) / Math.max(1, st.level)) + ' each';
      const n = buyCount(s.id);
      const cost = costFor(s.id, n);
      r.btnLabel.textContent = `Level Up x${n}`;
      r.btnCost.textContent = money$(cost);
      setBtn(r.btn, state.money >= cost);
    }
    const bt = document.getElementById('buildTimer');
    if (bt) bt.textContent = fmtTime(Math.max(0, (state.nextBuildAt - Date.now()) / 1000));
  } else {
    screen.querySelectorAll('[data-cost]').forEach(b => setBtn(b, !b.dataset.locked && state.money >= +b.dataset.cost));
  }
}
function setBtn(btn, ok) { if (btn) btn.classList.toggle('disabled', !ok); }

function updateAlerts() {
  const canMgr = SECTIONS.some(s => state.sections[s.id].level > 0 && !state.sections[s.id].manager && state.money >= s.manager.cost);
  const canUpg = UPGRADES.some(u => !state.upgrades.includes(u.id) && state.money >= u.cost);
  const canFr = claimableStars() >= Math.max(1, Math.ceil(state.stars * 0.5));
  const setA = (t, on) => document.querySelector(`.tab[data-tab="${t}"]`).classList.toggle('alert', on && tab !== t);
  setA('managers', canMgr);
  setA('upgrades', canUpg);
  setA('franchise', canFr);
  setA('store', !!state.build);
}

// ---------- FX ----------
function flushFloats() {
  if (tab !== 'store') { for (const k in floatAcc) delete floatAcc[k]; return; }
  for (const id in floatAcc) {
    const r = refs[id];
    if (r && floatAcc[id] > 0) {
      const rect = r.icon.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) floatText('+' + money$(floatAcc[id]), rect.left + rect.width / 2, rect.top);
    }
    delete floatAcc[id];
  }
}
function floatText(text, x, y) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  $('#fx').appendChild(el);
  setTimeout(() => el.remove(), 1000);
  const m = $('#money'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump');
}
function confetti() {
  const colors = ['#ffc83d', '#2ecc71', '#ff5a5f', '#7fd4ff', '#c3a6ff', '#ff8fb1'];
  for (let i = 0; i < 36; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.top = -20 - Math.random() * 80 + 'px';
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = Math.random() * 0.4 + 's';
    $('#fx').appendChild(c);
    setTimeout(() => c.remove(), 2000);
  }
}
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  const box = $('#toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

// ---------- Modal ----------
function showModal(html) { $('#modalCard').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
function showSettings() {
  showModal(`
    <div class="emoji">⚙️</div><h2>Settings</h2>
    <p>Name your store</p>
    <input id="nameInput" maxlength="24" value="${state.storeName.replace(/"/g, '&quot;')}">
    <button class="btn green" data-act="saveName">Save name</button>
    <button class="btn" data-act="toggleSound">Sound: ${state.sound ? 'ON 🔊' : 'OFF 🔇'}</button>
    <button class="btn danger" data-act="askReset">Reset all progress</button>
    <button class="btn disabled" data-act="close">Close</button>`);
}

// ---------- Input ----------
let holdTimer = null, holdInterval = null, holdFired = false;
function stopHold() { clearTimeout(holdTimer); clearInterval(holdInterval); holdTimer = holdInterval = null; }

screen.addEventListener('pointerdown', e => {
  const btn = e.target.closest('[data-act="level"]');
  if (!btn) return;
  holdFired = false;
  stopHold();
  // Hold the Level Up button to keep buying
  holdTimer = setTimeout(() => {
    holdInterval = setInterval(() => { if (levelUp(btn.dataset.id)) holdFired = true; }, 90);
  }, 400);
});
['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, stopHold));
screen.addEventListener('scroll', stopHold, { passive: true });

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id } = el.dataset;
  switch (act) {
    case 'sell': startSale(id); break;
    case 'level': if (!holdFired) levelUp(id); holdFired = false; break;
    case 'unlock': levelUp(id, 1); break;
    case 'manager': hireManager(id); break;
    case 'upgrade': buyUpgrade(id); break;
    case 'part': pickPart(+el.dataset.idx, el); break;
    case 'franchise':
      if (claimableStars() > 0) showModal(`<div class="emoji">⭐</div><h2>Open a new store?</h2>
        <p>You'll gain <b>${claimableStars()} Stars</b> and start over with a permanent profit bonus of x${(1 + (state.stars + claimableStars()) * STAR_BONUS).toFixed(2)}.</p>
        <button class="btn green" data-act="confirmFranchise">Franchise!</button><button class="btn disabled" data-act="close">Not yet</button>`);
      break;
    case 'confirmFranchise': franchise(); break;
    case 'close': closeModal(); break;
    case 'saveName': {
      const v = ($('#nameInput').value || '').trim();
      if (v) state.storeName = v.slice(0, 24);
      save(); closeModal(); render();
      break;
    }
    case 'toggleSound': state.sound = !state.sound; showSettings(); break;
    case 'askReset':
      showModal(`<div class="emoji">⚠️</div><h2>Reset everything?</h2><p>This wipes all progress, including Stars.</p>
        <button class="btn danger" data-act="confirmReset">Yes, reset</button><button class="btn disabled" data-act="close">Cancel</button>`);
      break;
    case 'confirmReset':
      state = freshRun();
      save(); closeModal(); tab = 'store'; render();
      break;
  }
});

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { tab = t.dataset.tab; screen.scrollTop = 0; render(); }));
$('#buyModeBtn').addEventListener('click', () => { state.buyMode = (state.buyMode + 1) % BUY_MODES.length; render(); });
$('#settingsBtn').addEventListener('click', showSettings);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else { applyOffline(); lastFrame = performance.now(); }
});
window.addEventListener('pagehide', save);

// ---------- Boot ----------
if (state.sections.svc.level > 0 && !state.build && !state.nextBuildAt) state.nextBuildAt = Date.now() + 5000;
render();
applyOffline();
requestAnimationFrame(t => { lastFrame = t; frame(t); });
if (isNewPlayer) toast('👆 Tap the mouse icon to make your first sale!');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
