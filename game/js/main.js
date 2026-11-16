// LAST RAIL — titik masuk & mesin permainan: state, loop, stage, dan semua aksi.
// Satu kalimat: bangun rel di depan kereta yang melaju, sebelum Void mengejarmu.
import {
  W, H, STAGES, TOTAL_TILES, START_LUMEN, START_RAIL, START_BOOST,
  PRICES, DELIVERY, ENDLESS_SEGMENT, ENDLESS_DELIVERY, ENDLESS_TRAIN_STEP,
  ENDLESS_VOID_STEP, SURGE_INTERVAL, SURGE_JUMP, SURGE_TELEGRAPH,
  BOOST_DURATION, BOOST_MULT, SHIELD_DURATION, SCORE_PAR_TIME, SCORE_TIME_MULT,
  SCORE_LUMEN_MULT, gradeFor, mulberry32, clamp, fmtTime, TILE, GRID_X0, GRID_Y0,
  GRID_COLS_VISIBLE, GRID_ROWS, TRAIN_VIEW_COL, COVER_VIEW_COL, PIECE_ORDER,
  DIFFICULTY, DIFFICULTY_ORDER, TIDE_TIME, TIDE_WARN, TIDE_DUR, TIDE_MULT,
} from './config.js';
import { SoundFX } from './audio.js';
import { FX } from './fx.js';
import { Economy } from './economy.js';
import { World, cellKey } from './levels.js';
import { drawScene, colToX, rowToY, cellCenter, screenToCell, dirOf } from './render.js';
import { attachInput, hitUI } from './input.js';
import { setupShot } from './shots.js';
import { loadFeats, loadRuns, finishRun } from './feats.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

window.addEventListener('error', (e) => {
  window.__err = e.message;
});

const BEST_KEY = 'last-rail-best';
const BEST_DIST_KEY = 'last-rail-best-distance';
const ENDLESS_KEY = 'last-rail-endless';

function loadNum(key) {
  try {
    return parseInt(localStorage.getItem(key), 10) || 0;
  } catch {
    return 0;
  }
}
function saveNum(key, v) {
  try {
    localStorage.setItem(key, String(v));
  } catch { /* penyimpanan tidak tersedia */ }
}

const s = {
  screen: 'title', // title | play | paused | station | win | lose
  t: 0,
  mode: 'standard', // standard | endless
  stage: 1,
  endlessSeg: 0, // segmen endless ke- (1 = tile 300-350)
  nextStationAt: 50,
  trainPos: 0, // jarak absolut (tile)
  voidPos: -13,
  gap: 13,
  railAhead: START_RAIL,
  stageTime: 0,
  runTime: 0,
  path: [], // [{col,row,kind,rot}]
  pathStartTile: 0,
  world: null,
  economy: new Economy(),
  fx: new FX(),
  sound: new SoundFX(),
  best: loadNum(BEST_KEY),
  bestDistance: loadNum(BEST_DIST_KEY),
  unlockedEndless: loadNum(ENDLESS_KEY) > 0,
  selectedPiece: 'straight',
  ghostRot: 0,
  hover: null,
  ghost: null,
  dragging: false,
  dragLast: null,
  pendingFork: null,
  boostTimer: 0,
  shieldTimer: 0,
  surgeWarn: false,
  surgeFired: {},
  surgeWarned: {},
  // VOID TIDE (revisi 2, item 4): menggantikan Surge #2 (t=40) di S5+.
  tideWarn: false, // telegraph ungu 2 detik sebelum Tide
  tide: { warned: false, active: false, until: 0 },
  // Difficulty (revisi 2, item 3): dipilih di title, bertahan antar restart.
  difficulty: 'STANDARD',
  voidDelta: 0, // dari DIFFICULTY[difficulty].voidDelta
  stageStats: null,
  lastDelivery: 0,
  stageStart: { pathLen: 0, crystals: 0, lumenEarned: 0, toolsUsed: 0 },
  stalledEver: false,
  shieldsUsed: 0,
  boostsUsed: 0,
  minGap: Infinity,
  finalScore: 0,
  finalGrade: '',
  medals: [],
  // Feats karier + histori run (revisi 3, item 5–6): persisten localStorage.
  feats: loadFeats(),
  runs: loadRuns(),
  newFeats: [], // feats yang baru diraih di run yang baru selesai (tampil di end screen)
  loseReason: '',
  seed: 1,
  rng: mulberry32(1),
  camCol: 0,
  viewCol: TRAIN_VIEW_COL,
  shotMode: false,
  currentSpeed: 0,
  stageDef: STAGES[0],
  ui: [],
  collectedIdx: -1, // indeks path terakhir yang kristalnya sudah dicek
};

window.__lr = s; // diekspos untuk playtest otomatis.

