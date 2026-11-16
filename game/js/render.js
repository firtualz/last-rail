// LAST RAIL — gambar canvas: grid, rel, kereta, Void, HUD, palet, dan semua
// layar (title, station, win, lose, pause). Satu tugas: menggambar state.
import {
  W, H, TILE, GRID_ROWS, GRID_X0, GRID_Y0, GRID_COLS_VISIBLE,
  WIN_TEXT, LOSE_TEXT, CONTROLS_TEXT, PIECES, PIECE_ORDER, PRICES,
  STAGES, TOTAL_TILES, gradeFor, DIFFICULTY, DIFFICULTY_ORDER,
} from './config.js';
import { cellKey } from './levels.js';
import { nextGoalText, formatRuns, formatFeats, gradeThresholdsText, FEATS } from './feats.js';

export function colToX(col, camCol) {
  return GRID_X0 + (col - camCol) * TILE;
}
export function rowToY(row) {
  return GRID_Y0 + row * TILE;
}
export function cellCenter(col, row, camCol) {
  return { x: colToX(col, camCol) + TILE / 2, y: rowToY(row) + TILE / 2 };
}
export function screenToCell(x, y, camCol) {
  if (x < GRID_X0 || y < GRID_Y0 || y >= GRID_Y0 + GRID_ROWS * TILE) return null;
  const col = camCol + Math.floor((x - GRID_X0) / TILE);
  const row = Math.floor((y - GRID_Y0) / TILE);
  if (col < 0 || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, font, color, align = 'center', stroke = null) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Arah dari sel a ke sel b (tetangga Manhattan): 'E' | 'W' | 'N' | 'S'.
export function dirOf(a, b) {
  if (b.col > a.col) return 'E';
  if (b.col < a.col) return 'W';
  if (b.row > a.row) return 'S';
  return 'N';
}
const DIR_VEC = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };
const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };

function drawRailSegment(ctx, cx, cy, dirs, color) {
  // dirs: array arah dari pusat sel ke tepi yang dihubungkan.
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  for (const d of dirs) {
    const [dx, dy] = DIR_VEC[d];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * TILE * 0.5, cy + dy * TILE * 0.5);
    ctx.stroke();
  }
  // Bantalan (ties) di tengah sel.
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(cx - 26, cy - 4, 52, 8);
}

function drawCrystal(ctx, x, y, t, bright) {
  const pulse = 1 + 0.12 * Math.sin(t * 3 + x * 0.01);
  const s = (bright ? 15 : 12) * pulse;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#19c3d6';
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#19c3d6';
  ctx.fillRect(-s / 1.4, -s / 1.4, s * 1.4, s * 1.4);
  ctx.fillStyle = '#bff6ff';
  ctx.fillRect(-s / 3, -s / 3, s / 1.5, s / 1.5);
  ctx.restore();
}

