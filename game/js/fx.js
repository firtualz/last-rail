// LAST RAIL — partikel & teks melayang: kilau kristal, debu pasang rel,
// sulur Void, dan angka "+2" yang naik lalu hilang. Satu tugas saja:
// umpan balik visual.
export class FX {
  constructor() {
    this.particles = [];
    this.floaters = [];
  }

  clear() {
    this.particles.length = 0;
    this.floaters.length = 0;
  }

  burst(x, y, color, n, speed) {
    for (let i = 0; i < (n || 10); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (speed || 90) * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.5 + Math.random() * 0.4,
        age: 0,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  // Kilau kristal saat diambil: percikan cyan yang naik.
  sparkle(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const s = 60 + Math.random() * 90;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 24,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.6 + Math.random() * 0.4,
        age: 0,
        size: 2 + Math.random() * 3,
        color: '#19c3d6',
      });
    }
  }

  // Debu kecil saat rel dipasang.
  dust(x, y) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 30,
        vy: -12 - Math.random() * 20,
        life: 0.5 + Math.random() * 0.3,
        age: 0,
        size: 3 + Math.random() * 4,
        color: 'rgba(180,150,90,0.7)',
      });
    }
  }

  // Asap kereta (dipanggil berkala dari main).
  smoke(x, y) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 10, y,
      vx: (Math.random() - 0.5) * 10,
      vy: -30 - Math.random() * 20,
      life: 1.0 + Math.random() * 0.5,
      age: 0,
      size: 6 + Math.random() * 6,
      color: 'rgba(120,110,100,0.5)',
      smoke: true,
    });
  }

  floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color: color || '#ffd166', age: 0, life: 1.3 });
  }

  update(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.smoke) p.vy -= 4 * dt;
      else p.vy += 160 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const f of this.floaters) {
      f.age += dt;
      f.y -= 42 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.age < f.life);
  }

  draw(ctx) {
    for (const p of this.particles) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = p.smoke ? a * 0.5 : a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.smoke ? 1 + p.age : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of this.floaters) {
      const a = 1 - f.age / f.life;
      ctx.globalAlpha = a;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(40,20,10,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
