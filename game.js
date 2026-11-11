'use strict';

/* =========================================================
   PC Parts Tycoon — run a PC parts store as a character.
   Move with the touch joystick, restock shelves from the
   stockroom, and check shoppers out at the register.
   ========================================================= */

const SAVE_KEY = 'pcPartsTycoon_store_v2';
const W_MAIN = 600, W_FULL = 1000, H = 1020;   // store size; the expansion wing adds x 600..1000
function worldW() { return state.expanded ? W_FULL : W_MAIN; }
const VIEW_UNITS = 610;              // how many world units fit across the screen
const MILESTONES = [10, 25, 50, 100];

// ---------- Store layout ("Racetrack Loop") ----------
// Stockroom across the top, wall shelves left & right, a center island with
// two back-to-back shelves, and a one-way loop: in bottom-left, out bottom-right.
const SECTIONS = [
  { id: 'acc', name: 'Accessories', item: 'Mouse', items: 'mice', icon: '🖱️', color: '#4fb3ff', price: 8, unlock: 0,
    shelf: { x: 26, y: 270, w: 40, h: 330 }, crate: { x: 90, y: 90 }, stockSpot: { x: 94, y: 435 }, pad: { x: 120, y: 435 } },
  { id: 'case', name: 'PC Cases', item: 'PC Case', items: 'PC cases', icon: '🗄️', color: '#a77bff', price: 25, unlock: 120,
    shelf: { x: 534, y: 270, w: 40, h: 330 }, crate: { x: 205, y: 90 }, stockSpot: { x: 506, y: 435 }, pad: { x: 478, y: 435 } },
  { id: 'mon', name: 'Monitors', item: 'Monitor', items: 'monitors', icon: '🖥️', color: '#2ecc8f', price: 60, unlock: 600,
    shelf: { x: 200, y: 345, w: 200, h: 42 }, crate: { x: 320, y: 90 }, stockSpot: { x: 300, y: 321 }, pad: { x: 300, y: 313 } },
  { id: 'gpu', name: 'Graphics Cards', item: 'GPU', items: 'GPUs', icon: '🎮', color: '#ff9f43', price: 140, unlock: 2500,
    shelf: { x: 200, y: 465, w: 200, h: 42 }, crate: { x: 435, y: 90 }, stockSpot: { x: 300, y: 533 }, pad: { x: 300, y: 548 } },
  { id: 'svc', name: 'Service Station', item: 'Custom PC', items: 'custom PCs', icon: '🛠️', color: '#ff6b9a', price: 400, unlock: 10000,
    bench: { x: 210, y: 200, w: 180, h: 40 }, pad: { x: 300, y: 272 } },
  // ----- Expansion wing -----
  { id: 'cpu', name: 'CPUs', item: 'CPU', items: 'CPUs', icon: '🧠', color: '#3bb5b5', price: 220, unlock: 30000, wing: true,
    shelf: { x: 660, y: 300, w: 200, h: 42 }, crate: { x: 690, y: 90 }, stockSpot: { x: 760, y: 276 }, pad: { x: 760, y: 372 } },
  { id: 'ram', name: 'RAM & Storage', item: 'RAM Kit', items: 'RAM kits', icon: '💾', color: '#e05fb0', price: 350, unlock: 75000, wing: true,
    shelf: { x: 660, y: 470, w: 200, h: 42 }, crate: { x: 805, y: 90 }, stockSpot: { x: 760, y: 446 }, pad: { x: 760, y: 542 } },
  { id: 'chair', name: 'Gaming Chairs', item: 'Gaming Chair', items: 'gaming chairs', icon: '🪑', color: '#e5484d', price: 600, unlock: 150000, wing: true,
    shelf: { x: 660, y: 640, w: 200, h: 42 }, crate: { x: 920, y: 90 }, stockSpot: { x: 760, y: 616 }, pad: { x: 760, y: 712 } },
];
// Knocking down the right wall opens the wing
const EXPANSION = { cost: 25000, pad: { x: 540, y: 690 } };
const DIVIDER_OPEN = [{ x: 588, y: 260, w: 24, h: 350 }, { x: 588, y: 780, w: 24, h: 224 }];
const DIVIDER_CLOSED = [{ x: 588, y: 0, w: 24, h: H }];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.id, s]));
const PARTS = SECTIONS.filter(s => s.shelf);
SEC.svc.custSpot = { x: 348, y: 272 };          // where the build customer waits
SEC.svc.workPad = { x: 252, y: 274 };           // where you stand to assemble
const STOCKROOM_H = 140;                        // stockroom band: y 16..156
const CRATE_W = 84, CRATE_H = 64;

// Rough clockwise order shoppers visit sections in (they wander freely between stops)
const LOOP = [{ x: 105, y: 1000 }, { x: 130, y: 680 }, { x: 130, y: 300 }, { x: 470, y: 300 }, { x: 470, y: 700 }];
const LOOP_CUM = [0];
for (let i = 1; i < LOOP.length; i++) LOOP_CUM.push(LOOP_CUM[i - 1] + Math.hypot(LOOP[i].x - LOOP[i - 1].x, LOOP[i].y - LOOP[i - 1].y));
const S_END = LOOP_CUM[LOOP_CUM.length - 1];
const ENTRANCE = { x: 40, w: 130 }, EXIT = { x: 430, w: 130 };
// Open-floor spots where shoppers stop to look around
const WANDER_SPOTS = [
  { x: 160, y: 255 }, { x: 440, y: 255 }, { x: 230, y: 426 }, { x: 300, y: 426 }, { x: 370, y: 426 },
  { x: 130, y: 450 }, { x: 470, y: 450 }, { x: 200, y: 630 }, { x: 300, y: 610 }, { x: 420, y: 640 },
  { x: 250, y: 700 }, { x: 160, y: 800 },
  { x: 920, y: 300 }, { x: 920, y: 560 }, { x: 760, y: 800 }, { x: 700, y: 210 },
];
const EXIT_PATH = [{ x: 540, y: 720 }, { x: 540, y: 960 }, { x: 495, y: H + 30 }];

// Two checkout lanes. Shoppers line up on the left of each counter; the clerk stands on the right.
const COUNTERS = [{ x: 300, y: 770, w: 36, h: 90 }, { x: 440, y: 770, w: 36, h: 90 }];
const REG = [{ x: 362, y: 815 }, { x: 502, y: 815 }];   // stand here to check people out
const LANE_X = [278, 418];
function queueSlot(lane, i) {
  const col = Math.floor(i / 6), row = i % 6;
  return { x: LANE_X[lane] - col * 40, y: 815 - row * 44 };
}
const REG_RADIUS = 30;
// Cash from sales stacks up here until you walk over and collect it
const PILE_SPOTS = [{ x: 318, y: 850 }, { x: 458, y: 850 }];
const BENCH_PILE = { x: 416, y: 232 };

// ---------- Staff & player upgrades ----------
const STAFF = {
  cashier: { name: 'Cashier Cass', icon: '🧑‍💼', cost: 500, desc: 'Runs checkout Lane 2' },
  cashier2: { name: 'Cashier Cody', icon: '👨‍💼', cost: 3000, desc: 'Runs checkout Lane 1, so you can keep restocking' },
  stocker: { name: 'Stocker Stan', icon: '🧑‍🔧', cost: 1500, desc: 'Carries stock to empty shelves' },
  tech: { name: 'Tech Tara', icon: '👩‍💻', cost: 8000, desc: 'Assembles PCs at the Service Station' },
};
const MAX_PLAYER_LV = 8;
// Upgrades for hired staff
const STAFF_UPGRADES = [
  { id: 'cashierSpeed', staff: 'cashier', icon: '⚡', title: 'Faster Scanning', base: 400, growth: 1.9, max: 8,
    desc: () => `Both cashiers scan an item every ${cashierScanTime().toFixed(2)}s` },
  { id: 'stockerSpeed', staff: 'stocker', icon: '👟', title: 'Stocker Shoes', base: 600, growth: 1.9, max: 8,
    desc: () => `Walks ${Math.round(stockerSpeed() / 125 * 100)}% speed` },
  { id: 'stockerCarry', staff: 'stocker', icon: '📦', title: 'Hand Truck', base: 800, growth: 2, max: 6,
    desc: () => `Carries ${stockerCarry()} boxes per trip` },
  { id: 'techSpeed', staff: 'tech', icon: '🔧', title: 'Power Tools', base: 4000, growth: 1.9, max: 8,
    desc: () => `Repairs in ${(3 * techFactor()).toFixed(1)}s, full builds in ${(6 * techFactor()).toFixed(1)}s` },
];
const STAFF_UP = Object.fromEntries(STAFF_UPGRADES.map(u => [u.id, u]));
function staffLv(id) { return state.staffLv[id] || 0; }
function staffUpCost(id) { const u = STAFF_UP[id]; return Math.round(u.base * Math.pow(u.growth, staffLv(id))); }
function cashierScanTime() { return 0.6 * Math.pow(0.84, staffLv('cashierSpeed')); }
function stockerSpeed() { return 125 * (1 + 0.18 * staffLv('stockerSpeed')); }
function stockerHandTime() { return Math.pow(0.85, staffLv('stockerSpeed')); }
function stockerCarry() { return 4 + 2 * staffLv('stockerCarry'); }
function techBuildTime() { return 8 * Math.pow(0.85, staffLv('techSpeed')); }
// How much longer the tech takes than you (2x at first, faster with Power Tools)
function techFactor() { return techBuildTime() / 4; }
// Floor pads where you hire staff by standing on them
const HIRE_PADS = {
  cashier: { x: 222, y: 900, label: 'CASHIER' },
  cashier2: { x: 222, y: 900, label: 'CASHIER 2' },
  stocker: { x: 530, y: 90, label: 'STOCKER' },
};

