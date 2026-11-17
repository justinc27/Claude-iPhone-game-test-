'use strict';

/* =========================================================
   PC Parts Tycoon — run a PC parts store as a character.
   Move with the touch joystick, restock shelves from the
   stockroom, and check shoppers out at the register.
   ========================================================= */

const SAVE_KEY = 'pcPartsTycoon_store_v2';
const W_MAIN = 600, W_FULL = 1000, H = 1020;   // store size; the expansion wing adds x 600..1000
function worldW() { return state.expanded ? W_FULL : W_MAIN; }
const VIEW_UNITS = 488;              // how many world units fit across the screen (zoomed in so the camera follows you)
const MILESTONES = [10, 25, 50, 100];
const MAX_STOCKROOM_LV = 6;

// ---------- Store layout ("Racetrack Loop") ----------
// Stockroom across the top, wall shelves left & right, a center island with
// two back-to-back shelves, and a one-way loop: in bottom-left, out bottom-right.
// Crates sit near the back wall so a clear walkway runs in front of them (y 108–144) where nothing gets picked up
const CRATE_Y = 72;
const SECTIONS = [
  { id: 'acc', name: 'Accessories', item: 'Mouse', items: 'mice', icon: '🖱️', color: '#4fb3ff', price: 8, unlock: 0,
    shelf: { x: 26, y: 270, w: 40, h: 330 }, crate: { x: 90, y: CRATE_Y }, stockSpot: { x: 94, y: 435 }, pad: { x: 120, y: 435 } },
  { id: 'case', name: 'PC Cases', item: 'PC Case', items: 'PC cases', icon: '🗄️', color: '#a77bff', price: 25, unlock: 120,
    shelf: { x: 534, y: 270, w: 40, h: 330 }, crate: { x: 205, y: CRATE_Y }, stockSpot: { x: 506, y: 435 }, pad: { x: 478, y: 435 } },
  { id: 'mon', name: 'Monitors', item: 'Monitor', items: 'monitors', icon: '🖥️', color: '#2ecc8f', price: 60, unlock: 600,
    shelf: { x: 200, y: 345, w: 200, h: 42 }, crate: { x: 320, y: CRATE_Y }, stockSpot: { x: 300, y: 321 }, pad: { x: 300, y: 313 } },
  { id: 'gpu', name: 'Graphics Cards', item: 'GPU', items: 'GPUs', icon: '🎮', color: '#ff9f43', price: 140, unlock: 1500,
    shelf: { x: 200, y: 465, w: 200, h: 42 }, crate: { x: 435, y: CRATE_Y }, stockSpot: { x: 300, y: 533 }, pad: { x: 300, y: 548 } },
  { id: 'svc', name: 'Service Station', item: 'Custom PC', items: 'custom PCs', icon: '🛠️', color: '#ff6b9a', price: 400, unlock: 10000,
    bench: { x: 210, y: 200, w: 180, h: 40 }, pad: { x: 300, y: 272 } },
  // ----- Expansion wing -----
  { id: 'cpu', name: 'CPUs', item: 'CPU', items: 'CPUs', icon: '🧠', color: '#3bb5b5', price: 220, unlock: 30000, wing: true,
    shelf: { x: 660, y: 300, w: 200, h: 42 }, crate: { x: 690, y: CRATE_Y }, stockSpot: { x: 760, y: 276 }, pad: { x: 760, y: 372 } },
  { id: 'ram', name: 'RAM & Storage', item: 'RAM Kit', items: 'RAM kits', icon: '💾', color: '#e05fb0', price: 350, unlock: 75000, wing: true,
    shelf: { x: 660, y: 470, w: 200, h: 42 }, crate: { x: 805, y: CRATE_Y }, stockSpot: { x: 760, y: 446 }, pad: { x: 760, y: 542 } },
  { id: 'chair', name: 'Gaming Chairs', item: 'Gaming Chair', items: 'gaming chairs', icon: '🪑', color: '#e5484d', price: 600, unlock: 150000, wing: true,
    shelf: { x: 660, y: 640, w: 200, h: 42 }, crate: { x: 920, y: CRATE_Y }, stockSpot: { x: 760, y: 616 }, pad: { x: 760, y: 712 } },
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
// Store upgrades: big late-game purchases, available once the store is expanded
const STORE_UPGRADES = [
  { id: 'ads', icon: '📣', title: 'Advertising', base: 40000, max: 5,
    desc: l => `Up to ${10 + l} shoppers at once${l ? `, arriving ${10 * l}% faster` : ''}${l < 5 ? ` → ${11 + l}, ${10 * (l + 1)}% faster` : ''}` },
  { id: 'displays', icon: '✨', title: 'Premium Displays', base: 60000, max: 5,
    desc: l => `${l ? `Every price +${6 * l}%` : 'Raise every price'}${l < 5 ? ` → +${6 * (l + 1)}%` : ''}` },
  { id: 'tools', icon: '🧰', title: 'Pro Repair Kits', base: 30000, max: 5,
    desc: l => `Service Station jobs pay ${l ? `+${15 * l}%` : 'more'}${l < 5 ? ` → +${15 * (l + 1)}%` : ''}` },
];
const STORE_UP = Object.fromEntries(STORE_UPGRADES.map(u => [u.id, u]));
function storeLv(id) { return (state.storeUp && state.storeUp[id]) || 0; }
function storeUpCost(id) { return Math.round(STORE_UP[id].base * Math.pow(2, storeLv(id))); }
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
    starPerks: keep.starPerks || {},
    storeName: keep.storeName || 'Byte Depot',
    sound: keep.sound !== undefined ? keep.sound : true,
    haptics: keep.haptics !== undefined ? keep.haptics : true,
    sec, speedLv: 0, carryLv: 0,
    expanded: false, expandPaid: 0,
    crates: Object.fromEntries(SECTIONS.filter(x => x.shelf).map(x => [x.id, 24])),
    deliveryLv: 0, truckLv: 0,
    // late-game Store upgrades and Store goals: these belong to this store and reset on Franchise
    storeUp: { ads: 0, displays: 0, tools: 0 }, decorSeen: null, goalsDone: [], goalsClaimed: [], storeServed: 0, storeBuilt: 0,
    piles: [0, 0], benchPile: 0,
    staff: { cashier: false, cashier2: false, stocker: false, tech: false },
    staffPaid: { cashier: 0, cashier2: 0, stocker: 0 },
    staffLv: {},
    admin: keep.admin || { unlimited: false, speed: 1, savedMoney: 0 },
    player: { x: 300, y: 640 },
    carry: [],
    rate: 0,
    lastSeen: Date.now(),
  };
}
// ---------- Saving ----------
// Saves are protected three ways:
//  1. A backup copy, refreshed once a minute, so a bad save can't wipe progress.
//  2. A save is only written if it checks out, and a save that won't load is kept aside, never overwritten.
//  3. In the iPhone app, every save is also mirrored to the app's own storage (Capacitor Preferences),
//     which iOS doesn't clear the way it can clear a web view's storage.
const BACKUP_KEY = SAVE_KEY + '_backup', DAMAGED_KEY = SAVE_KEY + '_damaged';
const BACKUP_EVERY = 60 * 1000;
let lastBackup = 0;
function nativePrefs() {
  try { return (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Preferences) || null; } catch (e) { return null; }
}
function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function lsSet(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }
// A save is usable if it parses and has the basics a store needs
function parseSave(raw) {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return s && typeof s === 'object' && s.sec && typeof s.sec === 'object' && Number.isFinite(s.money) ? s : null;
  } catch (e) { return null; }
}
function mergeSave(s) {
  const base = freshState(s);
  const base0 = freshState(s);
  const merged = Object.assign(base, s);
  for (const sc of SECTIONS) merged.sec[sc.id] = Object.assign(base.sec[sc.id], (s.sec || {})[sc.id] || {});
  merged.staff = Object.assign(freshState().staff, s.staff || {});
  merged.staffPaid = Object.assign(freshState().staffPaid, s.staffPaid || {});
  merged.staffLv = Object.assign({}, s.staffLv || {});
  merged.crates = Object.assign(base0.crates, s.crates || {});
  merged.piles = Array.isArray(s.piles) ? s.piles : [0, 0];
  merged.storeUp = Object.assign({ ads: 0, displays: 0, tools: 0 }, s.storeUp || {});
  return merged;
}
function load() {
  const raw = lsGet(SAVE_KEY);
  const main = parseSave(raw), backup = parseSave(lsGet(BACKUP_KEY));
  // keep a save that won't load aside instead of letting a new game overwrite it
  if (raw && !main && !lsGet(DAMAGED_KEY)) lsSet(DAMAGED_KEY, raw);
  const best = [main, backup].filter(Boolean).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))[0];
  if (!best) return null;
  try { return mergeSave(best); } catch (e) { return null; }
}
function save(forceBackup = false) {
  state.lastSeen = Date.now();
  let json;
  try { json = JSON.stringify(state); } catch (e) { return; }
  if (!parseSave(json)) return;   // never replace a good save with a broken one
  lsSet(SAVE_KEY, json);
  if (forceBackup || Date.now() - lastBackup > BACKUP_EVERY) { lsSet(BACKUP_KEY, json); lastBackup = Date.now(); }
  const prefs = nativePrefs();
  if (prefs) prefs.set({ key: SAVE_KEY, value: json }).catch(() => {});
}
// In the iPhone app: if the app's own storage has a newer save (the web view's storage was cleared), restore it
function restoreFromNative() {
  const prefs = nativePrefs();
  if (!prefs) return;
  prefs.get({ key: SAVE_KEY }).then(r => {
    const n = parseSave(r && r.value);
    if (!n || (loaded && (n.lastSeen || 0) <= (state.lastSeen || 0))) return;
    if (lsGet(SAVE_KEY + '_restoring') === String(n.lastSeen)) return;   // already tried once: don't loop
    if (lsSet(SAVE_KEY, r.value) && lsSet(SAVE_KEY + '_restoring', String(n.lastSeen))) location.reload();
  }).catch(() => {});
}
// Ask the browser not to clear the game's storage (helps when it's added to the Home Screen)
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* not supported */ }
const loaded = load();
const isNewPlayer = !loaded;
let state = loaded || freshState();
state.money = Math.floor(state.money);
for (const id in state.sec) state.sec[id].paid = Math.floor(state.sec[id].paid || 0);
for (const k in state.staffPaid) state.staffPaid[k] = Math.floor(state.staffPaid[k] || 0);
if (loaded) lsSet(BACKUP_KEY, JSON.stringify(state));   // the save that just loaded fine becomes the backup
lastBackup = Date.now();
restoreFromNative();
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
  return Math.round(SEC[id].price * (1 + 0.25 * (L - 1)) * Math.pow(2, MILESTONES.filter(m => L >= m).length) * starMult() * (1 + 0.06 * storeLv('displays')));
}
function levelCost(id) { return Math.round(SEC[id].price * 12 * Math.pow(1.32, state.sec[id].level - 1)); }
function shelfCap(id) { return Math.min(20, 6 + 2 * Math.floor((state.sec[id].level - 1) / 5)); }
function playerSpeed() { return (165 + 20 * state.speedLv) * (1 + 0.08 * perkLv('quickHands')); }
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
  if (state.admin && state.admin.unlimited) state.admin.savedMoney += amount;   // real earnings are kept
  state.lifetime += amount;
  track('earn', null, amount);
  if (x !== undefined) celebrate(amount, x, y);
  else bumpMoney();
}
// ---------- Feedback effects ----------
const reducedMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
let shake = 0, flash = 0;
const popAt = {};       // the newest item on each shelf pops in
const signPopAt = {};   // a shelf's price sign pops when its price changes
// "Cha-ching": coins burst out, fly up to your money, and the amount bounces up
function celebrate(amount, x, y) {
  const big = amount >= Math.max(300, state.rate * 15);
  const n = big ? 18 : 9, fly = big ? 7 : 4;
  for (let i = 0; i < n; i++) fx.push({ type: 'burst', x, y, vx: (Math.random() - 0.5) * 220, vy: -140 - Math.random() * 150, t: 0, life: 0.85 });
  for (let i = 0; i < fly; i++) fx.push({ type: 'fly', x, y, t: -0.25 - i * 0.06, life: 0.55, last: i === fly - 1 });
  fx.push({ type: 'text', text: '+' + money$(amount) + (big ? '!' : ''), x, y, t: 0, life: 1.3, big });
  if (big) { if (!reducedMotion) shake = 1; flash = 1; sfx.big(); } else sfx.ching();
}
// Where the money counter is, in world units (coins fly there)
function moneyTarget() {
  const cr = canvas.getBoundingClientRect(), m = document.getElementById('money').getBoundingClientRect();
  const sx = m.left + m.width * 0.3 - cr.left, sy = m.top + m.height / 2 - cr.top;
  return { x: cam.x + (sx - cssW / 2) / zoom, y: cam.y + (sy - cssH / 2) / zoom };
}
// Where item i sits on a shelf (matches drawShelf)
function itemPos(s, i) {
  const r = s.shelf, vert = r.h > r.w, per = Math.min(10, shelfCap(s.id)), len = vert ? r.h : r.w;
  const step = (len - 24) / (per - 1 || 1), col = i % per, row = Math.floor(i / per);
  return vert ? { x: r.x + r.w / 2 + row * 6, y: r.y + 12 + col * step } : { x: r.x + 12 + col * step, y: r.y + r.h / 2 - row * 8 };
}
function popScale(t) {
  if (t < 0) return 0;
  if (t >= 0.35) return 1;
  const k = t / 0.35, e = q => 1 - Math.pow(1 - q, 3);
  return k < 0.6 ? e(k / 0.6) * 1.3 : 1.3 - 0.3 * e((k - 0.6) / 0.4);
}
// A box flies onto the shelf, the item pops in with a puff (and "+1" when you placed it)
function shelfPlaced(s, from, byPlayer) {
  const i = state.sec[s.id].stock - 1, p = itemPos(s, i), delay = 0.22;
  fx.push({ type: 'box', x: from.x, y: from.y, tx: p.x, ty: p.y, t: 0, life: delay, color: s.color, carried: true });
  popAt[s.id] = { i, t: time + delay };
  fx.push({ type: 'puff', x: p.x, y: p.y + 4, t: -delay, life: 0.4 });
  if (byPlayer) { fx.push({ type: 'plus', x: p.x, y: p.y - 16, t: -delay, life: 0.8, color: s.color }); later(delay * 1000, sfx.pop); }
}
// Level-up: a gold ring around the shelf, confetti, a banner and a fanfare
function celebrateLevel(id, milestone) {
  signPopAt[id] = time;
  if (holdingBuy && !milestone) { sfx.tick(); return; }
  const r = SEC[id].shelf || SEC[id].bench;
  fx.push({ type: 'ring', r, t: 0, life: 0.8 });
  const cols = ['#ffc83d', '#2ecc71', '#ff5a5f', '#7fd4ff', '#c3a6ff', '#ff8fb1'];
  for (let i = 0; i < 36; i++) fx.push({ type: 'confetti', x: r.x + r.w / 2 + (Math.random() - 0.5) * r.w * 0.6, y: r.y, vx: (Math.random() - 0.5) * 260, vy: -120 - Math.random() * 200, spin: (Math.random() - 0.5) * 16, c: cols[i % 6], t: 0, life: 1.6 });
  const L = state.sec[id].level;
  showLevelBanner(milestone ? `🏆 Lv ${L}! ${SEC[id].name} prices x2` : `⬆️ Lv ${L}: ${SEC[id].item} now ${money$(price(id))}`);
  sfx.fanfare();
}
function showLevelBanner(words) {
  const b = document.getElementById('levelBanner');
  b.innerHTML = withProductArt(escapeHtml(words));
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
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
let lastChing = 0;
const later = (ms, fn) => setTimeout(fn, ms);
const sfx = {
  pick: () => beep(700, 0.04, 'triangle', 0.025),
  drop: () => beep(520, 0.04, 'triangle', 0.025),
  scan: () => beep(1500, 0.04, 'square', 0.015),
  // a plain register sound, skipped when a "cha-ching" just played
  cash: () => { if (performance.now() - lastChing < 250) return; beep(1320, 0.06, 'triangle', 0.04); later(60, () => beep(1760, 0.08, 'triangle', 0.04)); },
  pop: () => { beep(520, 0.06, 'triangle', 0.05); later(40, () => beep(880, 0.08, 'triangle', 0.04)); },
  ching: () => {
    lastChing = performance.now();
    beep(1568, 0.12, 'triangle', 0.05); later(80, () => beep(2093, 0.25, 'triangle', 0.05));
    for (let i = 0; i < 6; i++) later(120 + i * 30, () => beep(2600 + i * 180, 0.05, 'sine', 0.015));
  },
  big: () => { sfx.ching(); later(50, () => beep(523, 0.18, 'square', 0.03)); later(150, () => beep(784, 0.25, 'square', 0.03)); },
  fanfare: () => [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 90, () => beep(f, i === 4 ? 0.4 : 0.14, 'triangle', 0.05))),
  tick: () => beep(990, 0.03, 'triangle', 0.02),
  unlock: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.05), i * 90)),
  sad: () => beep(180, 0.2, 'sawtooth', 0.03),
};

