// LAST RAIL — data & tuning. SEMUA angka dari outline §2/§4/§9.
// config.js adalah satu-satunya sumber kebenaran: harga, kecepatan, gap,
// stage, surge, skor. Jangan duplikasi angka ini di file lain.
export const W = 1280;
export const H = 720;

// Satu kalimat permainan: bangun rel di depan kereta yang melaju,
// sebelum Void mengejarmu.
export const WIN_TILE = 300;
export const WIN_TEXT = 'WIN: REACH DAWN TERMINUS · TILE 300';
export const LOSE_TEXT = 'LOSE: THE VOID CATCHES YOU';
export const CONTROLS_TEXT =
  'CLICK BUILD  ·  1-4 SELECT  ·  R ROTATE  ·  DRAG LINE  ·  SPACE BOOST  ·  Q SHIELD  ·  X BULLDOZE  ·  P PAUSE';

// --- Grid ---
export const TILE = 80;
export const GRID_ROWS = 5; // baris 0..4; main band = baris 1,2,3
export const MAIN_BAND = [1, 2, 3];
export const GRID_X0 = 100;
export const GRID_Y0 = 80;
export const GRID_COLS_VISIBLE = 14;
export const TRAIN_VIEW_COL = 3; // kereta di kolom ke-3 viewport (play normal)
export const COVER_VIEW_COL = 6; // kereta di kolom ke-6 viewport (cover/play shot)

// --- Ekonomi (§2.1) ---
export const PRICES = {
  straight: 1,
  curve: 2,
  junction: 4,
  bridge: 5,
  boost: 15,
  shield: 25,
  lantern: 30,
  reroll: 10,
  doze: 5,
};
export const CRYSTAL_LUMEN = 3; // per kristal; +1 Lantern; +1 BRIGHT LAMP (maks 5)
export const START_LUMEN = 20;
export const START_RAIL = 12; // tile awal gratis (departure yard)
export const START_BOOST = 1; // starter kit: 1x Boost di inventory
export const MAX_BOOST = 3;
export const MAX_SHIELD = 2;
export const DELIVERY = [0, 25, 30, 35, 40]; // indeks stage 1..4
export const BOOST_DURATION = 5; // detik
export const BOOST_MULT = 1.5;
export const SHIELD_DURATION = 5; // detik
export const CRYSTALS_PER_BLOCK = 9; // per 10 kolom; 10 dengan CRYSTAL SENSE

// --- Stage (§4.1) ---
// tile: batas kumulatif (stage berakhir saat trainPos >= end)
// train/void: tile per detik; gap: tile awal; durasi: detik
export const STAGES = [
  { name: 'EMBERFIELD', start: 0, end: 50, train: 0.8, void: 1.0, gap: 13, rocks: 0, chasms: 0, forks: 0 },
  { name: 'STONE CUT', start: 50, end: 100, train: 1.0, void: 1.25, gap: 12, rocks: 6, chasms: 0, forks: 0 },
  { name: 'JUNCTION', start: 100, end: 150, train: 1.2, void: 1.5, gap: 8, rocks: 4, chasms: 0, forks: 3 },
  { name: 'TRESTLE', start: 150, end: 200, train: 1.4, void: 1.75, gap: 7, rocks: 3, chasms: 4, forks: 2 },
  { name: 'THE VOID', start: 200, end: 300, train: 1.6, void: 2.0, gap: 12, rocks: 2, chasms: 2, forks: 2 },
];
export const TOTAL_TILES = 300;
export const SURGE_INTERVAL = 20; // detik waktu stage (t=20, t=40)
export const SURGE_JUMP = 3; // tile
export const SURGE_TELEGRAPH = 2; // detik peringatan sebelum Surge
export const ENDLESS_SEGMENT = 50; // tile per segmen endless
export const ENDLESS_DELIVERY = 40;
export const ENDLESS_TRAIN_STEP = 0.1; // + per segmen
export const ENDLESS_VOID_STEP = 0.15; // + per segmen

// --- Difficulty (revisi 2, teardown item 3) ---
// voidDelta: ditambah ke kecepatan Void tiap stage. scoreMult: pengali skor akhir.
// GENTLE: Void -0.1, start 30 Lumen. DAWNSEEKER: Void +0.03 (BUKAN +0.1 —
// +0.1 membuat S1 mustahil tanpa starter Shield: tutup 18,75 vs gap 13 +
// Boost 2 = -3,75; dan S5 tak terjangkau di seed terburuk).
export const DIFFICULTY = {
  GENTLE: { label: 'GENTLE', voidDelta: -0.1, startLumen: 30, scoreMult: 1.0, desc: 'Void slower · 30 Lumen start' },
  STANDARD: { label: 'STANDARD', voidDelta: 0, startLumen: 20, scoreMult: 1.0, desc: 'As designed · 20 Lumen start' },
  DAWNSEEKER: { label: 'DAWNSEEKER', voidDelta: 0.03, startLumen: 20, scoreMult: 1.4, desc: 'Void faster · score x1.4' },
};
export const DIFFICULTY_ORDER = ['GENTLE', 'STANDARD', 'DAWNSEEKER'];