// ---------- State ----------
function freshState(keep = {}) {
  const sec = {};
  for (const s of SECTIONS) sec[s.id] = { unlocked: s.unlock === 0, level: 1, stock: s.unlock === 0 ? 4 : 0, paid: 0 };
  return {
    money: 0,
    // kept when you franchise
    lifetime: keep.lifetime || 0, served: keep.served || 0, built: keep.built || 0,
    restocked: keep.restocked || 0, sold: keep.sold || {},
    stars: keep.stars || 0, starsClaimed: keep.starsClaimed || 0, franchises: keep.franchises || 0,
    achDone: keep.achDone || [], achClaimed: keep.achClaimed || [], daily: keep.daily || null,
    storeName: keep.storeName || 'Byte Depot',
    sound: keep.sound !== undefined ? keep.sound : true,
    sec, speedLv: 0, carryLv: 0,
    expanded: false, expandPaid: 0,
    crates: Object.fromEntries(SECTIONS.filter(x => x.shelf).map(x => [x.id, 24])),
    deliveryLv: 0, truckLv: 0,
    piles: [0, 0], benchPile: 0,
    staff: { cashier: false, cashier2: false, stocker: false, tech: false },
    staffPaid: { cashier: 0, cashier2: 0, stocker: 0 },
    staffLv: {},
    player: { x: 300, y: 640 },
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
    const base0 = freshState(s);
    const merged = Object.assign(base, s);
    for (const sc of SECTIONS) merged.sec[sc.id] = Object.assign(base.sec[sc.id], (s.sec || {})[sc.id] || {});
    merged.staff = Object.assign(freshState().staff, s.staff || {});
    merged.staffPaid = Object.assign(freshState().staffPaid, s.staffPaid || {});
    merged.staffLv = Object.assign({}, s.staffLv || {});
    merged.crates = Object.assign(base0.crates, s.crates || {});
    merged.piles = Array.isArray(s.piles) ? s.piles : [0, 0];
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
state.money = Math.floor(state.money);
for (const id in state.sec) state.sec[id].paid = Math.floor(state.sec[id].paid || 0);
for (const k in state.staffPaid) state.staffPaid[k] = Math.floor(state.staffPaid[k] || 0);
if (loaded && [{ x: 300, y: 770, w: 176, h: 90 }, { x: 26, y: 270, w: 548, h: 330 }].some(r => state.player.x > r.x && state.player.x < r.x + r.w && state.player.y > r.y && state.player.y < r.y + r.h)) state.player = { x: 300, y: 640 };

// Runtime-only world objects
let customers = [];
let queues = [[], []];
const serveTimers = [0, 0];
let awayFromLane1 = 0;
let fx = [];
let spawnTimer = 2;
let pickTimer = 0, dropTimer = 0;
let buildProgress = 0;
const npcs = {};

// ---------- Economy ----------
function price(id) {
  const L = state.sec[id].level;
  return Math.round(SEC[id].price * (1 + 0.25 * (L - 1)) * Math.pow(2, MILESTONES.filter(m => L >= m).length) * starMult());
}
function levelCost(id) { return Math.round(SEC[id].price * 12 * Math.pow(1.32, state.sec[id].level - 1)); }
function shelfCap(id) { return Math.min(20, 6 + 2 * Math.floor((state.sec[id].level - 1) / 5)); }
function playerSpeed() { return 165 + 20 * state.speedLv; }
function carryCap() { return 4 + 2 * state.carryLv; }
function speedCost() { return Math.round(80 * Math.pow(2, state.speedLv)); }
function carryCost() { return Math.round(120 * Math.pow(2.1, state.carryLv)); }
function unlockedParts() { return PARTS.filter(s => state.sec[s.id].unlocked); }

let rateBucket = 0;
function earn(amount, x, y) {
  amount = Math.round(amount);
  if (amount <= 0) return;
  rateBucket += amount;
  bank(amount, x, y);
}
// Put money in your pocket (sales already counted when they happened)
function bank(amount, x, y) {
  amount = Math.round(amount);
  if (amount <= 0) return;
  state.money += amount;
  state.lifetime += amount;
  track('earn', null, amount);
  if (x !== undefined) fx.push({ type: 'text', text: '+' + money$(amount), x, y, t: 0, color: '#2ecc71' });
  bumpMoney();
}

// ---------- Formatting ----------
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
function fmt(n) {
  if (n < 1000) return String(Math.floor(n));
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
  const list = [...COUNTERS, ...(state.expanded ? DIVIDER_OPEN : [])];
  for (const s of PARTS) if (state.sec[s.id].unlocked) list.push(s.shelf);
  if (state.sec.svc.unlocked) list.push(SEC.svc.bench);
  return list;
}
let FURNITURE = [];
// For shoppers & staff: is a straight walk blocked by furniture?
function segmentBlocked(a, b) {
  const steps = Math.ceil(dist(a, b) / 8);
  for (let i = 1; i < steps; i++) {
    const p = { x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps };
    if (FURNITURE.some(r => inRect(p, r, 16))) return true;
  }
  return false;
}
// Small grid A* so staff can find their way around the furniture
const CELL = 20, GW = Math.ceil(W_FULL / CELL), GH = Math.ceil(H / CELL);
const blockedCell = new Uint8Array(GW * GH);
function rebuildGrid() {
  FURNITURE = [...COUNTERS, SEC.svc.bench, ...PARTS.map(s => s.shelf), ...(state.expanded ? DIVIDER_OPEN : DIVIDER_CLOSED)];
  const ww = worldW();
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const p = { x: gx * CELL + CELL / 2, y: gy * CELL + CELL / 2 };
    blockedCell[gy * GW + gx] = (p.x < 30 || p.x > ww - 30 || p.y < 30 || FURNITURE.some(r => inRect(p, r, 14))) ? 1 : 0;
  }
}
rebuildGrid();
function gridPath(from, to) {
  const cl = v => Math.max(0, Math.min(v, 1e9));
  const sx = Math.min(GW - 1, Math.floor(cl(from.x) / CELL)), sy = Math.min(GH - 1, Math.floor(cl(from.y) / CELL));
  const tx = Math.min(GW - 1, Math.floor(cl(to.x) / CELL)), ty = Math.min(GH - 1, Math.floor(cl(to.y) / CELL));
  const start = sy * GW + sx, goal = ty * GW + tx;
  const g = new Float32Array(GW * GH).fill(Infinity), came = new Int32Array(GW * GH).fill(-1), closed = new Uint8Array(GW * GH);
  g[start] = 0;
  const open = [start];
  const h = i => Math.hypot(i % GW - tx, Math.floor(i / GW) - ty);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (g[open[i]] + h(open[i]) < g[open[bi]] + h(open[bi])) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === goal) break;
    closed[cur] = 1;
    const cx = cur % GW, cy = Math.floor(cur / GW);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = ny * GW + nx;
      if (closed[n] || (blockedCell[n] && n !== goal)) continue;
      if (dx && dy && (blockedCell[cy * GW + nx] || blockedCell[ny * GW + cx])) continue;
      const ng = g[cur] + (dx && dy ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; came[n] = cur; if (!open.includes(n)) open.push(n); }
    }
  }
  if (came[goal] === -1 && goal !== start) return [{ x: to.x, y: to.y }];
  const cells = [];
  for (let c = goal; c !== -1 && c !== start; c = came[c]) cells.unshift({ x: (c % GW) * CELL + CELL / 2, y: Math.floor(c / GW) * CELL + CELL / 2 });
  cells[cells.length - 1] = { x: to.x, y: to.y };
  // String-pull: skip corners that have a clear straight line
  const out = [];
  let anchor = from;
  for (let i = 0; i < cells.length; i++) {
    if (i === cells.length - 1 || segmentBlocked(anchor, cells[i + 1])) { out.push(cells[i]); anchor = cells[i]; }
  }
  return out;
}
function route(from, to) {
  if (!segmentBlocked(from, to)) return [{ x: to.x, y: to.y }];
  return gridPath(from, to);
}
// Position along the shopper loop
function loopS(p) {
  let best = Infinity, bestS = 0;
  for (let i = 1; i < LOOP.length; i++) {
    const a = LOOP[i - 1], b = LOOP[i];
    const vx = b.x - a.x, vy = b.y - a.y, len2 = vx * vx + vy * vy;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
    const d = Math.hypot(a.x + vx * k - p.x, a.y + vy * k - p.y);
    if (d < best) { best = d; bestS = LOOP_CUM[i - 1] + k * Math.sqrt(len2); }
  }
  return bestS;
}
function walk(o, dt) {
  if (!o.path.length) return true;
  const tgt = o.path[0];
  const dx = tgt.x - o.x, dy = tgt.y - o.y, d = Math.hypot(dx, dy);
  const step = o.speed * dt;
  if (d <= step) { o.x = tgt.x; o.y = tgt.y; o.path.shift(); if (tgt.pause) o.pauseT = tgt.pause; }
  else { o.x += dx / d * step; o.y += dy / d * step; o.face = dx < 0 ? -1 : 1; }
  o.moving = true;
  return !o.path.length;
}