function saveBest() {
  if (s.finalScore > s.best) {
    s.best = s.finalScore;
    saveNum(BEST_KEY, s.best);
  }
  const dist = Math.floor(s.trainPos);
  if (dist > s.bestDistance) {
    s.bestDistance = dist;
    saveNum(BEST_DIST_KEY, s.bestDistance);
  }
}

// --- Definisi stage saat ini (standard atau endless) ---
function stageDefFor(stage, endlessSeg) {
  if (stage <= 5) return STAGES[stage - 1];
  const k = endlessSeg; // 1,2,...
  return {
    name: 'ENDLESS ' + k,
    start: 200 + 50 * k,
    end: 250 + 50 * k,
    train: 1.6 + ENDLESS_TRAIN_STEP * k,
    void: 2.0 + ENDLESS_VOID_STEP * k,
    gap: 12,
    rocks: 2, chasms: 2, forks: 1,
  };
}

function startGapFor(def) {
  // VOID WARD: rank I +4, rank II +7 total.
  const r = s.economy.boonRank('void-ward');
  return def.gap + (r === 1 ? 4 : r >= 2 ? 7 : 0);
}

function trainSpeedBase() {
  let v = s.stageDef.train;
  v += 0.1 * s.economy.boonRank('swift-engine'); // rank I +0.1, rank II +0.2
  return v;
}

function boostMult() {
  // OVERDRIVE: rank I x1.75, rank II x2.0.
  const r = s.economy.boonRank('overdrive');
  if (r >= 2) return 2.0;
  if (r >= 1) return 1.75;
  return BOOST_MULT;
}
function boostDuration() {
  return BOOST_DURATION + 3 * s.economy.boonRank('overdrive'); // 5 -> 8 -> 11
}
function shieldDuration() {
  return SHIELD_DURATION + 3 * s.economy.boonRank('long-haul'); // 5 -> 8 -> 11
}

function pathIdx() {
  return Math.floor(s.trainPos) - s.pathStartTile;
}

function head() {
  return s.path[s.path.length - 1];
}

function pathSet() {
  if (!s._pathSet || s._pathSetLen !== s.path.length) {
    s._pathSet = new Set(s.path.map((c) => cellKey(c.col, c.row)));
    s._pathSetLen = s.path.length;
  }
  return s._pathSet;
}

