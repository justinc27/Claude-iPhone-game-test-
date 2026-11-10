'use strict';

/* =========================================================
   PC Parts Tycoon — run a PC parts store as a character.
   Move with the touch joystick, restock shelves from the
   stockroom, and check shoppers out at the register.
   ========================================================= */

const SAVE_KEY = 'pcPartsTycoon_store_v2';
const W = 600, H = 1020;             // world size in world units
const AISLE_X = 300;                 // central aisle shoppers walk along
const DOOR = { x: 300, y: 1000 };
const VIEW_UNITS = 610;              // how many world units fit across the screen
const MILESTONES = [10, 25, 50, 100];

// ---------- Store layout & sections ----------
const SECTIONS = [
  { id: 'acc', name: 'Accessories', item: 'Mouse', items: 'mice', icon: '🖱️', color: '#4fb3ff', price: 8, unlock: 0,
    shelf: { x: 40, y: 220, w: 190, h: 42 }, crate: { x: 85, y: 95 } },
  { id: 'case', name: 'PC Cases', item: 'PC Case', items: 'PC cases', icon: '🗄️', color: '#a77bff', price: 25, unlock: 120,
    shelf: { x: 370, y: 220, w: 190, h: 42 }, crate: { x: 405, y: 95 } },
  { id: 'mon', name: 'Monitors', item: 'Monitor', items: 'monitors', icon: '🖥️', color: '#2ecc8f', price: 60, unlock: 600,
    shelf: { x: 40, y: 380, w: 190, h: 42 }, crate: { x: 195, y: 95 } },
  { id: 'gpu', name: 'Graphics Cards', item: 'GPU', items: 'GPUs', icon: '🎮', color: '#ff9f43', price: 140, unlock: 2500,
    shelf: { x: 370, y: 380, w: 190, h: 42 }, crate: { x: 515, y: 95 } },
  { id: 'svc', name: 'Service Station', item: 'Custom PC', items: 'custom PCs', icon: '🛠️', color: '#ff6b9a', price: 400, unlock: 10000,
    bench: { x: 370, y: 545, w: 190, h: 40 } },
];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.id, s]));
const PARTS = SECTIONS.filter(s => s.shelf);
for (const s of PARTS) s.front = { x: s.shelf.x + s.shelf.w / 2, y: s.shelf.y + s.shelf.h + 28 };
SEC.svc.front = { x: 465, y: 618 };            // unlock pad
SEC.svc.custSpot = { x: 525, y: 615 };          // where the build customer waits
SEC.svc.workPad = { x: 410, y: 618 };           // where you stand to assemble
const COUNTER = { x: 40, y: 690, w: 160, h: 40 };
const REGISTER = { x: 120, y: 662 };            // stand here to check people out
const CRATE_W = 84, CRATE_H = 64;

function queueSlot(i) {
  const col = Math.floor(i / 5), row = i % 5;
  return { x: 120 + col * 50, y: 768 + row * 46 };
}

// ---------- Staff & player upgrades ----------
const STAFF = {
  cashier: { name: 'Cashier Cass', icon: '🧑‍💼', cost: 500, desc: 'Checks out customers at the register' },
  stocker: { name: 'Stocker Stan', icon: '🧑‍🔧', cost: 1500, desc: 'Carries stock to empty shelves' },
  tech: { name: 'Tech Tara', icon: '👩‍💻', cost: 8000, desc: 'Assembles PCs at the Service Station' },
};
const MAX_PLAYER_LV = 8;
// Upgrades for hired staff
const STAFF_UPGRADES = [
  { id: 'cashierSpeed', staff: 'cashier', icon: '⚡', title: 'Faster Scanning', base: 400, growth: 1.9, max: 8,
    desc: () => `Scans an item every ${cashierScanTime().toFixed(2)}s` },
  { id: 'stockerSpeed', staff: 'stocker', icon: '👟', title: 'Stocker Shoes', base: 600, growth: 1.9, max: 8,
    desc: () => `Walks ${Math.round(stockerSpeed() / 125 * 100)}% speed` },
  { id: 'stockerCarry', staff: 'stocker', icon: '📦', title: 'Hand Truck', base: 800, growth: 2, max: 6,
    desc: () => `Carries ${stockerCarry()} boxes per trip` },
  { id: 'techSpeed', staff: 'tech', icon: '🔧', title: 'Power Tools', base: 4000, growth: 1.9, max: 8,
    desc: () => `Builds a PC in ${techBuildTime().toFixed(1)}s` },
];
const STAFF_UP = Object.fromEntries(STAFF_UPGRADES.map(u => [u.id, u]));
function staffLv(id) { return state.staffLv[id] || 0; }
function staffUpCost(id) { const u = STAFF_UP[id]; return u.base * Math.pow(u.growth, staffLv(id)); }
function cashierScanTime() { return 0.6 * Math.pow(0.84, staffLv('cashierSpeed')); }
function stockerSpeed() { return 125 * (1 + 0.18 * staffLv('stockerSpeed')); }
function stockerHandTime() { return Math.pow(0.85, staffLv('stockerSpeed')); }
function stockerCarry() { return 4 + 2 * staffLv('stockerCarry'); }
function techBuildTime() { return 8 * Math.pow(0.85, staffLv('techSpeed')); }
// Floor pads where you hire staff by standing on them
const HIRE_PADS = {
  cashier: { x: 268, y: 700, label: 'CASHIER' },
  stocker: { x: 300, y: 95, label: 'STOCKER' },
};

// ---------- State ----------
function freshState(keep = {}) {
  const sec = {};
  for (const s of SECTIONS) sec[s.id] = { unlocked: s.unlock === 0, level: 1, stock: s.unlock === 0 ? 4 : 0, paid: 0 };
  return {
    money: 0, lifetime: 0, served: 0, built: 0,
    storeName: keep.storeName || 'Byte Depot',
    sound: keep.sound !== undefined ? keep.sound : true,
    sec, speedLv: 0, carryLv: 0,
    staff: { cashier: false, stocker: false, tech: false },
    staffPaid: { cashier: 0, stocker: 0 },
    staffLv: {},
    player: { x: 300, y: 600 },
    carry: [],
    rate: 0,
    lastSeen: Date.now(),
  };
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const base = freshState(s);
    const merged = Object.assign(base, s);
    for (const sc of SECTIONS) merged.sec[sc.id] = Object.assign(base.sec[sc.id], (s.sec || {})[sc.id] || {});
    merged.staff = Object.assign(freshState().staff, s.staff || {});
    merged.staffPaid = Object.assign(freshState().staffPaid, s.staffPaid || {});
    merged.staffLv = Object.assign({}, s.staffLv || {});
    return merged;
  } catch (e) { return null; }
}
function save() {
  state.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}
const loaded = load();
const isNewPlayer = !loaded;
let state = loaded || freshState();

// Runtime-only world objects
let customers = [];
let queue = [];
let fx = [];
let spawnTimer = 2;
let serveTimer = 0, pickTimer = 0, dropTimer = 0;
let buildProgress = 0;
const npcs = {};

