// LAST RAIL — adegan screenshot yang deterministik (?shot=<nama>).
// Setiap adegan dirender oleh kode game yang sama (bukan gambar tempelan):
// state dibuat dari seed tetap, waktu dibekukan, lalu satu frame digambar.
// Dipakai untuk 4 screenshot: cover (gameplay langsung), title, play, nightend.
import {
  STAGES, START_RAIL, PRICES, BOONS, mulberry32, COVER_VIEW_COL, TRAIN_VIEW_COL,
} from './config.js';
import { cellKey } from './levels.js';

const DIRS = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };
const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };

function dirOf(a, b) {
  if (b.col > a.col) return 'E';
  if (b.col < a.col) return 'W';
  if (b.row > a.row) return 'S';
  return 'N';
}

const CURVE_ROT = {
  'W,N': 0, 'N,W': 0,
  'N,E': 1, 'E,N': 1,
  'E,S': 2, 'S,E': 2,
  'S,W': 3, 'W,S': 3,
};

// Perpanjang path dengan random walk deterministik (mayoritas ke timur,
// kadang belok utara/selatan di main band). Tidak pernah ke barat,
// tidak pernah mengunjungi sel yang sama dua kali.
function wanderPath(s, targetLen, rng) {
  const path = s.path;
  const used = new Set(path.map((c) => cellKey(c.col, c.row)));
  let guard = 0;
  while (path.length < targetLen && guard++ < 5000) {
    const h = path[path.length - 1];
    const prev = path.length > 1 ? path[path.length - 2] : null;
    const r = rng();
    let dir;
    if (r < 0.68) dir = 'E';
    else if (r < 0.84) dir = 'N';
    else dir = 'S';
    const [dx, dy] = DIRS[dir];
    const nc = h.col + dx;
    const nr = h.row + dy;
    // Jangan keluar grid; belok vertikal hanya di main band (kecuali 25%).
    const inMain = nr >= 1 && nr <= 3;
    if (nr < 0 || nr > 4) dir = 'E';
    else if (!inMain && rng() > 0.25) dir = 'E';
    const [fx, fy] = DIRS[dir];
    const tc = h.col + fx;
    const tr = h.row + fy;
    // Jangan kembali ke sel sebelumnya.
    if (prev && tc === prev.col && tr === prev.row) {
      dir = 'E';
    }
    const [gx, gy] = DIRS[dir];
    const cc = h.col + gx;
    const cr = h.row + gy;
    if (used.has(cellKey(cc, cr))) {
      // Fallback: lurus ke timur (selalu kosong).
      const ec = h.col + 1;
      if (used.has(cellKey(ec, h.row))) break;
      path.push({ col: ec, row: h.row, kind: 'straight', rot: 0 });
      used.add(cellKey(ec, h.row));
      continue;
    }
    path.push({ col: cc, row: cr, kind: 'straight', rot: 0 });
    used.add(cellKey(cc, cr));
  }
  // Tentukan kind/rot tiap sel dari tetangganya.
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    const dIn = dirOf(b, a); // arah dari sel ke sel sebelumnya
    const dOut = dirOf(b, c); // arah dari sel ke sel berikut
    if (dIn === OPP[dOut]) {
      b.kind = 'straight';
      b.rot = (dIn === 'E' || dIn === 'W') ? 0 : 1;
    } else {
      b.kind = 'curve';
      b.rot = CURVE_ROT[dIn + ',' + dOut] ?? 0;
    }
  }
  const last = path[path.length - 1];
  const before = path[path.length - 2];
  if (last && before) {
    const d = dirOf(last, before);
    last.kind = 'straight';
    last.rot = (d === 'E' || d === 'W') ? 0 : 1;
  }
  return path;
}

// Bersihkan obstacle/kristal yang menumpuk di atas path yang di-stage,
// lalu tempatkan kristal di sepanjang path.
function cleanPath(s, crystalEvery = 12) {
  const pathCells = new Set(s.path.map((c) => cellKey(c.col, c.row)));
  for (const k of [...s.world.rocks]) if (pathCells.has(k)) s.world.rocks.delete(k);
  for (const k of [...s.world.chasms]) if (pathCells.has(k)) s.world.chasms.delete(k);
  s.world.crystals.clear();
  for (let i = 14; i < s.path.length; i += crystalEvery) {
    const c = s.path[i];
    s.world.crystals.add(cellKey(c.col, c.row));
  }
  // Beberapa kristal di luar jalur (bonus rute memutar).
  for (let i = 20; i < s.path.length; i += 29) {
    const c = s.path[i];
    const r2 = c.row === 1 ? 4 : c.row === 3 ? 0 : 1;
    s.world.crystals.add(cellKey(c.col + 1, r2));
  }
}

