// LAST RAIL — feats karier + NEXT GOAL + LAST 3 RUNS (revisi 3, item 5–7).
// Satu tugas: definisi 6 feats persisten, histori 3 run terakhir, dan
// NEXT GOAL yang spesifik/terukur. Semua tersimpan di localStorage.
// Feats bersifat KARIER (sekali diraih, tetap) — beda dari medali per-run.
// Pola dari teardown top 3 (#5 FEATS x/6, #6 histori+seed, #8 ambang S +
// NEXT GOAL); isinya khas LAST RAIL (chain, DAWNSEEKER, Lumen), bukan klon.
import { GRADE_THRESHOLDS } from './config.js';

const FEATS_KEY = 'last-rail-feats';
const RUNS_KEY = 'last-rail-runs';
const MAX_RUNS = 3;

// 6 feats. `goal` = teks NEXT GOAL bila feat ini yang berikutnya.
// Urutan = urutan prioritas NEXT GOAL (setelah menang + S grade).
export const FEATS = [
  { id: 'first-light', name: 'FIRST LIGHT',
    desc: 'Win with the Void never closer than 4 tiles',
    goal: 'WIN WITH VOID NEVER CLOSER THAN 4 TILES' },
  { id: 'no-shield', name: 'NO SHIELD USED',
    desc: 'Win without using a Shield',
    goal: 'WIN WITHOUT USING A SHIELD' },
  { id: 'full-speed', name: 'FULL SPEED',
    desc: 'Win without ever stalling',
    goal: 'WIN WITHOUT EVER STALLING' },
  { id: 'chain-master', name: 'CHAIN MASTER',
    desc: 'Reach CHAIN x5 in a run',
    goal: 'REACH CHAIN x5' },
  { id: 'dawnseeker', name: 'DAWNSEEKER',
    desc: 'Win on DAWNSEEKER difficulty',
    goal: 'WIN ON DAWNSEEKER' },
  { id: 'rich-haul', name: 'RICH HAUL',
    desc: 'Win with 100+ Lumen left',
    goal: 'WIN WITH 100+ LUMEN LEFT' },
];

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
function saveJSON(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch { /* penyimpanan tidak tersedia */ }
}

// --- Feats ---
export function loadFeats() {
  const v = loadJSON(FEATS_KEY, []);
  return Array.isArray(v) ? v.filter((id) => FEATS.some((f) => f.id === id)) : [];
}
export function saveFeats(ids) {
  saveJSON(FEATS_KEY, ids);
}

// --- Last 3 runs ---
// Satu run: { result:'WON'|'LOST', tile, score, grade, difficulty, seed, date }
// `date` = ISO; ditampilkan ringkas '16 Nov'.
export function loadRuns() {
  const v = loadJSON(RUNS_KEY, []);
  return Array.isArray(v) ? v.slice(0, MAX_RUNS) : [];
}
export function saveRuns(runs) {
  saveJSON(RUNS_KEY, runs.slice(0, MAX_RUNS));
}
export function recordRun(runs, run) {
  const next = [run, ...runs].slice(0, MAX_RUNS);
  saveRuns(next);
  return next;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtRunDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + MONTHS[d.getMonth()];
}
// 'WON 1615 S · 16 Nov' — ringkas untuk satu baris title.
export function formatRun(run) {
  const grade = run.result === 'WON' ? ' ' + (run.grade || '') : '';
  return run.result + ' ' + run.score + grade + ' · ' + fmtRunDate(run.date);
}
export function formatRuns(runs) {
  return runs.map(formatRun).join('   |   ');
}
export function formatFeats(ids) {
  if (!ids.length) return 'FEATS 0/6';
  const names = ids.map((id) => {
    const f = FEATS.find((x) => x.id === id);
    return f ? f.name : id;
  });
  return 'FEATS ' + ids.length + '/6: ' + names.join(' · ');
}

// --- Rekam akhir run (menang/kalah): feats baru + histori ---
// `run` = { won, tile, score, grade, difficulty, seed, minGap, shieldsUsed,
//   stalledEver, maxChain, lumen }.
export function finishRun(feats, runs, run) {
  const earned = new Set(feats);
  const newly = [];
  const check = (id, ok) => {
    if (ok && !earned.has(id)) {
      earned.add(id);
      newly.push(id);
    }
  };
  if (run.won) {
    check('first-light', run.minGap >= 4);
    check('no-shield', run.shieldsUsed === 0);
    check('full-speed', !run.stalledEver);
    check('dawnseeker', run.difficulty === 'DAWNSEEKER');
    check('rich-haul', run.lumen >= 100);
  }
  check('chain-master', (run.maxChain || 0) >= 5);
  const featsOut = [...earned];
  saveFeats(featsOut);
  const record = {
    result: run.won ? 'WON' : 'LOST',
    tile: run.tile,
    score: run.score,
    grade: run.grade || '',
    difficulty: run.difficulty,
    seed: run.seed,
    date: new Date().toISOString(),
  };
  const runsOut = recordRun(runs, record);
  return { feats: featsOut, newly, runs: runsOut };
}

// --- NEXT GOAL (spesifik + terukur, bukan generik) ---
// 1. Belum pernah menang -> menangkan run.
// 2. Sudah menang tapi best < 1000 -> grade S.
// 3. Feat pertama yang belum diraih (urutan FEATS).
// 4. Semua diraih -> selesai.
export function nextGoalText(feats, best, runs) {
  const hasWon = (runs || []).some((r) => r.result === 'WON');
  if (!hasWon) return 'NEXT GOAL: WIN — REACH DAWN TERMINUS (TILE 300)';
  if ((best || 0) < GRADE_THRESHOLDS.S) {
    return 'NEXT GOAL: S GRADE — NEED ' + GRADE_THRESHOLDS.S + ' (BEST ' + (best || 0) + ')';
  }
  const earned = new Set(feats || []);
  for (const f of FEATS) {
    if (!earned.has(f.id)) return 'NEXT GOAL: FEAT — ' + f.goal;
  }
  return 'ALL 6 FEATS EARNED — DAWN IS YOURS';
}

// --- Ambang grade S/A/B/C dengan ✓/✗ untuk skor run ini (item 7) ---
// 'S 1000 ✓ · A 800 ✓ · B 600 ✓ · C <600 ✗' — C ✓ bila skor < 600.
export function gradeThresholdsText(score) {
  const s = score || 0;
  const mark = (ok) => (ok ? '✓' : '✗');
  return 'S ' + GRADE_THRESHOLDS.S + ' ' + mark(s >= GRADE_THRESHOLDS.S)
    + '  ·  A ' + GRADE_THRESHOLDS.A + ' ' + mark(s >= GRADE_THRESHOLDS.A)
    + '  ·  B ' + GRADE_THRESHOLDS.B + ' ' + mark(s >= GRADE_THRESHOLDS.B)
    + '  ·  C <' + GRADE_THRESHOLDS.B + ' ' + mark(s < GRADE_THRESHOLDS.B);
}