// ---------- Customers ----------
const SHIRTS = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#8338ec', '#fb8500', '#3a86ff'];
const SKINS = ['#f5d0a9', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const HAIR = ['#2b1d0e', '#6b3e1b', '#e8c170', '#111', '#b5542b', '#999'];
// Where a shopper stands to grab something from a section
function makeStop(id) {
  const r = Math.random(), side = Math.random() < 0.5;
  let spot;
  if (id === 'acc') spot = { x: 94, y: 290 + r * 290 };
  else if (id === 'case') spot = { x: 506, y: 290 + r * 290 };
  else if (id === 'mon') spot = { x: 215 + r * 170, y: side ? 321 : 413 };   // in front, or from the middle aisle
  else if (id === 'gpu') spot = { x: 215 + r * 170, y: side ? 533 : 439 };
  else if (id === 'cpu') spot = { x: 675 + r * 170, y: side ? 276 : 366 };
  else if (id === 'ram') spot = { x: 675 + r * 170, y: side ? 446 : 536 };
  else if (id === 'chair') spot = { x: 675 + r * 170, y: side ? 616 : 706 };
  else spot = { ...SEC.svc.custSpot };
  return { id, spot, s: loopS(spot) };
}
// Walk to a target, sometimes stopping somewhere on the floor to look around first
function wanderTo(c, target, chance = 0.45) {
  if (Math.random() < chance) {
    const options = WANDER_SPOTS.filter(w => w.x < worldW() - 30 && dist(w, c) > 60 && dist(w, target) > 60);
    const w = options[Math.floor(Math.random() * options.length)];
    if (w) {
      const look = { x: w.x + (Math.random() * 30 - 15), y: w.y + (Math.random() * 20 - 10) };
      const first = route(c, look);
      first[first.length - 1].pause = 0.8 + Math.random() * 1.8;
      return [...first, ...route(look, target)];
    }
  }
  return route(c, target);
}
function spawnCustomer() {
  const parts = unlockedParts();
  const svcActive = customers.some(c => c.build && c.state !== 'leave');
  const wantsBuild = state.sec.svc.unlocked && !svcActive && Math.random() < eventBuildChance();
  const x = ENTRANCE.x + ENTRANCE.w / 2 + (Math.random() * 30 - 15);
  const c = {
    x, y: H + 10, path: [{ x, y: 960 }], speed: 75 + Math.random() * 35, pauseT: 0,
    shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    skin: SKINS[Math.floor(Math.random() * SKINS.length)],
    hair: HAIR[Math.floor(Math.random() * HAIR.length)],
    wants: [], stops: [], cart: [], idx: 0, going: -1, phase: 'walk',
    timer: 0, patience: 14, state: 'shop', scanned: 0, mood: null, face: 1,
  };
  if (wantsBuild) {
    c.build = true;
    c.job = makeJob();
    c.patience = 70;
    c.stops = [makeStop('svc')];
  } else {
    const pool = parts.map(p => p.id).sort(() => Math.random() - 0.5);
    const n = 1 + Math.floor(Math.random() * Math.min(3, pool.length));
    const picks = pool.slice(0, n);
    if (rushEvent && rushEvent.want && state.sec[rushEvent.want].unlocked && !picks.includes(rushEvent.want)) picks[0] = rushEvent.want;
    c.stops = picks.map(makeStop).sort((a, b) => a.s - b.s);
  }
  c.wants = c.stops.map(st => st.id);
  customers.push(c);
}
function leave(c, mood) {
  const wasQueued = c.state === 'queue';
  c.state = 'leave';
  c.mood = mood;
  c.moodT = 0;
  c.pauseT = 0;
  if (wasQueued) c.path = [{ x: c.x, y: 900 }, { x: 495, y: 960 }, { x: 495, y: H + 30 }];
  else c.path = [...route(c, EXIT_PATH[0]), ...EXIT_PATH.slice(1).map(p => ({ ...p }))];
  if (mood === 'sad') sfx.sad();
}
function joinQueue(c) {
  let lane = 0;
  if (state.staff.cashier) lane = queues[1].length <= queues[0].length ? 1 : 0;   // shortest open line
  c.state = 'queue';
  c.lane = lane;
  queues[lane].push(c);
}
function updateCustomer(c, dt) {
  c.moving = false;
  if (c.mood) c.moodT += dt;
  if (c.pauseT > 0) { c.pauseT -= dt; return; }
  const arrived = walk(c, dt);
  if (!arrived) return;

  if (c.state === 'shop') {
    if (c.phase === 'browse') {
      const stop = c.stops[c.idx];
      if (stop.id === 'svc') { c.state = 'svc'; return; }
      c.timer += dt;
      if (c.timer < 0.6) return;
      const st = state.sec[stop.id];
      let done = false;
      if (st.stock > 0) { st.stock--; c.cart.push(stop.id); done = true; c.waiting = false; }
      else {
        c.waiting = true;
        c.patience -= dt;
        if (c.patience <= 0) { done = true; c.patience = 10; c.waiting = false; }
      }
      if (done) { c.idx++; c.phase = 'walk'; }
      return;
    }
    if (c.idx < c.stops.length) {
      const stop = c.stops[c.idx];
      if (c.going !== c.idx) { c.going = c.idx; c.path = wanderTo(c, stop.spot, c.idx === 0 ? 0.3 : 0.45); return; }
      c.phase = 'browse'; c.timer = 0;
      return;
    }
    if (c.cart.length) joinQueue(c); else leave(c, 'sad');
  } else if (c.state === 'queue') {
    const q = queues[c.lane];
    const slot = queueSlot(c.lane, q.indexOf(c));
    if (dist(c, slot) > 2) c.path = route(c, slot);
  } else if (c.state === 'svc') {
    c.waiting = true;
    c.patience -= dt;
    if (c.patience <= 0 && buildProgress < 0.05 && !(c.job && c.job.got.length)) { c.waiting = false; leave(c, 'sad'); buildProgress = 0; }
  } else if (c.state === 'leave') {
    if (c.y > H + 20) c.remove = true;
  }
}

// Checkout: lane 1 is yours, lane 2 is the cashier's
function laneServer(l) {
  if (dist(state.player, REG[l]) < REG_RADIUS) return 0.28;
  if (l === 1 && state.staff.cashier) return cashierScanTime();
  if (l === 0 && state.staff.cashier2) return cashierScanTime();
  return 0;
}
function updateRegister(dt) {
  // If you walk away from lane 1, waiting shoppers move to the cashier's lane
  if (state.staff.cashier && !state.staff.cashier2 && dist(state.player, REG[0]) >= REG_RADIUS) awayFromLane1 += dt; else awayFromLane1 = 0;
  if (awayFromLane1 > 2.5) {
    const moving = queues[0].filter(c => c.scanned === 0);
    queues[0] = queues[0].filter(c => c.scanned > 0);
    for (const c of moving) { c.lane = 1; queues[1].push(c); }
  }
  for (let l = 0; l < 2; l++) {
    const front = queues[l][0];
    const scanTime = laneServer(l);
    if (!front || !scanTime || dist(front, queueSlot(l, 0)) > 4) { serveTimers[l] = 0; continue; }
    serveTimers[l] += dt;
    if (serveTimers[l] < scanTime) continue;
    serveTimers[l] = 0;
    front.scanned++;
    sfx.scan();
    if (front.scanned >= front.cart.length) {
      const total = Math.round(front.cart.reduce((sum, id) => sum + price(id), 0) * eventPriceMult());
      // Cash goes on the counter; if you're the one at the register it goes straight in your pocket
      if (dist(state.player, REG[l]) < REG_RADIUS) earn(total, REG[l].x, REG[l].y - 40);
      else { state.piles[l] += total; rateBucket += total; }
      track('serve', null, 1);
      for (const id of front.cart) track('sell', id, 1);
      sfx.cash();
      state.served++;
      queues[l].shift();
      leave(front, 'happy');
    }
  }
}

// ---------- Service Station jobs ----------
const JOBS = {
  repair: { name: 'Repair', icon: '🔧', time: 3, pay: 0.5 },
  upgrade: { name: 'Upgrade', icon: '⬆️', time: 4, pay: 1.2 },
  build: { name: 'Full Build', icon: '🖥️', time: 6, pay: 2.5 },
};
function makeJob() {
  const has = id => state.sec[id] && state.sec[id].unlocked;
  const r = Math.random();
  if (r < 0.4) return { type: 'repair', parts: [], got: [] };
  if (r < 0.75) {
    const opts = ['gpu', 'ram', 'cpu'].filter(has);
    return { type: 'upgrade', parts: [opts[Math.floor(Math.random() * opts.length)] || 'gpu'], got: [] };
  }
  return { type: 'build', parts: ['case', 'gpu', ...['cpu', 'ram'].filter(has)], got: [] };
}
function missingParts(job) {
  const need = [...job.parts];
  for (const g of job.got) { const i = need.indexOf(g); if (i >= 0) need.splice(i, 1); }
  return need;
}
function jobPay(job) {
  return Math.round((price('svc') * JOBS[job.type].pay + job.parts.reduce((a, id) => a + price(id), 0)) * eventBuildPay());
}
function currentJobCustomer() { return customers.find(x => x.state === 'svc' && !x.path.length); }
let handTimer = 0, techPullTimer = 0;
function updateService(dt) {
  if (!state.sec.svc.unlocked) return;
  const c = currentJobCustomer();
  if (!c) return;
  const job = c.job || (c.job = makeJob());
  const p = state.player;
  let missing = missingParts(job);
  // You hand over parts you're carrying
  handTimer += dt;
  if (missing.length && inRect(p, SEC.svc.bench, 40) && handTimer > 0.15) {
    const idx = state.carry.findIndex(id => missing.includes(id));
    if (idx >= 0) { job.got.push(state.carry[idx]); state.carry.splice(idx, 1); handTimer = 0; sfx.drop(); missing = missingParts(job); }
  }
  // The tech grabs parts off the shelves
  if (missing.length && state.staff.tech) {
    techPullTimer += dt;
    if (techPullTimer > 1.2) {
      techPullTimer = 0;
      const id = missing.find(x => state.sec[x].stock > 0);
      if (id) { state.sec[id].stock--; job.got.push(id); missing = missingParts(job); }
    }
  }
  if (missing.length) return;
  const playerHere = dist(p, SEC.svc.workPad) < 34;
  const t = JOBS[job.type].time;
  const rate = Math.max(playerHere ? 1 / t : 0, state.staff.tech ? 1 / (t * techFactor()) : 0);
  if (!rate) return;
  buildProgress += rate * dt;
  if (Math.random() < dt * 6) fx.push({ type: 'spark', x: SEC.svc.bench.x + 30 + Math.random() * 120, y: SEC.svc.bench.y + 10, t: 0 });
  if (buildProgress >= 1) {
    buildProgress = 0;
    state.built++;
    const pay = jobPay(job);
    if (playerHere) earn(pay, SEC.svc.custSpot.x, SEC.svc.custSpot.y - 40);
    else { state.benchPile += pay; rateBucket += pay; }
    track('build', job.type, 1);
    sfx.cash();
    c.carryPC = job.type !== 'repair';
    leave(c, 'happy');
  }
}

// ---------- Hooks filled in by later features ----------
// ---------- Franchise (prestige) ----------
const STAR_BONUS = 0.05;   // +5% profit per Star
const THEMES = [
  { name: 'Strip Mall', a: '#f4f1ff', b: '#e9e4fb', wall: '#3b2a7a' },
  { name: 'Shopping Mall', a: '#fff4e6', b: '#fbe6cf', wall: '#7a3f2a' },
  { name: 'Warehouse', a: '#eaf0f4', b: '#dbe4eb', wall: '#2f3d4f' },
  { name: 'Flagship Store', a: '#eafaf1', b: '#d6f1e3', wall: '#1d5a49' },
];
function theme() { return THEMES[state.franchises % THEMES.length]; }
function starMult() { return 1 + STAR_BONUS * state.stars; }
function starsEarned() { return Math.floor(5 * Math.sqrt(state.lifetime / 50000)); }
function claimableStars() { return Math.max(0, starsEarned() - state.starsClaimed); }
function nextStarAt() { const n = starsEarned() + 1; return Math.ceil(Math.pow(n / 5, 2) * 50000); }
function franchiseHtml() {
  const gain = claimableStars();
  const next = THEMES[(state.franchises + 1) % THEMES.length];
  return `<div class="group">Franchise <span>Start over in a bigger location</span></div>
    <div class="item franchise"><div class="avatar" style="--c:#fff1b8">⭐</div>
      <div class="info"><div class="title">${state.stars} Stars <small>profit x${starMult().toFixed(2)}</small></div>
      <div class="desc">Now: ${theme().name}. Sell it and open a ${next.name} for <b>+${gain} ⭐</b>. Next Star at ${money$(nextStarAt())} lifetime earnings. Resets cash, sections, staff and upgrades.</div></div>
      <button class="btn ${gain > 0 ? 'green' : 'disabled'}" data-act="franchise">Franchise<small>+${gain} ⭐</small></button></div>`;
}
function doFranchise() {
  const gain = claimableStars();
  if (gain <= 0) return;
  const keep = {
    storeName: state.storeName, sound: state.sound, lifetime: state.lifetime, served: state.served, built: state.built,
    restocked: state.restocked, sold: state.sold, stars: state.stars + gain, starsClaimed: state.starsClaimed + gain,
    franchises: state.franchises + 1, achDone: state.achDone, achClaimed: state.achClaimed, daily: state.daily,
  };
  state = freshState(keep);
  customers = []; queues = [[], []]; fx = []; buildProgress = 0;
  for (const k in npcs) delete npcs[k];
  truck.phase = 'away'; truckTimer = 30; rushEvent = null;
  rebuildGrid();
  save(); closeModal(); confetti(); sfx.unlock();
  toast(`⭐ Welcome to your new ${theme().name}! Profit x${starMult().toFixed(2)}`);
}

// ---------- Missions & achievements ----------
function track(kind, id, n) {
  if (kind === 'restock') state.restocked += n;
  if (kind === 'sell') state.sold[id] = (state.sold[id] || 0) + n;
  if (state.daily) for (const m of state.daily.list) {
    if (!m.claimed && m.kind === kind && (!m.id || m.id === id)) m.progress = Math.min(m.target, m.progress + n);
  }
}
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function niceRound(n) { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - 1)); return Math.max(p, Math.round(n / p) * p); }
function makeDaily() {
  const parts = unlockedParts();
  const reward = niceRound(Math.max(200, state.rate * 150));
  const pick = parts[Math.floor(Math.random() * parts.length)];
  const pool = [
    { kind: 'serve', target: 20 + 10 * parts.length },
    { kind: 'sell', id: pick.id, target: 8 + 2 * parts.length },
    { kind: 'restock', target: 30 + 10 * parts.length },
    { kind: 'earn', target: niceRound(Math.max(500, state.rate * 600)) },
  ];
  if (state.sec.svc.unlocked) pool.push({ kind: 'build', target: 3 });
  pool.sort(() => Math.random() - 0.5);
  state.daily = { day: todayKey(), list: pool.slice(0, 3).map((m, i) => ({ ...m, progress: 0, claimed: false, reward: reward * (i + 1) })) };
}
function missionText(m) {
  if (m.kind === 'serve') return `Check out ${m.target} shoppers`;
  if (m.kind === 'sell') return `Sell ${m.target} ${SEC[m.id].items}`;
  if (m.kind === 'restock') return `Restock ${m.target} boxes yourself`;
  if (m.kind === 'build') return `Finish ${m.target} Service Station jobs`;
  return `Earn ${money$(m.target)}`;
}
const MISSION_ICON = { serve: '🛒', sell: '🏷️', restock: '📦', build: '🛠️', earn: '💰' };
const countUnlocked = ids => ids.filter(id => state.sec[id].unlocked).length;
const ACHIEVEMENTS = [
  { id: 'serve1', icon: '🛒', name: 'First Sale', desc: 'Check out your first shopper', goal: 1, value: () => state.served },
  { id: 'serve100', icon: '🛒', name: 'Regulars', desc: 'Check out 100 shoppers', goal: 100, value: () => state.served },
  { id: 'serve1000', icon: '🛒', name: 'Crowd Pleaser', desc: 'Check out 1,000 shoppers', goal: 1000, value: () => state.served },
  { id: 'serve5000', icon: '🏆', name: 'Retail Legend', desc: 'Check out 5,000 shoppers', goal: 5000, value: () => state.served },
  { id: 'restock250', icon: '📦', name: 'Stock Star', desc: 'Restock 250 boxes yourself', goal: 250, value: () => state.restocked },
  { id: 'build1', icon: '🛠️', name: 'Handy', desc: 'Finish a Service Station job', goal: 1, value: () => state.built },
  { id: 'build50', icon: '🖥️', name: 'Master Builder', desc: 'Finish 50 Service Station jobs', goal: 50, value: () => state.built },
  { id: 'store5', icon: '🏪', name: 'Full Store', desc: 'Unlock the Service Station', goal: 1, value: () => state.sec.svc.unlocked ? 1 : 0 },
  { id: 'expand', icon: '🧱', name: 'Growing Up', desc: 'Expand your store', goal: 1, value: () => state.expanded ? 1 : 0 },
  { id: 'store8', icon: '🏬', name: 'Megastore', desc: 'Unlock all 8 sections', goal: 8, value: () => countUnlocked(SECTIONS.map(x => x.id)) },
  { id: 'staff', icon: '👥', name: 'Dream Team', desc: 'Hire all 4 staff', goal: 4, value: () => Object.values(state.staff).filter(Boolean).length },
  { id: 'earn10k', icon: '💵', name: 'Ten Grand', desc: 'Earn $10K in total', goal: 1e4, value: () => state.lifetime },
  { id: 'earn100k', icon: '💰', name: 'Big Business', desc: 'Earn $100K in total', goal: 1e5, value: () => state.lifetime },
  { id: 'earn1m', icon: '🤑', name: 'Millionaire', desc: 'Earn $1M in total', goal: 1e6, value: () => state.lifetime },
  { id: 'earn10m', icon: '💎', name: 'Tycoon', desc: 'Earn $10M in total', goal: 1e7, value: () => state.lifetime },
  { id: 'franchise1', icon: '⭐', name: 'Franchise Owner', desc: 'Open a second store', goal: 1, value: () => state.franchises },
];
function updateMissions() {
  if (!state.daily || state.daily.day !== todayKey()) makeDaily();
  for (const a of ACHIEVEMENTS) if (!state.achDone.includes(a.id) && a.value() >= a.goal) {
    state.achDone.push(a.id);
    toast(`🏆 Achievement: ${a.name}! Claim your ⭐ in Missions`);
  }
}
function anyClaimable() {
  if (state.daily && state.daily.list.some(m => !m.claimed && m.progress >= m.target)) return true;
  return state.achDone.some(id => !state.achClaimed.includes(id));
}
function showMissions() {
  const msLeft = new Date(new Date().setHours(24, 0, 0, 0)) - Date.now();
  let html = `<div class="sheet-head"><h2>Missions</h2><button class="icon-btn small" data-act="close" aria-label="Close">✕</button></div>`;
  html += `<div class="group">Daily missions <span>New ones in ${fmtTime(msLeft / 1000)}</span></div>`;
  state.daily.list.forEach((m, i) => {
    const done = m.progress >= m.target;
    html += `<div class="item ${m.claimed ? 'done' : ''}"><div class="avatar" style="--c:#e6f7ff">${MISSION_ICON[m.kind]}</div>
      <div class="info"><div class="title">${missionText(m)}</div>
      <div class="meter"><i style="width:${Math.round(100 * m.progress / m.target)}%"></i></div>
      <div class="desc">${m.kind === 'earn' ? money$(m.progress) + ' / ' + money$(m.target) : m.progress + ' / ' + m.target} · reward ${money$(m.reward)}</div></div>
      ${m.claimed ? '<button class="btn owned" disabled>Done ✓</button>' : `<button class="btn ${done ? 'green' : 'disabled'}" data-act="claimDaily" data-id="${i}">Claim<small>${money$(m.reward)}</small></button>`}</div>`;
  });
  html += `<div class="group">Achievements <span>Each one is worth a ⭐ Star</span></div>`;
  for (const a of ACHIEVEMENTS) {
    const done = state.achDone.includes(a.id), claimed = state.achClaimed.includes(a.id);
    const v = Math.min(a.goal, a.value());
    html += `<div class="item ${claimed ? 'done' : ''}"><div class="avatar" style="--c:${done ? '#fff1b8' : '#ece8fb'}">${a.icon}</div>
      <div class="info"><div class="title">${a.name}</div><div class="desc">${a.desc}${done ? '' : ` · ${a.goal >= 1e4 ? money$(v) + ' / ' + money$(a.goal) : v + ' / ' + a.goal}`}</div></div>
      ${claimed ? '<button class="btn owned" disabled>⭐ ✓</button>' : done ? `<button class="btn green" data-act="claimAch" data-id="${a.id}">Claim<small>+1 ⭐</small></button>` : ''}</div>`;
  }
  showModal(html, true);
}

