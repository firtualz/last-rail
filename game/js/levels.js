// LAST RAIL — dunia: generator seeded untuk kristal, rock, chasm, fork site.
// Aturan penempatan (outline §9.1, W-4): rock >=3 kolom antar rock, tidak
// pernah di sel kristal; chasm tepat 1 sel, tidak menutup 3 baris main band;
// fork site >=4 kolom dari obstacle mana pun, koridornya bebas rock/chasm.
// Kristal: 9 per 10 kolom (10 dengan CRYSTAL SENSE), berkelompok 2-3,
// 80% di main band. Semua deterministik per seed — screenshot seed=1
// selalu menghasilkan dunia yang sama.
import { STAGES, MAIN_BAND, GRID_ROWS, CRYSTALS_PER_BLOCK, mulberry32 } from './config.js';

export function cellKey(col, row) {
  return col + ',' + row;
}

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.crystals = new Set(); // "col,row"
    this.rocks = new Set();
    this.chasms = new Set();
    this.forks = new Map(); // key -> {col,row,branchRow,joinCol,joinRow,choice,placed}
    this.corridorCells = new Set(); // sel koridor kristal (terkunci tanpa junction)
    this.genBlocks = new Set();
    this.genStages = new Set();
    this.genSegments = new Set();
  }

  rngFor(tag, idx) {
    return mulberry32((this.seed ^ Math.imul(tag, 2654435761) ^ Math.imul(idx + 1, 40503)) >>> 0);
  }

  hasCrystal(col, row) {
    return this.crystals.has(cellKey(col, row));
  }
  hasRock(col, row) {
    return this.rocks.has(cellKey(col, row));
  }
  hasChasm(col, row) {
    return this.chasms.has(cellKey(col, row));
  }
  forkAt(col, row) {
    return this.forks.get(cellKey(col, row)) || null;
  }
  isCorridor(col, row) {
    return this.corridorCells.has(cellKey(col, row));
  }

  // --- Kristal per blok 10 kolom ---
  genCrystalBlock(blockIdx, crystalSense) {
    if (this.genBlocks.has(blockIdx)) return;
    this.genBlocks.add(blockIdx);
    const rng = this.rngFor(11, blockIdx);
    const start = blockIdx * 10;
    const target = CRYSTALS_PER_BLOCK + (crystalSense ? 1 : 0);
    const usedCols = new Set();
    let placed = 0;
    let guard = 0;
    while (placed < target && guard++ < 60) {
      const size = Math.min(target - placed, 2 + Math.floor(rng() * 2)); // 2-3
      const col0 = start + Math.floor(rng() * (10 - size + 1));
      let ok = true;
      for (let c = col0; c < col0 + size; c++) if (usedCols.has(c)) ok = false;
      if (!ok) continue;
      for (let c = col0; c < col0 + size; c++) {
        usedCols.add(c);
        const row = rng() < 0.8
          ? MAIN_BAND[Math.floor(rng() * MAIN_BAND.length)]
          : (rng() < 0.5 ? 0 : GRID_ROWS - 1);
        this.crystals.add(cellKey(c, row));
        placed++;
      }
    }
  }

  // --- Obstacle per stage ---
  genStageObstacles(stageIdx) {
    if (this.genStages.has(stageIdx)) return;
    this.genStages.add(stageIdx);
    const def = STAGES[stageIdx];
    const rng = this.rngFor(23, stageIdx);
    const lo = def.start + 4;
    const hi = def.end - 4;
    // 1) Fork site dulu (koridornya harus bebas rock/chasm).
    for (let i = 0; i < def.forks; i++) this.placeFork(rng, lo, hi);
    // 2) Rock.
    for (let i = 0; i < def.rocks; i++) this.placeRock(rng, lo, hi);
    // 3) Chasm.
    for (let i = 0; i < def.chasms; i++) this.placeChasm(rng, lo, hi);
  }

  // Segmen endless k (k=1,2,...): kolom [200+50k, 250+50k).
  genEndlessSegment(k) {
    if (this.genSegments.has(k)) return;
    this.genSegments.add(k);
    const rng = this.rngFor(31, k);
    const lo = 200 + 50 * k + 4;
    const hi = 250 + 50 * k - 4;
    this.placeFork(rng, lo, hi);
    for (let i = 0; i < 2; i++) this.placeRock(rng, lo, hi);
    for (let i = 0; i < 2; i++) this.placeChasm(rng, lo, hi);
  }

  obstacleNear(col, minDist) {
    const near = (set) => {
      for (const k of set) {
        const c = parseInt(k.split(',')[0], 10);
        if (Math.abs(c - col) < minDist) return true;
      }
      return false;
    };
    if (near(this.rocks) || near(this.chasms)) return true;
    for (const f of this.forks.values()) {
      if (Math.abs(f.col - col) < minDist) return true;
    }
    return false;
  }

  placeFork(rng, lo, hi) {
    for (let tries = 0; tries < 120; tries++) {
      const col = lo + Math.floor(rng() * Math.max(1, hi - lo));
      const row = MAIN_BAND[Math.floor(rng() * MAIN_BAND.length)];
      if (this.hasCrystal(col, row) || this.hasRock(col, row) || this.hasChasm(col, row)) continue;
      if (this.forkAt(col, row)) continue;
      if (this.obstacleNear(col, 4)) continue;
      const branchRow = row === 1 ? 0 : row === 3 ? GRID_ROWS - 1 : (rng() < 0.5 ? 0 : GRID_ROWS - 1);
      // Koridor: belok ke baris luar, sejajar 2 kolom, gabung kembali.
      const corridor = [
        cellKey(col, branchRow),
        cellKey(col + 1, branchRow),
        cellKey(col + 2, branchRow),
      ];
      // Koridor tidak boleh bersinggungan dengan rock/chasm.
      let ok = true;
      for (const k of corridor) {
        if (this.rocks.has(k) || this.chasms.has(k)) ok = false;
      }
      if (!ok) continue;
      this.forks.set(cellKey(col, row), {
        col, row, branchRow, joinCol: col + 2, joinRow: row,
        choice: null, placed: false,
      });
      for (const k of corridor) this.corridorCells.add(k);
      // Bonus: klaster kristal di koridor.
      this.crystals.add(cellKey(col + 1, branchRow));
      this.crystals.add(cellKey(col + 2, branchRow));
      return true;
    }
    return false;
  }

  placeRock(rng, lo, hi) {
    for (let tries = 0; tries < 120; tries++) {
      const col = lo + Math.floor(rng() * Math.max(1, hi - lo));
      const row = MAIN_BAND[Math.floor(rng() * MAIN_BAND.length)];
      const key = cellKey(col, row);
      if (this.hasCrystal(col, row) || this.rocks.has(key) || this.hasChasm(col, row)) continue;
      if (this.forkAt(col, row) || this.isCorridor(col, row)) continue;
      if (this.obstacleNear(col, 3)) continue; // rock >=3 kolom antar rock
      this.rocks.add(key);
      return true;
    }
    return false;
  }

  placeChasm(rng, lo, hi) {
    for (let tries = 0; tries < 120; tries++) {
      const col = lo + Math.floor(rng() * Math.max(1, hi - lo));
      const row = MAIN_BAND[Math.floor(rng() * MAIN_BAND.length)];
      const key = cellKey(col, row);
      if (this.hasCrystal(col, row) || this.chasms.has(key) || this.hasRock(col, row)) continue;
      if (this.forkAt(col, row) || this.isCorridor(col, row)) continue;
      if (this.obstacleNear(col, 2)) continue;
      // Tidak boleh ada chasm lain di kolom yang sama (tepat 1 sel).
      let sameCol = false;
      for (const k of this.chasms) {
        if (parseInt(k.split(',')[0], 10) === col) sameCol = true;
      }
      if (sameCol) continue;
      this.chasms.add(key);
      return true;
    }
    return false;
  }

  // Hasilkan semua yang dibutuhkan sampai kolom upToCol (kristal dulu,
  // baru obstacle — rock tidak pernah menempati sel kristal).
  ensureWorld(upToCol, crystalSense) {
    const lastBlock = Math.floor(upToCol / 10);
    for (let b = 0; b <= lastBlock; b++) this.genCrystalBlock(b, crystalSense);
    for (let i = 0; i < STAGES.length; i++) {
      if (STAGES[i].start <= upToCol + 10) this.genStageObstacles(i);
    }
    if (upToCol >= 300) {
      const lastSeg = Math.floor((upToCol - 300) / 50) + 1;
      for (let k = 1; k <= lastSeg; k++) this.genEndlessSegment(k);
    }
  }

  // Sel yang tersegel oleh pilihan junction (tidak bisa dibangun).
  sealedCells() {
    const out = new Set();
    for (const f of this.forks.values()) {
      if (f.choice === 'direct') {
        out.add(cellKey(f.col, f.branchRow));
        out.add(cellKey(f.col + 1, f.branchRow));
        out.add(cellKey(f.col + 2, f.branchRow));
      } else if (f.choice === 'crystal') {
        out.add(cellKey(f.col + 1, f.row)); // sel langsung (bukan join)
      }
    }
    return out;
  }

}