// ---------- Haptics ----------
// In the iPhone app (Capacitor) this uses the Taptic Engine; in browsers that allow it, the vibration
// motor. iPhone browsers don't allow vibration, so there's nothing to feel in Safari or the preview.
const HAPTIC_RANK = { selection: 0, light: 1, medium: 2, heavy: 3, success: 4 };
let lastBuzzAt = 0, lastBuzzRank = -1;
function buzz(kind) {
  if (!state.haptics) return;
  const now = performance.now(), rank = HAPTIC_RANK[kind];
  if (now - lastBuzzAt < 70 && rank <= lastBuzzRank) return;   // don't stack buzzes; a stronger one may override
  lastBuzzAt = now; lastBuzzRank = rank;
  try {
    const H = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Haptics;
    if (H) {
      if (kind === 'selection') H.selectionChanged();
      else if (kind === 'success') H.notification({ type: 'SUCCESS' });
      else H.impact({ style: kind.toUpperCase() });
    } else if (navigator.vibrate) {
      navigator.vibrate({ selection: 5, light: 10, medium: 20, heavy: 35, success: [15, 40, 25] }[kind]);
    }
  } catch (e) { /* haptics unavailable */ }
}
// Each sound effect also gives a matching tap
for (const [name, kind] of Object.entries({ pick: 'light', drop: 'light', pop: 'light', ching: 'medium', big: 'heavy', fanfare: 'success', unlock: 'success', tick: 'selection' })) {
  const play = sfx[name];
  sfx[name] = (...a) => { const r = play(...a); buzz(kind); return r; };
}

// ---------- Geometry ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inRect = (p, r, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
function crateRect(s) { return { x: s.crate.x - CRATE_W / 2, y: s.crate.y - CRATE_H / 2, w: CRATE_W, h: CRATE_H }; }
function padRect(p, w = 96, h = 56) { return { x: p.x - w / 2, y: p.y - h / 2, w, h }; }