// ---------- Rush events ----------
const EVENTS = [
  { id: 'gpu', icon: '🎮', name: 'GPU Launch Day!', desc: 'Everyone wants a graphics card', dur: 60, ok: () => state.sec.gpu.unlocked, spawn: 2, want: 'gpu' },
  { id: 'black', icon: '🛍️', name: 'Black Friday!', desc: 'Twice the shoppers, double prices', dur: 60, ok: () => unlockedParts().length >= 3, spawn: 2, priceMult: 2 },
  { id: 'build', icon: '🛠️', name: 'Build Season!', desc: 'Service Station jobs pay double', dur: 75, ok: () => state.sec.svc.unlocked, buildChance: 0.85, buildPay: 2 },
  { id: 'school', icon: '🎒', name: 'Back to School!', desc: 'Students rush in for accessories', dur: 45, ok: () => state.sec.case.unlocked, spawn: 2.5, want: 'acc' },
];
let rushEvent = null, eventLeft = 0, nextEventIn = 240;
function updateEvents(dt) {
  if (rushEvent) {
    eventLeft -= dt;
    if (eventLeft <= 0) { toast(`${rushEvent.icon} ${rushEvent.name.replace('!', '')} is over`); rushEvent = null; nextEventIn = 150 + Math.random() * 120; }
    return;
  }
  if (!state.sec.mon.unlocked) return;   // rushes start once the store has a few sections
  nextEventIn -= dt;
  if (nextEventIn <= 0) {
    const opts = EVENTS.filter(e => e.ok());
    rushEvent = opts[Math.floor(Math.random() * opts.length)];
    eventLeft = rushEvent.dur;
    sfx.unlock(); confetti();
    toast(`${rushEvent.icon} ${rushEvent.name} ${rushEvent.desc}`);
  }
}
function eventPriceMult() { return (rushEvent && rushEvent.priceMult) || 1; }
function eventBuildChance() { return (rushEvent && rushEvent.buildChance) || 0.3; }
function eventBuildPay() { return (rushEvent && rushEvent.buildPay) || 1; }

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
  // Cash piles at the registers and the Service Station
  for (let l = 0; l < 2; l++) if (state.piles[l] >= 1 && (dist(p, PILE_SPOTS[l]) < 70 || dist(p, REG[l]) < REG_RADIUS + 10)) collectPile(PILE_SPOTS[l], state.piles[l], () => { state.piles[l] = 0; });
  if (state.benchPile >= 1 && dist(p, BENCH_PILE) < 70) collectPile(BENCH_PILE, state.benchPile, () => { state.benchPile = 0; });
  // Stockroom crates: pick up boxes
  pickTimer += dt; dropTimer += dt;
  for (const s of unlockedParts()) {
    if (inRect(p, crateRect(s)) && state.carry.length < carryCap() && pickTimer > 0.13 && state.crates[s.id] > 0) {
      state.carry.push(s.id); state.crates[s.id]--; pickTimer = 0; sfx.pick();
    }
  }
  // Shelves: drop matching boxes
  for (const s of unlockedParts()) {
    const st = state.sec[s.id];
    const i = state.carry.lastIndexOf(s.id);
    if (i >= 0 && st.stock < shelfCap(s.id) && inRect(p, s.shelf, 34) && dropTimer > 0.1) {
      state.carry.splice(i, 1); st.stock++; dropTimer = 0; sfx.drop(); track('restock', s.id, 1);
    }
  }
  // Unlock pads: money flows in while you stand on them
  for (const s of SECTIONS) {
    const st = state.sec[s.id];
    if (st.unlocked || !canUnlockNext(s.id)) continue;
    if (inRect(p, padRect(s.pad)) && state.money >= 1) {
      const amt = Math.min(state.money, s.unlock - st.paid, Math.max(1, Math.round(Math.max(25, s.unlock / 1.6) * dt)));
      state.money -= amt; st.paid += amt;
      if (Math.random() < dt * 20) fx.push({ type: 'coin', x: p.x, y: p.y - 30, tx: s.pad.x, ty: s.pad.y, t: 0 });
      if (st.paid >= s.unlock) unlockSection(s.id);
    }
  }
  // Expansion pad
  if (!state.expanded && state.sec.svc.unlocked && inRect(p, padRect(EXPANSION.pad, 110, 60)) && state.money >= 1) {
    const amt = Math.min(state.money, EXPANSION.cost - state.expandPaid, Math.max(1, Math.round(EXPANSION.cost / 1.6 * dt)));
    state.money -= amt; state.expandPaid += amt;
    if (Math.random() < dt * 20) fx.push({ type: 'coin', x: p.x, y: p.y - 30, tx: EXPANSION.pad.x, ty: EXPANSION.pad.y, t: 0 });
    if (state.expandPaid >= EXPANSION.cost) expandStore();
  }
  // Hire pads: money flows in while you stand on them
  for (const k in HIRE_PADS) {
    if (state.staff[k] || !staffAvailable(k)) continue;
    const pad = HIRE_PADS[k], cost = STAFF[k].cost;
    if (inRect(p, padRect(pad)) && state.money >= 1) {
      const amt = Math.min(state.money, cost - state.staffPaid[k], Math.max(1, Math.round(Math.max(25, cost / 1.6) * dt)));
      state.money -= amt; state.staffPaid[k] += amt;
      if (Math.random() < dt * 20) fx.push({ type: 'coin', x: p.x, y: p.y - 30, tx: pad.x, ty: pad.y, t: 0 });
      if (state.staffPaid[k] >= cost) hireStaff(k);
    }
  }
}
function collectPile(spot, amount, clear) {
  clear();
  bank(amount, spot.x, spot.y - 30);
  for (let i = 0; i < 6; i++) fx.push({ type: 'coin', x: spot.x + Math.random() * 20 - 10, y: spot.y, tx: state.player.x, ty: state.player.y - 30, t: -i * 0.05 });
  sfx.cash();
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
  const nx = Math.max(16 + PLAYER_R, Math.min(worldW() - 16 - PLAYER_R, p.x + dx));
  const ny = Math.max(16 + PLAYER_R, Math.min(H - 30, p.y + dy));
  const probe = { x: nx, y: ny };
  if (obstacles().some(r => inRect(probe, r, PLAYER_R - 2))) return;
  p.x = nx; p.y = ny;
}
function expandStore() {
  state.expanded = true;
  state.expandPaid = EXPANSION.cost;
  rebuildGrid();
  sfx.unlock(); confetti();
  toast('🧱 The wall is down! A new wing is open to the right');
  save();
}
// Nudge someone out of a piece of furniture (e.g. a shelf that just appeared)
function pushOut(p, r) {
  if (!r || !inRect(p, r, PLAYER_R)) return;
  const opts = [
    { x: r.x - PLAYER_R - 4, y: p.y }, { x: r.x + r.w + PLAYER_R + 4, y: p.y },
    { x: p.x, y: r.y - PLAYER_R - 4 }, { x: p.x, y: r.y + r.h + PLAYER_R + 4 },
  ].filter(o => o.x > 30 && o.x < worldW() - 30);
  const best = opts.sort((a, b) => dist(a, p) - dist(b, p))[0];
  p.x = best.x; p.y = best.y;
}
// Sections unlock in order
function canUnlockNext(id) {
  if (SEC[id].wing && !state.expanded) return false;
  const i = SECTIONS.findIndex(s => s.id === id);
  return SECTIONS.slice(0, i).every(s => state.sec[s.id].unlocked);
}
function unlockSection(id) {
  const st = state.sec[id];
  st.unlocked = true; st.paid = SEC[id].unlock;
  if (SEC[id].shelf) { st.stock = 3; state.crates[id] = crateMax(); }
  sfx.unlock(); confetti();
  toast(`${SEC[id].icon} ${SEC[id].name} unlocked!`);
  pushOut(state.player, SEC[id].shelf || SEC[id].bench);
  save();
}