// --- CRYSTAL CHAIN (revisi 2, teardown item 2) — SKOR SAJA, tidak pernah Lumen ---
// chain = kristal berurutan tanpa sel kosong di antaranya (stasiun tidak mereset).
// mult = min(5, max(1, chain)); per kristal: chainScore += value x (mult - 1).
export const CHAIN_MAX_MULT = 5;

// --- VOID TIDE (revisi 2, teardown item 4) — menggantikan Surge #2 (t=40) di S5+ ---
// Void x1.3 selama 5 detik (bukan lompatan instan). Biaya gap = (2,0x1,3-1,6)x5 -
// (2,0-1,6)x5 = 3 tile — persis sama dengan Surge yang digantikannya.
export const TIDE_TIME = 40; // detik waktu stage (menggantikan Surge t=40)
export const TIDE_WARN = 38; // telegraph 2 detik sebelumnya
export const TIDE_DUR = 5; // detik
export const TIDE_MULT = 1.3;

// --- Draft (§8.1, revisi 2: stacking rank II) ---
// maxRank: 1 = boon ekonomi (BRIGHT LAMP, SPARE PARTS, CRYSTAL SENSE) —
// TIDAK BOLEH stack (satu pick sudah +60..+140 LUMEN/run; stacking membuat
// grade S trivial). 2 = bisa stack ke rank II.
// desc2: teks rank II. synergy: teks tampilan saja (TANPA bonus mekanik).
export const BOONS = [
  { id: 'iron-rails', name: 'IRON RAILS', maxRank: 2,
    desc: 'Rail cost -1 (min 0): Straight 0, Curve 1, Junction 3, Bridge 4.',
    desc2: 'Rail cost -1 more (min 0): Straight 0, Curve 1, Junction 3, Bridge 2.',
    synergy: 'Pairs with BRIGHT LAMP — cheaper rails, richer crystals.' },
  { id: 'bright-lamp', name: 'BRIGHT LAMP', maxRank: 1,
    desc: 'Crystal +1 LUMEN (3 to 4). Stacks with Lantern, max 5.',
    desc2: '',
    synergy: 'Pairs with IRON RAILS — spend less, earn more.' },
  { id: 'swift-engine', name: 'SWIFT ENGINE', maxRank: 2,
    desc: 'Train +0.1 tiles/s each stage. Faster exposure — rails needed sooner.',
    desc2: 'Train +0.2 tiles/s total. The Void never waits.',
    synergy: 'Pairs with VOID WARD — speed with a safety net.' },
  { id: 'void-ward', name: 'VOID WARD', maxRank: 2,
    desc: 'Start gap +4 tiles each stage.',
    desc2: 'Start gap +7 tiles total. Breathe before the chase.',
    synergy: 'Pairs with SWIFT ENGINE — speed with a safety net.' },
  { id: 'spare-parts', name: 'SPARE PARTS', maxRank: 1,
    desc: '+15 LUMEN at every Station.',
    desc2: '',
    synergy: 'Pairs with CRYSTAL SENSE — income from every corner.' },
  { id: 'long-haul', name: 'LONG HAUL', maxRank: 2,
    desc: 'Shield lasts +3s (5 to 8).',
    desc2: 'Shield lasts +6s total (5 to 11).',
    synergy: 'Pairs with OVERDRIVE — long tools, long runs.' },
  { id: 'overdrive', name: 'OVERDRIVE', maxRank: 2,
    desc: 'Boost lasts +3s (5 to 8) and x1.5 to x1.75.',
    desc2: 'Boost lasts +6s total (5 to 11) and x1.5 to x2.0.',
    synergy: 'Pairs with LONG HAUL — long tools, long runs.' },
  { id: 'crystal-sense', name: 'CRYSTAL SENSE', maxRank: 1,
    desc: 'Crystal guarantee 9 to 10 per 10 columns.',
    desc2: '',
    synergy: 'Pairs with SPARE PARTS — income from every corner.' },
];

// --- Skor (§9.3) ---
export const SCORE_PAR_TIME = 300; // detik; bonus waktu = max(0, 300 - waktu) x 2
export const SCORE_TIME_MULT = 2;
export const SCORE_LUMEN_MULT = 10;
// Ambang grade (revisi 3, item 7 — S TETAP ≥1000, keputusan Warden ronde 2:
// menaikkan ke 1200 membuat S mustahil tanpa boon ekonomi).
export const GRADE_THRESHOLDS = { S: 1000, A: 800, B: 600 };
export function gradeFor(score) {
  if (score >= GRADE_THRESHOLDS.S) return 'S';
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  return 'C';
}

// --- Palet build ---
export const PIECES = {
  straight: { id: 'straight', name: 'STRAIGHT', key: '1', price: PRICES.straight },
  curve: { id: 'curve', name: 'CURVE', key: '2', price: PRICES.curve },
  junction: { id: 'junction', name: 'JUNCTION', key: '3', price: PRICES.junction },
  bridge: { id: 'bridge', name: 'BRIDGE', key: '4', price: PRICES.bridge },
};
export const PIECE_ORDER = ['straight', 'curve', 'junction', 'bridge'];

// RNG kecil yang bisa di-seed (untuk screenshot yang deterministik).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}