function drawRock(ctx, x, y) {
  ctx.fillStyle = '#8a8a8a';
  ctx.beginPath();
  ctx.arc(x - 10, y + 8, 16, 0, Math.PI * 2);
  ctx.arc(x + 12, y + 10, 14, 0, Math.PI * 2);
  ctx.arc(x, y - 8, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a8a8a8';
  ctx.beginPath();
  ctx.arc(x - 6, y - 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c5c5c';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTrain(ctx, x, y, angle, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(0.75, 0.75); // kereta kecil (~60 px lokomotif), bukan fokus frame
  // Tender di belakang (offset -1 tile sepanjang arah hadap).
  ctx.fillStyle = '#8a5a1a';
  rr(ctx, -118, -16, 44, 32, 6);
  ctx.fill();
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(-112, -20, 32, 6);
  // Lokomotif.
  ctx.fillStyle = '#f2a71b';
  rr(ctx, -62, -22, 92, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#3a2a18';
  rr(ctx, -62, -22, 30, 44, 10); // kabin
  ctx.fill();
  ctx.fillStyle = '#ffe9b0';
  ctx.fillRect(-56, -14, 16, 18); // jendela kabin
  ctx.fillStyle = '#d62828';
  ctx.fillRect(18, -22, 12, 44); // garis merah
  // Cerobong + lampu depan.
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(6, -34, 12, 14);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(32, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(32, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Roda.
  ctx.fillStyle = '#2a1c0c';
  for (const wx of [-48, -18, 12]) {
    ctx.beginPath();
    ctx.arc(wx, 24, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPalette(ctx, s) {
  const y = 560;
  const h = 90;
  const x0 = 100;
  const w = 186;
  const gap = 8;
  const cards = [];
  for (let i = 0; i < PIECE_ORDER.length; i++) {
    const p = PIECES[PIECE_ORDER[i]];
    const price = s.economy.railPrice(p.id);
    cards.push({
      id: 'piece:' + p.id, x: x0 + i * (w + gap), y, w, h,
      key: p.key, name: p.name, sub: price + ' LUMEN',
      selected: s.selectedPiece === p.id,
      disabled: s.economy.lumen < price,
    });
  }
  cards.push({
    id: 'tool:boost', x: x0 + 4 * (w + gap), y, w, h,
    key: 'SPACE', name: 'BOOST', sub: PRICES.boost + ' · x' + s.economy.boost,
    selected: false, disabled: s.economy.boost <= 0,
  });
  cards.push({
    id: 'tool:shield', x: x0 + 5 * (w + gap), y, w, h,
    key: 'Q', name: 'SHIELD', sub: PRICES.shield + ' · x' + s.economy.shield,
    selected: false, disabled: s.economy.shield <= 0,
  });
  for (const c of cards) {
    s.ui.push(c);
    ctx.fillStyle = c.selected ? '#ffd166' : c.disabled ? '#e8dcc0' : '#fff8e6';
    rr(ctx, c.x, c.y, c.w, c.h, 10);
    ctx.fill();
    ctx.strokeStyle = c.selected ? '#b97d10' : '#d9a441';
    ctx.lineWidth = c.selected ? 4 : 2;
    ctx.stroke();
    ctx.fillStyle = '#3a2a18';
    text(ctx, c.key, c.x + 22, c.y + 20, 'bold 18px system-ui, sans-serif', '#3a2a18', 'center');
    text(ctx, c.name, c.x + c.w / 2, c.y + 42, 'bold 20px system-ui, sans-serif', '#3a2a18');
    text(ctx, c.sub, c.x + c.w / 2, c.y + 68, '16px system-ui, sans-serif', c.disabled ? '#a08c62' : '#6b4a1f');
  }
}

function drawTopBar(ctx, s) {
  ctx.fillStyle = '#6b4a1f';
  ctx.fillRect(0, 0, W, 64);
  text(ctx, 'LAST RAIL', 24, 34, 'bold 30px system-ui, sans-serif', '#ffd166', 'left');
  // Strip WIN/LOSE di tengah.
  ctx.fillStyle = '#4a3410';
  const stripW = 640;
  rr(ctx, (W - stripW) / 2, 10, stripW, 44, 8);
  ctx.fill();
  text(ctx, WIN_TEXT + '  —  ' + LOSE_TEXT, W / 2, 33, 'bold 17px system-ui, sans-serif', '#ffffff');
  const right = 'LUMEN ' + s.economy.lumen + '  ·  ' + (DIFFICULTY[s.difficulty] ? DIFFICULTY[s.difficulty].label : 'STANDARD');
  text(ctx, right, W - 24, 34, 'bold 22px system-ui, sans-serif', '#ffe9b0', 'right');
}

function drawControlsBar(ctx) {
  ctx.fillStyle = '#efe0bd';
  ctx.fillRect(0, 650, W, 70);
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(0, 650, W, 3);
  text(ctx, CONTROLS_TEXT, W / 2, 686, 'bold 19px system-ui, sans-serif', '#3a2a18');
}

function drawStatusStrip(ctx, s, t) {
  const y0 = 480;
  ctx.fillStyle = '#f2dfbc';
  ctx.fillRect(0, y0, W, 80);
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(0, y0, W, 3);
  const stage = s.stageDef || STAGES[s.stage - 1] || STAGES[4];
  // Kiri: stage + tile + progress bar ke 300 (+ CHAIN saat >= 2).
  // 'TILE' dihilangkan (revisi 3, W2): '250/300' cukup jelas, dan teks
  // yang lebih pendek memberi jarak aman antara CHAIN dan RAIL AHEAD
  // (terukur: CHAIN x3 menempel RAIL AHEAD di S1 bila 'TILE' dipertahankan).
  const leftText = 'STAGE ' + s.stage + ' · ' + stage.name + ' · ' + Math.floor(s.trainPos) + '/' + TOTAL_TILES;
  text(ctx, leftText, 100, y0 + 22, 'bold 20px system-ui, sans-serif', '#3a2a18', 'left');
  if (s.economy.chain >= 2) {
    ctx.font = 'bold 20px system-ui, sans-serif';
    const w = ctx.measureText(leftText).width;
    // Spasi akhir (revisi 3, W2) agar CHAIN tidak menempel RAIL AHEAD.
    text(ctx, ' · CHAIN x' + s.economy.chain + ' ', 100 + w, y0 + 22, 'bold 20px system-ui, sans-serif', '#b97d10', 'left');
  }
  const barX = 100, barY = y0 + 40, barW = 420, barH = 14;
  ctx.fillStyle = '#d9c08a';
  rr(ctx, barX, barY, barW, barH, 7);
  ctx.fill();
  ctx.fillStyle = '#b97d10';
  rr(ctx, barX, barY, Math.max(8, barW * (s.trainPos / TOTAL_TILES)), barH, 7);
  ctx.fill();
  // Tengah: RAIL AHEAD + VOID GAP.
  const railAhead = s.railAhead;
  let railColor = '#3a2a18';
  if (railAhead < 4) railColor = (Math.floor(t * 4) % 2 === 0) ? '#d62828' : '#7a1010';
  else if (railAhead < 8) railColor = '#b97d10';
  text(ctx, 'RAIL AHEAD: ' + railAhead, 640, y0 + 22, 'bold 22px system-ui, sans-serif', railColor);
  const gap = Math.max(0, s.gap);
  text(ctx, 'VOID GAP: ' + Math.floor(gap), 640, y0 + 52, 'bold 20px system-ui, sans-serif',
    gap < 4 ? '#d62828' : '#3a2a18');
  // Gap bar.
  const gW = 180;
  ctx.fillStyle = '#d9c08a';
  rr(ctx, 730, y0 + 44, gW, 14, 7);
  ctx.fill();
  ctx.fillStyle = gap < 4 ? '#d62828' : '#7a9e3d';
  rr(ctx, 730, y0 + 44, Math.max(6, gW * Math.min(1, gap / 16)), 14, 7);
  ctx.fill();
  // Kanan: kecepatan + hint.
  const speed = s.currentSpeed ? s.currentSpeed.toFixed(1) : stage.train.toFixed(1);
  text(ctx, 'SPEED ' + speed + ' t/s', 1180, y0 + 22, 'bold 20px system-ui, sans-serif', '#3a2a18', 'right');
  let hint = '';
  let hintColor = '#6b4a1f';
  if (s.tideWarn) { hint = 'VOID TIDE IN 2s!'; hintColor = '#7a3fd4'; }
  else if (s.surgeWarn) { hint = 'SURGE IN 2s!'; hintColor = '#d62828'; }
  else if (s.tide && s.tide.active) { hint = 'VOID TIDE — VOID x1.3!'; hintColor = '#7a3fd4'; }
  else if (gap < 4) { hint = 'VOID CLOSE — SPACE TO BOOST'; hintColor = '#d62828'; }
  else if (railAhead < 4) { hint = 'RAIL AHEAD LOW — BUILD NOW'; hintColor = '#b97d10'; }
  if (hint) {
    const blink = Math.floor(t * 3) % 2 === 0;
    if (blink) text(ctx, hint, 1180, y0 + 52, 'bold 19px system-ui, sans-serif', hintColor, 'right');
  }
  // Boss bar VOID HERALD (revisi 2, item 4; revisi 3, W1): hanya stage >= 5,
  // baris bawah status strip. Fase dari tile S5: I 201-250, II 251-275,
  // III 276-300. Berdenyut merah (Surge) / ungu (Tide).
  // W1: by 546 -> 540 + label di tengah bar (by+6, bukan by+11) — label
  // 'VOID HERALD'/'PHASE I' sebelumnya terpotong ~5px oleh palet (y 560).
  // Bar 540-552: di bawah gap bar (berakhir 538), di atas palet (560).
  if (s.stage >= 5) {
    const by = 540;
    const label = 'VOID HERALD';
    const barX = 220, barW = 880, barH = 12;
    let frac, phase;
    if (s.stage === 5) {
      frac = Math.min(1, Math.max(0, (s.trainPos - 200) / 100));
      phase = s.trainPos < 251 ? 'PHASE I' : s.trainPos < 276 ? 'PHASE II' : 'PHASE III';
    } else {
      const segStart = s.nextStationAt - 50;
      frac = Math.min(1, Math.max(0, (s.trainPos - segStart) / 50));
      phase = 'ENDLESS';
    }
    text(ctx, label, 100, by + 6, 'bold 15px system-ui, sans-serif', '#7a3fd4', 'left');
    ctx.fillStyle = '#d9c08a';
    rr(ctx, barX, by, barW, barH, 6);
    ctx.fill();
    const pulse = (s.surgeWarn || s.tideWarn) && Math.floor(t * 4) % 2 === 0;
    ctx.fillStyle = pulse ? '#d62828' : (s.tide && s.tide.active) ? '#b388ff' : '#7a3fd4';
    rr(ctx, barX, by, Math.max(10, barW * frac), barH, 6);
    ctx.fill();
    // Penanda 50% (tile 250) dan 75% (tile 275).
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(barX + barW * 0.5 - 1, by - 2, 2, barH + 4);
    ctx.fillRect(barX + barW * 0.75 - 1, by - 2, 2, barH + 4);
    text(ctx, phase, barX + barW + 12, by + 6, 'bold 15px system-ui, sans-serif', '#7a3fd4', 'left');
  }
}

function drawGrid(ctx, s, t) {
  const camCol = s.camCol;
  const x1 = GRID_X0 + GRID_COLS_VISIBLE * TILE;
  const y1 = GRID_Y0 + GRID_ROWS * TILE;
  // Latar grid krem terang.
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS_VISIBLE; c++) {
      const col = camCol + c;
      const x = GRID_X0 + c * TILE;
      const y = GRID_Y0 + r * TILE;
      const main = r >= 1 && r <= 3;
      ctx.fillStyle = (c + r) % 2 === 0
        ? (main ? '#f7ead0' : '#efe0bd')
        : (main ? '#f2dfbc' : '#e9d6ac');
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = '#d9c08a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
      void col;
    }
  }
  // Garis tepi grid.
  ctx.strokeStyle = '#b98d3e';
  ctx.lineWidth = 3;
  ctx.strokeRect(GRID_X0, GRID_Y0, GRID_COLS_VISIBLE * TILE, GRID_ROWS * TILE);

  const sealed = s.world ? s.world.sealedCells() : new Set();
  const inView = (col) => col >= camCol && col < camCol + GRID_COLS_VISIBLE;

  // Chasm (lubang) — di bawah rel.
  if (s.world) {
    for (const k of s.world.chasms) {
      const [col, row] = k.split(',').map(Number);
      if (!inView(col)) continue;
      const { x, y } = cellCenter(col, row, camCol);
      ctx.fillStyle = '#2a1a3a';
      rr(ctx, x - 34, y - 30, 68, 60, 8);
      ctx.fill();
      ctx.fillStyle = '#4a2a5e';
      rr(ctx, x - 26, y - 22, 52, 44, 6);
      ctx.fill();
    }
    // Sel tersegel (cabang junction yang tidak dipilih).
    for (const k of sealed) {
      const [col, row] = k.split(',').map(Number);
      if (!inView(col)) continue;
      const x = colToX(col, camCol), y = rowToY(row);
      ctx.fillStyle = 'rgba(60,40,20,0.55)';
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = 'rgba(60,40,20,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 10);
      ctx.lineTo(x + TILE - 10, y + TILE - 10);
      ctx.moveTo(x + TILE - 10, y + 10);
      ctx.lineTo(x + 10, y + TILE - 10);
      ctx.stroke();
    }
    // Koridor kristal yang terkunci (fork belum dibeli junction-nya).
    for (const k of s.world.corridorCells) {
      const [col, row] = k.split(',').map(Number);
      if (!inView(col)) continue;
      const f = s.world.forkAt(col, row);
      if (f) continue; // sel fork sendiri bukan koridor
      const fork = [...s.world.forks.values()].find((ff) =>
        (ff.col === col && ff.branchRow === row) ||
        (ff.col + 1 === col && ff.branchRow === row) ||
        (ff.col + 2 === col && ff.branchRow === row));
      if (!fork || fork.placed || fork.choice) continue;
      if (s.trainPos > fork.col + 2) continue; // sudah lewat: memudar
      const x = colToX(col, camCol), y = rowToY(row);
      ctx.strokeStyle = 'rgba(120,90,40,0.55)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 6, y + 6, TILE - 12, TILE - 12);
      ctx.setLineDash([]);
    }
    // Kristal (yang belum diambil).
    for (const k of s.world.crystals) {
      const [col, row] = k.split(',').map(Number);
      if (!inView(col)) continue;
      if (sealed.has(k)) continue;
      const { x, y } = cellCenter(col, row, camCol);
      drawCrystal(ctx, x, y, t, s.economy.lantern);
    }
    // Rock.
    for (const k of s.world.rocks) {
      const [col, row] = k.split(',').map(Number);
      if (!inView(col)) continue;
      const { x, y } = cellCenter(col, row, camCol);
      drawRock(ctx, x, y);
    }
    // Marker fork site (belum dibangun): berlian amber BESAR tanpa nomor
    // (M-3: nomor urut fork tidak bermakna dan tidak terbaca di cover).
    for (const f of s.world.forks.values()) {
      if (f.placed) continue;
      if (!inView(f.col)) continue;
      const { x, y } = cellCenter(f.col, f.row, camCol);
      ctx.save();
      ctx.translate(x, y - 26);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#7a5200';
      ctx.lineWidth = 3;
      ctx.fillRect(-14, -14, 28, 28);
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.fillStyle = '#fff3d6';
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    }
  }

  // Rel (path) — gambar per sel berdasarkan tetangga path.
  const path = s.path;
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (!inView(cell.col)) continue;
    const { x, y } = cellCenter(cell.col, cell.row, camCol);
    const dirs = [];
    if (i > 0) dirs.push(dirOf(cell, path[i - 1]));
    if (i < path.length - 1) dirs.push(dirOf(cell, path[i + 1]));
    if (cell.kind === 'junction') {
      // Jalur utama + cabang (cabang dipilih = solid, lain = redup).
      const f = s.world ? s.world.forkAt(cell.col, cell.row) : null;
      drawRailSegment(ctx, x, y, dirs, '#4a3a28');
      if (f) {
        const branchDir = f.branchRow < f.row ? 'N' : 'S';
        const chosen = f.choice === 'crystal';
        ctx.globalAlpha = chosen ? 1 : 0.35;
        drawRailSegment(ctx, x, y, [branchDir], '#4a3a28');
        ctx.globalAlpha = 1;
      }
    } else if (cell.kind === 'bridge') {
      // Jembatan: papan kayu di atas chasm.
      ctx.fillStyle = '#a97c50';
      rr(ctx, x - 36, y - 26, 72, 52, 6);
      ctx.fill();
      ctx.strokeStyle = '#6b4a2f';
      ctx.lineWidth = 2;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * 14, y - 26);
        ctx.lineTo(x + k * 14, y + 26);
        ctx.stroke();
      }
      drawRailSegment(ctx, x, y, dirs, '#3a2a18');
    } else {
      drawRailSegment(ctx, x, y, dirs, '#4a3a28');
    }
  }

  // Panah pilihan junction (saat pending): DIRECT di sel lurus, CRYSTAL di sel belok.
  if (s.pendingFork) {
    const f = s.pendingFork;
    const dCell = cellCenter(f.col + 1, f.row, camCol);
    const cCell = cellCenter(f.col, f.branchRow, camCol);
    for (const [c, label] of [[dCell, 'DIRECT'], [cCell, 'CRYSTAL']]) {
      ctx.fillStyle = 'rgba(255,248,230,0.95)';
      rr(ctx, c.x - 52, c.y - 20, 104, 40, 8);
      ctx.fill();
      ctx.strokeStyle = '#b97d10';
      ctx.lineWidth = 3;
      ctx.stroke();
      text(ctx, label, c.x, c.y, 'bold 17px system-ui, sans-serif', '#3a2a18');
    }
  }

  // Ghost (preview piece) + tag harga.
  if (s.ghost && s.screen === 'play') {
    const g = s.ghost;
    const { x, y } = cellCenter(g.col, g.row, camCol);
    ctx.globalAlpha = 0.75;
    if (g.kind === 'doze') {
      ctx.fillStyle = g.valid ? '#7a9e3d' : '#d62828';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DOZE 5', x, y - 30);
    } else {
      ctx.fillStyle = g.valid ? '#7a9e3d' : '#d62828';
      rr(ctx, x - 30, y - 30, 60, 60, 8);
      ctx.fill();
      ctx.fillStyle = '#fff8e6';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(g.price), x, y + 6);
    }
    ctx.globalAlpha = 1;
  }

  // Kereta.
  if (s.screen === 'play' || s.screen === 'paused' || s.shotMode) {
    const i = Math.min(Math.floor(s.trainPos), path.length - 1);
    const j = Math.min(i + 1, path.length - 1);
    const frac = s.trainPos - i;
    const a = cellCenter(path[i].col, path[i].row, camCol);
    const b = cellCenter(path[j].col, path[j].row, camCol);
    const tx = a.x + (b.x - a.x) * frac;
    const ty = a.y + (b.y - a.y) * frac;
    const dx = b.x - a.x, dy = b.y - a.y;
    const angle = Math.atan2(dy, dx);
    drawTrain(ctx, tx, ty, angle, t);
  }

  // Void: pita gelap di tepi kiri — tepi kanannya = trainX - gap*TILE.
  if (s.screen === 'play' || s.screen === 'paused' || s.shotMode) {
    const i = Math.min(Math.floor(s.trainPos), path.length - 1);
    const j = Math.min(i + 1, path.length - 1);
    const frac = s.trainPos - i;
    const a = cellCenter(path[i].col, path[i].row, camCol);
    const b = cellCenter(path[j].col, path[j].row, camCol);
    const trainX = a.x + (b.x - a.x) * frac;
    const voidEdge = trainX - s.gap * TILE;
    if (voidEdge > -60) {
      ctx.fillStyle = '#1a0b2e';
      ctx.fillRect(-40, GRID_Y0, voidEdge + 40, GRID_ROWS * TILE);
      // Sulur: tepi bergelombang.
      ctx.fillStyle = '#2e1250';
      for (let k = 0; k < 5; k++) {
        const wy = GRID_Y0 + 40 + k * 72 + 12 * Math.sin(t * 2 + k);
        ctx.beginPath();
        ctx.arc(voidEdge, wy, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      // Dua mata berpendar bila pita terlihat.
      if (voidEdge > 30) {
        ctx.fillStyle = '#b388ff';
        ctx.beginPath();
        ctx.arc(voidEdge - 18, GRID_Y0 + 120, 7, 0, Math.PI * 2);
        ctx.arc(voidEdge - 18, GRID_Y0 + 150, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a0b2e';
        ctx.beginPath();
        ctx.arc(voidEdge - 18, GRID_Y0 + 120, 3, 0, Math.PI * 2);
        ctx.arc(voidEdge - 18, GRID_Y0 + 150, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  void x1; void y1;
}

function drawPlayScreen(ctx, s, t) {
  ctx.fillStyle = '#f7ead0';
  ctx.fillRect(0, 0, W, H);
  drawTopBar(ctx, s);
  drawGrid(ctx, s, t);
  drawStatusStrip(ctx, s, t);
  drawPalette(ctx, s);
  drawControlsBar(ctx);
  // Telegraph Surge: denyut merah di tepi layar.
  if (s.surgeWarn) {
    const a = 0.25 + 0.2 * Math.sin(t * 10);
    ctx.fillStyle = 'rgba(214,40,40,' + a + ')';
    ctx.fillRect(0, 0, W, 10);
    ctx.fillRect(0, H - 10, W, 10);
    ctx.fillRect(0, 0, 10, H);
    ctx.fillRect(W - 10, 0, 10, H);
  }
  if (s.screen === 'paused') {
    ctx.fillStyle = 'rgba(30,20,10,0.55)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSED', W / 2, 320, 'bold 56px system-ui, sans-serif', '#ffe9b0');
    text(ctx, 'P resume  ·  R restart run  ·  M mute', W / 2, 380, 'bold 24px system-ui, sans-serif', '#fff8e6');
  }
  s.fx.draw(ctx);
}

function drawTitleScreen(ctx, s, t) {
  ctx.fillStyle = '#f7ead0';
  ctx.fillRect(0, 0, W, H);
  // Rel dekoratif di bawah. Kereta di x~200 agar tidak tertutup tombol difficulty.
  ctx.fillStyle = '#efe0bd';
  ctx.fillRect(0, 500, W, 120);
  drawTrain(ctx, 200 + 40 * Math.sin(t * 0.5), 545, 0, t);
  text(ctx, 'LAST RAIL', W / 2, 130, 'bold 96px system-ui, sans-serif', '#b97d10');
  text(ctx, 'Build the rail. Outrun the Void.', W / 2, 200, 'bold 28px system-ui, sans-serif', '#3a2a18');
  // Strip WIN/LOSE.
  ctx.fillStyle = '#4a3410';
  rr(ctx, (W - 760) / 2, 236, 760, 48, 8);
  ctx.fill();
  text(ctx, WIN_TEXT + '  —  ' + LOSE_TEXT, W / 2, 261, 'bold 18px system-ui, sans-serif', '#ffffff');
  // Tutorial 3 langkah.
  const steps = ['1  SELECT PIECE', '2  CLICK TO BUILD', '3  OUTRUN THE VOID'];
  for (let i = 0; i < 3; i++) {
    const x = 320 + i * 220;
    ctx.fillStyle = '#fff8e6';
    rr(ctx, x, 320, 200, 64, 10);
    ctx.fill();
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, steps[i], x + 100, 353, 'bold 17px system-ui, sans-serif', '#3a2a18');
  }
  // Best score + seed (revisi 3, item 6): seed yang ditampilkan di sini
  // adalah seed run yang akan dimainkan (title memakai s.seed yang sama).
  const bestSeed = (s.best > 0 ? 'BEST SCORE: ' + s.best + '  ·  ' : '') + 'SEED ' + s.seed;
  text(ctx, bestSeed, W / 2, 412, 'bold 22px system-ui, sans-serif', '#6b4a1f');
  // Feats karier (revisi 3, item 5): 'FEATS 3/6: FIRST LIGHT · ...'.
  text(ctx, formatFeats(s.feats || []), W / 2, 438, 'bold 18px system-ui, sans-serif', '#7a3fd4');
  // Last 3 runs (revisi 3, item 6): 'WON 1615 S · 16 Nov | LOST 155 · 15 Nov'.
  if (s.runs && s.runs.length) {
    text(ctx, 'LAST 3 RUNS: ' + formatRuns(s.runs), W / 2, 464, 'bold 17px system-ui, sans-serif', '#6b4a1f');
  }
  // Difficulty (revisi 2, item 3): 3 tombol + tombol 1/2/3.
  const diffs = DIFFICULTY_ORDER.map((id) => ({ id, ...DIFFICULTY[id] }));
  for (let i = 0; i < diffs.length; i++) {
    const d = diffs[i];
    const x = 320 + i * 220;
    const y = 490;
    s.ui.push({ id: 'diff:' + d.id, x, y, w: 200, h: 52 });
    const selected = s.difficulty === d.id;
    ctx.fillStyle = selected ? '#ffd166' : '#fff8e6';
    rr(ctx, x, y, 200, 52, 10);
    ctx.fill();
    ctx.strokeStyle = selected ? '#b97d10' : '#d9a441';
    ctx.lineWidth = selected ? 3 : 2;
    ctx.stroke();
    text(ctx, (i + 1) + '  ' + d.label, x + 100, y + 21, 'bold 18px system-ui, sans-serif', '#3a2a18');
    text(ctx, d.desc, x + 100, y + 42, '13px system-ui, sans-serif', '#6b4a1f');
  }
  // Mode.
  // Di shot mode jangan berkedip — teks harus selalu terlihat di screenshot.
  // Revisi 3: CLICK TO START pindah ke y 566 (antara tombol difficulty dan
  // mode) agar baris FEATS/LAST 3 RUNS muat di 412-464.
  const blink = s.shotMode || Math.floor(t * 2) % 2 === 0;
  if (blink) text(ctx, 'CLICK TO START', W / 2, 566, 'bold 30px system-ui, sans-serif', '#b97d10');
  // Tombol mode (UI hit).
  const modes = [
    { id: 'mode:standard', label: 'STANDARD', sub: '5 stages · tile 300', locked: false },
    { id: 'mode:endless', label: 'ENDLESS', sub: s.unlockedEndless ? 'Continue from tile 300' : 'LOCKED — WIN ONCE', locked: !s.unlockedEndless },
  ];
  for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    const x = W / 2 - 320 + i * 340;
    const y = 590;
    s.ui.push({ id: m.id, x, y, w: 300, h: 55 });
    ctx.fillStyle = m.locked ? '#e8dcc0' : (s.mode === 'standard' && m.id === 'mode:standard') || (s.mode === 'endless' && m.id === 'mode:endless') ? '#ffd166' : '#fff8e6';
    rr(ctx, x, y, 300, 55, 10);
    ctx.fill();
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, m.label, x + 150, y + 21, 'bold 22px system-ui, sans-serif', m.locked ? '#a08c62' : '#3a2a18');
    text(ctx, m.sub, x + 150, y + 43, '15px system-ui, sans-serif', '#6b4a1f');
  }
  drawControlsBar(ctx);
  s.fx.draw(ctx);
}

function drawStationScreen(ctx, s, t) {
  ctx.fillStyle = '#f7ead0';
  ctx.fillRect(0, 0, W, H);
  drawTopBar(ctx, s);
  const st = s.stageStats;
  text(ctx, 'STATION — STAGE ' + s.stage + ' COMPLETE', W / 2, 100, 'bold 34px system-ui, sans-serif', '#3a2a18');
  // Statistik stage.
  const stats = [
    'TIME ' + (st ? st.time : '0:00'),
    'TILES BUILT ' + (st ? st.tiles : 0),
    'CRYSTALS ' + (st ? st.crystals : 0),
    'LUMEN EARNED ' + (st ? st.lumenEarned : 0),
    'TOOLS USED ' + (st ? st.toolsUsed : 0),
  ];
  text(ctx, stats.join('   ·   '), W / 2, 138, 'bold 19px system-ui, sans-serif', '#6b4a1f');
  text(ctx, 'DELIVERY BONUS  +' + (s.lastDelivery || 0) + ' LUMEN', W / 2, 168,
    'bold 22px system-ui, sans-serif', '#b97d10');
  // Draft.
  text(ctx, 'DEPOT DRAFT — PICK 1 (FREE)', 100, 206, 'bold 20px system-ui, sans-serif', '#3a2a18', 'left');
  const offer = s.economy.draftOffer || [];
  for (let i = 0; i < 3; i++) {
    const b = offer[i];
    const x = 100 + i * 300;
    const y = 224;
    const picked = s.economy.draftPicked;
    s.ui.push({ id: b ? 'draft:' + b.id : 'draft:none', x, y, w: 280, h: 150 });
    ctx.fillStyle = b ? (picked ? '#e8dcc0' : '#fff8e6') : '#efe0bd';
    rr(ctx, x, y, 280, 150, 10);
    ctx.fill();
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (b) {
      // Rank II: lencana + nama sudah membawa " II" dari offerDraft.
      text(ctx, b.name, x + 140, y + 26, 'bold 19px system-ui, sans-serif', '#3a2a18');
      if (b.rank === 2) {
        ctx.fillStyle = '#7a3fd4';
        rr(ctx, x + 232, y + 8, 40, 20, 5);
        ctx.fill();
        text(ctx, 'II', x + 252, y + 23, 'bold 13px system-ui, sans-serif', '#ffffff');
      }
      ctx.font = '15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6b4a1f';
      wrapText(ctx, b.desc, x + 140, y + 52, 250, 19);
      // Synergy (revisi 2, item 1): teks tampilan saja, tanpa bonus mekanik.
      if (b.synergy) {
        ctx.font = 'italic 13px system-ui, sans-serif';
        ctx.fillStyle = '#7a3fd4';
        wrapText(ctx, b.synergy, x + 140, y + 122, 250, 16);
      }
    } else {
      text(ctx, '—', x + 140, y + 60, 'bold 24px system-ui, sans-serif', '#a08c62');
    }
  }
  // Reroll.
  const rrX = 1000, rrY = 224;
  s.ui.push({ id: 'reroll', x: rrX, y: rrY, w: 180, h: 150 });
  ctx.fillStyle = s.economy.rerolled ? '#e8dcc0' : '#fff8e6';
  rr(ctx, rrX, rrY, 180, 120, 10);
  ctx.fill();
  ctx.strokeStyle = '#d9a441';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, 'REROLL', rrX + 90, rrY + 40, 'bold 19px system-ui, sans-serif', '#3a2a18');
  text(ctx, '10 LUMEN', rrX + 90, rrY + 68, '16px system-ui, sans-serif', '#6b4a1f');
  text(ctx, s.economy.rerolled ? '(USED)' : '(1x)', rrX + 90, rrY + 92, '15px system-ui, sans-serif', '#a08c62');
  // Shop (label + kartu digeser ke bawah karena kartu draft kini 150 tinggi).
  text(ctx, 'SHOP', 100, 394, 'bold 20px system-ui, sans-serif', '#3a2a18', 'left');
  const items = s.economy.shopItems();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const x = 100 + i * 300;
    const y = 412;
    const full = it.owned >= it.max;
    s.ui.push({ id: 'shop:' + it.id, x, y, w: 280, h: 96 });
    ctx.fillStyle = full ? '#e8dcc0' : '#fff8e6';
    rr(ctx, x, y, 280, 96, 10);
    ctx.fill();
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, it.name, x + 140, y + 24, 'bold 19px system-ui, sans-serif', '#3a2a18');
    text(ctx, it.desc, x + 140, y + 48, '15px system-ui, sans-serif', '#6b4a1f');
    text(ctx, full ? 'MAXED' : it.price + ' LUMEN  ·  x' + it.owned + '/' + it.max,
      x + 140, y + 74, 'bold 16px system-ui, sans-serif', full ? '#a08c62' : '#b97d10');
  }
  // Continue.
  const cx = W / 2 - 200, cy = 530;
  s.ui.push({ id: 'continue', x: cx, y: cy, w: 400, h: 64 });
  ctx.fillStyle = '#ffd166';
  rr(ctx, cx, cy, 400, 64, 12);
  ctx.fill();
  ctx.strokeStyle = '#b97d10';
  ctx.lineWidth = 3;
  ctx.stroke();
  const nextStage = s.mode === 'endless' ? 'NEXT SEGMENT' : 'CONTINUE → STAGE ' + (s.stage + 1);
  text(ctx, nextStage, W / 2, cy + 33, 'bold 24px system-ui, sans-serif', '#3a2a18');
  text(ctx, 'LUMEN ' + s.economy.lumen + '  ·  R restart run', W / 2, 624, 'bold 18px system-ui, sans-serif', '#6b4a1f');
  s.fx.draw(ctx);
}

function wrapText(ctx, str, x, y, maxW, lineH) {
  const words = str.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawWinScreen(ctx, s, t) {
  ctx.fillStyle = '#f7ead0';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'DAWN REACHED — TILE 300', W / 2, 100, 'bold 52px system-ui, sans-serif', '#b97d10');
  text(ctx, 'SCORE ' + s.finalScore, W / 2, 165, 'bold 36px system-ui, sans-serif', '#3a2a18');
  text(ctx, 'GRADE ' + (s.finalGrade || 'A'), W / 2, 225, 'bold 64px system-ui, sans-serif', '#d62828');
  const stats = [
    'TIME ' + (s.runTime ? fmtTime(s.runTime) : '4:12'),
    'TILES 300',
    'CRYSTALS ' + s.economy.crystalsCollected,
    'LUMEN LEFT ' + s.economy.lumen,
  ];
  if (s.economy.chainScore > 0) stats.push('CHAIN +' + s.economy.chainScore);
  stats.push(DIFFICULTY[s.difficulty] ? DIFFICULTY[s.difficulty].label : 'STANDARD');
  text(ctx, stats.join('   ·   '), W / 2, 280, 'bold 20px system-ui, sans-serif', '#6b4a1f');
  if (s.medals && s.medals.length) {
    text(ctx, 'MEDALS: ' + s.medals.join('  ·  '), W / 2, 312, 'bold 20px system-ui, sans-serif', '#b97d10');
  }
  // Build list (revisi 3, item 7): boon + rank sebagai chips + Lantern.
  const build = s.economy.buildList();
  text(ctx, 'YOUR BUILD: ' + (build.length ? build.join('  ·  ') : '— NO BOONS'), W / 2, 342,
    'bold 18px system-ui, sans-serif', '#3a2a18');
  // Ambang S/A/B/C dengan ✓/✗ (revisi 3, item 7): S tetap ≥1000.
  text(ctx, gradeThresholdsText(s.finalScore), W / 2, 372, 'bold 18px system-ui, sans-serif', '#3a2a18');
  // NEXT GOAL (revisi 3, item 5): spesifik + terukur.
  text(ctx, nextGoalText(s.feats || [], s.best, s.runs || []), W / 2, 402,
    'bold 18px system-ui, sans-serif', '#7a3fd4');
  // Seed run ini + best score (revisi 3, item 6).
  text(ctx, 'SEED ' + s.seed + '  ·  BEST SCORE: ' + s.best, W / 2, 432, 'bold 18px system-ui, sans-serif', '#6b4a1f');
  // Feat baru yang diraih run ini (bila ada).
  if (s.newFeats && s.newFeats.length) {
    const names = s.newFeats.map((id) => {
      const f = FEATS.find((x) => x.id === id);
      return f ? f.name : id;
    });
    text(ctx, 'NEW FEAT: ' + names.join(' · ') + '!', W / 2, 462, 'bold 18px system-ui, sans-serif', '#7a3fd4');
  }
  // Tombol.
  const b1 = { id: 'endless', x: W / 2 - 420, y: 480, w: 400, h: 70 };
  const b2 = { id: 'restart', x: W / 2 + 20, y: 480, w: 400, h: 70 };
  for (const b of [b1, b2]) {
    s.ui.push(b);
    ctx.fillStyle = b.id === 'endless' ? '#ffd166' : '#fff8e6';
    rr(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#b97d10';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  text(ctx, 'CONTINUE ENDLESS', W / 2 - 220, 516, 'bold 22px system-ui, sans-serif', '#3a2a18');
  text(ctx, 'RESTART (R)', W / 2 + 220, 516, 'bold 22px system-ui, sans-serif', '#3a2a18');
  // SAME SEED (revisi 3, item 6): replay seed yang sama (tombol + 'S').
  const b3 = { id: 'same-seed', x: W / 2 - 200, y: 565, w: 400, h: 55 };
  s.ui.push(b3);
  ctx.fillStyle = '#fff8e6';
  rr(ctx, b3.x, b3.y, b3.w, b3.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#7a3fd4';
  ctx.lineWidth = 3;
  ctx.stroke();
  text(ctx, 'SAME SEED (S)', W / 2, 593, 'bold 20px system-ui, sans-serif', '#7a3fd4');
  drawControlsBar(ctx);
  s.fx.draw(ctx);
}

function drawLoseScreen(ctx, s, t) {
  ctx.fillStyle = '#f7ead0';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'THE VOID CAUGHT YOU', W / 2, 120, 'bold 52px system-ui, sans-serif', '#5e1a6e');
  text(ctx, s.loseReason || 'GAP CLOSED', W / 2, 180, 'bold 28px system-ui, sans-serif', '#d62828');
  text(ctx, 'TILE ' + Math.floor(s.trainPos) + ' / 300', W / 2, 235, 'bold 32px system-ui, sans-serif', '#3a2a18');
  text(ctx, 'SCORE ' + s.finalScore, W / 2, 285, 'bold 28px system-ui, sans-serif', '#3a2a18');
  // Build list (revisi 3, item 7) — juga di layar kalah: juri melihat build
  // yang membawa run sejauh ini.
  const build = s.economy.buildList();
  text(ctx, 'YOUR BUILD: ' + (build.length ? build.join('  ·  ') : '— NO BOONS'), W / 2, 320,
    'bold 18px system-ui, sans-serif', '#3a2a18');
  // Ambang S/A/B/C dengan ✓/✗ (revisi 3, item 7).
  text(ctx, gradeThresholdsText(s.finalScore), W / 2, 350, 'bold 18px system-ui, sans-serif', '#3a2a18');
  // NEXT GOAL (revisi 3, item 5).
  text(ctx, nextGoalText(s.feats || [], s.best, s.runs || []), W / 2, 380,
    'bold 18px system-ui, sans-serif', '#7a3fd4');
  // Seed run ini + best score (revisi 3, item 6).
  text(ctx, 'SEED ' + s.seed + '  ·  BEST SCORE: ' + s.best, W / 2, 410, 'bold 18px system-ui, sans-serif', '#6b4a1f');
  // Feat baru yang diraih run ini (bila ada).
  if (s.newFeats && s.newFeats.length) {
    const names = s.newFeats.map((id) => {
      const f = FEATS.find((x) => x.id === id);
      return f ? f.name : id;
    });
    text(ctx, 'NEW FEAT: ' + names.join(' · ') + '!', W / 2, 440, 'bold 18px system-ui, sans-serif', '#7a3fd4');
  }
  // Tombol: RETRY (seed baru) + SAME SEED (revisi 3, item 6).
  const b1 = { id: 'retry', x: W / 2 - 420, y: 480, w: 400, h: 70 };
  const b2 = { id: 'same-seed', x: W / 2 + 20, y: 480, w: 400, h: 70 };
  for (const b of [b1, b2]) {
    s.ui.push(b);
    ctx.fillStyle = b.id === 'retry' ? '#ffd166' : '#fff8e6';
    rr(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.strokeStyle = b.id === 'retry' ? '#b97d10' : '#7a3fd4';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  text(ctx, 'RETRY (R)', W / 2 - 220, 516, 'bold 24px system-ui, sans-serif', '#3a2a18');
  text(ctx, 'SAME SEED (S)', W / 2 + 220, 516, 'bold 24px system-ui, sans-serif', '#7a3fd4');
  drawControlsBar(ctx);
  s.fx.draw(ctx);
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return m + ':' + String(ss).padStart(2, '0');
}

export function drawScene(ctx, s, t) {
  s.ui.length = 0;
  if (s.screen === 'title') drawTitleScreen(ctx, s, t);
  else if (s.screen === 'station') drawStationScreen(ctx, s, t);
  else if (s.screen === 'win') drawWinScreen(ctx, s, t);
  else if (s.screen === 'lose') drawLoseScreen(ctx, s, t);
  else drawPlayScreen(ctx, s, t); // play | paused
}
