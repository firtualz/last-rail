// main.ts — titik masuk entri best-game-01 untuk LAST RAIL.
//
// Tugas file ini sederhana: siapkan direktori output, salin game/ dan
// screenshots/ ke sana, lalu minta library make.fun yang divendor untuk
// menulis dossier.json dari isi output tersebut.
//
// Cara pakai:
//   MAKEFUN_OUTPUT_DIR=/output node main.ts
// Kalau variabel MAKEFUN_OUTPUT_DIR tidak diset, output jatuh ke /output.
//
// Node 22, standard library saja — tidak ada dependensi yang perlu diinstal.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDossier } from './vendor/makefun-game.ts';

// Folder tempat file ini berada: game/ dan screenshots/ tinggal di sebelahnya.
const rootDir = dirname(fileURLToPath(import.meta.url));

// Tujuan penyalinan. Variabel lingkungan menang; kalau kosong, pakai /output.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// 1. Pastikan direktori output ada, sedalam apa pun jalurnya.
mkdirSync(outputDir, { recursive: true });

// 2. Salin seluruh isi game/ (index.html, skrip, gaya, aset) ke <out>/game/.
cpSync(join(rootDir, 'game'), join(outputDir, 'game'), { recursive: true });

// 3. Siapkan <out>/screenshots/ — selalu dibuat, meski kosong — lalu isi
//    dengan tangkapan layar yang ada di samping file ini, kalau ada.
const screenshotsOut = join(outputDir, 'screenshots');
mkdirSync(screenshotsOut, { recursive: true });
const screenshotsSrc = join(rootDir, 'screenshots');
if (existsSync(screenshotsSrc)) {
  cpSync(screenshotsSrc, screenshotsOut, { recursive: true });
}

// 4. Bangun dossier dari direktori output yang sudah lengkap, dengan batas
//    (caps) yang sama seperti yang dipakai penilai di gate.json.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

// 5. Simpan dossier sebagai <out>/dossier.json.
writeFileSync(join(outputDir, 'dossier.json'), dossier);