// ---------- Economy ----------
function price(id) {
  const L = state.sec[id].level;
  return SEC[id].price * (1 + 0.25 * (L - 1)) * Math.pow(2, MILESTONES.filter(m => L >= m).length);
}
function levelCost(id) { return SEC[id].price * 12 * Math.pow(1.32, state.sec[id].level - 1); }
function shelfCap(id) { return Math.min(20, 6 + 2 * Math.floor((state.sec[id].level - 1) / 5)); }
function playerSpeed() { return 165 + 20 * state.speedLv; }
function carryCap() { return 4 + 2 * state.carryLv; }
function speedCost() { return 80 * Math.pow(2, state.speedLv); }
function carryCost() { return 120 * Math.pow(2.1, state.carryLv); }
function unlockedParts() { return PARTS.filter(s => state.sec[s.id].unlocked); }

let rateBucket = 0;
function earn(amount, x, y) {
  state.money += amount;
  state.lifetime += amount;
  rateBucket += amount;
  if (x !== undefined) fx.push({ type: 'text', text: '+' + money$(amount), x, y, t: 0, color: '#2ecc71' });
  bumpMoney();
}

// ---------- Formatting ----------
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
function fmt(n) {
  if (n < 1000) return n % 1 === 0 ? String(n) : (n < 100 ? n.toFixed(2).replace(/\.?0+$/, '') : Math.floor(n).toString());
  const tier = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3));
  const v = n / Math.pow(1000, tier);
  return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + SUFFIX[tier];
}
const money$ = n => '$' + fmt(n);
function fmtTime(sec) {
  if (sec < 60) return Math.ceil(sec) + 's';
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}m ${Math.floor(sec % 60)}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ---------- Sound ----------
let audioCtx = null;
function beep(freq = 880, dur = 0.07, type = 'sine', vol = 0.05) {
  if (!state.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* no audio */ }
}
const sfx = {
  pick: () => beep(700, 0.04, 'triangle', 0.025),
  drop: () => beep(520, 0.04, 'triangle', 0.025),
  scan: () => beep(1500, 0.04, 'square', 0.015),
  cash: () => { beep(1320, 0.06, 'triangle', 0.04); setTimeout(() => beep(1760, 0.08, 'triangle', 0.04), 60); },
  unlock: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.05), i * 90)),
  sad: () => beep(180, 0.2, 'sawtooth', 0.03),
};

// ---------- Geometry ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inRect = (p, r, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
function crateRect(s) { return { x: s.crate.x - CRATE_W / 2, y: s.crate.y - CRATE_H / 2, w: CRATE_W, h: CRATE_H }; }
function padRect(p, w = 96, h = 56) { return { x: p.x - w / 2, y: p.y - h / 2, w, h }; }

function obstacles() {
  const list = [COUNTER];
  for (const s of PARTS) if (state.sec[s.id].unlocked) list.push(s.shelf);
  if (state.sec.svc.unlocked) list.push(SEC.svc.bench);
  return list;
}
// For shoppers & staff: is a straight walk blocked by furniture?
function segmentBlocked(a, b) {
  const all = [COUNTER, SEC.svc.bench, ...PARTS.map(s => s.shelf)];
  const steps = Math.ceil(dist(a, b) / 8);
  for (let i = 1; i < steps; i++) {
    const p = { x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps };
    if (all.some(r => inRect(p, r, 10))) return true;
  }
  return false;
}
function route(from, to) {
  if (!segmentBlocked(from, to)) return [{ x: to.x, y: to.y }];
  const pts = [];
  if (Math.abs(from.x - AISLE_X) > 6) pts.push({ x: AISLE_X, y: from.y });
  pts.push({ x: AISLE_X, y: to.y }, { x: to.x, y: to.y });
  return pts;
}
function walk(o, dt) {
  if (!o.path.length) return true;
  const tgt = o.path[0];
  const dx = tgt.x - o.x, dy = tgt.y - o.y, d = Math.hypot(dx, dy);
  const step = o.speed * dt;
  if (d <= step) { o.x = tgt.x; o.y = tgt.y; o.path.shift(); }
  else { o.x += dx / d * step; o.y += dy / d * step; o.face = dx < 0 ? -1 : 1; }
  o.moving = true;
  return !o.path.length;
}

