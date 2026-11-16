// LAST RAIL — input: klik mouse (dipetakan ke koordinat logis 1280x720),
// gerak mouse (untuk ghost), drag (tahan + seret), dan keyboard.
// Satu tugas saja: mengubah kejadian browser menjadi panggilan handler.
export function attachInput(canvas, handlers) {
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.width) / r.width,
      y: ((e.clientY - r.top) * canvas.height) / r.height,
    };
  }
  canvas.addEventListener('pointerdown', (e) => {
    const p = toLogical(e);
    handlers.onPointer(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = toLogical(e);
    if (handlers.onMove) handlers.onMove(p.x, p.y);
  });
  canvas.addEventListener('pointerup', (e) => {
    const p = toLogical(e);
    if (handlers.onUp) handlers.onUp(p.x, p.y);
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (handlers.onRightClick) handlers.onRightClick();
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; // aksi diskrit (Boost/Shield/Pause/Mute) hanya pada tekan pertama — tahan tombol tidak boleh mengulang
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
    handlers.onKey(e.key);
  });
}

// Cari elemen UI (dari daftar hit yang dibangun render) di titik klik.
// Daftar dibangun dalam urutan gambar: elemen terakhir = paling atas.
export function hitUI(ui, x, y) {
  for (let i = ui.length - 1; i >= 0; i--) {
    const r = ui[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}