// ---------- Delivery truck ----------
const MAX_STOCKROOM_LV = 6;
function crateMax() { return 24 + 8 * state.deliveryLv; }
function truckInterval() { return Math.max(15, 40 - 5 * state.truckLv); }
function deliveryCost() { return Math.round(300 * Math.pow(2, state.deliveryLv)); }
function truckCost() { return Math.round(500 * Math.pow(2, state.truckLv)); }
const DOCK_X = 300, ROAD_Y = -48;
let truckTimer = 30;
const truck = { phase: 'away', x: -220, t: 0, drop: 0 };
function updateTruck(dt) {
  if (truck.phase === 'away') {
    truckTimer -= dt;
    if (truckTimer <= 0) { truck.phase = 'arriving'; truck.x = -220; }
  } else if (truck.phase === 'arriving') {
    truck.x += 280 * dt;
    if (truck.x >= DOCK_X) { truck.x = DOCK_X; truck.phase = 'unloading'; truck.t = 0; beep(440, 0.15, 'square', 0.03); }
  } else if (truck.phase === 'unloading') {
    truck.t += dt; truck.drop += dt;
    const parts = unlockedParts();
    if (truck.drop > 0.12 && parts.length) {
      truck.drop = 0;
      const s = parts[Math.floor(Math.random() * parts.length)];
      fx.push({ type: 'box', x: DOCK_X, y: ROAD_Y + 10, tx: s.crate.x, ty: s.crate.y, t: 0, color: s.color });
    }
    if (truck.t >= 2.2) {
      for (const s of parts) state.crates[s.id] = crateMax();
      truck.phase = 'leaving';
      toast('🚚 Delivery! Stockroom crates are full');
    }
  } else if (truck.phase === 'leaving') {
    truck.x += 280 * dt;
    if (truck.x > worldW() + 220) { truck.phase = 'away'; truckTimer = truckInterval(); }
  }
}
function truckStatus() {
  if (truck.phase === 'away') return `🚚 Next delivery in ${Math.ceil(truckTimer)}s`;
  if (truck.phase === 'arriving') return '🚚 Delivery truck arriving…';
  if (truck.phase === 'unloading') return '🚚 Unloading…';
  return '🚚 Delivered!';
}