// ---------- Customers ----------
const SHIRTS = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#8338ec', '#fb8500', '#3a86ff'];
const SKINS = ['#f5d0a9', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const HAIR = ['#2b1d0e', '#6b3e1b', '#e8c170', '#111', '#b5542b', '#999'];
function spawnCustomer() {
  const parts = unlockedParts();
  const svcActive = customers.some(c => c.state === 'svc');
  const wantsBuild = state.sec.svc.unlocked && !svcActive && Math.random() < 0.3;
  const c = {
    x: DOOR.x + (Math.random() * 30 - 15), y: H + 10, path: [], speed: 85 + Math.random() * 30,
    shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    skin: SKINS[Math.floor(Math.random() * SKINS.length)],
    hair: HAIR[Math.floor(Math.random() * HAIR.length)],
    wants: [], cart: [], idx: 0, timer: 0, patience: 14, state: 'shop', goingTo: null, scanned: 0, mood: null, face: 1,
  };
  if (wantsBuild) {
    c.state = 'svc';
    c.path = [{ x: c.x, y: DOOR.y - 20 }, ...route({ x: AISLE_X, y: DOOR.y - 20 }, SEC.svc.custSpot)];
    c.patience = 45;
  } else {
    const n = 1 + Math.floor(Math.random() * Math.min(3, parts.length + 1));
    for (let i = 0; i < n; i++) c.wants.push(parts[Math.floor(Math.random() * parts.length)].id);
    c.path = [{ x: c.x, y: DOOR.y - 20 }];
  }
  customers.push(c);
}
function leave(c, mood) {
  c.state = 'leave';
  c.mood = mood;
  c.moodT = 0;
  c.path = [...route(c, { x: AISLE_X, y: DOOR.y - 10 }), { x: AISLE_X + (Math.random() * 20 - 10), y: H + 30 }];
  if (mood === 'sad') sfx.sad();
}
function updateCustomer(c, dt) {
  c.moving = false;
  if (c.mood) c.moodT += dt;
  const arrived = walk(c, dt);
  if (!arrived) return;

  if (c.state === 'shop') {
    if (c.idx >= c.wants.length) {
      if (c.cart.length) { c.state = 'queue'; queue.push(c); }
      else leave(c, 'sad');
      return;
    }
    const s = SEC[c.wants[c.idx]];
    const spot = { x: s.front.x + (Math.random() * 120 - 60), y: s.front.y + (Math.random() * 10 - 5) };
    if (c.goingTo !== c.idx) { c.goingTo = c.idx; c.timer = 0; c.path = route(c, spot); return; }
    c.timer += dt;
    if (c.timer < 0.6) return;
    const st = state.sec[s.id];
    if (st.stock > 0) {
      st.stock--;
      c.cart.push(s.id);
      c.idx++;
      c.waiting = false;
    } else {
      c.waiting = true;
      c.patience -= dt;
      if (c.patience <= 0) { c.idx++; c.patience = 10; c.waiting = false; }
    }
  } else if (c.state === 'queue') {
    const i = queue.indexOf(c);
    const slot = queueSlot(i);
    if (dist(c, slot) > 2) { c.path = route(c, slot); return; }
  } else if (c.state === 'svc') {
    c.waiting = true;
    c.patience -= dt;
    if (c.patience <= 0 && buildProgress < 0.05) { c.waiting = false; leave(c, 'sad'); buildProgress = 0; }
  } else if (c.state === 'leave') {
    if (c.y > H + 20) c.remove = true;
  }
}

// Checkout at the register
function updateRegister(dt) {
  const front = queue[0];
  const playerHere = dist(state.player, REGISTER) < 36;
  const scanTime = playerHere ? 0.28 : state.staff.cashier ? cashierScanTime() : 0;
  if (!front || !scanTime || dist(front, queueSlot(0)) > 4) { serveTimer = 0; return; }
  serveTimer += dt;
  if (serveTimer >= scanTime) {
    serveTimer = 0;
    front.scanned++;
    sfx.scan();
    if (front.scanned >= front.cart.length) {
      const total = front.cart.reduce((sum, id) => sum + price(id), 0);
      earn(total, REGISTER.x, REGISTER.y - 30);
      sfx.cash();
      state.served++;
      queue.shift();
      leave(front, 'happy');
    }
  }
}

// Building PCs at the Service Station
function updateService(dt) {
  if (!state.sec.svc.unlocked) return;
  const c = customers.find(x => x.state === 'svc' && !x.path.length);
  const playerHere = dist(state.player, SEC.svc.workPad) < 34;
  const rate = Math.max(playerHere ? 1 / 4 : 0, state.staff.tech ? 1 / techBuildTime() : 0);
  if (!c || !rate) return;
  buildProgress += rate * dt;
  if (Math.random() < dt * 6) fx.push({ type: 'spark', x: SEC.svc.bench.x + 30 + Math.random() * 60, y: SEC.svc.bench.y + 10, t: 0 });
  if (buildProgress >= 1) {
    buildProgress = 0;
    state.built++;
    earn(price('svc'), SEC.svc.custSpot.x, SEC.svc.custSpot.y - 40);
    sfx.cash();
    c.carryPC = true;
    leave(c, 'happy');
  }
}

// ---------- Player ----------
const input = { x: 0, y: 0 };
const PLAYER_R = 14;
function updatePlayer(dt) {
  const p = state.player;
  let ix = input.x, iy = input.y;
  if (keys.size) {
    ix = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
    iy = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
    const m = Math.hypot(ix, iy) || 1; ix /= m; iy /= m;
  }
  p.moving = Math.hypot(ix, iy) > 0.1;
  if (p.moving) {
    p.face = ix < -0.1 ? -1 : ix > 0.1 ? 1 : p.face || 1;
    const sp = playerSpeed() * dt;
    moveAxis(p, ix * sp, 0);
    moveAxis(p, 0, iy * sp);
  }
  // Stockroom crates: pick up boxes
  pickTimer += dt; dropTimer += dt;
  for (const s of unlockedParts()) {
    if (inRect(p, crateRect(s)) && state.carry.length < carryCap() && pickTimer > 0.13) {
      state.carry.push(s.id); pickTimer = 0; sfx.pick();
    }
  }
  // Shelves: drop matching boxes
  for (const s of unlockedParts()) {
    const st = state.sec[s.id];
    const i = state.carry.lastIndexOf(s.id);
    if (i >= 0 && st.stock < shelfCap(s.id) && inRect(p, s.shelf, 34) && dropTimer > 0.1) {
      state.carry.splice(i, 1); st.stock++; dropTimer = 0; sfx.drop();
    }
  }
  // Unlock pads: money flows in while you stand on them
  for (const s of SECTIONS) {
    const st = state.sec[s.id];
    if (st.unlocked || !canUnlockNext(s.id)) continue;
    if (inRect(p, padRect(s.front)) && state.money > 0) {
      const amt = Math.min(state.money, s.unlock - st.paid, Math.max(25, s.unlock / 1.6) * dt);
      state.money -= amt; st.paid += amt;
      if (Math.random() < dt * 20) fx.push({ type: 'coin', x: p.x, y: p.y - 30, tx: s.front.x, ty: s.front.y, t: 0 });
      if (st.paid >= s.unlock - 1e-6) unlockSection(s.id);
    }
  }
  // Hire pads: money flows in while you stand on them
  for (const k in HIRE_PADS) {
    if (state.staff[k]) continue;
    const pad = HIRE_PADS[k], cost = STAFF[k].cost;
    if (inRect(p, padRect(pad)) && state.money > 0) {
      const amt = Math.min(state.money, cost - state.staffPaid[k], Math.max(25, cost / 1.6) * dt);
      state.money -= amt; state.staffPaid[k] += amt;
      if (Math.random() < dt * 20) fx.push({ type: 'coin', x: p.x, y: p.y - 30, tx: pad.x, ty: pad.y, t: 0 });
      if (state.staffPaid[k] >= cost - 1e-6) hireStaff(k);
    }
  }
}
function hireStaff(k) {
  if (state.staff[k]) return;
  state.staff[k] = true;
  if (state.staffPaid[k] !== undefined) state.staffPaid[k] = STAFF[k].cost;
  sfx.unlock(); confetti();
  toast(`${STAFF[k].icon} ${STAFF[k].name} joined your team!`);
  save();
}
function moveAxis(p, dx, dy) {
  const nx = Math.max(16 + PLAYER_R, Math.min(W - 16 - PLAYER_R, p.x + dx));
  const ny = Math.max(16 + PLAYER_R, Math.min(H - 30, p.y + dy));
  const probe = { x: nx, y: ny };
  if (obstacles().some(r => inRect(probe, r, PLAYER_R - 2))) return;
  p.x = nx; p.y = ny;
}
// Sections unlock in order
function canUnlockNext(id) {
  const i = SECTIONS.findIndex(s => s.id === id);
  return SECTIONS.slice(0, i).every(s => state.sec[s.id].unlocked);
}
function unlockSection(id) {
  const st = state.sec[id];
  st.unlocked = true; st.paid = SEC[id].unlock;
  if (SEC[id].shelf) st.stock = 3;
  sfx.unlock(); confetti();
  toast(`${SEC[id].icon} ${SEC[id].name} unlocked!`);
  // Push the player off the new shelf if needed
  const p = state.player;
  if (SEC[id].shelf && inRect(p, SEC[id].shelf, PLAYER_R)) p.y = SEC[id].shelf.y + SEC[id].shelf.h + PLAYER_R + 4;
  if (SEC[id].bench && inRect(p, SEC[id].bench, PLAYER_R)) p.y = SEC[id].bench.y + SEC[id].bench.h + PLAYER_R + 4;
  save();
}

// ---------- Staff NPCs ----------
function ensureNpcs() {
  if (state.staff.cashier && !npcs.cashier) npcs.cashier = { x: REGISTER.x - 34, y: REGISTER.y, path: [], speed: 0, shirt: '#2b2350', skin: '#e0ac69', hair: '#111', cap: '#ffc83d', face: 1 };
  if (state.staff.tech && !npcs.tech) npcs.tech = { x: SEC.svc.bench.x + 95, y: SEC.svc.bench.y - 22, path: [], speed: 0, shirt: '#ff6b9a', skin: '#c68642', hair: '#2b1d0e', cap: '#2b2350', face: 1 };
  if (state.staff.stocker && !npcs.stocker) npcs.stocker = { x: AISLE_X, y: 180, path: [], speed: 125, shirt: '#06d6a0', skin: '#f5d0a9', hair: '#b5542b', cap: '#2b2350', carry: [], job: 'idle', timer: 0, face: 1 };
}
function updateStocker(dt) {
  const n = npcs.stocker;
  if (!n) return;
  n.moving = false;
  n.speed = stockerSpeed();
  if (!walk(n, dt)) return;
  n.timer += dt;
  if (n.job === 'idle') {
    if (n.timer < 0.5) return;
    n.timer = 0;
    const need = unlockedParts()
      .map(s => ({ s, ratio: state.sec[s.id].stock / shelfCap(s.id) }))
      .filter(o => o.ratio < 0.6)
      .sort((a, b) => a.ratio - b.ratio)[0];
    if (!need) return;
    n.target = need.s.id; n.job = 'load';
    n.path = route(n, need.s.crate);
  } else if (n.job === 'load') {
    const st = state.sec[n.target];
    const want = Math.min(stockerCarry(), shelfCap(n.target) - st.stock);
    if (n.carry.length < want && n.timer > 0.3 * stockerHandTime()) { n.carry.push(n.target); n.timer = 0; }
    if (n.carry.length >= want) {
      n.job = 'unload'; n.timer = 0;
      const f = SEC[n.target].front;
      n.path = route(n, { x: f.x + (Math.random() * 60 - 30), y: f.y - 8 });
    }
  } else if (n.job === 'unload') {
    const st = state.sec[n.target];
    if (n.timer > 0.25 * stockerHandTime()) {
      n.timer = 0;
      if (n.carry.length && st.stock < shelfCap(n.target)) { n.carry.pop(); st.stock++; }
      else { n.carry = []; n.job = 'idle'; }
    }
  }
}

// ---------- Main update ----------
function update(dt) {
  updatePlayer(dt);
  ensureNpcs();
  updateStocker(dt);

  spawnTimer -= dt;
  const maxShoppers = Math.min(10, 2 + unlockedParts().length * 2);
  if (spawnTimer <= 0) {
    if (customers.length < maxShoppers) spawnCustomer();
    spawnTimer = Math.max(1.4, 4.5 - 0.7 * (unlockedParts().length - 1)) * (0.7 + Math.random() * 0.6);
  }
  for (const c of customers) updateCustomer(c, dt);
  customers = customers.filter(c => !c.remove);
  updateRegister(dt);
  updateService(dt);

  for (const f of fx) f.t += dt;
  fx = fx.filter(f => f.t < (f.type === 'text' ? 1.2 : 0.6));
}

// ---------- Rendering ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = 1, zoom = 1, cssW = 0, cssH = 0, cam = { x: 300, y: 600 };
function resize() {
  const r = canvas.getBoundingClientRect();
  cssW = r.width; cssH = r.height;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * DPR);
  canvas.height = Math.round(cssH * DPR);
  zoom = Math.min(cssW / VIEW_UNITS, cssH / 700);
  for (const k in emojiCache) delete emojiCache[k];
}
window.addEventListener('resize', resize);