// Ghost di sel kosong yang TERLIHAT di viewport (dekat kereta, bersebelahan
// dengan jalur bila mungkin) — ghost di depan head (ujung path) selalu di
// luar layar karena head 12-15 sel di depan kereta.
function placeVisibleGhost(s) {
  const pathCells = new Set(s.path.map((c) => cellKey(c.col, c.row)));
  const trainCol = s.path[Math.floor(s.trainPos)].col;
  const isFree = (col, row) => {
    const k = cellKey(col, row);
    if (pathCells.has(k)) return false;
    if (s.world.rocks.has(k) || s.world.chasms.has(k) || s.world.crystals.has(k)) return false;
    if (s.world.forks.has(k) || s.world.sealedCells().has(k)) return false;
    return true;
  };
  const adjacentToPath = (col, row) =>
    pathCells.has(cellKey(col + 1, row)) || pathCells.has(cellKey(col - 1, row)) ||
    pathCells.has(cellKey(col, row + 1)) || pathCells.has(cellKey(col, row - 1));
  for (let pass = 0; pass < 2; pass++) {
    for (let dc = 2; dc <= 7; dc++) {
      for (let row = 0; row < 5; row++) {
        const col = trainCol + dc;
        if (!isFree(col, row)) continue;
        if (pass === 0 && !adjacentToPath(col, row)) continue;
        s.hover = { col, row };
        s.selectedPiece = 'curve';
        s.ghostRot = 1;
        s.ghost = { col, row, kind: 'curve', price: 2, valid: true };
        return;
      }
    }
  }
}

function stagePlay(s, { stage, trainPos, lumen, gap, boost, shield, pathLen, viewCol, junctionAt }) {
  s.screen = 'play';
  s.stage = stage;
  s.stageDef = STAGES[stage - 1];
  s.trainPos = trainPos;
  s.viewCol = viewCol;
  s.economy.lumen = lumen;
  s.economy.boost = boost;
  s.economy.shield = shield;
  s.gap = gap;
  s.voidPos = trainPos - gap;
  s.railAhead = pathLen - 1 - Math.floor(trainPos);
  s.collectedIdx = Math.floor(trainPos);
  s.stageTime = 23;
  if (junctionAt !== undefined && s.path[junctionAt]) {
    const cell = s.path[junctionAt];
    cell.kind = 'junction';
    const branchRow = cell.row === 1 ? 0 : cell.row === 3 ? 4 : 0;
    s.world.forks.set(cellKey(cell.col, cell.row), {
      col: cell.col, row: cell.row, branchRow,
      joinCol: cell.col + 2, joinRow: cell.row,
      choice: null, placed: true,
    });
    s.world.corridorCells.add(cellKey(cell.col, branchRow));
    s.world.corridorCells.add(cellKey(cell.col + 1, branchRow));
    s.world.corridorCells.add(cellKey(cell.col + 2, branchRow));
  }
}

export function setupShot(s, name) {
  s.shotMode = true;
  s.best = s.best || 0;
  const rng = mulberry32(1000 + s.seed);

  if (name === 'title') {
    s.screen = 'title';
    s.best = 1615; // skor MENANG bot pengejar-kristal revisi 1 (bukan angka contoh)
    s.unlockedEndless = false;
    s.mode = 'standard';
    return;
  }

  if (name === 'nightend') {
    // Layar STATION setelah Stage 2 (nama adegan dipertahankan dari pola
    // ?shot= SUNSET STALL; isinya layar Station §9.3).
    // ANGKA NYATA dari bot pengejar-kristal revisi 1 (MENANG tile 300):
    // Stage 2: waktu 0:47, 50 tile, 20 kristal, 60 LUMEN diperoleh, 1 alat
    // dipakai; Lumen di stasiun (setelah delivery +30) = 71.
    s.screen = 'station';
    s.stage = 2;
    s.stageDef = STAGES[1];
    s.stageStats = { time: '0:47', tiles: 50, crystals: 20, lumenEarned: 60, toolsUsed: 1 };
    s.lastDelivery = 30;
    s.economy.lumen = 71;
    s.economy.boost = 1;
    s.economy.shield = 0;
    s.economy.draftOffer = [BOONS[0], BOONS[3], BOONS[2]]; // IRON RAILS, VOID WARD, SWIFT ENGINE
    s.economy.draftPicked = false;
    s.economy.rerolled = false;
    return;
  }

  if (name === 'play') {
    // Stage 2 STONE CUT: rock terlihat, HUD lengkap, ghost Curve + tag 2.
    s.path = [];
    for (let c = 0; c < START_RAIL; c++) {
      s.path.push({ col: c, row: 2, kind: c === 0 ? 'start' : 'straight', rot: 0 });
    }
    wanderPath(s, 86, rng);
    cleanPath(s, 11);
    // Rock yang terlihat di viewport (depan kereta).
    const trainCol = s.path[73].col;
    s.world.rocks.add(cellKey(trainCol + 8, 1));
    stagePlay(s, {
      stage: 2, trainPos: 73, lumen: 45, gap: 6,
      boost: 1, shield: 0, pathLen: s.path.length, viewCol: COVER_VIEW_COL,
    });
    // Ghost Curve di sel kosong yang terlihat di viewport, tag harga 2.
    placeVisibleGhost(s);
    return;
  }

  // cover (default): Stage 3 JUNCTION, kereta tile ~126, Lumen 45, gap 6.
  s.path = [];
  for (let c = 0; c < START_RAIL; c++) {
    s.path.push({ col: c, row: 2, kind: c === 0 ? 'start' : 'straight', rot: 0 });
  }
  wanderPath(s, 136, rng);
  cleanPath(s, 8);
  stagePlay(s, {
    stage: 3, trainPos: 126, lumen: 45, gap: 6,
    boost: 0, shield: 1, pathLen: s.path.length, viewCol: COVER_VIEW_COL,
    junctionAt: 130,
  });
  // Ghost Curve di sel kosong yang terlihat di viewport, tag harga 2.
  placeVisibleGhost(s);
}