// ---------- Staff NPCs ----------
function ensureNpcs() {
  if (state.staff.cashier2 && !npcs.cashier2) npcs.cashier2 = { x: REG[0].x + 8, y: REG[0].y, path: [], speed: 0, shirt: '#118ab2', skin: '#8d5524', hair: '#2b1d0e', cap: '#ffc83d', face: 1 };
  if (state.staff.cashier && !npcs.cashier) npcs.cashier = { x: REG[1].x + 8, y: REG[1].y, path: [], speed: 0, shirt: '#2b2350', skin: '#e0ac69', hair: '#111', cap: '#ffc83d', face: 1 };
  if (state.staff.tech && !npcs.tech) npcs.tech = { x: SEC.svc.bench.x - 24, y: SEC.svc.bench.y + 30, path: [], speed: 0, shirt: '#ff6b9a', skin: '#c68642', hair: '#2b1d0e', cap: '#2b2350', face: 1 };
  if (state.staff.stocker && !npcs.stocker) npcs.stocker = { x: 300, y: 178, path: [], speed: 125, shirt: '#06d6a0', skin: '#f5d0a9', hair: '#b5542b', cap: '#2b2350', carry: [], job: 'idle', timer: 0, face: 1 };
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
      .filter(s => state.crates[s.id] > 0)
      .map(s => ({ s, ratio: state.sec[s.id].stock / shelfCap(s.id) }))
      .filter(o => o.ratio < 0.6)
      .sort((a, b) => a.ratio - b.ratio)[0];
    if (!need) { if (dist(n, { x: 300, y: 178 }) > 4) n.path = route(n, { x: 300, y: 178 }); return; }
    n.target = need.s.id; n.job = 'load';
    n.path = route(n, need.s.crate);
  } else if (n.job === 'load') {
    const st = state.sec[n.target];
    const want = Math.min(stockerCarry(), shelfCap(n.target) - st.stock);
    const crateEmpty = state.crates[n.target] <= 0;
    if (n.carry.length < want && !crateEmpty && n.timer > 0.3 * stockerHandTime()) { n.carry.push(n.target); state.crates[n.target]--; n.timer = 0; }
    if (crateEmpty && !n.carry.length) { n.job = 'idle'; n.timer = 0; return; }
    if (n.carry.length >= want || crateEmpty) {
      n.job = 'unload'; n.timer = 0;
      const f = SEC[n.target].stockSpot;
      const vert = SEC[n.target].shelf.h > SEC[n.target].shelf.w;
      n.path = route(n, vert ? { x: f.x, y: f.y + (Math.random() * 160 - 80) } : { x: f.x + (Math.random() * 120 - 60), y: f.y });
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
  updateTruck(dt);
  updateEvents(dt);

  spawnTimer -= dt;
  const maxShoppers = Math.min(rushEvent ? 16 : 10, 2 + unlockedParts().length * 2 + (rushEvent ? 6 : 0));
  if (spawnTimer <= 0) {
    if (customers.length < maxShoppers) spawnCustomer();
    spawnTimer = Math.max(1.4, 4.5 - 0.7 * (unlockedParts().length - 1)) * (0.7 + Math.random() * 0.6) / ((rushEvent && rushEvent.spawn) || 1);
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
  const WW = worldW();
  const tx = vw >= WW ? WW / 2 : Math.max(vw / 2, Math.min(WW - vw / 2, state.player.x));
  const ty = vh >= H ? H / 2 : Math.max(vh / 2 - 96, Math.min(H - vh / 2 + 40, state.player.y));
  cam.x += (tx - cam.x) * 0.15; cam.y += (ty - cam.y) * 0.15;
  ctx.setTransform(zoom * DPR, 0, 0, zoom * DPR, (cssW / 2 - cam.x * zoom) * DPR, (cssH / 2 - cam.y * zoom) * DPR);

  drawRoad();
  drawFloor();
  drawTruck();
  drawStockroom();
  drawWalls();
  drawCheckout();
  for (const s of PARTS) drawShelf(s);
  drawService();
  drawUnlockPads();
  drawExpansionPad();
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
  rr(0, 0, W_FULL, H, 18); ctx.fillStyle = theme().wall; ctx.fill();
  // tiles
  ctx.save();
  rr(16, 16, W_FULL - 32, H - 32, 10); ctx.clip();
  for (let y = 16; y < H; y += 40) for (let x = 16; x < W_FULL; x += 40) {
    ctx.fillStyle = ((x + y) / 40) % 2 === 0 ? theme().a : theme().b;
    ctx.fillRect(x, y, 40, 40);
  }
  ctx.restore();
  // doors
  ctx.fillStyle = '#8fd3ff';
  ctx.fillRect(ENTRANCE.x, H - 18, ENTRANCE.w, 18);
  ctx.fillRect(EXIT.x, H - 18, EXIT.w, 18);
  text('ENTRANCE', ENTRANCE.x + ENTRANCE.w / 2, H - 9, 11, '#1d4e74');
  text('EXIT', EXIT.x + EXIT.w / 2, H - 9, 11, '#1d4e74');
  rr(ENTRANCE.x + 15, H - 66, ENTRANCE.w - 30, 42, 8); ctx.fillStyle = '#d8d0f5'; ctx.fill();
}

function drawRoad() {
  ctx.fillStyle = '#4b4566'; ctx.fillRect(-200, -100, W_FULL + 400, 100);
  ctx.strokeStyle = '#f4d35e'; ctx.lineWidth = 3; ctx.setLineDash([18, 14]);
  ctx.beginPath(); ctx.moveTo(-200, -50); ctx.lineTo(W_FULL + 200, -50); ctx.stroke(); ctx.setLineDash([]);
}
function drawTruck() {
  if (truck.phase === 'away') return;
  const x = truck.x, y = ROAD_Y;
  // trailer
  rr(x - 90, y - 26, 120, 48, 8); ctx.fillStyle = '#fafafa'; ctx.fill();
  ctx.strokeStyle = '#c9c3e3'; ctx.lineWidth = 2; ctx.stroke();
  text('PC PARTS', x - 30, y - 2, 13, '#5b2bd1');
  // cab
  rr(x + 32, y - 16, 40, 38, 8); ctx.fillStyle = '#ff6b6b'; ctx.fill();
  rr(x + 52, y - 10, 16, 14, 3); ctx.fillStyle = '#bfe9ff'; ctx.fill();
  ctx.fillStyle = '#2b2350';
  for (const wx of [x - 64, x - 8, x + 54]) { ctx.beginPath(); ctx.arc(wx, y + 24, 8, 0, Math.PI * 2); ctx.fill(); }
}
function drawWalls() {
  ctx.fillStyle = theme().wall;
  for (const r of (state.expanded ? DIVIDER_OPEN : DIVIDER_CLOSED)) { rr(r.x, r.y, r.w, r.h, 6); ctx.fill(); }
  if (!state.expanded) {
    // what's behind the wall
    ctx.fillStyle = '#2a1f5c'; ctx.fillRect(612, 0, W_FULL - 612, H);
    text('🔒 EXPANSION', 800, 500, 22, '#8f80d6');
  }
}
function drawExpansionPad() {
  if (state.expanded || !state.sec.svc.unlocked) return;
  const p = EXPANSION.pad, r = padRect(p, 110, 60), pct = state.expandPaid / EXPANSION.cost;
  const pulse = 1 + 0.04 * Math.sin(time * 5);
  ctx.save();
  ctx.translate(p.x, p.y); ctx.scale(pulse, pulse); ctx.translate(-p.x, -p.y);
  rr(r.x, r.y + 5, r.w, r.h, 12); ctx.fillStyle = '#8a3b12'; ctx.fill();
  rr(r.x, r.y, r.w, r.h, 12); ctx.fillStyle = '#ffb36b'; ctx.fill();
  ctx.save(); rr(r.x, r.y, r.w, r.h, 12); ctx.clip();
  ctx.fillStyle = '#2ecc71'; ctx.fillRect(r.x, r.y, r.w * pct, r.h); ctx.restore();
  drawEmoji('🧱', r.x + 18, r.y + r.h / 2, 18);
  text('EXPAND STORE', r.x + r.w / 2 + 10, r.y + 19, 10, '#5a2a00');
  text(money$(Math.ceil(EXPANSION.cost - state.expandPaid)), r.x + r.w / 2 + 10, r.y + 39, 15, '#5a2a00');
  ctx.restore();
}

function drawStockroom() {
  rr(16, 16, W_FULL - 32, STOCKROOM_H, 10); ctx.fillStyle = '#d9cfa8'; ctx.fill();
  ctx.strokeStyle = '#b9ab78'; ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(16, 16 + STOCKROOM_H); ctx.lineTo(W_FULL - 16, 16 + STOCKROOM_H); ctx.stroke(); ctx.setLineDash([]);
  // loading dock door in the top wall
  ctx.fillStyle = truck.phase === 'unloading' ? '#7ef0a8' : '#8fd3ff'; ctx.fillRect(DOCK_X - 45, 0, 90, 16);
  text('DOCK', DOCK_X, 8, 10, '#1d4e74');
  text('STOCKROOM  ·  ' + truckStatus(), 300, 30, 12, '#7a6a35');
  for (const s of PARTS) {
    const r = crateRect(s);
    const on = state.sec[s.id].unlocked;
    ctx.globalAlpha = on ? 1 : 0.3;
    rr(r.x, r.y + 6, r.w, r.h, 10); ctx.fillStyle = '#8a6a2f'; ctx.fill();
    rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = '#c99a4a'; ctx.fill();
    ctx.strokeStyle = '#a77c34'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(r.x + 6, r.y + r.h / 2); ctx.lineTo(r.x + r.w - 6, r.y + r.h / 2); ctx.stroke();
    const left = state.crates[s.id] || 0;
    if (on && left <= 0) ctx.globalAlpha = 0.45;
    drawEmoji(on ? s.icon : '🔒', s.crate.x, s.crate.y - 4, 24);
    ctx.globalAlpha = on ? 1 : 0.3;
    if (on && left <= 0) outlinedText('EMPTY', s.crate.x, s.crate.y + 16, 11, '#ff5a5f', '#fff');
    text(s.items[0].toUpperCase() + s.items.slice(1) + (on ? `  ${left}/${crateMax()}` : ''), s.crate.x, r.y + r.h + 14, 11, on && left <= 0 ? '#d63d42' : '#7a6a35');
    ctx.globalAlpha = 1;
  }
}

function drawShelf(s) {
  const st = state.sec[s.id];
  const r = s.shelf;
  const vert = r.h > r.w;
  if (!st.unlocked) {
    ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.strokeStyle = '#b8aee0';
    rr(r.x, r.y, r.w, r.h, 10); ctx.stroke(); ctx.setLineDash([]);
    if (vert) { ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(-Math.PI / 2); text(s.name, 0, 0, 14, '#a59bd0'); ctx.restore(); }
    else text(s.name, r.x + r.w / 2, r.y + r.h / 2, 14, '#a59bd0');
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
  const len = vert ? r.h : r.w;
  const step = (len - 24) / (per - 1 || 1);
  for (let i = 0; i < st.stock; i++) {
    const col = i % per, row = Math.floor(i / per);
    if (vert) drawEmoji(s.icon, r.x + r.w / 2 + row * 6, r.y + 12 + col * step, 17);
    else drawEmoji(s.icon, r.x + 12 + col * step, r.y + r.h / 2 - row * 8, 17);
  }
  // sign
  const label = `${s.name} · ${money$(price(s.id))}`;
  ctx.font = '700 11px Fredoka, ui-rounded, system-ui, sans-serif';
  const lw = ctx.measureText(label).width + 20;
  const lx = Math.max(20 + lw / 2, Math.min(W_FULL - 20 - lw / 2, r.x + r.w / 2));
  const ly = s.id === 'gpu' ? r.y + r.h + 22 : r.y - 14;
  rr(lx - lw / 2, ly - 10, lw, 20, 8); ctx.fillStyle = s.color; ctx.fill();
  text(label, lx, ly, 11, '#fff');
  const cx = vert ? (r.x < W_MAIN / 2 ? r.x + r.w + 6 : r.x - 6) : r.x + r.w + 8;
  const cy = vert ? r.y + r.h + 14 : r.y + r.h / 2;
  text(`${st.stock}/${cap}`, cx, cy, 11, st.stock ? '#6b6390' : '#ff5a5f', 700, vert ? (r.x < W_MAIN / 2 ? 'left' : 'right') : 'left');
  if (!st.stock) {
    if (vert) { ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(-Math.PI / 2); outlinedText('EMPTY!', 0, 0, 15, '#ff5a5f', '#fff'); ctx.restore(); }
    else outlinedText('EMPTY!', r.x + r.w / 2, r.y + r.h / 2, 15, '#ff5a5f', '#fff');
  }
}

function drawCashPile(spot, amount) {
  if (amount < 1) return;
  const n = Math.min(10, 1 + Math.floor(Math.log2(amount / 20 + 1)));
  for (let i = 0; i < n; i++) {
    rr(spot.x - 12 + (i % 2) * 3, spot.y - i * 4, 24, 12, 2); ctx.fillStyle = i % 2 ? '#2ecc71' : '#27ae60'; ctx.fill();
    ctx.strokeStyle = '#1e7a45'; ctx.lineWidth = 1; ctx.stroke();
  }
  outlinedText(money$(amount), spot.x, spot.y - n * 4 - 12, 12, '#7ef0a8', '#1e5e36');
}
function drawCheckout() {
  text('CHECKOUT', 390, 892, 13, '#7a4b1e');
  for (let l = 0; l < 2; l++) {
    const r = COUNTERS[l], reg = REG[l];
    const here = dist(state.player, reg) < REG_RADIUS;
    const staffed = (l === 1 && state.staff.cashier) || (l === 0 && state.staff.cashier2);
    // register spot
    ctx.beginPath(); ctx.arc(reg.x, reg.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = here ? 'rgba(46,204,113,.45)' : 'rgba(255,200,61,.45)'; ctx.fill();
    ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.strokeStyle = here ? '#1e9e55' : '#d99a00'; ctx.stroke(); ctx.setLineDash([]);
    // counter
    rr(r.x, r.y + 7, r.w, r.h, 9); ctx.fillStyle = '#7a4b1e'; ctx.fill();
    rr(r.x, r.y, r.w, r.h, 9); ctx.fillStyle = '#b8743a'; ctx.fill();
    rr(r.x + 6, r.y + 30, r.w - 12, 26, 5); ctx.fillStyle = '#2b2350'; ctx.fill();
    rr(r.x + 9, r.y + 34, r.w - 18, 10, 3); ctx.fillStyle = '#7ef0a8'; ctx.fill();
    text(l === 0 ? 'LANE 1' : 'LANE 2', r.x + r.w / 2, r.y - 10, 10, '#7a4b1e');
    // queue markers
    for (let i = 0; i < 4; i++) {
      const q = queueSlot(l, i);
      ctx.beginPath(); ctx.arc(q.x, q.y + 10, 5, 0, Math.PI * 2); ctx.fillStyle = '#d8d0f5'; ctx.fill();
    }
    const f = queues[l][0];
    if (f && f.cart.length && (here || staffed)) {
      const pct = f.scanned / f.cart.length;
      rr(r.x - 8, r.y + r.h + 14, 52, 7, 3); ctx.fillStyle = '#ddd6f7'; ctx.fill();
      rr(r.x - 8, r.y + r.h + 14, 52 * pct, 7, 3); ctx.fillStyle = '#2ecc71'; ctx.fill();
    }
    if (queues[l].length && !here && !staffed) outlinedText('Customers waiting!', reg.x, reg.y + 42, 11, '#ffc83d');
  }
  for (let l = 0; l < 2; l++) drawCashPile(PILE_SPOTS[l], state.piles[l]);
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
  ctx.beginPath(); ctx.arc(s.workPad.x, s.workPad.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = here ? 'rgba(46,204,113,.45)' : 'rgba(255,107,154,.35)'; ctx.fill();
  ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.strokeStyle = here ? '#1e9e55' : '#ff6b9a'; ctx.stroke(); ctx.setLineDash([]);
  rr(r.x, r.y + 8, r.w, r.h, 10); ctx.fillStyle = '#9a3d5c'; ctx.fill();
  rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = '#ff8fb1'; ctx.fill();
  rr(r.x + r.w / 2 - 84, r.y - 24, 168, 20, 8); ctx.fillStyle = s.color; ctx.fill();
  text('Service Station · repairs & builds', r.x + r.w / 2, r.y - 14, 11, '#fff');
  const c = currentJobCustomer();
  const job = c && c.job;
  if (!job) {
    drawEmoji('🧰', r.x + 60, r.y + r.h / 2, 22);
    drawEmoji('🔧', r.x + 120, r.y + r.h / 2, 18);
  } else {
    const J = JOBS[job.type];
    const missing = missingParts(job);
    // highlight the bench when you're carrying a part this job needs
    if (missing.some(id => state.carry.includes(id))) {
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(time * 6);
      rr(r.x - 24, r.y - 24, r.w + 48, r.h + 48, 16); ctx.fillStyle = s.color; ctx.fill();
      ctx.globalAlpha = 1;
      rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = '#ff8fb1'; ctx.fill();
    }
    drawEmoji(J.icon, r.x + 16, r.y + r.h / 2, 18);
    text(J.name, r.x + 30, r.y + 12, 10, '#7a2340', 700, 'left');
    text(money$(jobPay(job)), r.x + 30, r.y + 28, 11, '#1e7a45', 700, 'left');
    // part slots
    const got = [...job.got];
    job.parts.forEach((id, i) => {
      const x = r.x + 100 + i * 22, y = r.y + r.h / 2;
      const gi = got.indexOf(id);
      const have = gi >= 0; if (have) got.splice(gi, 1);
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fillStyle = have ? '#c8f5da' : '#fff'; ctx.fill();
      ctx.globalAlpha = have ? 1 : 0.4; drawEmoji(SEC[id].icon, x, y, 13); ctx.globalAlpha = 1;
      if (have) text('✓', x + 8, y - 8, 10, '#1e9e55');
    });
    if (!job.parts.length) text('no parts needed', r.x + 100, r.y + r.h / 2, 9, '#7a2340', 600, 'left');
    rr(r.x + 15, r.y + r.h + 6, 150, 8, 4); ctx.fillStyle = '#ddd6f7'; ctx.fill();
    rr(r.x + 15, r.y + r.h + 6, 150 * buildProgress, 8, 4); ctx.fillStyle = '#ff6b9a'; ctx.fill();
    if (!here && !state.staff.tech && !missing.length) outlinedText(`${J.name} ready to work on!`, s.workPad.x - 30, s.workPad.y + 34, 12, '#ffc83d');
  }
  drawCashPile(BENCH_PILE, state.benchPile);
}

function drawUnlockPads() {
  for (const s of SECTIONS) {
    const st = state.sec[s.id];
    if (st.unlocked || !canUnlockNext(s.id)) continue;
    const r = padRect(s.pad);
    const pct = st.paid / s.unlock;
    const pulse = 1 + 0.04 * Math.sin(time * 5);
    ctx.save();
    ctx.translate(s.pad.x, s.pad.y); ctx.scale(pulse, pulse); ctx.translate(-s.pad.x, -s.pad.y);
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
    if (state.staff[k] || !staffAvailable(k)) continue;
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
  else if (c.state === 'svc') { if (!c.path.length) return; icon = c.job ? JOBS[c.job.type].icon : '🛠️'; }
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
    } else if (f.type === 'box') {
      const k = Math.min(1, f.t / 0.6);
      rr(f.x + (f.tx - f.x) * k - 9, f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 40 - 7, 18, 14, 3); ctx.fillStyle = f.color; ctx.fill();
    } else if (f.type === 'coin') {
      if (f.t < 0) continue;
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
  const atReg = dist(p, REG[0]) < REG_RADIUS || dist(p, REG[1]) < REG_RADIUS;
  const carried = state.carry[0];
  if (carried) {
    const s = SEC[carried];
    if (state.sec[carried].stock < shelfCap(carried)) return { pt: s.stockSpot, text: `Put the ${s.items} on the ${s.name} shelf` };
  }
  if (queues[0].length && !state.staff.cashier && !state.staff.cashier2) return atReg ? { pt: REG[0], text: 'Stay here to check out the line' } : { pt: REG[0], text: 'Go to the register to check out customers' };
  const piled = state.piles[0] + state.piles[1];
  if (piled >= Math.max(50, state.rate * 40)) {
    const l = state.piles[1] > state.piles[0] ? 1 : 0;
    if (dist(p, REG[l]) > REG_RADIUS) return { pt: REG[l], text: `Collect the ${money$(piled)} at the checkout` };
  }
  if (state.benchPile >= Math.max(50, state.rate * 40) && dist(p, BENCH_PILE) > 70) return { pt: BENCH_PILE, text: `Collect the ${money$(state.benchPile)} at the Service Station` };
  const jc = currentJobCustomer();
  if (jc && jc.job) {
    const J = JOBS[jc.job.type], missing = missingParts(jc.job);
    if (missing.length && !state.staff.tech) {
      const carrying = missing.find(id => state.carry.includes(id));
      if (carrying) return { pt: { x: 300, y: 248 }, text: `Bring the ${SEC[carrying].item} to the Service Station` };
      const need = SEC[missing[0]];
      if (state.carry.length < carryCap() && state.crates[need.id] > 0) return { pt: need.crate, text: `${J.name} job needs a ${need.item}: grab one from the stockroom` };
    } else if (!missing.length && !state.staff.tech && dist(p, SEC.svc.workPad) > 34) return { pt: SEC.svc.workPad, text: `A ${J.name.toLowerCase()} is ready. Go work on it!` };
  }
  const next = SECTIONS.find(s => !state.sec[s.id].unlocked);
  if (next && next.wing && !state.expanded) {
    if (state.money >= EXPANSION.cost - state.expandPaid) return { pt: EXPANSION.pad, text: 'Stand on the pad to expand your store' };
  } else if (next && state.money >= next.unlock - state.sec[next.id].paid) return { pt: next.pad, text: `Stand on the pad to unlock ${next.name}` };
  for (const k in HIRE_PADS) {
    if (!state.staff[k] && staffAvailable(k) && state.money >= staffRemaining(k) && !inRect(p, padRect(HIRE_PADS[k])))
      return { pt: HIRE_PADS[k], text: k === 'cashier2' ? 'Stand on the pad to hire a second cashier' : `Stand on the pad to hire a ${HIRE_PADS[k].label.toLowerCase()}` };
  }
  const low = unlockedParts().find(s => state.sec[s.id].stock === 0) || (state.carry.length === 0 && unlockedParts().find(s => state.sec[s.id].stock < 2));
  if (low && state.carry.length < carryCap()) {
    if (state.crates[low.id] <= 0) return { pt: { x: DOCK_X, y: 60 }, text: `Out of ${low.items}! ${truckStatus()}` };
    return { pt: low.crate, text: `Grab ${low.items} from the stockroom` };
  }
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
  currentObjective = state.lifetime < 4000 || (queues[0].length && !state.staff.cashier) ? objective() : null;
  const hint = $('#hint');
  hint.textContent = currentObjective ? currentObjective.text : '';
  hint.classList.toggle('show', !!currentObjective);
  $('#upgradeBtn').classList.toggle('alert', anyAffordable() || claimableStars() > 0);
  updateMissions();
  $('#missionsBtn').classList.toggle('alert', anyClaimable());
  const eb = $('#eventBanner');
  eb.classList.toggle('show', !!rushEvent);
  if (rushEvent) eb.innerHTML = `<b>${rushEvent.icon} ${rushEvent.name}</b> ${rushEvent.desc} · ${Math.ceil(eventLeft)}s`;
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
  if (state.deliveryLv < MAX_STOCKROOM_LV && state.money >= deliveryCost()) return true;
  if (state.truckLv < MAX_STOCKROOM_LV && state.money >= truckCost()) return true;
  for (const u of STAFF_UPGRADES) if (state.staff[u.staff] && staffLv(u.id) < u.max && state.money >= staffUpCost(u.id)) return true;
  return false;
}
function staffRemaining(k) { return STAFF[k].cost - (state.staffPaid[k] || 0); }
function staffAvailable(k) {
  if (k === 'tech') return state.sec.svc.unlocked;
  if (k === 'cashier2') return state.staff.cashier;
  return true;
}
function showUpgrades() {
  let html = `<div class="sheet-head"><h2>Upgrades</h2><button class="icon-btn small" data-act="close" aria-label="Close">✕</button></div>`;
  html += `<div class="group">Sections <span>Level up to raise prices</span></div>`;
  for (const s of SECTIONS) {
    const st = state.sec[s.id];
    if (!st.unlocked) {
      html += `<div class="item locked"><div class="avatar" style="--c:${s.color}">🔒</div><div class="info"><div class="title">${s.name}</div><div class="desc">${s.wing && !state.expanded ? 'Expand the store first, then unlock' : 'Unlock on the store floor'} for ${money$(s.unlock)}</div></div></div>`;
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
      <div class="info"><div class="title">${s.name}</div><div class="desc">${avail ? s.desc + (HIRE_PADS[k] && !state.staff[k] ? ' · or hire on the store floor' : '') : k === 'cashier2' ? 'Hire Cashier Cass first' : 'Unlock the Service Station first'}</div></div>
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
  html += `<div class="group">Stockroom <span>Deliveries every ${truckInterval()}s</span></div>`;
  html += cappedRow('delivery', '📦', 'Bigger Deliveries', `Crates hold ${crateMax()}${state.deliveryLv < MAX_STOCKROOM_LV ? ` → ${crateMax() + 8}` : ''}`, state.deliveryLv, MAX_STOCKROOM_LV, deliveryCost());
  html += cappedRow('truck', '🚚', 'Faster Trucks', `A truck every ${truckInterval()}s${state.truckLv < MAX_STOCKROOM_LV ? ` → ${Math.max(15, truckInterval() - 5)}s` : ''}`, state.truckLv, MAX_STOCKROOM_LV, truckCost());
  html += franchiseHtml();
  showModal(html, true);
  updateHud(1);
}
function cappedRow(act, icon, title, desc, lv, max, cost) {
  return `<div class="item"><div class="avatar" style="--c:#fff1d6">${icon}</div>
    <div class="info"><div class="title">${title} <small>Lv ${lv}/${max}</small></div><div class="desc">${desc}</div></div>
    ${lv >= max ? '<button class="btn owned" disabled>MAX</button>' : `<button class="btn green" data-act="${act}" data-cost="${cost}">Buy<small>${money$(cost)}</small></button>`}</div>`;
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
    case 'franchise':
      if (claimableStars() > 0) showModal(`<div class="emoji">⭐</div><h2>Open a new store?</h2>
        <p>Sell your ${theme().name} for <b>${claimableStars()} Stars</b> and open a ${THEMES[(state.franchises + 1) % THEMES.length].name}. Every Star adds 5% to all your prices, forever.</p>
        <p>Your cash, sections, staff and upgrades start over. Stars, achievements and lifetime stats stay.</p>
        <button class="btn green" data-act="confirmFranchise">Franchise!</button><button class="btn disabled" data-act="close">Not yet</button>`);
      break;
    case 'confirmFranchise': doFranchise(); break;
    case 'claimDaily': {
      const m = state.daily && state.daily.list[+id];
      if (m && !m.claimed && m.progress >= m.target) { m.claimed = true; bank(m.reward); sfx.cash(); confetti(); toast(`📋 Mission done! +${money$(m.reward)}`); showMissions(); }
      break;
    }
    case 'claimAch': {
      if (state.achDone.includes(id) && !state.achClaimed.includes(id)) { state.achClaimed.push(id); state.stars++; sfx.unlock(); confetti(); toast(`⭐ +1 Star! Profit x${starMult().toFixed(2)}`); showMissions(); }
      break;
    }
    case 'delivery':
      if (state.deliveryLv < MAX_STOCKROOM_LV && spend(deliveryCost())) { state.deliveryLv++; sfx.unlock(); showUpgrades(); }
      break;
    case 'truck':
      if (state.truckLv < MAX_STOCKROOM_LV && spend(truckCost())) { state.truckLv++; truckTimer = Math.min(truckTimer, truckInterval()); sfx.unlock(); showUpgrades(); }
      break;
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
      customers = []; queues = [[], []]; fx = []; buildProgress = 0;
      for (const k in npcs) delete npcs[k];
      rebuildGrid();
      save(); closeModal();
      break;
  }
});
$('#upgradeBtn').addEventListener('click', showUpgrades);
$('#settingsBtn').addEventListener('click', showSettings);
$('#missionsBtn').addEventListener('click', () => { updateMissions(); showMissions(); });
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