const emojiCache = {};
function drawEmoji(ch, x, y, size) {
  const px = Math.max(4, Math.round(size * zoom * DPR));
  const key = ch + px;
  let c = emojiCache[key];
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(px * 1.4);
    const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.fillText(ch, c.width / 2, c.height / 2 + px * 0.06);
    emojiCache[key] = c;
  }
  ctx.drawImage(c, x - size * 0.7, y - size * 0.7, size * 1.4, size * 1.4);
}
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function text(str, x, y, size, color, weight = 700, align = 'center') {
  ctx.font = `${weight} ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
function outlinedText(str, x, y, size, color, stroke = '#2b2350') {
  ctx.font = `700 ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = size / 4; ctx.strokeStyle = stroke; ctx.lineJoin = 'round';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}

let time = 0;
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1d1147';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Camera follows the player, clamped to the store
  const vw = cssW / zoom, vh = cssH / zoom;
  const tx = vw >= W ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, state.player.x));
  const ty = vh >= H ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2 + 40, state.player.y));
  cam.x += (tx - cam.x) * 0.15; cam.y += (ty - cam.y) * 0.15;
  ctx.setTransform(zoom * DPR, 0, 0, zoom * DPR, (cssW / 2 - cam.x * zoom) * DPR, (cssH / 2 - cam.y * zoom) * DPR);

  drawFloor();
  drawStockroom();
  drawCheckout();
  for (const s of PARTS) drawShelf(s);
  drawService();
  drawUnlockPads();
  drawHirePads();

  // Characters, sorted by depth
  const people = [...customers.map(c => ({ o: c, kind: 'cust' })), { o: state.player, kind: 'player' }];
  for (const k in npcs) people.push({ o: npcs[k], kind: 'staff' });
  people.sort((a, b) => a.o.y - b.o.y);
  for (const p of people) drawPerson(p.o, p.kind);
  for (const c of customers) drawBubble(c);

  drawFx();
  drawObjective();
}

function drawFloor() {
  // walls
  rr(0, 0, W, H, 18); ctx.fillStyle = '#3b2a7a'; ctx.fill();
  // tiles
  ctx.save();
  rr(16, 16, W - 32, H - 32, 10); ctx.clip();
  for (let y = 16; y < H; y += 40) for (let x = 16; x < W; x += 40) {
    ctx.fillStyle = ((x + y) / 40) % 2 === 0 ? '#f4f1ff' : '#e9e4fb';
    ctx.fillRect(x, y, 40, 40);
  }
  ctx.restore();
  // door
  ctx.fillStyle = '#8fd3ff';
  ctx.fillRect(250, H - 18, 100, 18);
  text('ENTRANCE', 300, H - 9, 11, '#1d4e74');
  // entrance mat
  rr(255, H - 70, 90, 46, 8); ctx.fillStyle = '#d8d0f5'; ctx.fill();
}