function trainScreenPos() {
  const i = Math.min(Math.max(pathIdx(), 0), s.path.length - 1);
  const j = Math.min(i + 1, s.path.length - 1);
  const frac = clamp(s.trainPos - s.pathStartTile - i, 0, 1);
  const a = cellCenter(s.path[i].col, s.path[i].row, s.camCol);
  const b = cellCenter(s.path[j].col, s.path[j].row, s.camCol);
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

function updateCamCol() {
  const i = Math.min(Math.max(pathIdx(), 0), s.path.length - 1);
  const trainCol = s.path[i] ? s.path[i].col : 0;
  s.camCol = trainCol - s.viewCol;
  if (s.camCol < 0) s.camCol = 0;
}

function updateRailAhead() {
  s.railAhead = Math.max(0, (s.path.length - 1) - pathIdx());
}

// --- Run baru ---
// seedOpt: bila diberikan (>0), run memakai seed itu (SAME SEED replay,
// item 6) — dunia + draft deterministik dari seed. Bila tidak, seed acak.
function newRun(mode, seedOpt) {
  const m = mode || s.mode;
  s.mode = m;
  const diff = DIFFICULTY[s.difficulty] || DIFFICULTY.STANDARD;
  s.economy = new Economy(diff.startLumen, diff.scoreMult);
  s.voidDelta = diff.voidDelta;
  s.fx.clear();
  s.screen = 'title';
  s.stage = 1;
  s.endlessSeg = 0;
  s.nextStationAt = 50;
  s.trainPos = 0;
  s.runTime = 0;
  s.stageTime = 0;
  s.selectedPiece = 'straight';
  s.ghostRot = 0;
  s.hover = null;
  s.ghost = null;
  s.dragging = false;
  s.pendingFork = null;
  s.boostTimer = 0;
  s.shieldTimer = 0;
  s.surgeWarn = false;
  s.surgeFired = {};
  s.surgeWarned = {};
  s.tideWarn = false;
  s.tide = { warned: false, active: false, until: 0 };
  s.stalledEver = false;
  s.shieldsUsed = 0;
  s.boostsUsed = 0;
  s.minGap = Infinity;
  s.finalScore = 0;
  s.finalGrade = '';
  s.medals = [];
  s.newFeats = [];
  s.loseReason = '';
  s.viewCol = TRAIN_VIEW_COL;
  s.seed = (seedOpt !== undefined && seedOpt > 0) ? seedOpt : ((Date.now() % 2147483647) || 1);
  s.rng = mulberry32(s.seed);
  s.world = new World(s.seed);
  s.pathStartTile = 0;
  s.collectedIdx = -1;
  // Departure yard: 12 tile lurus gratis di baris tengah (row 2).
  s.path = [];
  for (let c = 0; c < START_RAIL; c++) {
    s.path.push({ col: c, row: 2, kind: c === 0 ? 'start' : 'straight', rot: 0 });
  }
  s._pathSet = null;
  if (m === 'endless') {
    // Endless dari title: mulai di tile 300 dengan yard 288-300.
    s.pathStartTile = 288;
    s.path = [];
    for (let c = 288; c <= 300; c++) {
      s.path.push({ col: c, row: 2, kind: c === 288 ? 'start' : 'straight', rot: 0 });
    }
    s.trainPos = 300;
    s.stage = 6;
    s.endlessSeg = 1;
    s.nextStationAt = 350;
    s.collectedIdx = s.path.length - 1;
  }
  s.stageDef = stageDefFor(s.stage, s.endlessSeg);
  s.gap = startGapFor(s.stageDef);
  s.voidPos = s.trainPos - s.gap;
  s.world.ensureWorld(trainColNow() + 40, s.economy.hasBoon('crystal-sense'));
  s.stageStart = { pathLen: s.path.length, crystals: 0, lumenEarned: 0, toolsUsed: 0 };
  s.screen = 'title';
}

function trainColNow() {
  const i = Math.min(Math.max(pathIdx(), 0), s.path.length - 1);
  return s.path[i] ? s.path[i].col : 0;
}

function startPlay() {
  s.screen = 'play';
  s.stageTime = 0;
  s.stageStart = {
    pathLen: s.path.length,
    crystals: s.economy.crystalsCollected,
    lumenEarned: s.economy.lumenEarned,
    toolsUsed: s.economy.toolsUsed,
  };
  s.sound.ensure();
}

function beginStage() {
  s.stageDef = stageDefFor(s.stage, s.endlessSeg);
  s.stageTime = 0;
  s.surgeWarn = false;
  s.surgeFired = {};
  s.surgeWarned = {};
  s.tideWarn = false;
  s.tide = { warned: false, active: false, until: 0 };
  s.gap = startGapFor(s.stageDef);
  s.voidPos = s.trainPos - s.gap;
  s.world.ensureWorld(trainColNow() + 60, s.economy.hasBoon('crystal-sense'));
  s.stageStart = {
    pathLen: s.path.length,
    crystals: s.economy.crystalsCollected,
    lumenEarned: s.economy.lumenEarned,
    toolsUsed: s.economy.toolsUsed,
  };
  s.screen = 'play';
}

function toStation() {
  const st = s.stageStart;
  s.stageStats = {
    time: fmtTime(s.stageTime),
    tiles: s.path.length - st.pathLen,
    crystals: s.economy.crystalsCollected - st.crystals,
    lumenEarned: s.economy.lumenEarned - st.lumenEarned,
    toolsUsed: s.economy.toolsUsed - st.toolsUsed,
  };
  const delivery = s.mode === 'endless' ? ENDLESS_DELIVERY : (DELIVERY[s.stage] || 0);
  s.lastDelivery = delivery;
  s.economy.earn(delivery);
  if (s.economy.hasBoon('spare-parts')) s.economy.earn(15);
  s.economy.offerDraft(s.rng);
  s.screen = 'station';
  s.sound.station();
}

function continueFromStation() {
  if (s.mode === 'endless') {
    s.endlessSeg++;
    s.stage++;
    s.nextStationAt += ENDLESS_SEGMENT;
  } else {
    s.stage++;
    s.nextStationAt = STAGES[s.stage - 1] ? STAGES[s.stage - 1].end : TOTAL_TILES;
  }
  beginStage();
}

function scoreNow() {
  // Skor kalah: jarak + Lumen x10 + CHAIN (skor saja), lalu x pengali difficulty.
  const raw = Math.floor(s.trainPos) + s.economy.lumen * SCORE_LUMEN_MULT + s.economy.chainScore;
  return Math.floor(raw * s.economy.scoreMult);
}

function winGame() {
  const timeBonus = Math.max(0, SCORE_PAR_TIME - s.runTime) * SCORE_TIME_MULT;
  // Skor menang: 300 + Lumen x10 + bonus waktu + CHAIN, lalu x pengali difficulty.
  const raw = TOTAL_TILES + s.economy.lumen * SCORE_LUMEN_MULT + Math.round(timeBonus) + s.economy.chainScore;
  s.finalScore = Math.floor(raw * s.economy.scoreMult);
  s.finalGrade = gradeFor(s.finalScore);
  s.medals = [];
  if (s.shieldsUsed === 0) s.medals.push('NO SHIELD USED');
  if (!s.stalledEver) s.medals.push('FULL SPEED');
  if (s.minGap >= 4) s.medals.push('FIRST LIGHT');
  s.unlockedEndless = true;
  saveNum(ENDLESS_KEY, 1);
  saveBest();
  recordFinish(true);
  s.screen = 'win';
  s.sound.win();
}

function loseGame(reason) {
  s.loseReason = reason;
  s.finalScore = scoreNow();
  saveBest();
  recordFinish(false);
  s.screen = 'lose';
  s.sound.lose();
}

// Rekam akhir run ke feats karier + histori 3 run (revisi 3, item 5–6).
// Dipanggil SETELAH finalScore/finalGrade dihitung (dipakai di record).
function recordFinish(won) {
  const out = finishRun(s.feats, s.runs, {
    won,
    tile: Math.floor(s.trainPos),
    score: s.finalScore,
    grade: won ? s.finalGrade : '',
    difficulty: s.difficulty,
    seed: s.seed,
    minGap: s.minGap,
    shieldsUsed: s.shieldsUsed,
    stalledEver: s.stalledEver,
    maxChain: s.economy.maxChain,
    lumen: s.economy.lumen,
  });
  s.feats = out.feats;
  s.newFeats = out.newly;
  s.runs = out.runs;
}

// --- Validitas penempatan (§7.2) ---
function corridorLocked(col, row) {
  // Sel koridor hanya bisa dibangun bila fork-nya memilih CRYSTAL.
  for (const f of s.world.forks.values()) {
    const inCorridor =
      (f.col === col && f.branchRow === row) ||
      (f.col + 1 === col && f.branchRow === row) ||
      (f.col + 2 === col && f.branchRow === row);
    if (inCorridor) return f.choice !== 'crystal';
  }
  return false;
}

function pieceConnects(piece, rot, fromDir) {
  // fromDir: arah dari sel baru ke head ('E' berarti head ada di timur sel baru).
  // Kembalikan true bila piece punya sisi yang menghadap head.
  if (piece === 'straight') {
    const sides = rot === 0 ? ['E', 'W'] : ['N', 'S'];
    return sides.includes(fromDir);
  }
  if (piece === 'bridge') {
    const sides = rot === 0 ? ['E', 'W'] : ['N', 'S'];
    return sides.includes(fromDir);
  }
  if (piece === 'curve') {
    const sides = [
      ['W', 'N'], // rot 0
      ['N', 'E'], // rot 1
      ['E', 'S'], // rot 2
      ['S', 'W'], // rot 3
    ][rot];
    return sides.includes(fromDir);
  }
  if (piece === 'junction') return true; // geometri ditentukan fork site
  return false;
}

function canPlace(piece, rot, col, row) {
  const h = head();
  if (!h) return { ok: false };
  const dc = col - h.col;
  const dr = row - h.row;
  if (Math.abs(dc) + Math.abs(dr) !== 1) return { ok: false };
  if (dc < 0) return { ok: false }; // tidak pernah mundur ke barat
  if (row < 0 || row >= GRID_ROWS) return { ok: false };
  const key = cellKey(col, row);
  if (pathSet().has(key)) return { ok: false };
  if (s.world.sealedCells().has(key)) return { ok: false };
  if (corridorLocked(col, row)) return { ok: false };
  const fork = s.world.forkAt(col, row);
  const isChasm = s.world.hasChasm(col, row);
  const isRock = s.world.hasRock(col, row);
  if (isRock) return { ok: false };
  if (piece === 'junction') {
    if (!fork || fork.placed) return { ok: false };
  } else if (piece === 'bridge') {
    if (!isChasm) return { ok: false };
  } else {
    if (isChasm) return { ok: false };
  }
  // Bila junction menunggu pilihan, hanya 2 sel cabang yang valid.
  if (s.pendingFork) {
    const f = s.pendingFork;
    const isDirect = col === f.col + 1 && row === f.row;
    const isTurn = col === f.col && row === f.branchRow;
    if (!isDirect && !isTurn) return { ok: false };
  }
  const fromDir = dirOf({ col, row }, h); // arah dari sel baru ke head
  if (!pieceConnects(piece, rot, fromDir)) return { ok: false };
  const price = s.economy.railPrice(piece);
  if (s.economy.lumen < price) return { ok: false, price };
  return { ok: true, price };
}

function updateGhost() {
  if (s.screen !== 'play' || !s.hover) {
    s.ghost = null;
    return;
  }
  const { col, row } = s.hover;
  // Hover rock -> bulldoze.
  if (s.world.hasRock(col, row)) {
    s.ghost = { col, row, kind: 'doze', price: PRICES.doze, valid: s.economy.lumen >= PRICES.doze };
    return;
  }
  // Junction menunggu pilihan: panah cabang.
  if (s.pendingFork) {
    const f = s.pendingFork;
    if (col === f.col + 1 && row === f.row) {
      s.ghost = { col, row, kind: 'arrow-direct', price: 0, valid: true };
      return;
    }
    if (col === f.col && row === f.branchRow) {
      s.ghost = { col, row, kind: 'arrow-crystal', price: 0, valid: true };
      return;
    }
    s.ghost = { col, row, kind: 'none', price: 0, valid: false };
    return;
  }
  const chk = canPlace(s.selectedPiece, s.ghostRot, col, row);
  s.ghost = {
    col, row,
    kind: s.selectedPiece,
    price: chk.price !== undefined ? chk.price : s.economy.railPrice(s.selectedPiece),
    valid: chk.ok,
  };
}

function placePiece(col, row) {
  const chk = canPlace(s.selectedPiece, s.ghostRot, col, row);
  if (!chk.ok) {
    s.sound.error();
    return false;
  }
  if (!s.economy.spend(chk.price)) {
    s.sound.error();
    return false;
  }
  const cell = { col, row, kind: s.selectedPiece, rot: s.ghostRot };
  s.path.push(cell);
  s._pathSet = null;
  const fork = s.world.forkAt(col, row);
  if (s.selectedPiece === 'junction' && fork) {
    fork.placed = true;
    s.pendingFork = fork;
  } else if (fork && !fork.placed) {
    // Rel biasa di fork site: jalur langsung, koridor tersegel.
    fork.choice = 'direct';
  }
  // Kunci pilihan cabang bila ini rel pertama setelah junction.
  if (s.pendingFork && s.selectedPiece !== 'junction') {
    const f = s.pendingFork;
    if (col === f.col + 1 && row === f.row) f.choice = 'direct';
    else if (col === f.col && row === f.branchRow) f.choice = 'crystal';
    s.pendingFork = null;
  }
  const c = cellCenter(col, row, s.camCol);
  s.fx.dust(c.x, c.y);
  s.sound.clack();
  updateRailAhead();
  updateGhost();
  return true;
}

function bulldoze(col, row) {
  if (!s.world.hasRock(col, row)) return false;
  if (!s.economy.spend(PRICES.doze)) {
    s.sound.error();
    return false;
  }
  s.world.rocks.delete(cellKey(col, row));
  const c = cellCenter(col, row, s.camCol);
  s.fx.burst(c.x, c.y, '#a8a8a8', 12, 120);
  s.sound.clack();
  updateGhost();
  return true;
}

function useBoost() {
  if (s.economy.boost <= 0) {
    s.sound.error();
    return;
  }
  s.economy.boost--;
  s.economy.toolsUsed++;
  s.boostsUsed++;
  s.boostTimer = boostDuration();
  s.sound.boost();
  const p = trainScreenPos();
  s.fx.burst(p.x, p.y, '#ffd166', 14, 140);
}

function useShield() {
  if (s.economy.shield <= 0) {
    s.sound.error();
    return;
  }
  s.economy.shield--;
  s.economy.toolsUsed++;
  s.shieldsUsed++;
  s.shieldTimer = shieldDuration();
  s.sound.shield();
  const p = trainScreenPos();
  s.fx.burst(p.x, p.y, '#b388ff', 14, 120);
}

function rotateGhost() {
  if (s.selectedPiece === 'curve') {
    s.ghostRot = (s.ghostRot + 1) % 4;
  } else if (s.selectedPiece === 'straight' || s.selectedPiece === 'bridge') {
    s.ghostRot = (s.ghostRot + 1) % 2;
  }
  // Junction tidak diputar (geometri ditentukan fork site).
  s.sound.click();
  updateGhost();
}

// --- Update per frame (play) ---
function update(dt) {
  s.runTime += dt;
  s.stageTime += dt;
  if (s.boostTimer > 0) s.boostTimer -= dt;
  if (s.shieldTimer > 0) s.shieldTimer -= dt;

  // Kecepatan kereta.
  const base = trainSpeedBase();
  const mult = s.boostTimer > 0 ? boostMult() : 1;
  const speed = base * mult;
  s.currentSpeed = speed;

  // Kereta maju selama ada rel di depan; kehabisan rel -> stall.
  const maxPos = s.pathStartTile + s.path.length - 1;
  if (s.trainPos < maxPos) {
    s.trainPos = Math.min(maxPos, s.trainPos + speed * dt);
  } else {
    s.stalledEver = true;
  }

  // Kristal: ambil yang dilewati kereta.
  const idx = pathIdx();
  while (s.collectedIdx < idx) {
    s.collectedIdx++;
    const cell = s.path[s.collectedIdx];
    if (!cell) break;
    if (s.world.hasCrystal(cell.col, cell.row)) {
      s.world.crystals.delete(cellKey(cell.col, cell.row));
      const c = s.economy.collectCrystal();
      const p = cellCenter(cell.col, cell.row, s.camCol);
      s.fx.sparkle(p.x, p.y);
      s.fx.floater(p.x, p.y - 20, '+' + c.value, '#19c3d6');
      s.sound.crystal();
      // CRYSTAL CHAIN (revisi 2, item 2): skor saja — popup + chime saat
      // multiplier >= 2; sparkle ekstra saat >= 3. Lumen TIDAK berubah.
      if (c.mult >= 2) {
        s.fx.floater(p.x, p.y - 44, 'CHAIN x' + c.mult, '#b97d10');
        s.sound.chime();
        if (c.mult >= 3) s.fx.burst(p.x, p.y, '#ffd166', 8, 90);
      }
    } else {
      // Sel tanpa kristal: chain putus (stasiun tidak mereset).
      s.economy.breakChain();
    }
    // Fork dilewati tanpa junction: koridor terkunci (memudar).
    const fork = s.world.forkAt(cell.col, cell.row);
    if (fork && !fork.placed && fork.choice === null) fork.choice = 'direct';
  }

  // Void maju (beku saat Shield aktif). Kecepatan Void = base + difficulty
  // delta; VOID TIDE mengalikannya x1.3 selama 5 detik.
  if (s.shieldTimer <= 0) {
    const voidSpeed = (s.stageDef.void + s.voidDelta) * (s.tide.active ? TIDE_MULT : 1);
    s.voidPos += voidSpeed * dt;
  }
  s.gap = s.trainPos - s.voidPos;
  if (s.gap < s.minGap) s.minGap = s.gap;

  // VOID TIDE berakhir.
  if (s.tide.active && s.stageTime >= s.tide.until) {
    s.tide.active = false;
    s.tideWarn = false;
  }

  // Surge (Stage 5 dan endless): t=20 dan t=40 waktu stage.
  // Revisi 2: Surge #2 (t=40) DIGANTI VOID TIDE — Void x1.3 selama 5 detik,
  // bukan lompatan instan. Biaya gap Tide = 3 tile, sama dengan Surge.
  if (s.stage >= 5) {
    for (const tt of [SURGE_INTERVAL, SURGE_INTERVAL * 2]) {
      const isTide = tt === TIDE_TIME;
      if (!s.surgeWarned[tt] && s.stageTime >= tt - SURGE_TELEGRAPH) {
        s.surgeWarned[tt] = true;
        if (isTide) {
          s.tideWarn = true;
          s.tide.warned = true;
        } else {
          s.surgeWarn = true;
        }
        s.sound.alarm();
      }
      if (!s.surgeFired[tt] && s.stageTime >= tt) {
        s.surgeFired[tt] = true;
        if (isTide) {
          s.tideWarn = false;
          if (s.shieldTimer > 0) {
            s.fx.floater(640, 200, 'VOID TIDE BLOCKED!', '#b388ff');
          } else {
            s.tide.active = true;
            s.tide.until = s.stageTime + TIDE_DUR;
            s.fx.burst(120, 300, '#b388ff', 20, 160);
            s.sound.alarm();
          }
        } else {
          s.surgeWarn = false;
          if (s.shieldTimer > 0) {
            s.fx.floater(640, 200, 'SURGE BLOCKED!', '#b388ff');
          } else {
            s.voidPos += SURGE_JUMP;
            s.gap = s.trainPos - s.voidPos;
            s.fx.burst(120, 300, '#b388ff', 20, 160);
            s.sound.alarm();
          }
        }
      }
    }
  }

  // Asap kereta berkala.
  if (Math.random() < dt * 3) {
    const p = trainScreenPos();
    s.fx.smoke(p.x - 20, p.y - 30);
  }

  // Menang didahulukan atas kalah di tile 300: mencapai DAWN TERMINUS pada
  // frame yang sama dengan gap menyentuh 0 = MENANG (outline §3).
  if (s.mode === 'standard' && s.trainPos >= TOTAL_TILES) {
    winGame();
    return;
  }

  // Kalah?
  if (s.gap <= 0) {
    const stalled = s.trainPos >= maxPos - 0.001;
    loseGame(stalled ? 'OUT OF RAIL' : 'GAP CLOSED');
    return;
  }

  // Stasiun.
  if (s.trainPos >= s.nextStationAt && s.trainPos < TOTAL_TILES) {
    toStation();
    return;
  }
  if (s.mode === 'endless' && s.trainPos >= s.nextStationAt) {
    toStation();
    return;
  }

  s.world.ensureWorld(trainColNow() + 40, s.economy.hasBoon('crystal-sense'));
  updateRailAhead();
}

// --- Input ---
function handleClick(x, y) {
  s.sound.ensure();
  if (s.screen === 'title') {
    const hit = hitUI(s.ui, x, y);
    if (hit) {
      if (hit.id === 'mode:standard') {
        s.mode = 'standard';
        s.sound.click();
        return;
      }
      if (hit.id === 'mode:endless') {
        if (!s.unlockedEndless) {
          s.sound.error();
          return;
        }
        s.mode = 'endless';
        s.sound.click();
        return;
      }
      // Difficulty (revisi 2, item 3): pilih, jangan mulai.
      if (hit.id.startsWith('diff:')) {
        s.difficulty = hit.id.slice(5);
        s.sound.click();
        return;
      }
    }
    // Mulai dengan seed yang DITAMPILKAN di title (item 6): newRun memakai
    // s.seed yang sama, jadi seed di title = seed run yang dimainkan.
    newRun(s.mode, s.seed);
    startPlay();
    return;
  }
  if (s.screen === 'station') {
    const hit = hitUI(s.ui, x, y);
    if (!hit) return;
    if (hit.id === 'continue') {
      continueFromStation();
      s.sound.click();
    } else if (hit.id.startsWith('draft:')) {
      const id = hit.id.slice(6);
      if (id !== 'none' && s.economy.pickBoon(id)) s.sound.coin();
      else s.sound.error();
    } else if (hit.id === 'reroll') {
      if (s.economy.rerollDraft(s.rng)) s.sound.coin();
      else s.sound.error();
    } else if (hit.id.startsWith('shop:')) {
      const id = hit.id.slice(5);
      if (s.economy.buyShop(id)) s.sound.coin();
      else s.sound.error();
    }
    return;
  }
  if (s.screen === 'win') {
    const hit = hitUI(s.ui, x, y);
    if (hit && hit.id === 'endless') {
      // Lanjut endless dari tile 300 (state run dipertahankan).
      s.mode = 'endless';
      s.endlessSeg = 1;
      s.stage = 6;
      s.nextStationAt = 350;
      s.stageDef = stageDefFor(6, 1);
      s.stageTime = 0;
      s.surgeFired = {};
      s.surgeWarned = {};
      s.surgeWarn = false;
      s.tideWarn = false;
      s.tide = { warned: false, active: false, until: 0 };
      s.gap = startGapFor(s.stageDef);
      s.voidPos = s.trainPos - s.gap;
      s.world.ensureWorld(trainColNow() + 60, s.economy.hasBoon('crystal-sense'));
      // Reset patokan statistik stage (pola beginStage) agar stasiun endless
      // pertama tidak mencakup sisa Stage 5 (m-4).
      s.stageStart = {
        pathLen: s.path.length,
        crystals: s.economy.crystalsCollected,
        lumenEarned: s.economy.lumenEarned,
        toolsUsed: s.economy.toolsUsed,
      };
      s.screen = 'play';
      s.sound.click();
      return;
    }
    if (hit && hit.id === 'restart') {
      newRun('standard');
      startPlay();
      return;
    }
    // SAME SEED (revisi 3, item 6): replay seed yang sama — dunia + draft
    // identik (deterministik dari seed).
    if (hit && hit.id === 'same-seed') {
      newRun('standard', s.seed);
      startPlay();
      return;
    }
    return;
  }
  if (s.screen === 'lose') {
    const hit = hitUI(s.ui, x, y);
    if (hit && hit.id === 'retry') {
      newRun(s.mode);
      startPlay();
    }
    // SAME SEED (revisi 3, item 6).
    if (hit && hit.id === 'same-seed') {
      newRun(s.mode, s.seed);
      startPlay();
    }
    return;
  }
  if (s.screen === 'paused') return; // klik di pause tidak melakukan apa-apa
  if (s.screen !== 'play') return;

  const hit = hitUI(s.ui, x, y);
  if (hit) {
    if (hit.id.startsWith('piece:')) {
      s.selectedPiece = hit.id.slice(6);
      s.ghostRot = 0;
      s.sound.click();
      updateGhost();
      return;
    }
    if (hit.id === 'tool:boost') {
      useBoost();
      return;
    }
    if (hit.id === 'tool:shield') {
      useShield();
      return;
    }
    return;
  }
  // Klik grid.
  const cell = screenToCell(x, y, s.camCol);
  if (!cell) {
    s.hover = null;
    updateGhost();
    return;
  }
  // Panah pilihan junction.
  if (s.pendingFork) {
    const f = s.pendingFork;
    if (cell.col === f.col + 1 && cell.row === f.row) {
      f.choice = 'direct';
      s.pendingFork = null;
      s.sound.click();
      updateGhost();
      return;
    }
    if (cell.col === f.col && cell.row === f.branchRow) {
      f.choice = 'crystal';
      s.pendingFork = null;
      s.sound.click();
      updateGhost();
      return;
    }
    return;
  }
  // Rock -> bulldoze.
  if (s.world.hasRock(cell.col, cell.row)) {
    bulldoze(cell.col, cell.row);
    return;
  }
  // Pasang rel + mulai drag.
  if (placePiece(cell.col, cell.row)) {
    s.dragging = true;
    s.dragLast = cell;
  }
}

function handleMove(x, y) {
  if (s.screen !== 'play') return;
  const cell = screenToCell(x, y, s.camCol);
  s.hover = cell;
  updateGhost();
  if (s.dragging && cell && s.selectedPiece === 'straight') {
    if (!s.dragLast || s.dragLast.col !== cell.col || s.dragLast.row !== cell.row) {
      if (placePiece(cell.col, cell.row)) {
        s.dragLast = cell;
      } else {
        s.dragging = false;
      }
    }
  }
}

function handleUp() {
  s.dragging = false;
  s.dragLast = null;
}

function handleKey(key) {
  s.sound.ensure();
  if (key === 'm' || key === 'M') {
    s.sound.toggleMute();
    return;
  }
  if (s.screen === 'title') {
    if (key === 'Enter' || key === ' ') {
      // Seed yang ditampilkan di title = seed run yang dimainkan (item 6).
      newRun(s.mode, s.seed);
      startPlay();
    }
    // Difficulty (revisi 2, item 3): 1/2/3 = GENTLE/STANDARD/DAWNSEEKER.
    else if (key === '1' || key === '2' || key === '3') {
      s.difficulty = DIFFICULTY_ORDER[parseInt(key, 10) - 1];
      s.sound.click();
    }
    return;
  }
  if (s.screen === 'station') {
    if (key === 'Enter' || key === ' ') continueFromStation();
    else if (key === 'r' || key === 'R') {
      newRun(s.mode);
      startPlay();
    }
    return;
  }
  if (s.screen === 'win') {
    if (key === 'r' || key === 'R' || key === 'Enter') {
      newRun('standard');
      startPlay();
    }
    // SAME SEED (revisi 3, item 6): 'S' replay seed yang sama.
    else if (key === 's' || key === 'S') {
      newRun('standard', s.seed);
      startPlay();
    }
    return;
  }
  if (s.screen === 'lose') {
    if (key === 'r' || key === 'R' || key === 'Enter') {
      newRun(s.mode);
      startPlay();
    }
    // SAME SEED (revisi 3, item 6): 'S' replay seed yang sama.
    else if (key === 's' || key === 'S') {
      newRun(s.mode, s.seed);
      startPlay();
    }
    return;
  }
  if (key === 'p' || key === 'P') {
    s.screen = s.screen === 'play' ? 'paused' : s.screen === 'paused' ? 'play' : s.screen;
    return;
  }
  if (s.screen === 'paused') {
    if (key === 'r' || key === 'R') {
      newRun(s.mode);
      startPlay();
    }
    return;
  }
  if (s.screen !== 'play') return;
  if (key === ' ') {
    useBoost();
    return;
  }
  if (key === 'q' || key === 'Q') {
    useShield();
    return;
  }
  if (key === 'r' || key === 'R') {
    rotateGhost();
    return;
  }
  if (key === 'x' || key === 'X') {
    if (s.hover && s.world.hasRock(s.hover.col, s.hover.row)) bulldoze(s.hover.col, s.hover.row);
    return;
  }
  const piece = PIECE_ORDER.find((id) => {
    const k = { straight: '1', curve: '2', junction: '3', bridge: '4' }[id];
    return k === key;
  });
  if (piece) {
    s.selectedPiece = piece;
    s.ghostRot = 0;
    s.sound.click();
    updateGhost();
  }
}

attachInput(canvas, {
  onPointer: handleClick,
  onMove: handleMove,
  onUp: handleUp,
  onRightClick: () => {
    if (s.screen === 'play') rotateGhost();
  },
  onKey: handleKey,
});

// --- Loop utama ---
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seedParam = parseInt(params.get('seed') || '', 10);
if (shotName) {
  newRun('standard');
  if (Number.isInteger(seedParam) && seedParam > 0) {
    s.seed = seedParam;
    s.rng = mulberry32(seedParam);
    s.world = new World(seedParam);
    // Bangun ulang yard dengan seed shot (dunia deterministik).
    s.path = [];
    for (let c = 0; c < START_RAIL; c++) {
      s.path.push({ col: c, row: 2, kind: c === 0 ? 'start' : 'straight', rot: 0 });
    }
    s._pathSet = null;
    s.world.ensureWorld(340, false);
  }
  setupShot(s, shotName);
  updateCamCol();
  updateRailAhead();
  drawScene(ctx, s, 1.7);
  window.__shotReady = true;
} else {
  newRun('standard');
  let last = performance.now();
  function frame(now) {
    try {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      s.t += dt;
      if (s.screen === 'play') update(dt);
      s.fx.update(dt);
      updateCamCol();
      updateRailAhead();
      drawScene(ctx, s, s.t);
    } catch (err) {
      window.__err = String(err && err.message ? err.message : err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