function obstacles() {
  const list = [...COUNTERS, ...decorRectsOn(), ...stockWallRects(), ...(state.expanded ? DIVIDER_OPEN : [])];
  for (const s of PARTS) if (state.sec[s.id].unlocked) list.push(s.shelf);
  if (state.sec.svc.unlocked) list.push(SEC.svc.bench);
  return list;
}
let FURNITURE = [];
// Frosted-glass wall between the stockroom and the store, with sliding-door openings
const STOCK_WALL_Y = 144, STOCK_WALL_H = 16;
const STOCK_DOORS = [{ x: 113, w: 70 }, { x: 343, w: 70 }, { x: 713, w: 70, wing: true }];
const STOCK_WALL_SEGS = [[16, 113], [183, 343], [413, 588]];
const STOCK_WALL_SEGS_EXPANDED = [[16, 113], [183, 343], [413, 713], [783, 984]];
function stockWallRects() {
  return (state.expanded ? STOCK_WALL_SEGS_EXPANDED : STOCK_WALL_SEGS).map(([a, b]) => ({ x: a, y: STOCK_WALL_Y, w: b - a, h: STOCK_WALL_H }));
}
function stockDoors() { return STOCK_DOORS.filter(d => !d.wing || state.expanded); }
// Automatic sliding doors: 0 = shut, 1 = fully open. They open when you or the stocker come near.
const doorOpen = STOCK_DOORS.map(() => 0);
function updateDoors(dt) {
  STOCK_DOORS.forEach((d, i) => {
    const c = { x: d.x + d.w / 2, y: STOCK_WALL_Y + STOCK_WALL_H / 2 };
    const near = [state.player, npcs.stocker].some(o => o && Math.abs(o.x - c.x) < d.w / 2 + 30 && Math.abs(o.y - c.y) < 70);
    doorOpen[i] = Math.max(0, Math.min(1, doorOpen[i] + (near ? 5 : -2.5) * dt));
  });
}
// Decorations: a "gamer showroom" set that fills the store as you progress (see DECOR_ITEMS).
// Each has a spot, a scale, an unlock test and, if people walk around it, a solid footprint.
const DECOR_ITEMS = [
  { id: 'planter1', name: 'Modern Planter', x: 88, y: 664, s: 0.8, rect: { x: 76, y: 648, w: 24, h: 22 }, on: () => true },
  { id: 'planter2', name: 'Modern Planter', x: 196, y: 990, s: 0.8, rect: { x: 184, y: 974, w: 24, h: 22 }, on: () => true },
  { id: 'planter3', name: 'Modern Planter', x: 412, y: 990, s: 0.8, rect: { x: 400, y: 974, w: 24, h: 22 }, on: () => true },
  { id: 'planter4', name: 'Modern Planter', x: 578, y: 990, s: 0.8, rect: { x: 566, y: 974, w: 24, h: 22 }, on: () => true },
  { id: 'showcase', name: 'RGB Showcase PC', x: 130, y: 866, s: 1, rect: { x: 98, y: 860, w: 64, h: 38 }, on: () => state.sec.case.unlocked },
  { id: 'videowall', name: 'Video Wall', x: 60, y: 196, s: 0.68, rect: { x: 22, y: 168, w: 76, h: 48 }, on: () => state.sec.mon.unlocked },
  { id: 'thanks', name: '"Thank You!" Neon', x: 300, y: 978, s: 0.8, on: () => state.staff.cashier },
  { id: 'gpusign', name: 'Giant GPU Display', x: 168, y: 538, s: 0.52, rect: { x: 142, y: 530, w: 52, h: 26 }, on: () => state.sec.gpu.unlocked },
  { id: 'boxes', name: 'Box Pyramid', x: 545, y: 66, s: 0.85, rect: { x: 505, y: 40, w: 80, h: 56 }, on: () => state.staff.stocker },
  { id: 'toolwall', name: 'Tool Wall', x: 500, y: 188, s: 0.8, rect: { x: 457, y: 166, w: 86, h: 42 }, on: () => state.sec.svc.unlocked },
  { id: 'repairsign', name: '"PC Repair" Neon', x: 262, y: 152, s: 0.8, on: () => state.staff.tech },
  { id: 'arcade', name: 'Arcade Cabinet', x: 955, y: 432, s: 0.9, rect: { x: 935, y: 410, w: 40, h: 54 }, on: () => state.expanded },
  { id: 'chiprug', name: 'CPU Chip Rug', x: 900, y: 830, s: 0.9, on: () => state.sec.cpu.unlocked },
  { id: 'simrig', name: 'Racing Sim Rig', x: 780, y: 880, s: 0.9, rect: { x: 735, y: 862, w: 90, h: 34 }, on: () => state.sec.chair.unlocked },
  { id: 'balloons', name: 'Balloon Arch', x: 105, y: 972, s: 1.15, on: () => storeLv('ads') >= 1 },
  { id: 'spotlights', name: 'Spotlights', on: () => storeLv('displays') >= 1 },
  { id: 'trophy', name: 'Trophy Case', x: 900, y: 966, s: 0.85, rect: { x: 861, y: 944, w: 78, h: 44 }, on: () => allSecLv(10) },
];
// pathfinding plans around every decoration's spot; you only bump into the ones that are out
const DECOR_RECTS = DECOR_ITEMS.filter(d => d.rect).map(d => d.rect);
function decorOn(d) { try { return !!d.on(); } catch (e) { return false; } }
function decorRectsOn() { return DECOR_ITEMS.filter(d => d.rect && decorOn(d)).map(d => d.rect); }
// New decorations pop in with a little celebration (they belong to this store and reset with a Franchise)
function checkDecor(silent = false) {
  if (!state.decorSeen) { state.decorSeen = DECOR_ITEMS.filter(decorOn).map(d => d.id); return; }
  for (const d of DECOR_ITEMS) {
    if (state.decorSeen.includes(d.id) || !decorOn(d)) continue;
    state.decorSeen.push(d.id);
    if (d.rect) pushOut(state.player, d.rect);
    if (silent) continue;
    const r = d.rect || { x: (d.x || 300) - 30, y: (d.y || 500) - 20, w: 60, h: 40 };
    fx.push({ type: 'ring', r, t: 0, life: 0.8 });
    const cols = ['#ffc83d', '#2ecc71', '#ff5a5f', '#7fd4ff', '#c3a6ff', '#ff8fb1'];
    for (let i = 0; i < 24; i++) fx.push({ type: 'confetti', x: r.x + r.w / 2, y: r.y, vx: (Math.random() - 0.5) * 240, vy: -120 - Math.random() * 180, spin: (Math.random() - 0.5) * 16, c: cols[i % 6], t: 0, life: 1.4 });
    toast(`🎨 New decoration: ${d.name}!`);
  }
}
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
  FURNITURE = [...COUNTERS, ...DECOR_RECTS, ...stockWallRects(), SEC.svc.bench, ...PARTS.map(s => s.shelf), ...(state.expanded ? DIVIDER_OPEN : DIVIDER_CLOSED)];
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
const PANTS = ['#2b2350', '#3d5a80', '#5c4033', '#4a4e69', '#264653', '#6d597a'];
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
    pants: PANTS[Math.floor(Math.random() * PANTS.length)], style: Math.floor(Math.random() * 4),
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
      const lucky = Math.random() < 0.03 * perkLv('luckyCustomers');
      const total = Math.round(front.cart.reduce((sum, id) => sum + price(id), 0) * eventPriceMult() * (lucky ? 2 : 1));
      if (lucky) fx.push({ type: 'text', text: '🍀 LUCKY x2', x: REG[l].x, y: REG[l].y - 70, t: 0, life: 1.3, big: true });
      // Cash goes on the counter; if you're the one at the register it goes straight in your pocket
      if (dist(state.player, REG[l]) < REG_RADIUS) earn(total, REG[l].x, REG[l].y - 40);
      else { state.piles[l] += total; rateBucket += total; }
      track('serve', null, 1);
      for (const id of front.cart) track('sell', id, 1);
      sfx.cash();
      state.served++; state.storeServed++;
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
  return Math.round((price('svc') * JOBS[job.type].pay + job.parts.reduce((a, id) => a + price(id), 0)) * eventBuildPay() * (1 + 0.15 * storeLv('tools')));
}
function currentJobCustomer() { return customers.find(x => x.state === 'svc' && !x.path.length); }
let handTimer = 0, techPullTimer = 0, partPullTimer = 0;
// A part is in stock if its shelf or its stockroom crate has one
function partInStock(id) { return state.sec[id].stock > 0 || state.crates[id] > 0; }
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
  // Standing in the work circle, you pull the parts it needs from stock: the shelf first, then the stockroom
  const playerHere = dist(p, SEC.svc.workPad) < 34;
  if (missing.length && playerHere) {
    partPullTimer += dt;
    if (partPullTimer > 0.3) {
      partPullTimer = 0;
      const id = missing.find(partInStock);
      if (id) {
        if (state.sec[id].stock > 0) state.sec[id].stock--; else state.crates[id]--;
        job.got.push(id); missing = missingParts(job); sfx.drop();
      }
    }
  } else partPullTimer = 0;
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
  const t = JOBS[job.type].time;
  const rate = Math.max(playerHere ? 1 / t : 0, state.staff.tech ? 1 / (t * techFactor()) : 0);
  if (!rate) return;
  buildProgress += rate * dt;
  if (Math.random() < dt * 6) fx.push({ type: 'spark', x: SEC.svc.bench.x + 30 + Math.random() * 120, y: SEC.svc.bench.y + 10, t: 0 });
  if (buildProgress >= 1) {
    buildProgress = 0;
    state.built++; state.storeBuilt++;
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
// Opening a new store is the end goal for each store: every section open, plus a fee that grows x4 each time
const FRANCHISE_BASE = 1500000, FRANCHISE_GROWTH = 4;
function franchiseCost() { return FRANCHISE_BASE * Math.pow(FRANCHISE_GROWTH, state.franchises); }
function allSectionsOpen() { return SECTIONS.every(s => state.sec[s.id].unlocked); }
function canFranchise() { return claimableStars() > 0 && allSectionsOpen() && state.money >= franchiseCost(); }
function franchiseBlock() {
  if (!allSectionsOpen()) return `Unlock all ${SECTIONS.length} sections first (${countUnlocked(SECTIONS.map(s => s.id))}/${SECTIONS.length} open)`;
  if (claimableStars() <= 0) return `Earn your next Star first (at ${money$(nextStarAt())} lifetime earnings)`;
  if (state.money < franchiseCost()) return `You need ${money$(franchiseCost())} (you have ${money$(Math.floor(state.money))})`;
  return '';
}
function nextStarAt() { const n = starsEarned() + 1; return Math.ceil(Math.pow(n / 5, 2) * 50000); }
// ---------- Star Shop: permanent perks bought with Stars ----------
const HEAD_START = [0, 500, 5000, 50000];
const NIGHT_SHIFT = [{ rate: 0.5, hours: 2 }, { rate: 0.65, hours: 3 }, { rate: 0.8, hours: 4 }, { rate: 1, hours: 6 }];
const STAR_PERKS = [
  { id: 'headStart', icon: '💵', name: 'Head Start', costs: [2, 5, 10], desc: l => `New stores start with ${money$(HEAD_START[l])}` },
  { id: 'veteranStaff', icon: '👥', name: 'Veteran Staff', costs: [4, 8], desc: l => ['New stores start with no staff', 'New stores start with a cashier hired', 'New stores start with a cashier and a stocker'][l] },
  { id: 'biggerCrates', icon: '📦', name: 'Bigger Crates', costs: [2, 3, 5, 8], desc: l => `Crates hold +${25 * l}%` },
  { id: 'expressDelivery', icon: '🚚', name: 'Express Delivery', costs: [2, 4, 6], desc: l => `Trucks arrive ${10 * l}% sooner` },
  { id: 'quickHands', icon: '👟', name: 'Quick Hands', costs: [1, 2, 3, 5, 8], desc: l => `You walk +${8 * l}% faster and handle boxes +${15 * l}% faster` },
  { id: 'rushHour', icon: '🎉', name: 'Rush Hour', costs: [3, 5, 8], desc: l => `Rush events +${25 * l}% more often, +${20 * l}% longer` },
  { id: 'luckyCustomers', icon: '🍀', name: 'Lucky Customers', costs: [2, 3, 5, 8, 12], desc: l => `${3 * l}% of sales pay double` },
  { id: 'nightShift', icon: '🌙', name: 'Night Shift', costs: [2, 4, 7], desc: l => `Offline: ${Math.round(NIGHT_SHIFT[l].rate * 100)}% earnings for up to ${NIGHT_SHIFT[l].hours}h` },
];
const STAR_PERK = Object.fromEntries(STAR_PERKS.map(p => [p.id, p]));
function perkLv(id) { return (state.starPerks && state.starPerks[id]) || 0; }
function perkCost(id) { return STAR_PERK[id].costs[perkLv(id)]; }
function anyPerkAffordable() { return STAR_PERKS.some(p => perkLv(p.id) < p.costs.length && state.stars >= perkCost(p.id)); }
function showStarShop() {
  let html = `<div class="sheet-head"><h2>⭐ Star Shop</h2><button class="icon-btn small" data-act="close" aria-label="Close">✕</button></div>
    <div class="star-balance"><b>${state.stars} ⭐</b> to spend<span>Perks are permanent and stay through every Franchise. Each Star you keep adds +${STAR_BONUS * 100}% to your prices (now x${starMult().toFixed(2)}).</span></div>`;
  for (const p of STAR_PERKS) {
    const lv = perkLv(p.id), max = p.costs.length, done = lv >= max;
    html += `<div class="item"><div class="avatar" style="--c:#fff1b8">${p.icon}</div>
      <div class="info"><div class="title">${p.name} <small>Lv ${lv}/${max}</small></div>
      <div class="desc">${lv ? 'Now: ' + p.desc(lv) : 'Not bought yet'}${done ? '' : `<br><b>Next: ${p.desc(lv + 1)}</b>`}</div></div>
      ${done ? '<button class="btn owned" disabled>MAX</button>' : `<button class="btn ${state.stars >= perkCost(p.id) ? 'green' : 'disabled'}" data-act="starPerk" data-id="${p.id}">Buy<small>${perkCost(p.id)} ⭐</small></button>`}</div>`;
  }
  showModal(html, true);
}
function buyPerk(id) {
  const p = STAR_PERK[id];
  if (!p || perkLv(id) >= p.costs.length || state.stars < perkCost(id)) return;
  state.stars -= perkCost(id);
  state.starPerks[id] = perkLv(id) + 1;
  if (id === 'expressDelivery') truckTimer = Math.min(truckTimer, truckInterval());
  sfx.unlock(); confetti();
  toast(`${p.icon} ${p.name} Lv ${perkLv(id)}!`);
  save(); showStarShop();
}
function franchiseHtml() {
  const gain = claimableStars();
  const next = THEMES[(state.franchises + 1) % THEMES.length];
  return `<div class="group">Franchise <span>Start over in a bigger location</span></div>
    <div class="item franchise"><div class="avatar" style="--c:#fff1b8">⭐</div>
      <div class="info"><div class="title">${state.stars} Stars <small>profit x${starMult().toFixed(2)}</small></div>
      <div class="desc">Now: ${theme().name}. Pay <b>${money$(franchiseCost())}</b> and open a ${next.name} for <b>+${gain} ⭐</b>. Needs all ${SECTIONS.length} sections open. Next Star at ${money$(nextStarAt())} lifetime earnings. Resets cash, sections, staff and upgrades.${canFranchise() ? '' : `<br><b>${franchiseBlock()}</b>`}</div></div>
      <button class="btn ${canFranchise() ? 'green' : 'disabled'}" data-act="franchise">Franchise<small>${money$(franchiseCost())}</small></button></div>`;
}
function doFranchise() {
  const gain = claimableStars();
  if (!canFranchise()) return;
  const keep = {
    storeName: state.storeName, sound: state.sound, haptics: state.haptics, lifetime: state.lifetime, served: state.served, built: state.built,
    restocked: state.restocked, sold: state.sold, stars: state.stars + gain, starsClaimed: state.starsClaimed + gain,
    franchises: state.franchises + 1, achDone: state.achDone, achClaimed: state.achClaimed, daily: state.daily,
    starPerks: state.starPerks,
    admin: { ...state.admin, savedMoney: 0 },
  };
  state = freshState(keep);
  state.money = HEAD_START[perkLv('headStart')];
  if (perkLv('veteranStaff') >= 1) { state.staff.cashier = true; state.staffPaid.cashier = STAFF.cashier.cost; }
  if (perkLv('veteranStaff') >= 2) { state.staff.stocker = true; state.staffPaid.stocker = STAFF.stocker.cost; }
  customers = []; queues = [[], []]; fx = []; buildProgress = 0;
  for (const k in npcs) delete npcs[k];
  truck.phase = 'away'; truckTimer = 30; rushEvent = null;
  rebuildGrid();
  save(true); closeModal(); confetti(); sfx.unlock();
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
  { id: 'shelf25', icon: '🏷️', name: 'Shelf Master', desc: 'Get a section to Lv 25', goal: 25, value: () => Math.max(...SECTIONS.map(s => state.sec[s.id].level)) },
  { id: 'earn100m', icon: '🏦', name: 'Mogul', desc: 'Earn $100M in total', goal: 1e8, value: () => state.lifetime },
  { id: 'franchise3', icon: '🌟', name: 'Store Chain', desc: 'Open 3 new stores', goal: 3, value: () => state.franchises },
];
// Store goals: cash rewards for finishing up a store; they reset with each Franchise and pay more in later stores
const allSecLv = n => SECTIONS.every(s => state.sec[s.id].unlocked && state.sec[s.id].level >= n);
const GOALS = [
  { id: 'lv10', icon: '📈', name: 'Every section open and at Lv 10', reward: 20000, goal: 8, value: () => SECTIONS.filter(s => state.sec[s.id].unlocked && state.sec[s.id].level >= 10).length },
  { id: 'serve1000', icon: '🛒', name: 'Check out 1,000 shoppers in this store', reward: 40000, goal: 1000, value: () => state.storeServed },
  { id: 'stockMax', icon: '🚚', name: 'Max out both Stockroom upgrades', reward: 50000, goal: 2 * MAX_STOCKROOM_LV, value: () => state.deliveryLv + state.truckLv },
  { id: 'build100', icon: '🛠️', name: 'Finish 100 Service jobs in this store', reward: 60000, goal: 100, value: () => state.storeBuilt },
  { id: 'staffMax', icon: '👥', name: 'Max out every staff upgrade', reward: 100000, goal: STAFF_UPGRADES.reduce((a, u) => a + u.max, 0), value: () => STAFF_UPGRADES.reduce((a, u) => a + staffLv(u.id), 0) },
  { id: 'lv20', icon: '🚀', name: 'Every section at Lv 20', reward: 150000, goal: 8, value: () => SECTIONS.filter(s => state.sec[s.id].unlocked && state.sec[s.id].level >= 20).length },
  { id: 'storeMax', icon: '🏆', name: 'Max out every Store upgrade', reward: 250000, goal: STORE_UPGRADES.reduce((a, u) => a + u.max, 0), value: () => STORE_UPGRADES.reduce((a, u) => a + storeLv(u.id), 0) },
];
const GOAL = Object.fromEntries(GOALS.map(x => [x.id, x]));
function goalReward(gl) { return gl.reward * (1 + state.franchises); }
function updateMissions() {
  if (!state.daily || state.daily.day !== todayKey()) makeDaily();
  for (const a of ACHIEVEMENTS) if (!state.achDone.includes(a.id) && a.value() >= a.goal) {
    state.achDone.push(a.id);
    toast(`🏆 Achievement: ${a.name}! Claim your ⭐ in Missions`);
  }
  for (const gl of GOALS) if (!state.goalsDone.includes(gl.id) && gl.value() >= gl.goal) {
    state.goalsDone.push(gl.id);
    toast(`🎯 Store goal done: claim ${money$(goalReward(gl))} in Missions`);
  }
}
function anyClaimable() {
  if (state.daily && state.daily.list.some(m => !m.claimed && m.progress >= m.target)) return true;
  if (state.goalsDone.some(id => !state.goalsClaimed.includes(id))) return true;
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
  html += `<div class="group">Store goals <span>Cash rewards for this store</span></div>`;
  for (const gl of GOALS) {
    const done = state.goalsDone.includes(gl.id), claimed = state.goalsClaimed.includes(gl.id);
    const v = Math.min(gl.goal, gl.value()), r = goalReward(gl);
    html += `<div class="item ${claimed ? 'done' : ''}"><div class="avatar" style="--c:${done ? '#dff7e8' : '#ece8fb'}">${gl.icon}</div>
      <div class="info"><div class="title">${gl.name}</div>
      ${done ? '' : `<div class="meter"><i style="width:${Math.round(100 * v / gl.goal)}%"></i></div>`}
      <div class="desc">${done ? '' : `${v} / ${gl.goal} · `}reward ${money$(r)}</div></div>
      ${claimed ? '<button class="btn owned" disabled>Done ✓</button>' : `<button class="btn ${done ? 'green' : 'disabled'}" data-act="claimGoal" data-id="${gl.id}">Claim<small>${money$(r)}</small></button>`}</div>`;
  }
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
    if (eventLeft <= 0) { toast(`${rushEvent.icon} ${rushEvent.name.replace('!', '')} is over`); rushEvent = null; nextEventIn = (150 + Math.random() * 120) / (1 + 0.25 * perkLv('rushHour')); }
    return;
  }
  if (!state.sec.mon.unlocked) return;   // rushes start once the store has a few sections
  nextEventIn -= dt;
  if (nextEventIn <= 0) {
    const opts = EVENTS.filter(e => e.ok());
    rushEvent = opts[Math.floor(Math.random() * opts.length)];
    eventLeft = rushEvent.dur * (1 + 0.2 * perkLv('rushHour'));
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
  let returning = null;
  for (const s of unlockedParts()) {
    if (!inRect(p, crateRect(s))) continue;
    if (!boxUsable(s.id) && state.carry.includes(s.id)) returning = s;
    if (pickTimer <= 0.13 / (1 + 0.15 * perkLv('quickHands'))) continue;
    if (!boxUsable(s.id)) {
      // shelf is full and no job needs one: after a short wait, boxes of this type go back into the crate
      const i = state.carry.lastIndexOf(s.id);
      if (i >= 0 && returnWait >= RETURN_DELAY) {
        state.carry.splice(i, 1); pickTimer = 0;
        if (state.crates[s.id] < crateMax()) {
          state.crates[s.id]++; sfx.drop();
          fx.push({ type: 'box', x: p.x, y: p.y - 60, tx: s.crate.x, ty: s.crate.y, t: 0, life: 0.22, color: s.color, carried: true });
        } else {
          // crate is full: the box goes back to the supplier for a small restocking fee
          const fee = Math.min(state.money, restockFee(s.id));
          state.money -= fee;
          beep(330, 0.08, 'triangle', 0.035);
          fx.push({ type: 'box', x: p.x, y: p.y - 60, tx: DOCK_X, ty: 4, t: 0, life: 0.45, color: s.color, carried: true });
          if (fee > 0) fx.push({ type: 'text', text: '-' + money$(fee), x: p.x + 18, y: p.y - 70, t: 0, life: 1.1, bad: true });
        }
      }
    } else if (state.carry.length < carryCap() && state.crates[s.id] > 0) {
      state.carry.push(s.id); state.crates[s.id]--; pickTimer = 0; sfx.pick();
    }
  }
  if (returning && returning === returnCrate) returnWait += dt;
  else { returnWait = 0; returnCrate = returning; }
  // Shelves: drop matching boxes
  for (const s of unlockedParts()) {
    const st = state.sec[s.id];
    const i = state.carry.lastIndexOf(s.id);
    if (i >= 0 && st.stock < shelfCap(s.id) && inRect(p, s.shelf, 34) && dropTimer > 0.1 / (1 + 0.15 * perkLv('quickHands'))) {
      state.carry.splice(i, 1); st.stock++; dropTimer = 0; track('restock', s.id, 1);
      shelfPlaced(s, { x: p.x, y: p.y - 60 }, true);
    }
  }
  // Unlock pads: money flows in while you stand on them
  for (const s of SECTIONS) {
    const st = state.sec[s.id];
    if (st.unlocked || !canUnlockNext(s.id)) continue;
    if (inRect(p, padRect(s.pad)) && state.money >= 1) {
      const amt = Math.min(state.money, s.unlock - st.paid, (state.admin.unlimited ? Infinity : Math.max(1, Math.round(Math.max(25, s.unlock / 1.6) * dt))));
      state.money -= amt; st.paid += amt;
      if (Math.random() < dt * 20) fx.push({ type: 'coin', x: p.x, y: p.y - 30, tx: s.pad.x, ty: s.pad.y, t: 0 });
      if (st.paid >= s.unlock) unlockSection(s.id);
    }
  }
  // Expansion pad
  if (!state.expanded && state.sec.svc.unlocked && inRect(p, padRect(EXPANSION.pad, 110, 60)) && state.money >= 1) {
    const amt = Math.min(state.money, EXPANSION.cost - state.expandPaid, (state.admin.unlimited ? Infinity : Math.max(1, Math.round(EXPANSION.cost / 1.6 * dt))));
    state.money -= amt; state.expandPaid += amt;
    if (Math.random() < dt * 20) fx.push({ type: 'coin', x: p.x, y: p.y - 30, tx: EXPANSION.pad.x, ty: EXPANSION.pad.y, t: 0 });
    if (state.expandPaid >= EXPANSION.cost) expandStore();
  }
  // Hire pads: money flows in while you stand on them
  for (const k in HIRE_PADS) {
    if (state.staff[k] || !staffAvailable(k)) continue;
    const pad = HIRE_PADS[k], cost = STAFF[k].cost;
    if (inRect(p, padRect(pad)) && state.money >= 1) {
      const amt = Math.min(state.money, cost - state.staffPaid[k], (state.admin.unlimited ? Infinity : Math.max(1, Math.round(Math.max(25, cost / 1.6) * dt))));
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
}
// Stand on the crate this long before boxes start going back (so you don't return them by accident)
const RETURN_DELAY = 1;
// Returning a box when its crate is full costs 10% of its shelf price (at least $1)
function restockFee(id) { return Math.max(1, Math.round(price(id) * 0.1)); }
let returnWait = 0, returnCrate = null;
// Is there anywhere to put a box of this type right now: shelf space, or a Service Station job that needs it?
function boxUsable(id) {
  if (state.sec[id].stock < shelfCap(id)) return true;
  const c = currentJobCustomer();
  return !!(c && c.job && missingParts(c.job).includes(id));
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
function crateMax() { return Math.round((24 + 8 * state.deliveryLv) * (1 + 0.25 * perkLv('biggerCrates'))); }
function truckInterval() { return Math.round(Math.max(15, 40 - 5 * state.truckLv) * (1 - 0.1 * perkLv('expressDelivery'))); }
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
      if (n.carry.length && st.stock < shelfCap(n.target)) { n.carry.pop(); st.stock++; shelfPlaced(SEC[n.target], { x: n.x, y: n.y - 60 }, false); }
      else { n.carry = []; n.job = 'idle'; }
    }
  }
}

// ---------- Main update ----------
function update(dt, movePlayer = true) {
  if (movePlayer) updatePlayer(dt);
  ensureNpcs();
  updateStocker(dt);
  updateTruck(dt);
  updateDoors(dt);
  updateEvents(dt);

  spawnTimer -= dt;
  const maxShoppers = Math.min((rushEvent ? 16 : 10) + storeLv('ads'), 2 + unlockedParts().length * 2 + (rushEvent ? 6 : 0) + storeLv('ads'));
  if (spawnTimer <= 0) {
    if (customers.length < maxShoppers) spawnCustomer();
    spawnTimer = Math.max(1.4, 4.5 - 0.7 * (unlockedParts().length - 1)) * (0.7 + Math.random() * 0.6) / ((rushEvent && rushEvent.spawn) || 1) / (1 + 0.1 * storeLv('ads'));
  }
  for (const c of customers) updateCustomer(c, dt);
  customers = customers.filter(c => !c.remove);
  updateRegister(dt);
  updateService(dt);

  for (const f of fx) f.t += dt;
  for (const f of fx) if (f.type === 'fly' && f.last && !f.done && f.t >= f.life) { f.done = true; bumpMoney(); }
  fx = fx.filter(f => f.t < (f.life || (f.type === 'text' ? 1.2 : 0.6)));
  shake = Math.max(0, shake - dt * 3); flash = Math.max(0, flash - dt * 2.5);
}

// ---------- Rendering ----------
const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
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
// Products are drawn as pictures of the real thing. Each product's emoji in SECTIONS is the
// marker that gets swapped for its picture, on the canvas and in menus and pop-ups.
const GPU_ICON = '🎮';
function artCanvas(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = (x, y, ww, hh, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + ww, y, x + ww, y + hh, rad); g.arcTo(x + ww, y + hh, x, y + hh, rad); g.arcTo(x, y + hh, x, y, rad); g.arcTo(x, y, x + ww, y, rad); g.closePath(); };
  paint(g, r);
  return c;
}
const gpuArt = artCanvas(160, 80, (g, r) => {
  // metal bracket
  r(4, 8, 14, 62, 3); g.fillStyle = '#c8ccd6'; g.fill(); g.strokeStyle = '#7d8394'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#7d8394'; for (let i = 0; i < 3; i++) { r(8, 16 + i * 14, 6, 8, 2); g.fill(); }
  // circuit board and gold connector pins
  r(16, 54, 136, 12, 3); g.fillStyle = '#1f6f4a'; g.fill();
  g.fillStyle = '#f2c14e'; for (let i = 0; i < 10; i++) g.fillRect(44 + i * 8, 65, 5, 9);
  // cooler shroud with an orange accent
  r(16, 8, 138, 50, 10); g.fillStyle = '#2b2d3a'; g.fill(); g.strokeStyle = '#14151d'; g.lineWidth = 2.5; g.stroke();
  r(24, 12, 122, 5, 2.5); g.fillStyle = '#ff9f43'; g.fill();
  for (const fx of [56, 114]) {
    g.beginPath(); g.arc(fx, 35, 18, 0, Math.PI * 2); g.fillStyle = '#14151d'; g.fill();
    g.fillStyle = '#6a7083';
    for (let k = 0; k < 7; k++) { const a = k * Math.PI * 2 / 7; g.beginPath(); g.ellipse(fx + Math.cos(a) * 9, 35 + Math.sin(a) * 9, 8, 3.2, a + 0.6, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(fx, 35, 5, 0, Math.PI * 2); g.fillStyle = '#ff9f43'; g.fill();
    g.beginPath(); g.arc(fx, 35, 18, 0, Math.PI * 2); g.strokeStyle = '#454a5a'; g.lineWidth = 2; g.stroke();
  }
});
// Gaming mouse, seen from above, with an RGB stripe
const mouseArt = artCanvas(110, 160, (g) => {
  g.beginPath(); g.moveTo(55, 6); g.bezierCurveTo(98, 6, 104, 60, 100, 100); g.bezierCurveTo(96, 142, 78, 156, 55, 156); g.bezierCurveTo(32, 156, 14, 142, 10, 100); g.bezierCurveTo(6, 60, 12, 6, 55, 6); g.closePath();
  const body = g.createLinearGradient(0, 0, 110, 0); body.addColorStop(0, '#3a3d4d'); body.addColorStop(0.5, '#2b2d3a'); body.addColorStop(1, '#1d1f29');
  g.fillStyle = body; g.fill(); g.strokeStyle = '#14151d'; g.lineWidth = 3; g.stroke();
  g.strokeStyle = '#14151d'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(55, 8); g.lineTo(55, 66); g.moveTo(14, 66); g.quadraticCurveTo(55, 76, 96, 66); g.stroke();   // buttons
  g.fillStyle = '#5a6075'; g.beginPath(); g.ellipse(55, 34, 6, 13, 0, 0, Math.PI * 2); g.fill();                                                                         // scroll wheel
  const rgb = g.createLinearGradient(20, 0, 90, 0); rgb.addColorStop(0, '#ff4fa3'); rgb.addColorStop(0.5, '#7fd4ff'); rgb.addColorStop(1, '#7ef0a8');
  g.strokeStyle = rgb; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(28, 128); g.quadraticCurveTo(55, 142, 82, 128); g.stroke();                          // RGB stripe
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(36, 50, 9, 26, -0.15, 0, Math.PI * 2); g.fill();                                                        // shine
});
// PC tower with a glass side panel and RGB fans
const caseArt = artCanvas(120, 160, (g, r) => {
  r(6, 4, 108, 146, 8); g.fillStyle = '#23252f'; g.fill(); g.strokeStyle = '#0f1016'; g.lineWidth = 3; g.stroke();
  r(16, 14, 88, 126, 5); g.fillStyle = '#141620'; g.fill();
  const glass = g.createLinearGradient(16, 14, 104, 140); glass.addColorStop(0, 'rgba(140,190,255,.30)'); glass.addColorStop(1, 'rgba(90,60,200,.25)');
  r(16, 14, 88, 126, 5); g.fillStyle = glass; g.fill();
  const fan = (x, y, c) => { g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.strokeStyle = c; g.lineWidth = 4; g.stroke(); g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fillStyle = '#2f3240'; g.fill(); g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fillStyle = c; g.fill(); };
  fan(38, 38, '#ff4fa3'); fan(38, 78, '#7fd4ff'); fan(80, 112, '#c3a6ff');
  r(58, 60, 40, 10, 2); g.fillStyle = '#3a3d4d'; g.fill(); r(58, 60, 40, 3, 1.5); g.fillStyle = '#ff9f43'; g.fill();     // graphics card inside
  r(62, 22, 30, 26, 3); g.fillStyle = '#3a3d4d'; g.fill();                                                                 // CPU cooler
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(26, 132); g.lineTo(94, 24); g.stroke();   // glass glare
  g.fillStyle = '#0f1016'; r(14, 150, 22, 8, 3); g.fill(); r(84, 150, 22, 8, 3); g.fill();                                  // feet
});
// Slim gaming monitor on a stand
const monitorArt = artCanvas(200, 150, (g, r) => {
  r(84, 100, 32, 30, 3); g.fillStyle = '#2b2d3a'; g.fill();                                          // neck
  r(54, 126, 92, 14, 7); g.fillStyle = '#23252f'; g.fill(); g.strokeStyle = '#0f1016'; g.lineWidth = 2; g.stroke();   // base
  r(6, 6, 188, 106, 8); g.fillStyle = '#1d1f29'; g.fill(); g.strokeStyle = '#0f1016'; g.lineWidth = 3; g.stroke();    // bezel
  const scr = g.createLinearGradient(12, 12, 188, 104); scr.addColorStop(0, '#3a86ff'); scr.addColorStop(0.55, '#8338ec'); scr.addColorStop(1, '#ff4fa3');
  r(13, 12, 174, 92, 4); g.fillStyle = scr; g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)'; r(26, 72, 50, 6, 3); g.fill(); r(26, 84, 32, 6, 3); g.fill();                  // a bit of on-screen UI
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 6; g.beginPath(); g.moveTo(120, 14); g.lineTo(80, 102); g.stroke();   // glare
  g.fillStyle = '#7ef0a8'; g.beginPath(); g.arc(178, 108, 2.5, 0, Math.PI * 2); g.fill();                                // power light
});
// CPU: silver heat spreader on a green board with gold contacts
const cpuArt = artCanvas(150, 150, (g, r) => {
  r(8, 8, 134, 134, 8); g.fillStyle = '#1f6f4a'; g.fill(); g.strokeStyle = '#124a30'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#f2c14e';
  for (let i = 0; i < 12; i++) { const p = 20 + i * 10; g.fillRect(p, 12, 4, 6); g.fillRect(p, 132, 4, 6); g.fillRect(12, p, 6, 4); g.fillRect(132, p, 6, 4); }
  const ihs = g.createLinearGradient(30, 30, 120, 120); ihs.addColorStop(0, '#f3f5f9'); ihs.addColorStop(0.5, '#c9ced8'); ihs.addColorStop(1, '#9aa1b0');
  r(30, 30, 90, 90, 6); g.fillStyle = ihs; g.fill(); g.strokeStyle = '#7d8394'; g.lineWidth = 2.5; g.stroke();
  g.fillStyle = 'rgba(80,88,104,.55)'; r(44, 58, 62, 6, 3); g.fill(); r(44, 72, 46, 6, 3); g.fill(); r(44, 86, 54, 5, 2.5); g.fill();   // etched markings
  g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(14, 14); g.lineTo(30, 14); g.lineTo(14, 30); g.closePath(); g.fill();                  // corner marker
});
// 2.5-inch SSD with a coloured label
const ssdArt = artCanvas(200, 130, (g, r) => {
  r(6, 6, 188, 118, 10); g.fillStyle = '#2b2d3a'; g.fill(); g.strokeStyle = '#0f1016'; g.lineWidth = 3; g.stroke();
  const lab = g.createLinearGradient(20, 20, 180, 110); lab.addColorStop(0, '#e05fb0'); lab.addColorStop(1, '#8338ec');
  r(20, 20, 160, 90, 6); g.fillStyle = lab; g.fill();
  g.font = '700 38px Fredoka, ui-rounded, system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('SSD', 34, 54);
  g.fillStyle = 'rgba(255,255,255,.8)'; r(34, 80, 70, 7, 3.5); g.fill(); r(34, 92, 44, 6, 3); g.fill();
  g.fillStyle = '#c8ccd6'; r(150, 42, 22, 46, 3); g.fill();                                            // connector
  g.fillStyle = '#7d8394'; for (let i = 0; i < 5; i++) g.fillRect(155, 47 + i * 8, 12, 3);
  g.fillStyle = '#c8ccd6'; for (const [x, y] of [[14, 14], [186, 14], [14, 116], [186, 116]]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }   // screws
});
// Gaming chair: tall bucket seat with side bolsters, headrest pillow and a 5-star base
const chairArt = artCanvas(130, 175, (g, r) => {
  const dark = '#1d1f29', accent = '#e5484d';
  // base and wheels
  g.strokeStyle = '#3a3d4d'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath();
  for (const [x, y] of [[20, 160], [42, 168], [88, 168], [110, 160]]) { g.moveTo(65, 150); g.lineTo(x, y); }
  g.stroke();
  g.fillStyle = '#14151d'; for (const [x, y] of [[20, 162], [42, 170], [88, 170], [110, 162]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  r(60, 120, 10, 32, 3); g.fillStyle = '#7d8394'; g.fill();                                            // gas lift
  // armrests
  r(8, 92, 18, 10, 4); g.fillStyle = '#2b2d3a'; g.fill(); r(14, 100, 6, 22, 2); g.fill();
  r(104, 92, 18, 10, 4); g.fill(); r(110, 100, 6, 22, 2); g.fill();
  // backrest with bolsters
  g.beginPath(); g.moveTo(30, 18); g.quadraticCurveTo(65, 2, 100, 18); g.lineTo(104, 96); g.lineTo(26, 96); g.closePath();
  g.fillStyle = dark; g.fill(); g.strokeStyle = '#0f1016'; g.lineWidth = 3; g.stroke();
  g.fillStyle = accent; g.beginPath(); g.moveTo(30, 18); g.lineTo(42, 14); g.lineTo(40, 96); g.lineTo(26, 96); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(100, 18); g.lineTo(88, 14); g.lineTo(90, 96); g.lineTo(104, 96); g.closePath(); g.fill();
  r(46, 22, 38, 14, 6); g.fillStyle = accent; g.fill();                                                  // headrest pillow
  r(52, 46, 26, 34, 5); g.fillStyle = '#2b2d3a'; g.fill();                                               // lumbar stitching panel
  // seat
  r(22, 94, 86, 28, 10); g.fillStyle = '#2b2d3a'; g.fill(); g.strokeStyle = '#0f1016'; g.lineWidth = 3; g.stroke();
  r(30, 98, 70, 8, 4); g.fillStyle = accent; g.fill();
});
// marker → { art, width as a multiple of the drawn size }
const PRODUCT_ART = {
  '🎮': { art: gpuArt, wm: 1.55, name: 'graphics card' },
  '🖱️': { art: mouseArt, wm: 0.8, name: 'gaming mouse' },
  '🗄️': { art: caseArt, wm: 0.95, name: 'PC case' },
  '🖥️': { art: monitorArt, wm: 1.35, name: 'monitor' },
  '🧠': { art: cpuArt, wm: 1.05, name: 'CPU' },
  '💾': { art: ssdArt, wm: 1.35, name: 'SSD' },
  '🪑': { art: chairArt, wm: 0.95, name: 'gaming chair' },
};
const ART_PAD = 14;
for (const k in PRODUCT_ART) {
  const a = PRODUCT_ART[k];
  // the same picture with a soft drop shadow baked in (used on shelves)
  a.shadow = (() => {
    const c = document.createElement('canvas');
    c.width = a.art.width + ART_PAD * 2; c.height = a.art.height + ART_PAD * 2;
    const g = c.getContext('2d');
    g.shadowColor = 'rgba(20,10,50,.6)'; g.shadowBlur = 7; g.shadowOffsetX = 6; g.shadowOffsetY = 11;
    g.drawImage(a.art, ART_PAD, ART_PAD);
    return c;
  })();
  a.img = `<img class="prod-icon" src="${a.art.toDataURL()}" alt="${a.name}">`;
}
function withProductArt(html) {
  for (const k in PRODUCT_ART) html = html.split(k).join(PRODUCT_ART[k].img);
  return html;
}
function escapeHtml(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// shadow = true adds a soft drop shadow (used for products on shelves)
function drawEmoji(ch, x, y, size, shadow = false) {
  const pa = PRODUCT_ART[ch];
  if (pa) {
    const w = size * pa.wm, h = w * pa.art.height / pa.art.width;
    if (!shadow) { ctx.drawImage(pa.art, x - w / 2, y - h / 2, w, h); return; }
    const k = w / pa.art.width;
    ctx.drawImage(pa.shadow, x - w / 2 - ART_PAD * k, y - h / 2 - ART_PAD * k, pa.shadow.width * k, pa.shadow.height * k);
    return;
  }
  const px = Math.max(4, Math.round(size * zoom * DPR));
  const key = ch + px + (shadow ? 's' : '');
  const box = shadow ? 1.7 : 1.4;
  let c = emojiCache[key];
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(px * box);
    const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    if (shadow) { g.shadowColor = 'rgba(20,10,50,.6)'; g.shadowBlur = px * 0.12; g.shadowOffsetX = px * 0.1; g.shadowOffsetY = px * 0.17; }
    g.fillText(ch, c.width / 2, c.height / 2 + px * 0.06);
    emojiCache[key] = c;
  }
  ctx.drawImage(c, x - size * box / 2, y - size * box / 2, size * box, size * box);
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
  // The view always reaches up to the road, which shows through the see-through top bar
  const top = ROAD_Y - 52, bottom = H + 170;   // room below the store so you stay clear of the money bar and hint
  const ty = vh >= bottom - top ? (top + bottom) / 2 : Math.max(top + vh / 2, Math.min(bottom - vh / 2, state.player.y));
  cam.x += (tx - cam.x) * 0.15; cam.y += (ty - cam.y) * 0.15;
  const shx = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0, shy = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;
  ctx.setTransform(zoom * DPR, 0, 0, zoom * DPR, (cssW / 2 - cam.x * zoom + shx) * DPR, (cssH / 2 - cam.y * zoom + shy) * DPR);

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
  drawDecor();

  // Characters, sorted by depth
  const people = [...customers.map(c => ({ o: c, kind: 'cust' })), { o: state.player, kind: 'player' }];
  for (const k in npcs) people.push({ o: npcs[k], kind: 'staff' });
  people.sort((a, b) => a.o.y - b.o.y);
  for (const p of people) drawPerson(p.o, p.kind);
  for (const c of customers) drawBubble(c);

  drawFx();
  drawReturnTimer();
  drawObjective();
  drawVignette();
  if (flash > 0) { ctx.fillStyle = `rgba(255,214,90,${flash * 0.3})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

// A soft drop shadow under furniture (light comes from the top left)
function softShadow(r, radius = 10) {
  for (let i = 0; i < 4; i++) {
    rr(r.x + 3 - i * 2, r.y + 7 - i, r.w + i * 4, r.h + i * 2 + 2, radius + i * 2);
    ctx.fillStyle = 'rgba(20,10,50,.055)'; ctx.fill();
  }
}
const LIGHTS = [{ x: 150, y: 330 }, { x: 450, y: 330 }, { x: 300, y: 560 }, { x: 150, y: 800 }, { x: 450, y: 800 }, { x: 760, y: 330 }, { x: 760, y: 640 }, { x: 900, y: 860 }];
// The floor, wall trim, light pools and furniture shadows only change when the store does,
// so they're drawn once into an image and reused every frame.
let floorCache = null, floorKey = '';
function buildFloor() {
  const sc = Math.min(2, Math.max(0.5, zoom * DPR));
  const c = document.createElement('canvas');
  c.width = Math.ceil(W_FULL * sc); c.height = Math.ceil(H * sc);
  const main = ctx;
  ctx = c.getContext('2d');
  ctx.scale(sc, sc);
  const T = theme();
  // walls with a light top edge
  rr(0, 0, W_FULL, H, 18); ctx.fillStyle = T.wall; ctx.fill();
  rr(4, 4, W_FULL - 8, H - 8, 15); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 3; ctx.stroke();
  // brick texture on the outer walls
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = 20, row = 0; y < H - 8; y += 8, row++) {
    ctx.moveTo(2, y); ctx.lineTo(15, y); ctx.moveTo(W_FULL - 15, y); ctx.lineTo(W_FULL - 2, y);
    const bx = row % 2 ? 6 : 11; ctx.moveTo(bx, y); ctx.lineTo(bx, y + 8); ctx.moveTo(W_FULL - bx, y); ctx.lineTo(W_FULL - bx, y + 8);
  }
  ctx.stroke();
  ctx.save();
  rr(16, 16, W_FULL - 32, H - 32, 10); ctx.clip();
  // tiles, grout and a little speckle
  for (let y = 16; y < H; y += 40) for (let x = 16; x < W_FULL; x += 40) {
    ctx.fillStyle = ((x + y) / 40) % 2 === 0 ? T.a : T.b;
    ctx.fillRect(x, y, 40, 40);
    let h = (x * 73856093) ^ (y * 19349663);
    ctx.fillStyle = 'rgba(43,35,80,.05)';
    for (let k = 0; k < 3; k++) { h = (h * 1103515245 + 12345) & 0x7fffffff; ctx.fillRect(x + (h % 36) + 2, y + ((h >> 8) % 36) + 2, 2, 2); }
  }
  ctx.strokeStyle = 'rgba(43,35,80,.07)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 16; x <= W_FULL; x += 40) { ctx.moveTo(x, 16); ctx.lineTo(x, H); }
  for (let y = 16; y <= H; y += 40) { ctx.moveTo(16, y); ctx.lineTo(W_FULL, y); }
  ctx.stroke();
  // warm pools of light under the ceiling lights
  for (const l of LIGHTS) {
    const g = ctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, 190);
    g.addColorStop(0, 'rgba(255,248,225,.45)'); g.addColorStop(1, 'rgba(255,248,225,0)');
    ctx.fillStyle = g; ctx.fillRect(l.x - 190, l.y - 190, 380, 380);
  }
  // shading where the floor meets the walls
  const edge = (x0, y0, x1, y1, w, h) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(43,35,80,.16)'); g.addColorStop(1, 'rgba(43,35,80,0)');
    ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
  };
  edge(0, 16, 0, 48, W_FULL, 32);
  edge(0, H - 16, 0, H - 48, W_FULL, 32);
  edge(16, 0, 48, 0, 32, H);
  edge(W_FULL - 16, 0, W_FULL - 48, 0, 32, H);
  // wooden plank floor in the checkout area
  drawPlanks(236, 736, 350, 268);
  // store-logo rug in the open floor
  rr(208, 581, 184, 68, 34); ctx.fillStyle = '#4a2f9e'; ctx.fill();
  rr(214, 587, 172, 56, 28); ctx.strokeStyle = '#ffc83d'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
  text(state.storeName.toUpperCase().slice(0, 14), 310, 616, 15, '#fff');
  // shadows under the furniture that's in the store
  for (const r of COUNTERS) softShadow(r, 9);
  for (const s of PARTS) if (state.sec[s.id].unlocked) softShadow(s.shelf);
  if (state.sec.svc.unlocked) softShadow(SEC.svc.bench);
  ctx.restore();
  // crisp baseboard line
  rr(16, 16, W_FULL - 32, H - 32, 10); ctx.strokeStyle = 'rgba(20,10,50,.22)'; ctx.lineWidth = 2; ctx.stroke();
  // doors and the entrance mat
  ctx.fillStyle = '#8fd3ff';
  ctx.fillRect(ENTRANCE.x, H - 18, ENTRANCE.w, 18);
  ctx.fillRect(EXIT.x, H - 18, EXIT.w, 18);
  text('ENTRANCE', ENTRANCE.x + ENTRANCE.w / 2, H - 9, 11, '#1d4e74');
  text('EXIT', EXIT.x + EXIT.w / 2, H - 9, 11, '#1d4e74');
  // welcome mat
  rr(ENTRANCE.x + 12, H - 68, ENTRANCE.w - 24, 46, 9); ctx.fillStyle = '#3b2a7a'; ctx.fill();
  rr(ENTRANCE.x + 18, H - 62, ENTRANCE.w - 36, 34, 6); ctx.fillStyle = '#5b3fc0'; ctx.fill();
  text('WELCOME', ENTRANCE.x + ENTRANCE.w / 2, H - 45, 13, '#ffc83d');
  ctx = main;
  floorCache = c;
}
function drawFloor() {
  const key = [state.storeName, state.franchises % THEMES.length, state.expanded, ...SECTIONS.map(s => state.sec[s.id].unlocked ? 1 : 0), Math.round(zoom * DPR * 100)].join(',');
  if (key !== floorKey || !floorCache) { buildFloor(); floorKey = key; }
  ctx.drawImage(floorCache, 0, 0, W_FULL, H);
}
// A gentle darkening around the screen edges
let vignette = null, vignetteKey = '';
function drawVignette() {
  const key = canvas.width + 'x' + canvas.height;
  if (key !== vignetteKey) {
    const w = canvas.width, h = canvas.height;
    vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, 'rgba(20,8,60,0)'); vignette.addColorStop(1, 'rgba(20,8,60,.32)');
    vignetteKey = key;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, canvas.width, canvas.height);
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
  for (const r of (state.expanded ? DIVIDER_OPEN : DIVIDER_CLOSED)) {
    softShadow(r, 6);
    rr(r.x, r.y, r.w, r.h, 6); ctx.fillStyle = theme().wall; ctx.fill();
    rr(r.x + 3, r.y + 3, r.w - 6, Math.max(0, r.h - 6), 4); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (!state.expanded) {
    // what's behind the wall
    ctx.fillStyle = '#2a1f5c'; ctx.fillRect(612, 0, W_FULL - 612, H);
    text('🔒 EXPANSION', 800, 500, 22, '#8f80d6');
  }
  drawStockWall();
}
function drawStockWall() {
  const Y = STOCK_WALL_Y + 6;
  for (const r of stockWallRects()) {
    rr(r.x, Y + 10, r.w, 6, 3); ctx.fillStyle = 'rgba(20,10,50,.12)'; ctx.fill();
    const g = ctx.createLinearGradient(0, Y - 6, 0, Y + 10);
    g.addColorStop(0, 'rgba(240,245,255,.85)'); g.addColorStop(1, 'rgba(200,215,240,.75)');
    rr(r.x, Y - 6, r.w, 16, 3); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2b2350'; ctx.lineWidth = 2; ctx.stroke();
  }
  for (const d of stockDoors()) {
    // two glass panels meet in the middle when shut and slide into the wall when open
    const o = doorOpen[STOCK_DOORS.indexOf(d)], k = o * o * (3 - 2 * o), hw = d.w / 2;
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? d.x - k * (hw - 4) : d.x + hw + k * (hw - 4);
      rr(x0, Y - 4, hw, 12, 2); ctx.fillStyle = 'rgba(160,215,255,.6)'; ctx.fill();
      ctx.strokeStyle = '#2b2350'; ctx.lineWidth = 1.5; ctx.stroke();
      // handle bar near the meeting edge
      ctx.fillStyle = 'rgba(43,35,80,.55)'; ctx.fillRect(side < 0 ? x0 + hw - 6 : x0 + 4, Y - 1, 2, 6);
    }
    // caution stripe on the floor in the doorway
    ctx.save(); rr(d.x, Y + 14, d.w, 8, 2); ctx.clip();
    for (let x = d.x - 10; x < d.x + d.w + 10; x += 12) {
      ctx.fillStyle = ((x - d.x + 10) / 12 | 0) % 2 ? '#2b2350' : '#ffc83d';
      ctx.beginPath(); ctx.moveTo(x, Y + 22); ctx.lineTo(x + 6, Y + 14); ctx.lineTo(x + 12, Y + 14); ctx.lineTo(x + 6, Y + 22); ctx.fill();
    }
    ctx.restore();
  }
}
// The hint arrow leads through the nearest stockroom doorway when you're on the other side of the glass
function viaDoor(p, pt) {
  const top = STOCK_WALL_Y, bot = STOCK_WALL_Y + STOCK_WALL_H;
  const inside = q => q.y < top, outside = q => q.y > bot;
  if (!((inside(pt) && outside(p)) || (outside(pt) && inside(p)))) return pt;
  const doors = stockDoors();
  if (doors.some(d => p.x > d.x + 12 && p.x < d.x + d.w - 12)) return pt;
  const d = doors.reduce((a, b) => Math.abs(b.x + b.w / 2 - p.x) < Math.abs(a.x + a.w / 2 - p.x) ? b : a);
  return { x: d.x + d.w / 2, y: inside(p) ? top - 10 : bot + 14 };
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
  ctx.fillStyle = 'rgba(120,100,60,.12)';
  for (const [sx, sy, rad] of [[150, 40, 18], [330, 130, 24], [470, 50, 14], [260, 70, 10], [760, 120, 20], [900, 45, 14]]) { ctx.beginPath(); ctx.ellipse(sx, sy, rad, rad * 0.6, 0.4, 0, Math.PI * 2); ctx.fill(); }
  // the walkway in front of the crates: walk along it to reach a crate without stepping on the others
  const laneY = CRATE_Y + CRATE_H / 2 + 6, laneH = STOCK_WALL_Y - laneY;
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(16, laneY, W_FULL - 32, laneH);
  ctx.strokeStyle = 'rgba(255,200,61,.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([12, 9]);
  ctx.beginPath(); ctx.moveTo(22, laneY); ctx.lineTo(W_FULL - 22, laneY); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); rr(16, 150, W_FULL - 32, 10, 3); ctx.clip();
  for (let x = 0; x < W_FULL; x += 20) { ctx.fillStyle = (x / 20) % 2 ? '#2b2350' : '#ffc83d'; ctx.beginPath(); ctx.moveTo(x, 160); ctx.lineTo(x + 10, 150); ctx.lineTo(x + 20, 150); ctx.lineTo(x + 10, 160); ctx.fill(); }
  ctx.restore();
  text('STOCKROOM  ·  ' + truckStatus(), 300, 30, 12, '#7a6a35');
  for (const s of PARTS) {
    const r = crateRect(s);
    softShadow(r);
    const on = state.sec[s.id].unlocked;
    ctx.globalAlpha = on ? 1 : 0.3;
    rr(r.x, r.y + 6, r.w, r.h, 10); ctx.fillStyle = '#8a6a2f'; ctx.fill();
    rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = '#c99a4a'; ctx.fill();
    ctx.strokeStyle = '#a77c34'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(r.x + 6, r.y + r.h / 2); ctx.lineTo(r.x + r.w - 6, r.y + r.h / 2); ctx.stroke();
    // a small bar in the section's colour on the front of the crate
    rr(s.crate.x - 12, r.y + r.h + 0.5, 24, 4.5, 2); ctx.fillStyle = s.color; ctx.fill();
    const left = state.crates[s.id] || 0;
    if (on && left <= 0) ctx.globalAlpha = 0.45;
    drawEmoji(on ? s.icon : '🔒', s.crate.x, s.crate.y - 4, 24);
    ctx.globalAlpha = on ? 1 : 0.3;
    if (on && left <= 0) outlinedText('EMPTY', s.crate.x, s.crate.y + 16, 11, '#ff5a5f', '#fff');
    text(s.items[0].toUpperCase() + s.items.slice(1) + (on ? `  ${left}/${crateMax()}` : ''), s.crate.x, r.y + r.h + 14, 11, on && left <= 0 ? '#d63d42' : '#7a6a35');
    ctx.globalAlpha = 1;
  }
}

// A shelf in its section's colour, with a fine grain and speckle for texture
function shelfBody(r, color) {
  rr(r.x, r.y + 8, r.w, r.h, 10); ctx.fillStyle = shade(color, -0.35); ctx.fill();
  rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = shade(color, 0.12); ctx.fill();
  const ix = r.x + 5, iy = r.y + 5, iw = r.w - 10, ih = r.h - 10;
  rr(ix, iy, iw, ih, 7); ctx.fillStyle = shade(color, -0.14); ctx.fill();
  ctx.save();
  rr(ix, iy, iw, ih, 7); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let d = -ih; d < iw; d += 7) { ctx.moveTo(ix + d, iy + ih); ctx.lineTo(ix + d + ih, iy); }
  ctx.stroke();
  let h = (r.x * 73856093) ^ (r.y * 19349663);
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  for (let k = 0, n = Math.floor(iw * ih / 120); k < n; k++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    ctx.fillRect(ix + (h % iw), iy + ((h >> 8) % ih), 1.5, 1.5);
  }
  ctx.restore();
  rr(r.x + 8, r.y + 2, r.w - 16, 3, 1.5); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
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
  shelfBody(r, s.color);
  // items on the shelf
  const cap = shelfCap(s.id);
  const per = Math.min(10, cap);
  const len = vert ? r.h : r.w;
  const step = (len - 24) / (per - 1 || 1);
  for (let i = 0; i < st.stock; i++) {
    const col = i % per, row = Math.floor(i / per);
    const pop = popAt[s.id], sc = pop && pop.i === i ? popScale(time - pop.t) : 1;
    if (sc <= 0) continue;
    if (vert) drawEmoji(s.icon, r.x + r.w / 2 + row * 6, r.y + 12 + col * step, 17 * sc, true);
    else drawEmoji(s.icon, r.x + 12 + col * step, r.y + r.h / 2 - row * 8, 17 * sc, true);
  }
  // sign
  const label = `${s.name} · ${money$(price(s.id))}`;
  ctx.font = '700 11px Fredoka, ui-rounded, system-ui, sans-serif';
  const lw = ctx.measureText(label).width + 20;
  const lx = Math.max(20 + lw / 2, Math.min(W_FULL - 20 - lw / 2, r.x + r.w / 2));
  const ly = s.id === 'gpu' ? r.y + r.h + 22 : r.y - 14;
  const sp = signPopAt[s.id] !== undefined ? time - signPopAt[s.id] : 9;
  const ss = sp < 0.4 ? 1 + 0.25 * Math.sin(sp / 0.4 * Math.PI) : 1;
  ctx.save(); ctx.translate(lx, ly); ctx.scale(ss, ss); ctx.translate(-lx, -ly);
  rr(lx - lw / 2, ly - 10, lw, 20, 8); ctx.fillStyle = s.color; ctx.fill();
  text(label, lx, ly, 11, '#fff');
  ctx.restore();
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
  // soft pulsing gold glow so waiting cash is easy to spot
  const pulse = 0.5 + 0.5 * Math.sin(time * 4 + spot.x);
  const cy = spot.y + 6 - n * 2, rad = 30 + pulse * 6;
  const glow = ctx.createRadialGradient(spot.x, cy, 4, spot.x, cy, rad);
  glow.addColorStop(0, `rgba(255,214,90,${0.45 + 0.2 * pulse})`); glow.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(spot.x, cy, rad, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < n; i++) {
    rr(spot.x - 12 + (i % 2) * 3, spot.y - i * 4, 24, 12, 2); ctx.fillStyle = i % 2 ? '#2ecc71' : '#27ae60'; ctx.fill();
    ctx.strokeStyle = '#1e7a45'; ctx.lineWidth = 1; ctx.stroke();
  }
  // a light edge on the top bill and a little twinkle
  const top = spot.y - (n - 1) * 4;
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(spot.x - 9 + ((n - 1) % 2) * 3, top + 1.5); ctx.lineTo(spot.x + 9 + ((n - 1) % 2) * 3, top + 1.5); ctx.stroke();
  const tw = (Math.sin(time * 5 + spot.y) + 1) / 2, sx = spot.x + 14, sy = top - 3, sr = 2.5 + 2.5 * tw;
  ctx.globalAlpha = 0.35 + 0.65 * tw; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(sx, sy - sr); ctx.lineTo(sx + sr * 0.3, sy - sr * 0.3); ctx.lineTo(sx + sr, sy); ctx.lineTo(sx + sr * 0.3, sy + sr * 0.3);
  ctx.lineTo(sx, sy + sr); ctx.lineTo(sx - sr * 0.3, sy + sr * 0.3); ctx.lineTo(sx - sr, sy); ctx.lineTo(sx - sr * 0.3, sy - sr * 0.3); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
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
    if (!here && !state.staff.tech && missing.every(partInStock)) outlinedText(`${J.name} ready to work on!`, s.workPad.x - 30, s.workPad.y + 34, 12, '#ffc83d');
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

function drawPlanks(x0, y0, w, h) {
  ctx.save(); rr(x0, y0, w, h, 12); ctx.clip();
  for (let y = y0, row = 0; y < y0 + h; y += 18, row++) {
    ctx.fillStyle = row % 2 ? '#d6b48a' : '#ddbd94'; ctx.fillRect(x0, y, w, 18);
    ctx.fillStyle = 'rgba(110,70,30,.25)'; ctx.fillRect(x0, y + 17, w, 1.2);
    for (let x = x0 + (row % 3) * 37; x < x0 + w; x += 110) ctx.fillRect(x, y, 1.2, 18);
    ctx.strokeStyle = 'rgba(140,90,40,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y + 7); ctx.bezierCurveTo(x0 + w * .3, y + 4, x0 + w * .6, y + 11, x0 + w, y + 7); ctx.stroke();
  }
  ctx.restore();
  rr(x0, y0, w, h, 12); ctx.strokeStyle = 'rgba(110,70,30,.35)'; ctx.lineWidth = 2; ctx.stroke();
}
// ---------- Decorations ("gamer showroom" set) ----------
const decoHue = o => `hsl(${(time * 60 + o) % 360},95%,60%)`;
function dRR(x, y, w, h, r, c) { rr(x, y, w, h, r); ctx.fillStyle = c; ctx.fill(); }
function dShadow(x, y, w, h) { ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,10,50,.22)'; ctx.fill(); }
// a soft glow: a few see-through circles (cheaper than a blur or a gradient every frame)
function dGlow(x, y, r, c, a = 0.12) { ctx.fillStyle = c; for (let i = 0; i < 3; i++) { ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, r * (1 - i * 0.28), 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
// a glossy block: top face, darker front face and a shine
function dBlock(x, y, w, h, d, top, front) { dRR(x, y + d, w, h, 6, front); dRR(x, y, w, h, 6, top); ctx.globalAlpha = 0.35; dRR(x + 3, y + 2, w - 6, 3, 2, '#fff'); ctx.globalAlpha = 1; }
function dNeon(str, x, y, size, color) {
  ctx.font = `700 ${size}px Fredoka, ui-rounded, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.strokeStyle = color; ctx.globalAlpha = 0.25; ctx.lineWidth = size * 0.55; ctx.strokeText(str, x, y);
  ctx.globalAlpha = 1; ctx.lineWidth = size * 0.16; ctx.strokeText(str, x, y); ctx.fillStyle = '#fff'; ctx.fillText(str, x, y);
}
const DECOR_DRAW = {
  planter() {
    dShadow(0, 18, 18, 6); dBlock(-13, -4, 26, 18, 6, '#f4f1ff', '#c9c2e8');
    const sway = Math.sin(time * 1.5) * 0.04;
    for (const [a, l, c] of [[-0.35, 34, '#2f8f5b'], [0.3, 38, '#3ba86b'], [0, 44, '#2a7d50'], [-0.12, 30, '#47bf7c']]) {
      ctx.save(); ctx.translate(0, -2); ctx.rotate(a + sway); ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-6, -l / 2, 0, -l); ctx.quadraticCurveTo(6, -l / 2, 4, 0);
      ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = '#d8f2b0'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
  },
  showcase() {
    dShadow(0, 30, 34, 8); dGlow(0, -10, 50, decoHue(0)); dBlock(-30, 8, 60, 16, 8, '#e9e6f6', '#a59bd0');
    dRR(-18, -40, 36, 50, 5, '#1d1a2b'); ctx.strokeStyle = decoHue(0); ctx.lineWidth = 2; rr(-18, -40, 36, 50, 5); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, -30 + i * 14, 5, 0, Math.PI * 2); ctx.strokeStyle = decoHue(i * 60); ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.globalAlpha = 0.25; dRR(-22, -44, 44, 58, 6, '#bfe9ff'); ctx.globalAlpha = 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(-18, -42, 3, 50); ctx.globalAlpha = 1;
  },
  videowall() {
    dShadow(0, 34, 54, 7); dGlow(0, -5, 66, decoHue(200), 0.08); dRR(-56, -40, 112, 70, 6, '#141225');
    for (let i = 0; i < 4; i++) { ctx.fillStyle = decoHue(i * 40); ctx.fillRect(-52 + (i % 2) * 53, -36 + Math.floor(i / 2) * 32, 51, 30); }
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff'; ctx.fillRect(-52, -36, 104, 10); ctx.globalAlpha = 1;
    text('4K · 240Hz', 0, -4, 15, 'rgba(255,255,255,.9)'); dRR(-8, 30, 16, 6, 2, '#2b2350');
  },
  thanks() { dNeon('Thank You!', 0, 0, 20, '#ff4fa3'); },
  repairsign() { dRR(-56, -13, 112, 26, 8, 'rgba(29,26,43,.85)'); dNeon('PC REPAIR', 0, 1, 15, '#3fd1ff'); },
  gpusign() {
    dShadow(0, 34, 44, 7); ctx.strokeStyle = '#6b6390'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-30, 32); ctx.lineTo(-30, 12); ctx.moveTo(30, 32); ctx.lineTo(30, 12); ctx.stroke();
    dRR(-50, -30, 100, 44, 8, '#2b2a33'); dRR(-50, 10, 100, 6, 3, '#18171f'); ctx.fillStyle = decoHue(30); ctx.fillRect(-46, -30, 92, 3);
    for (const dx of [-24, 24]) {
      ctx.beginPath(); ctx.arc(dx, -8, 17, 0, Math.PI * 2); ctx.fillStyle = '#121118'; ctx.fill();
      ctx.save(); ctx.translate(dx, -8); ctx.rotate(time * 6);
      for (let k = 0; k < 7; k++) { ctx.rotate(Math.PI * 2 / 7); ctx.beginPath(); ctx.ellipse(7, 0, 8, 3.2, 0.5, 0, Math.PI * 2); ctx.fillStyle = '#4a4860'; ctx.fill(); }
      ctx.restore(); ctx.beginPath(); ctx.arc(dx, -8, 4, 0, Math.PI * 2); ctx.fillStyle = decoHue(30); ctx.fill();
    }
  },
  boxes() {
    dShadow(0, 30, 46, 8); const c = ['#c99a4a', '#d6a95a', '#b88a3e'];
    for (const [dx, dy, i] of [[-30, 10, 0], [0, 10, 1], [30, 10, 2], [-15, -14, 1], [15, -14, 0], [0, -38, 2]]) {
      dBlock(dx - 14, dy - 6, 28, 18, 6, c[i], '#8a6a2f'); ctx.fillStyle = '#e9d3a6'; ctx.fillRect(dx - 2, dy - 6, 4, 18); ctx.fillStyle = decoHue(i * 90); ctx.fillRect(dx - 10, dy + 13, 20, 3);
    }
  },
  toolwall() {
    dRR(-54, -34, 108, 62, 6, '#e8d7b8'); ctx.fillStyle = '#c9b48f';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(-46 + i * 11.5, -26 + j * 12, 1.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.lineCap = 'round'; ctx.strokeStyle = '#ff6b9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-38, -22); ctx.lineTo(-38, 14); ctx.stroke(); dRR(-44, -26, 12, 8, 2, '#8d8aa0');
    ctx.strokeStyle = '#3fd1ff'; ctx.beginPath(); ctx.moveTo(-16, -20); ctx.lineTo(-16, 16); ctx.stroke(); ctx.beginPath(); ctx.arc(-16, -22, 5, 0, Math.PI * 2); ctx.strokeStyle = '#8d8aa0'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#ffc83d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(6, -20); ctx.lineTo(6, 14); ctx.stroke(); ctx.lineCap = 'butt';
    dRR(22, -22, 26, 30, 4, '#2b2350'); ctx.fillStyle = '#2ecc71'; ctx.fillRect(26, -18, 18, 10);
  },
  arcade() {
    dShadow(0, 34, 26, 7); dRR(-22, -42, 44, 74, 6, '#5b2bd1'); dRR(-22, -42, 44, 14, 6, decoHue(280)); text('ARCADE', 0, -35, 8, '#fff');
    dRR(-16, -24, 32, 24, 3, '#0d0b18'); ctx.fillStyle = decoHue(100); ctx.fillRect(-10, -16, 6, 6); ctx.fillStyle = decoHue(220); ctx.fillRect(2, -12, 8, 4); dRR(-20, 2, 40, 10, 3, '#3b1f8f');
    for (const [bx, by, r, c] of [[-9, 4, 3, '#ff5a5f'], [4, 6, 2.5, '#ffc83d'], [11, 6, 2.5, '#2ecc71']]) { ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); }
  },
  chiprug() {
    dRR(-42, -30, 84, 60, 6, '#2f7a6e'); ctx.fillStyle = '#d4b45a'; for (let i = 0; i < 7; i++) { ctx.fillRect(-33 + i * 10.5, -36, 4, 7); ctx.fillRect(-33 + i * 10.5, 29, 4, 7); }
    dRR(-24, -18, 48, 36, 4, '#3bb5b5'); dRR(-16, -11, 32, 22, 3, '#c7d0db'); text('CPU', 0, 1, 11, '#2b2350');
  },
  simrig() {
    dShadow(0, 30, 46, 8); dRR(-48, 6, 96, 18, 6, '#26242e'); ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 3; rr(-48, 6, 96, 18, 6); ctx.stroke();
    dRR(10, -26, 30, 40, 10, '#e5484d'); dRR(14, -22, 22, 30, 8, '#b8323a'); dRR(-40, -34, 40, 24, 3, '#141225');
    ctx.fillStyle = decoHue(160); ctx.fillRect(-38, -32, 36, 20); ctx.beginPath(); ctx.arc(-12, 2, 9, 0, Math.PI * 2); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3; ctx.stroke();
  },
  balloons() {
    const cols = ['#ff5a5f', '#ffc83d', '#3fd1ff', '#a77bff', '#2ecc71'];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (1 - i / 12), bx = Math.cos(a) * 46, by = 26 - Math.sin(a) * 50 + Math.sin(time * 2 + i) * 1.5;
      ctx.beginPath(); ctx.ellipse(bx, by, 8, 9.5, 0, 0, Math.PI * 2); ctx.fillStyle = cols[i % 5]; ctx.fill();
      ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(bx - 3, by - 3, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1;
    }
  },
  trophy() {
    dShadow(0, 32, 44, 7); dBlock(-46, -30, 92, 54, 8, '#7a4b2a', '#5a3520'); dRR(-40, -26, 80, 44, 4, 'rgba(191,233,255,.55)');
    for (const [dx, c, s] of [[-24, '#ffc83d', 1], [0, '#ffd966', 1.25], [24, '#c0c4d6', 0.95]]) {
      ctx.save(); ctx.translate(dx, 2); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(-8, -16); ctx.lineTo(8, -16); ctx.quadraticCurveTo(8, -2, 0, 0); ctx.quadraticCurveTo(-8, -2, -8, -16);
      ctx.fillStyle = c; ctx.fill(); ctx.fillRect(-2, 0, 4, 7); ctx.fillRect(-6, 7, 12, 3); ctx.restore();
    }
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(-38, -24, 3, 40); ctx.globalAlpha = 1;
  },
};
// warm light pools on every open shelf, with a lamp above each
function drawSpotlights() {
  for (const s of PARTS) {
    if (!state.sec[s.id].unlocked) continue;
    const r = s.shelf, horiz = r.w > r.h;
    for (let i = 0; i < 3; i++) {
      const x = horiz ? r.x + r.w * (i + 0.5) / 3 : r.x + r.w / 2, y = horiz ? r.y + r.h / 2 : r.y + r.h * (i + 0.5) / 3;
      ctx.globalAlpha = 0.16 + 0.04 * Math.sin(time * 2 + i); ctx.beginPath(); ctx.ellipse(x, y, horiz ? 30 : 22, horiz ? 20 : 30, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff4b0'; ctx.fill();
      ctx.globalAlpha = 1; dRR(x - 5, (horiz ? r.y : y) - 12, 10, 6, 3, '#2b2350'); ctx.fillStyle = '#ffe58a'; ctx.fillRect(x - 3, (horiz ? r.y : y) - 7, 6, 2);
    }
  }
}
function drawDecor() {
  // RGB light strips along the inside of the walls (always on)
  const hue = (time * 40) % 360, right = worldW() - 18;
  ctx.save(); ctx.lineCap = 'round';
  // glow = a wide faint line under a bright thin one (cheaper than a blur)
  const strip = (x1, y1, x2, y2, off) => {
    const c = `hsl(${(hue + off) % 360},100%,62%)`;
    ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.globalAlpha = 0.25; ctx.lineWidth = 12; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.stroke();
  };
  strip(19, 172, 19, 1000, 0); strip(right + 1, 172, right + 1, 1000, 120); strip(180, 1001, 420, 1001, 240);
  ctx.restore();
  // flat ones first (rugs), then the rest
  const shown = DECOR_ITEMS.filter(decorOn);
  for (const flat of [true, false]) for (const d of shown) {
    if ((d.id === 'chiprug') !== flat) continue;
    if (d.id === 'spotlights') { drawSpotlights(); continue; }
    const fn = DECOR_DRAW[d.id.startsWith('planter') ? 'planter' : d.id];
    if (!fn) continue;
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.s, d.s); fn(); ctx.restore();
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

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const OUTLINE = 'rgba(43,35,80,.6)';
// A cardboard box (centred on x, y) with packing tape and a sticker in the section's colour
function drawCardboard(x, y, w, h, color) {
  const x0 = x - w / 2, y0 = y - h / 2;
  rr(x0, y0, w, h, 2.5); ctx.fillStyle = '#c99556'; ctx.fill();
  ctx.fillStyle = '#a8763d'; ctx.fillRect(x0 + 1, y0 + h - 3, w - 2, 2);            // shaded front edge
  ctx.fillStyle = '#ddb27a'; ctx.fillRect(x0 + 1, y0 + 1, w - 2, 2);                // light top edge
  ctx.fillStyle = 'rgba(240,215,160,.9)'; ctx.fillRect(x - 2.5, y0, 5, h);          // packing tape
  ctx.strokeStyle = 'rgba(120,80,35,.35)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x0 + 2, y0 + h * 0.45); ctx.lineTo(x - 3, y0 + h * 0.45); ctx.moveTo(x + 3, y0 + h * 0.45); ctx.lineTo(x0 + w - 2, y0 + h * 0.45); ctx.stroke();   // flap seam
  rr(x0 + w - 8, y0 + h - 7, 6, 4.5, 1); ctx.fillStyle = color; ctx.fill();          // section sticker
  rr(x0, y0, w, h, 2.5); ctx.strokeStyle = '#7a5226'; ctx.lineWidth = 1.2; ctx.stroke();
}
function drawPerson(o, kind) {
  const x = o.x, y = o.y, face = o.face || 1;
  const ph = time * 12 + (o.x * 0.7 + o.y * 0.3) * 0.05;
  const walk = o.moving ? Math.sin(ph) : 0;
  const bob = o.moving ? -Math.abs(Math.sin(ph)) * 2.5 : Math.sin(time * 2 + x * 0.01) * 0.6;
  const stack = kind === 'player' ? state.carry : (o.carry || []);
  const shirt = kind === 'player' ? '#3a86ff' : o.shirt;
  const pants = kind === 'cust' ? (o.pants || '#2b2350') : '#2b2350';
  const skin = o.skin || '#f5d0a9';
  const hair = o.hair || '#2b1d0e';
  // soft shadow
  const sg = ctx.createRadialGradient(x, y + 2, 2, x, y + 2, 17);
  sg.addColorStop(0, 'rgba(20,10,50,.34)'); sg.addColorStop(1, 'rgba(20,10,50,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(x, y + 2, 17, 7, 0, 0, Math.PI * 2); ctx.fill();
  // legs + shoes (step in turn while walking)
  const liftL = Math.max(0, walk) * 3, liftR = Math.max(0, -walk) * 3;
  ctx.fillStyle = pants;
  rr(x - 7, y - 13 - liftL, 6, 12, 3); ctx.fill();
  rr(x + 1, y - 13 - liftR, 6, 12, 3); ctx.fill();
  ctx.fillStyle = '#1d1640';
  ctx.beginPath(); ctx.ellipse(x - 4 + face, y - 1 - liftL, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 4 + face, y - 1 - liftR, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  // arms: swing while walking, lifted when holding boxes
  const shY = y - 26 + bob;
  const handsUp = stack.length > 0;
  const hand = side => handsUp
    ? { x: x + side * 9, y: y - 47 + bob }
    : { x: x + side * 13 + side * walk * face * 4, y: y - 13 + bob - Math.abs(walk) };
  const arm = side => {
    const h = hand(side);
    ctx.strokeStyle = shade(shirt, -0.12); ctx.lineWidth = 5.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + side * 9, shY); ctx.lineTo(h.x, h.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(h.x, h.y, 3, 0, Math.PI * 2); ctx.fillStyle = skin; ctx.fill();
  };
  // long hair falls behind the head
  const hy = y - 40 + bob;
  if (kind === 'cust' && o.style === 1) { rr(x - 12, hy - 4, 24, 20, 9); ctx.fillStyle = hair; ctx.fill(); }
  // body with soft two-tone shading
  const bg = ctx.createLinearGradient(x, y - 31 + bob, x, y - 10 + bob);
  bg.addColorStop(0, shade(shirt, 0.18)); bg.addColorStop(1, shade(shirt, -0.12));
  rr(x - 11, y - 31 + bob, 22, 21, 8); ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();
  if (kind === 'player') {
    rr(x - 7, y - 28 + bob, 14, 15, 4); ctx.fillStyle = '#ffc83d'; ctx.fill(); ctx.strokeStyle = 'rgba(122,75,0,.5)'; ctx.lineWidth = 1; ctx.stroke();
    rr(x - 4, y - 25 + bob, 8, 4, 1.5); ctx.fillStyle = '#fff'; ctx.fill();
  } else if (kind === 'staff') {
    rr(x + 2, y - 27 + bob, 6, 4, 1.5); ctx.fillStyle = '#fff'; ctx.fill();
  }
  arm(-1); arm(1);
  // head
  ctx.beginPath(); ctx.arc(x, hy, 10.5, 0, Math.PI * 2); ctx.fillStyle = skin; ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();
  // cheeks, eyes, mouth
  const ex = face * 2;
  ctx.fillStyle = 'rgba(255,120,140,.35)';
  ctx.beginPath(); ctx.arc(x - 6 + ex, hy + 4, 2.2, 0, Math.PI * 2); ctx.arc(x + 6 + ex, hy + 4, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2350';
  ctx.beginPath(); ctx.arc(x - 3.5 + ex, hy + 0.5, 1.9, 0, Math.PI * 2); ctx.arc(x + 3.5 + ex, hy + 0.5, 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 2.9 + ex, hy - 0.2, 0.7, 0, Math.PI * 2); ctx.arc(x + 4.1 + ex, hy - 0.2, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2b2350'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath();
  if (o.mood === 'sad' && o.moodT < 1.5) ctx.arc(x + ex, hy + 7, 2.6, Math.PI * 1.15, Math.PI * 1.85);
  else ctx.arc(x + ex, hy + 3.6, 2.6, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  // hair, or a cap for you and the staff
  if (kind === 'cust') {
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(x, hy - 1.5, 11, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - face * 3, hy - 7, 7, 3.5, -face * 0.3, 0, Math.PI * 2); ctx.fill();   // fringe
    if (o.style === 2) { ctx.beginPath(); ctx.arc(x, hy - 13, 4.5, 0, Math.PI * 2); ctx.fill(); }          // bun
    if (o.style === 3) for (const dx of [-7, -2.5, 2.5, 7]) { ctx.beginPath(); ctx.arc(x + dx, hy - 9.5, 3.4, 0, Math.PI * 2); ctx.fill(); }   // curls
  } else {
    const cap = kind === 'player' ? '#ff5a5f' : (o.cap || hair);
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.arc(x, hy - 2, 11, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
    rr(x + face * 5 - 7, hy - 5, 14, 4, 2); ctx.fillStyle = shade(cap.startsWith('#') ? cap : '#ff5a5f', -0.15); ctx.fill();   // brim
  }
  // carried boxes
  for (let i = 0; i < stack.length; i++) {
    const by = y - 60 + bob - i * 12;
    drawCardboard(x, by, 22, 13, SEC[stack[i]].color);
  }
  if (kind === 'player' && stack.length >= carryCap()) outlinedText('FULL', x, y - 68 - stack.length * 12, 11, '#fff');
  if (o.carryPC) drawEmoji('🖥️', x + 14, y - 20, 16);
  if (kind === 'cust' && o.cart.length && o.state !== 'shop') drawEmoji('🛍️', x + 15, y - 14 + bob, 14);
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

// A small timer beside your box stack while you wait for boxes to go back in the crate
function drawReturnTimer() {
  if (!returnCrate || returnWait <= 0 || returnWait >= RETURN_DELAY) return;
  const p = state.player, k = returnWait / RETURN_DELAY;
  const x = p.x + 24, y = p.y - 62;
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = '#2b2350'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.closePath();
  ctx.fillStyle = '#ffc83d'; ctx.fill();
}
function drawFx() {
  let target = null;
  const ease = q => 1 - Math.pow(1 - q, 3);
  for (const f of fx) {
    if (f.t < 0 && f.type !== 'coin') continue;
    if (f.type === 'text') {
      const life = f.life || 1.2, k = f.t / life;
      const sc = f.big ? 1 + 0.35 * Math.max(0, 1 - k * 4) : 1 + 0.2 * Math.max(0, 1 - k * 5);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.55) / 0.45);
      ctx.save(); ctx.translate(f.x, f.y - k * 46); ctx.scale(sc, sc);
      outlinedText(f.text, 0, 0, f.big ? 26 : f.bad ? 15 : 18, f.bad ? '#ffb3b5' : f.big ? '#ffe17a' : '#7ef0a8', f.bad ? '#9b1c22' : f.big ? '#8a5a00' : '#1e5e36');
      ctx.restore();
    } else if (f.type === 'burst') {
      const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t + 260 * f.t * f.t;
      ctx.globalAlpha = Math.min(1, 2 - 2 * f.t / f.life);
      ctx.beginPath(); ctx.ellipse(x, y, 6 * Math.abs(Math.cos(f.t * 12)) + 1.5, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffc83d'; ctx.fill(); ctx.strokeStyle = '#d99a00'; ctx.lineWidth = 1.5; ctx.stroke();
    } else if (f.type === 'fly') {
      target = target || moneyTarget();
      const k = ease(Math.min(1, f.t / f.life));
      ctx.beginPath(); ctx.arc(f.x + (target.x - f.x) * k, f.y + (target.y - f.y) * k - Math.sin(k * Math.PI) * 30, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffc83d'; ctx.fill(); ctx.strokeStyle = '#d99a00'; ctx.lineWidth = 1.2; ctx.stroke();
    } else if (f.type === 'puff') {
      const k = f.t / f.life;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff';
      for (let a = 0; a < 6; a++) { const ang = a / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(f.x + Math.cos(ang) * k * 18, f.y + Math.sin(ang) * k * 9, 3 + 4 * k, 0, Math.PI * 2); ctx.fill(); }
    } else if (f.type === 'plus') {
      const k = f.t / f.life;
      ctx.globalAlpha = 1 - Math.max(0, k - 0.5) / 0.5;
      outlinedText('+1', f.x, f.y - k * 22, 13, '#fff', shade(f.color, -0.35));
    } else if (f.type === 'ring') {
      const k = f.t / f.life, r = f.r;
      ctx.globalAlpha = 1 - k; ctx.lineWidth = 6; ctx.strokeStyle = '#ffc83d';
      rr(r.x - 22 * k, r.y - 22 * k, r.w + 44 * k, r.h + 44 * k, 14); ctx.stroke();
    } else if (f.type === 'confetti') {
      const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t + 200 * f.t * f.t;
      ctx.globalAlpha = Math.min(1, 2.5 - 2.5 * f.t / f.life);
      ctx.save(); ctx.translate(x, y); ctx.rotate(f.t * f.spin); ctx.fillStyle = f.c; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
    } else if (f.type === 'box') {
      const k = Math.min(1, f.t / (f.life || 0.6));
      const bx = f.x + (f.tx - f.x) * k, by = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 40;
      if (f.carried) drawCardboard(bx, by, 20, 13, f.color);
      else { rr(bx - 9, by - 7, 18, 14, 3); ctx.fillStyle = f.color; ctx.fill(); }
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
  const leftover = state.carry.find(id => !boxUsable(id));
  if (leftover) { const s = SEC[leftover]; return { pt: s.crate, text: `${s.name} shelf is full: return the ${s.items} to the stockroom` }; }
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
      if (missing.some(partInStock)) { if (dist(p, SEC.svc.workPad) > 34) return { pt: SEC.svc.workPad, text: `A ${J.name.toLowerCase()} is waiting. Stand in the circle and the parts come out of stock` }; }
      else return { pt: SEC[missing[0]].crate, text: `${J.name} job needs a ${SEC[missing[0]].item}: wait for the next delivery` };
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
  const aim = viaDoor(p, o.pt);
  const a = Math.atan2(aim.y - p.y, aim.x - p.x);
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
let shownMoney = NaN;
function bumpMoney() { const m = $('#money'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); }
let hudTimer = 0;
function updateHud(dt) {
  if (!(shownMoney <= state.money)) shownMoney = state.money;   // spending shows at once
  else if (shownMoney < state.money) shownMoney = Math.min(state.money, shownMoney + Math.max(1, (state.money - shownMoney) * Math.min(1, dt * 6)));
  const mt = fmt(Math.floor(shownMoney));
  if (mt !== lastMoneyText) { $('#moneyVal').textContent = mt; lastMoneyText = mt; }
  hudTimer += dt;
  if (hudTimer < 0.25) return;
  hudTimer = 0;
  $('#incomeVal').textContent = money$(state.rate * 60);
  $('#storeName').textContent = (adminActive() ? `🛠️ ADMIN${adminSpeed() > 1 ? ' ' + adminSpeed() + 'x' : ''} · ` : '') + state.storeName;
  currentObjective = state.lifetime < 4000 || (queues[0].length && !state.staff.cashier) || state.carry.some(id => !boxUsable(id)) ? objective() : null;
  const hint = $('#hint');
  hint.textContent = currentObjective ? currentObjective.text : '';
  hint.classList.toggle('show', !!currentObjective);
  $('#upgradeBtn').classList.toggle('alert', anyAffordable() || canFranchise());
  updateMissions();
  checkDecor();
  $('#missionsBtn').classList.toggle('alert', anyClaimable());
  $('#starCount').textContent = state.stars;
  $('#starBtn').classList.toggle('alert', anyPerkAffordable());
  const eb = $('#eventBanner');
  eb.classList.toggle('show', !!rushEvent);
  if (rushEvent) eb.innerHTML = withProductArt(`<b>${rushEvent.icon} ${rushEvent.name}</b> ${rushEvent.desc} · ${Math.ceil(eventLeft)}s`);
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
  if (state.expanded) for (const u of STORE_UPGRADES) if (storeLv(u.id) < u.max && state.money >= storeUpCost(u.id)) return true;
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
  html += `<div class="group">Store <span>Big upgrades for a finished store</span></div>`;
  for (const u of STORE_UPGRADES) {
    const lv = storeLv(u.id);
    html += `<div class="item ${state.expanded ? '' : 'locked'}"><div class="avatar" style="--c:#ffe9f2">${state.expanded ? u.icon : '🔒'}</div>
      <div class="info"><div class="title">${u.title} <small>Lv ${lv}/${u.max}</small></div><div class="desc">${state.expanded ? u.desc(lv) : 'Expand the store first'}</div></div>
      ${!state.expanded ? '' : lv >= u.max ? '<button class="btn owned" disabled>MAX</button>' : `<button class="btn green" data-act="storeUp" data-id="${u.id}" data-cost="${storeUpCost(u.id)}">Buy<small>${money$(storeUpCost(u.id))}</small></button>`}</div>`;
  }
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
  el.innerHTML = withProductArt(escapeHtml(msg));
  const box = $('#toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}
function showModal(html, sheet = false) {
  // pop-ups get a close button in the corner (full menus have one in their header)
  if (!sheet) html = '<button class="icon-btn small modal-x" data-act="close" aria-label="Close">✕</button>' + html;
  const card = $('#modalCard');
  const refreshing = sheet && !$('#modal').classList.contains('hidden') && card.classList.contains('sheet');
  const scroll = refreshing ? card.scrollTop : 0;
  card.innerHTML = withProductArt(html);
  card.scrollTop = scroll;
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
    <button class="btn" data-act="toggleHaptics">Vibration: ${state.haptics ? 'ON 📳' : 'OFF 📴'}</button>
    <button class="btn" data-act="admin">🛠️ Admin tools (testing)</button>
    <button class="btn danger" data-act="askReset">Reset all progress</button>
    <button class="btn disabled" data-act="close">Close</button>`);
}

function handleAction(el, act, id) {
  switch (act) {
    case 'level':
      if (spend(levelCost(id))) {
        state.sec[id].level++;
        celebrateLevel(id, MILESTONES.includes(state.sec[id].level));
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
        if (!holdingBuy) toast(`${u.icon} ${u.title} Lv ${state.staffLv[id]}: ${u.desc()}`);
        showUpgrades();
      }
      break;
    }
    case 'starShop': showStarShop(); $('#modalCard').scrollTop = 0; break;
    case 'starPerk': buyPerk(id); break;
    case 'franchise':
      if (!canFranchise()) { toast(`⭐ ${franchiseBlock()}`); break; }
      showModal(`<div class="emoji">⭐</div><h2>Open a new store?</h2>
        <p>Pay <b>${money$(franchiseCost())}</b> to sell your ${theme().name} for <b>${claimableStars()} Stars</b> and open a ${THEMES[(state.franchises + 1) % THEMES.length].name}. Every Star adds 5% to all your prices, forever.</p>
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
    case 'storeUp': {
      const u = STORE_UP[id];
      if (u && state.expanded && storeLv(id) < u.max && spend(storeUpCost(id))) {
        state.storeUp[id] = storeLv(id) + 1; sfx.unlock(); confetti();
        toast(`${u.icon} ${u.title} Lv ${storeLv(id)}!`); showUpgrades();
      }
      break;
    }
    case 'claimGoal': {
      const gl = GOAL[id];
      if (gl && state.goalsDone.includes(id) && !state.goalsClaimed.includes(id)) {
        state.goalsClaimed.push(id); const r = goalReward(gl); bank(r); sfx.cash(); confetti();
        toast(`🎯 Goal done! +${money$(r)}`); showMissions();
      }
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
    case 'toggleHaptics': state.haptics = !state.haptics; if (state.haptics) buzz('medium'); showSettings(); break;
    case 'admin': showAdmin(); break;
    case 'adminMoney': adminSetUnlimited(!state.admin.unlimited); showAdmin(); break;
    case 'adminSpeed': state.admin.speed = +id; toast(`⏩ Game speed ${id}x`); showAdmin(); break;
    case 'adminUnlock': adminUnlockAll(); showAdmin(); break;
    case 'adminHire': adminHireAll(); showAdmin(); break;
    case 'adminFill': adminFill(); showAdmin(); break;
    case 'adminTruck': if (truck.phase === 'away') truckTimer = 0; toast('🚚 Truck is on its way'); closeModal(); break;
    case 'adminEvent': adminEvent(); closeModal(); break;
    case 'adminLifetime': state.lifetime += 1e6; toast('📈 +$1M lifetime earnings (for testing Franchise)'); showAdmin(); break;
    case 'adminMissions': if (state.daily) for (const m of state.daily.list) m.progress = m.target; toast('📋 Daily missions completed'); showAdmin(); break;
    case 'askReset':
      showModal(`<div class="emoji">⚠️</div><h2>Reset everything?</h2><p>This wipes all progress.</p>
        <button class="btn danger" data-act="confirmReset">Yes, reset</button><button class="btn disabled" data-act="close">Cancel</button>`);
      break;
    case 'confirmReset':
      state = freshState();
      customers = []; queues = [[], []]; fx = []; buildProgress = 0;
      for (const k in npcs) delete npcs[k];
      rebuildGrid();
      save(true); closeModal();
      break;
  }
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (holdFired) { holdFired = false; return; }   // the hold already did the buying
  handleAction(el, el.dataset.act, el.dataset.id);
});

// ---------- Hold a buy button to keep buying ----------
const HOLD_ACTS = new Set(['level', 'staffUp', 'speed', 'carry', 'delivery', 'truck']);
let holdTimer = null, holdFired = false, holdingBuy = false;
function stopHold() { clearTimeout(holdTimer); holdTimer = null; holdingBuy = false; }
$('#modalCard').addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-act]');
  holdFired = false;
  if (!el || !HOLD_ACTS.has(el.dataset.act)) return;
  const { act, id } = el.dataset;
  stopHold();
  let delay = 220;
  const step = () => {
    holdingBuy = true;
    const before = state.money;
    handleAction(null, act, id);
    holdFired = true;
    if (state.money >= before) { stopHold(); return; }   // couldn't afford it, or it's maxed
    delay = Math.max(35, delay * 0.82);                    // speeds up the longer you hold
    holdTimer = setTimeout(step, delay);
  };
  holdTimer = setTimeout(step, 380);
});
['pointerup', 'pointercancel', 'blur'].forEach(ev => window.addEventListener(ev, stopHold));
$('#modalCard').addEventListener('scroll', stopHold, { passive: true });
$('#upgradeBtn').addEventListener('click', showUpgrades);
$('#settingsBtn').addEventListener('click', showSettings);
$('#missionsBtn').addEventListener('click', () => { updateMissions(); showMissions(); });
$('#starBtn').addEventListener('click', () => { showStarShop(); $('#modalCard').scrollTop = 0; });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

// ---------- Admin tools (for testing) ----------
const ADMIN_MONEY = 999e9;
function adminSpeed() { return (state.admin && state.admin.speed) || 1; }
function adminActive() { return state.admin.unlimited || adminSpeed() > 1; }
function adminSetUnlimited(on) {
  if (on === state.admin.unlimited) return;
  if (on) { state.admin.savedMoney = state.money; state.money = ADMIN_MONEY; toast('💸 Unlimited money ON'); }
  else { state.money = state.admin.savedMoney || 0; toast(`💸 Unlimited money OFF: back to ${money$(state.money)}`); }
  state.admin.unlimited = on;
}
// Keep the balance topped up; admin money never counts as earnings
function adminTick() { if (state.admin.unlimited && state.money < ADMIN_MONEY) state.money = ADMIN_MONEY; }
function adminUnlockAll() {
  state.expanded = true; state.expandPaid = EXPANSION.cost;
  for (const s of SECTIONS) {
    const st = state.sec[s.id];
    if (!st.unlocked) { st.unlocked = true; st.paid = s.unlock; if (s.shelf) { st.stock = shelfCap(s.id); state.crates[s.id] = crateMax(); } pushOut(state.player, s.shelf || s.bench); }
  }
  rebuildGrid(); confetti();
  toast('🔓 Every section unlocked and the store expanded');
}
function adminHireAll() {
  for (const k in STAFF) { state.staff[k] = true; if (state.staffPaid[k] !== undefined) state.staffPaid[k] = STAFF[k].cost; }
  toast('👥 All staff hired');
}
function adminFill() {
  for (const s of unlockedParts()) { state.sec[s.id].stock = shelfCap(s.id); state.crates[s.id] = crateMax(); }
  toast('📦 Shelves and crates full');
}
let adminEventIdx = 0;
function adminEvent() {
  const opts = EVENTS.filter(e => e.ok());
  if (!opts.length) { toast('Unlock PC Cases first to start events'); return; }
  rushEvent = opts[adminEventIdx++ % opts.length]; eventLeft = rushEvent.dur;
  toast(`${rushEvent.icon} ${rushEvent.name} ${rushEvent.desc}`);
}
function showAdmin() {
  const a = state.admin;
  const row = (act, icon, title, desc, label, on) => `<div class="item"><div class="avatar" style="--c:#ffe1e2">${icon}</div>
    <div class="info"><div class="title">${title}</div><div class="desc">${desc}</div></div>
    <button class="btn ${on === false ? 'disabled' : 'green'}" data-act="${act}">${label}</button></div>`;
  let html = `<div class="sheet-head"><h2>Admin tools</h2><button class="icon-btn small" data-act="close" aria-label="Close">✕</button></div>
    <div class="group">For testing <span>Admin money never counts toward Stars or achievements</span></div>`;
  html += row('adminMoney', '💸', 'Unlimited money', a.unlimited ? `On. Your real balance (${money$(a.savedMoney)}) comes back when you turn it off.` : 'Your balance stays topped up so everything is free.', a.unlimited ? 'ON' : 'OFF', a.unlimited);
  html += `<div class="item"><div class="avatar" style="--c:#ffe1e2">⏩</div><div class="info"><div class="title">Game speed</div><div class="desc">Shoppers, staff, trucks and timers run faster. You walk at normal speed.</div>
    <div class="speed-row">${[1, 2, 5, 10].map(n => `<button class="btn ${a.speed === n ? 'green' : 'disabled'}" data-act="adminSpeed" data-id="${n}">${n}x</button>`).join('')}</div></div></div>`;
  html += row('adminUnlock', '🔓', 'Unlock everything', 'Expands the store and unlocks all 8 sections', 'Unlock');
  html += row('adminHire', '👥', 'Hire all staff', 'Both cashiers, the stocker and the tech', 'Hire');
  html += row('adminFill', '📦', 'Fill shelves & crates', 'Every unlocked shelf and crate to the top', 'Fill');
  html += row('adminTruck', '🚚', 'Call the truck now', truckStatus(), 'Call');
  html += row('adminEvent', '🎉', 'Start a rush event', rushEvent ? `Running: ${rushEvent.name}` : 'Cycles through the events you have unlocked', 'Start');
  html += row('adminLifetime', '📈', '+$1M lifetime earnings', `For testing Franchise. Claimable now: ${claimableStars()} ⭐`, 'Add');
  html += row('adminMissions', '📋', 'Finish daily missions', 'Fills today\'s 3 missions so you can claim them', 'Finish');
  showModal(html, true);
}

// ---------- Offline earnings ----------
function applyOffline() {
  const away = Math.min(NIGHT_SHIFT[perkLv('nightShift')].hours * 3600, (Date.now() - (state.lastSeen || Date.now())) / 1000);
  state.lastSeen = Date.now();
  if (away < 30 || !state.staff.cashier || !state.staff.stocker) return;
  const earned = state.rate * away * NIGHT_SHIFT[perkLv('nightShift')].rate;
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
  const steps = adminSpeed();
  for (let i = 0; i < steps; i++) {
    time += dt;
    update(dt, i === 0);   // you always move at normal speed
    updateRate(dt);
    adminTick();
  }
  updateHud(dt);
  render();
  saveTimer += dt;
  if (saveTimer > 5) { save(); saveTimer = 0; }
  requestAnimationFrame(frame);
}

// a save from before the stockroom wall may have you standing where it is now
for (const r of stockWallRects()) if (inRect(state.player, r, 12)) state.player.y = STOCK_WALL_Y + STOCK_WALL_H + 20;
resize();
cam.x = state.player.x; cam.y = state.player.y;
applyOffline();
requestAnimationFrame(t => { last = t; frame(t); });
if (isNewPlayer) toast('👆 Drag anywhere to move. Restock shelves and check out shoppers!');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