function drawStockroom() {
  rr(16, 16, W - 32, 150, 10); ctx.fillStyle = '#d9cfa8'; ctx.fill();
  ctx.strokeStyle = '#b9ab78'; ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(16, 166); ctx.lineTo(W - 16, 166); ctx.stroke(); ctx.setLineDash([]);
  text('STOCKROOM', 300, 32, 13, '#7a6a35');
  for (const s of PARTS) {
    const r = crateRect(s);
    const on = state.sec[s.id].unlocked;
    ctx.globalAlpha = on ? 1 : 0.3;
    rr(r.x, r.y + 6, r.w, r.h, 10); ctx.fillStyle = '#8a6a2f'; ctx.fill();
    rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = '#c99a4a'; ctx.fill();
    ctx.strokeStyle = '#a77c34'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(r.x + 6, r.y + r.h / 2); ctx.lineTo(r.x + r.w - 6, r.y + r.h / 2); ctx.stroke();
    drawEmoji(on ? s.icon : '🔒', s.crate.x, s.crate.y - 4, 24);
    text(s.items[0].toUpperCase() + s.items.slice(1), s.crate.x, r.y + r.h + 16, 11, '#7a6a35');
    ctx.globalAlpha = 1;
  }
}

function drawShelf(s) {
  const st = state.sec[s.id];
  const r = s.shelf;
  if (!st.unlocked) {
    ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.strokeStyle = '#b8aee0';
    rr(r.x, r.y, r.w, r.h, 10); ctx.stroke(); ctx.setLineDash([]);
    text(s.name, r.x + r.w / 2, r.y + r.h / 2, 14, '#a59bd0');
    return;
  }
  // drop zone hint when carrying this item
  if (state.carry.includes(s.id)) {
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 6);
    rr(r.x - 30, r.y - 30, r.w + 60, r.h + 60, 18); ctx.fillStyle = s.color; ctx.fill();
    ctx.globalAlpha = 1;
  }
  rr(r.x, r.y + 8, r.w, r.h, 10); ctx.fillStyle = '#5a4a9a'; ctx.fill();
  rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = '#8b7ad6'; ctx.fill();
  rr(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 7); ctx.fillStyle = '#6d5cc0'; ctx.fill();
  // items on the shelf
  const cap = shelfCap(s.id);
  const per = Math.min(10, cap);
  const step = (r.w - 24) / (per - 1 || 1);
  for (let i = 0; i < st.stock; i++) {
    const col = i % per, row = Math.floor(i / per);
    drawEmoji(s.icon, r.x + 12 + col * step, r.y + r.h / 2 - row * 8, 17);
  }
  // sign
  const label = `${s.name} · ${money$(price(s.id))}`;
  rr(r.x + r.w / 2 - 78, r.y - 24, 156, 20, 8); ctx.fillStyle = s.color; ctx.fill();
  text(label, r.x + r.w / 2, r.y - 14, 11, '#fff');
  text(`${st.stock}/${cap}`, r.x + r.w - 4, r.y + r.h + 16, 11, st.stock ? '#6b6390' : '#ff5a5f', 700, 'right');
  if (!st.stock) outlinedText('EMPTY!', r.x + r.w / 2, r.y + r.h / 2, 15, '#ff5a5f', '#fff');
}

function drawCheckout() {
  const r = COUNTER;
  // register pad (where you stand)
  const here = dist(state.player, REGISTER) < 36;
  ctx.beginPath(); ctx.arc(REGISTER.x, REGISTER.y, 28, 0, Math.PI * 2);
  ctx.fillStyle = here ? 'rgba(46,204,113,.45)' : 'rgba(255,200,61,.45)'; ctx.fill();
  ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.strokeStyle = here ? '#1e9e55' : '#d99a00'; ctx.stroke(); ctx.setLineDash([]);
  rr(r.x, r.y + 8, r.w, r.h, 10); ctx.fillStyle = '#7a4b1e'; ctx.fill();
  rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = '#b8743a'; ctx.fill();
  rr(r.x + 90, r.y + 6, 44, 26, 6); ctx.fillStyle = '#2b2350'; ctx.fill();
  rr(r.x + 95, r.y + 10, 34, 12, 3); ctx.fillStyle = '#7ef0a8'; ctx.fill();
  text('CHECKOUT', r.x + 46, r.y + r.h / 2, 12, '#fff');
  // queue markers
  for (let i = 0; i < 5; i++) {
    const q = queueSlot(i);
    ctx.beginPath(); ctx.arc(q.x, q.y + 12, 6, 0, Math.PI * 2); ctx.fillStyle = '#d8d0f5'; ctx.fill();
  }
  if (queue.length && !here && !state.staff.cashier) outlinedText('Customers waiting!', REGISTER.x, REGISTER.y - 42, 12, '#ffc83d');
  // scan progress
  const f = queue[0];
  if (f && f.cart.length && (here || state.staff.cashier)) {
    const pct = f.scanned / f.cart.length;
    rr(r.x + 20, r.y + r.h + 14, 120, 8, 4); ctx.fillStyle = '#ddd6f7'; ctx.fill();
    rr(r.x + 20, r.y + r.h + 14, 120 * pct, 8, 4); ctx.fillStyle = '#2ecc71'; ctx.fill();
  }
}

function drawService() {
  const s = SEC.svc, st = state.sec.svc, r = s.bench;
  if (!st.unlocked) {
    ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.strokeStyle = '#b8aee0';
    rr(r.x, r.y, r.w, r.h, 10); ctx.stroke(); ctx.setLineDash([]);
    text('Service Station', r.x + r.w / 2, r.y + r.h / 2, 14, '#a59bd0');
    return;
  }
  const here = dist(state.player, s.workPad) < 34;
  ctx.beginPath(); ctx.arc(s.workPad.x, s.workPad.y, 26, 0, Math.PI * 2);
  ctx.fillStyle = here ? 'rgba(46,204,113,.45)' : 'rgba(255,107,154,.35)'; ctx.fill();
  ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.strokeStyle = here ? '#1e9e55' : '#ff6b9a'; ctx.stroke(); ctx.setLineDash([]);
  rr(r.x, r.y + 8, r.w, r.h, 10); ctx.fillStyle = '#9a3d5c'; ctx.fill();
  rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = '#ff8fb1'; ctx.fill();
  rr(r.x + r.w / 2 - 84, r.y - 24, 168, 20, 8); ctx.fillStyle = s.color; ctx.fill();
  text(`Service Station · ${money$(price('svc'))}/build`, r.x + r.w / 2, r.y - 14, 11, '#fff');
  const waiting = customers.find(c => c.state === 'svc' && !c.path.length);
  drawEmoji(waiting ? '🖥️' : '🧰', r.x + 60, r.y + r.h / 2, 22);
  drawEmoji('🔧', r.x + 120, r.y + r.h / 2, 18);
  if (waiting) {
    rr(r.x + 20, r.y + r.h + 46, 150, 10, 5); ctx.fillStyle = '#ddd6f7'; ctx.fill();
    rr(r.x + 20, r.y + r.h + 46, 150 * buildProgress, 10, 5); ctx.fillStyle = '#ff6b9a'; ctx.fill();
    if (!here && !state.staff.tech) outlinedText('Build a PC here!', s.workPad.x, s.workPad.y + 40, 12, '#ffc83d');
  }
}

function drawUnlockPads() {
  for (const s of SECTIONS) {
    const st = state.sec[s.id];
    if (st.unlocked || !canUnlockNext(s.id)) continue;
    const r = padRect(s.front);
    const pct = st.paid / s.unlock;
    const pulse = 1 + 0.04 * Math.sin(time * 5);
    ctx.save();
    ctx.translate(s.front.x, s.front.y); ctx.scale(pulse, pulse); ctx.translate(-s.front.x, -s.front.y);
    rr(r.x, r.y + 5, r.w, r.h, 12); ctx.fillStyle = '#d99a00'; ctx.fill();
    rr(r.x, r.y, r.w, r.h, 12); ctx.fillStyle = '#ffe17a'; ctx.fill();
    ctx.save(); rr(r.x, r.y, r.w, r.h, 12); ctx.clip();
    ctx.fillStyle = '#2ecc71'; ctx.fillRect(r.x, r.y, r.w * pct, r.h); ctx.restore();
    drawEmoji(s.icon, r.x + 18, r.y + r.h / 2, 18);
    text('UNLOCK', r.x + r.w / 2 + 10, r.y + 18, 11, '#6b4200');
    text(money$(Math.ceil(s.unlock - st.paid)), r.x + r.w / 2 + 10, r.y + 36, 15, '#6b4200');
    ctx.restore();
  }
}

function drawHirePads() {
  for (const k in HIRE_PADS) {
    if (state.staff[k]) continue;
    const pad = HIRE_PADS[k], r = padRect(pad), cost = STAFF[k].cost;
    const pct = state.staffPaid[k] / cost;
    rr(r.x, r.y + 5, r.w, r.h, 12); ctx.fillStyle = '#1f6fb2'; ctx.fill();
    rr(r.x, r.y, r.w, r.h, 12); ctx.fillStyle = '#8fd3ff'; ctx.fill();
    ctx.save(); rr(r.x, r.y, r.w, r.h, 12); ctx.clip();
    ctx.fillStyle = '#2ecc71'; ctx.fillRect(r.x, r.y, r.w * pct, r.h); ctx.restore();
    drawEmoji(STAFF[k].icon, r.x + 18, r.y + r.h / 2, 18);
    text('HIRE ' + pad.label, r.x + r.w / 2 + 10, r.y + 18, 9, '#123a5c');
    text(money$(Math.ceil(cost - state.staffPaid[k])), r.x + r.w / 2 + 10, r.y + 36, 15, '#123a5c');
  }
}

function drawPerson(o, kind) {
  const bob = o.moving ? Math.sin(time * 14 + (o.x + o.y) * 0.05) * 2 : 0;
  const x = o.x, y = o.y;
  // shadow
  ctx.beginPath(); ctx.ellipse(x, y + 4, 14, 6, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fill();
  // legs
  const step = o.moving ? Math.sin(time * 14 + x * 0.1) * 4 : 0;
  ctx.fillStyle = '#2b2350';
  rr(x - 8, y - 8 + step * 0.3, 6, 12, 3); ctx.fill();
  rr(x + 2, y - 8 - step * 0.3, 6, 12, 3); ctx.fill();
  // body
  const shirt = kind === 'player' ? '#3a86ff' : o.shirt;
  rr(x - 12, y - 28 + bob, 24, 24, 9); ctx.fillStyle = shirt; ctx.fill();
  if (kind !== 'cust') { rr(x - 7, y - 24 + bob, 14, 16, 4); ctx.fillStyle = kind === 'player' ? '#ffc83d' : 'rgba(255,255,255,.6)'; ctx.fill(); }
  // head
  const hy = y - 38 + bob;
  ctx.beginPath(); ctx.arc(x, hy, 11, 0, Math.PI * 2); ctx.fillStyle = o.skin || '#f5d0a9'; ctx.fill();
  // hair or cap
  ctx.beginPath(); ctx.arc(x, hy - 3, 11, Math.PI, 0); ctx.fillStyle = kind === 'player' ? '#ff5a5f' : (o.cap || o.hair); ctx.fill();
  if (kind !== 'cust') { rr(x + (o.face || 1) * 2 - 8 + (o.face || 1) * 6, hy - 6, 14, 4, 2); ctx.fill(); }
  // eyes
  ctx.fillStyle = '#2b2350';
  const ex = (o.face || 1) * 2;
  ctx.beginPath(); ctx.arc(x - 4 + ex, hy + 1, 1.8, 0, Math.PI * 2); ctx.arc(x + 4 + ex, hy + 1, 1.8, 0, Math.PI * 2); ctx.fill();
  // carried boxes
  const stack = kind === 'player' ? state.carry : (o.carry || []);
  for (let i = 0; i < stack.length; i++) {
    const by = y - 58 + bob - i * 12;
    rr(x - 11, by - 6, 22, 13, 3); ctx.fillStyle = SEC[stack[i]].color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  if (kind === 'player' && stack.length >= carryCap()) outlinedText('FULL', x, y - 66 - stack.length * 12, 11, '#fff');
  if (o.carryPC) drawEmoji('🖥️', x + 14, y - 20, 16);
  // shopping bag
  if (kind === 'cust' && o.cart.length && o.state !== 'shop') drawEmoji('🛍️', x + 14, y - 14 + bob, 14);
  if (kind === 'player') outlinedText('YOU', x, y + 14, 10, '#fff', '#3a86ff');
}

function drawBubble(c) {
  let icon = null, red = false;
  if (c.mood && c.moodT < 1.5) icon = c.mood === 'happy' ? '😄' : '😠';
  else if (c.state === 'shop' && c.idx < c.wants.length) { icon = SEC[c.wants[c.idx]].icon; red = c.waiting; }
  else if (c.state === 'svc') { icon = '🛠️'; }
  else if (c.state === 'queue') icon = '💳';
  if (!icon) return;
  const x = c.x + 16, y = c.y - 62;
  ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fillStyle = red ? '#ffe1e2' : '#fff'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = red ? '#ff5a5f' : '#d9d2f5'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 8, y + 10); ctx.lineTo(x - 14, y + 18); ctx.lineTo(x - 2, y + 13); ctx.fill();
  drawEmoji(icon, x, y, 16);
  if (red) outlinedText('!', x + 14, y - 12, 14, '#ff5a5f', '#fff');
}

function drawFx() {
  for (const f of fx) {
    if (f.type === 'text') {
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.2);
      outlinedText(f.text, f.x, f.y - f.t * 40, 18, '#7ef0a8', '#1e5e36');
    } else if (f.type === 'coin') {
      const k = f.t / 0.6;
      drawEmoji('🪙', f.x + (f.tx - f.x) * k, f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 30, 14);
    } else if (f.type === 'spark') {
      ctx.globalAlpha = 1 - f.t / 0.6;
      drawEmoji('✨', f.x, f.y - f.t * 30, 12);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- Objective arrow (tutorial help) ----------
function objective() {
  const p = state.player;
  const atReg = dist(p, REGISTER) < 36;
  const carried = state.carry[0];
  if (carried) {
    const s = SEC[carried];
    if (state.sec[carried].stock < shelfCap(carried)) return { pt: s.front, text: `Put the ${s.items} on the ${s.name} shelf` };
  }
  if (queue.length && !state.staff.cashier) return atReg ? { pt: REGISTER, text: 'Stay here to check out the line' } : { pt: REGISTER, text: 'Go to the register to check out customers' };
  const svcWaiting = customers.some(c => c.state === 'svc' && !c.path.length);
  if (svcWaiting && !state.staff.tech && dist(p, SEC.svc.workPad) > 34) return { pt: SEC.svc.workPad, text: 'A customer wants a custom PC. Go build it!' };
  const next = SECTIONS.find(s => !state.sec[s.id].unlocked);
  if (next && state.money >= next.unlock - state.sec[next.id].paid) return { pt: next.front, text: `Stand on the pad to unlock ${next.name}` };
  for (const k in HIRE_PADS) {
    if (!state.staff[k] && state.money >= staffRemaining(k) && !inRect(p, padRect(HIRE_PADS[k])))
      return { pt: HIRE_PADS[k], text: `Stand on the pad to hire a ${HIRE_PADS[k].label.toLowerCase()}` };
  }
  const low = unlockedParts().find(s => state.sec[s.id].stock === 0) || (state.carry.length === 0 && unlockedParts().find(s => state.sec[s.id].stock < 2));
  if (low && state.carry.length < carryCap()) return { pt: low.crate, text: `Grab ${low.items} from the stockroom` };
  return null;
}
let currentObjective = null;
function drawObjective() {
  const o = currentObjective;
  if (!o) return;
  const p = state.player;
  const d = dist(p, o.pt);
  // pulsing ring on the target
  ctx.beginPath(); ctx.arc(o.pt.x, o.pt.y, 30 + 6 * Math.sin(time * 6), 0, Math.PI * 2);
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,200,61,.9)'; ctx.stroke();
  if (d < 50) return;
  const a = Math.atan2(o.pt.y - p.y, o.pt.x - p.x);
  const ax = p.x + Math.cos(a) * 42, ay = p.y - 14 + Math.sin(a) * 42;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath();
  ctx.fillStyle = '#ffc83d'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#6b4200'; ctx.stroke();
  ctx.restore();
}

// ---------- Joystick ----------
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
const JOY_R = 55;
canvas.addEventListener('pointerdown', e => {
  if (joy.active) return;
  joy.active = true; joy.id = e.pointerId;
  joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  moveJoy(e);
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
});
canvas.addEventListener('pointermove', e => { if (joy.active && e.pointerId === joy.id) moveJoy(e); });
function endJoy(e) {
  if (!joy.active || e.pointerId !== joy.id) return;
  joy.active = false; input.x = input.y = 0;
}
canvas.addEventListener('pointerup', endJoy);
canvas.addEventListener('pointercancel', endJoy);
function moveJoy(e) {
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
  const mag = Math.min(1, d / JOY_R);
  input.x = d > 6 ? dx / (Math.hypot(dx, dy) || 1) * mag : 0;
  input.y = d > 6 ? dy / (Math.hypot(dx, dy) || 1) * mag : 0;
}
const keys = new Set();
window.addEventListener('keydown', e => { keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
window.addEventListener('keyup', e => { keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
window.addEventListener('blur', () => keys.clear());

// ---------- HUD ----------
const $ = sel => document.querySelector(sel);
let lastMoneyText = '';
function bumpMoney() { const m = $('#money'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); }
let hudTimer = 0;
function updateHud(dt) {
  const mt = fmt(state.money);
  if (mt !== lastMoneyText) { $('#moneyVal').textContent = mt; lastMoneyText = mt; }
  hudTimer += dt;
  if (hudTimer < 0.25) return;
  hudTimer = 0;
  $('#incomeVal').textContent = money$(state.rate * 60);
  $('#storeName').textContent = state.storeName;
  currentObjective = state.lifetime < 4000 || (queue.length && !state.staff.cashier) ? objective() : null;
  const hint = $('#hint');
  hint.textContent = currentObjective ? currentObjective.text : '';
  hint.classList.toggle('show', !!currentObjective);
  $('#upgradeBtn').classList.toggle('alert', anyAffordable());
  if (!$('#modal').classList.contains('hidden')) {
    document.querySelectorAll('#modalCard [data-cost]').forEach(b => b.classList.toggle('disabled', state.money < +b.dataset.cost));
  }
}
let rateTimer = 0;
function updateRate(dt) {
  rateTimer += dt;
  if (rateTimer >= 1) {
    state.rate = state.rate * 0.95 + (rateBucket / rateTimer) * 0.05;
    rateBucket = 0; rateTimer = 0;
  }
}

// ---------- Upgrades panel ----------
function anyAffordable() {
  for (const s of SECTIONS) if (state.sec[s.id].unlocked && state.money >= levelCost(s.id)) return true;
  for (const k in STAFF) if (!state.staff[k] && staffAvailable(k) && state.money >= staffRemaining(k)) return true;
  if (state.speedLv < MAX_PLAYER_LV && state.money >= speedCost()) return true;
  if (state.carryLv < MAX_PLAYER_LV && state.money >= carryCost()) return true;
  for (const u of STAFF_UPGRADES) if (state.staff[u.staff] && staffLv(u.id) < u.max && state.money >= staffUpCost(u.id)) return true;
  return false;
}
function staffRemaining(k) { return STAFF[k].cost - (state.staffPaid[k] || 0); }
function staffAvailable(k) { return k !== 'tech' || state.sec.svc.unlocked; }
function showUpgrades() {
  let html = `<div class="sheet-head"><h2>Upgrades</h2><button class="icon-btn small" data-act="close" aria-label="Close">✕</button></div>`;
  html += `<div class="group">Sections <span>Level up to raise prices</span></div>`;
  for (const s of SECTIONS) {
    const st = state.sec[s.id];
    if (!st.unlocked) {
      html += `<div class="item locked"><div class="avatar" style="--c:${s.color}">🔒</div><div class="info"><div class="title">${s.name}</div><div class="desc">Unlock on the store floor for ${money$(s.unlock)}</div></div></div>`;
      continue;
    }
    const next = st.level + 1;
    const nm = MILESTONES.find(m => m > st.level);
    const cur = price(s.id);
    st.level++; const after = price(s.id); st.level--;
    html += `<div class="item"><div class="avatar" style="--c:${s.color}">${s.icon}</div>
      <div class="info"><div class="title">${s.name} <small>Lv ${st.level}</small></div>
      <div class="desc">${s.item}: ${money$(cur)} → <b>${money$(after)}</b>${nm ? ` · x2 at Lv ${nm}` : ''}${s.shelf ? ` · holds ${shelfCap(s.id)}` : ''}</div></div>
      <button class="btn green" data-act="level" data-id="${s.id}" data-cost="${levelCost(s.id)}">Lv ${next}<small>${money$(levelCost(s.id))}</small></button></div>`;
  }
  html += `<div class="group">Staff <span>They work while you play</span></div>`;
  for (const k in STAFF) {
    const s = STAFF[k];
    const avail = staffAvailable(k);
    html += `<div class="item ${state.staff[k] ? 'done' : ''}"><div class="avatar" style="--c:#ece8fb">${s.icon}</div>
      <div class="info"><div class="title">${s.name}</div><div class="desc">${avail ? s.desc + (HIRE_PADS[k] && !state.staff[k] ? ' · or hire on the store floor' : '') : 'Unlock the Service Station first'}</div></div>
      ${state.staff[k] ? '<button class="btn owned" disabled>Hired ✓</button>'
        : avail ? `<button class="btn green" data-act="hire" data-id="${k}" data-cost="${staffRemaining(k)}">Hire<small>${money$(staffRemaining(k))}</small></button>` : ''}</div>`;
    if (state.staff[k]) for (const u of STAFF_UPGRADES.filter(x => x.staff === k)) {
      const lv = staffLv(u.id);
      html += `<div class="item sub"><div class="avatar" style="--c:#fff4d1">${u.icon}</div>
        <div class="info"><div class="title">${u.title} <small>Lv ${lv}/${u.max}</small></div><div class="desc">${u.desc()}</div></div>
        ${lv >= u.max ? '<button class="btn owned" disabled>MAX</button>' : `<button class="btn green" data-act="staffUp" data-id="${u.id}" data-cost="${staffUpCost(u.id)}">Buy<small>${money$(staffUpCost(u.id))}</small></button>`}</div>`;
    }
  }
  html += `<div class="group">You</div>`;
  html += playerRow('speed', '👟', 'Running Shoes', `Walk speed Lv ${state.speedLv}/${MAX_PLAYER_LV}`, state.speedLv, speedCost());
  html += playerRow('carry', '📦', 'Bigger Arms', `Carry ${carryCap()} boxes${state.carryLv < MAX_PLAYER_LV ? ` → ${carryCap() + 2}` : ''}`, state.carryLv, carryCost());
  showModal(html, true);
  updateHud(1);
}
function playerRow(act, icon, title, desc, lv, cost) {
  return `<div class="item"><div class="avatar" style="--c:#dff1ff">${icon}</div>
    <div class="info"><div class="title">${title}</div><div class="desc">${desc}</div></div>
    ${lv >= MAX_PLAYER_LV ? '<button class="btn owned" disabled>MAX</button>' : `<button class="btn green" data-act="${act}" data-cost="${cost}">Buy<small>${money$(cost)}</small></button>`}</div>`;
}
function spend(amount) {
  if (state.money + 1e-9 < amount) return false;
  state.money = Math.max(0, state.money - amount);
  return true;
}

// ---------- FX & UI helpers ----------
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
function showModal(html, sheet = false) {
  $('#modalCard').innerHTML = html;
  $('#modalCard').classList.toggle('sheet', sheet);
  $('#modal').classList.toggle('as-sheet', sheet);
  $('#modal').classList.remove('hidden');
  input.x = input.y = 0;
}
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

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id } = el.dataset;
  switch (act) {
    case 'level':
      if (spend(levelCost(id))) {
        state.sec[id].level++;
        sfx.unlock();
        const L = state.sec[id].level;
        toast(MILESTONES.includes(L) ? `🏆 ${SEC[id].name} Lv ${L}! Prices x2` : `⬆️ ${SEC[id].name} Lv ${L}: ${SEC[id].item} now sells for ${money$(price(id))}`);
        showUpgrades();
      }
      break;
    case 'hire':
      if (!state.staff[id] && spend(staffRemaining(id))) { hireStaff(id); showUpgrades(); }
      break;
    case 'speed':
      if (state.speedLv < MAX_PLAYER_LV && spend(speedCost())) { state.speedLv++; sfx.unlock(); showUpgrades(); }
      break;
    case 'staffUp': {
      const u = STAFF_UP[id];
      if (u && state.staff[u.staff] && staffLv(id) < u.max && spend(staffUpCost(id))) {
        state.staffLv[id] = staffLv(id) + 1;
        sfx.unlock();
        toast(`${u.icon} ${u.title} Lv ${state.staffLv[id]}: ${u.desc()}`);
        showUpgrades();
      }
      break;
    }
    case 'carry':
      if (state.carryLv < MAX_PLAYER_LV && spend(carryCost())) { state.carryLv++; sfx.unlock(); showUpgrades(); }
      break;
    case 'close': closeModal(); break;
    case 'saveName': {
      const v = ($('#nameInput').value || '').trim();
      if (v) state.storeName = v.slice(0, 24);
      save(); closeModal();
      break;
    }
    case 'toggleSound': state.sound = !state.sound; showSettings(); break;
    case 'askReset':
      showModal(`<div class="emoji">⚠️</div><h2>Reset everything?</h2><p>This wipes all progress.</p>
        <button class="btn danger" data-act="confirmReset">Yes, reset</button><button class="btn disabled" data-act="close">Cancel</button>`);
      break;
    case 'confirmReset':
      state = freshState();
      customers = []; queue = []; fx = []; buildProgress = 0;
      for (const k in npcs) delete npcs[k];
      save(); closeModal();
      break;
  }
});
$('#upgradeBtn').addEventListener('click', showUpgrades);
$('#settingsBtn').addEventListener('click', showSettings);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

// ---------- Offline earnings ----------
function applyOffline() {
  const away = Math.min(2 * 3600, (Date.now() - (state.lastSeen || Date.now())) / 1000);
  state.lastSeen = Date.now();
  if (away < 30 || !state.staff.cashier || !state.staff.stocker) return;
  const earned = state.rate * away * 0.5;
  if (earned < 1) return;
  earn(earned);
  showModal(`
    <div class="emoji">🌙</div>
    <h2>Welcome back!</h2>
    <p>Your staff kept the store open for ${fmtTime(away)}.</p>
    <div style="font-size:30px;font-weight:700;color:var(--green-dark)">+${money$(earned)}</div>
    <button class="btn green" data-act="close">Collect</button>`);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else { applyOffline(); last = performance.now(); }
});
window.addEventListener('pagehide', save);

// ---------- Loop ----------
let last = performance.now(), saveTimer = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  update(dt);
  updateRate(dt);
  updateHud(dt);
  render();
  saveTimer += dt;
  if (saveTimer > 5) { save(); saveTimer = 0; }
  requestAnimationFrame(frame);
}

resize();
cam.x = state.player.x; cam.y = state.player.y;
applyOffline();
requestAnimationFrame(t => { last = t; frame(t); });
if (isNewPlayer) toast('👆 Drag anywhere to move. Restock shelves and check out shoppers!');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
