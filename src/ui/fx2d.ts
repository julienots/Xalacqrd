// Lightweight 2D particle layer for UI/battle feedback (sparks, hits, coins).

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number }

class Fx2D {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private ps: P[] = [];
  private raf = 0;
  intensity = 1;

  private ensure() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fx-canvas';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    const rs = () => { const d = Math.min(2, devicePixelRatio || 1); this.canvas!.width = innerWidth * d; this.canvas!.height = innerHeight * d; this.ctx!.setTransform(d, 0, 0, d, 0, 0); };
    rs(); addEventListener('resize', rs);
  }

  burst(x: number, y: number, colors: string[], n = 24, speed = 260, gravity = 300, size = 4) {
    this.ensure();
    const count = Math.round(n * this.intensity);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
      this.ps.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life: 0, max: 0.5 + Math.random() * 0.6, size: size * (0.5 + Math.random()), color: colors[i % colors.length], g: gravity });
    }
    if (!this.raf) this.loop(performance.now());
  }

  burstAt(el: Element, colors: string[], n?: number, speed?: number) {
    const r = el.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, colors, n, speed);
  }

  private loop = (last: number) => {
    this.raf = requestAnimationFrame((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      const g = this.ctx!;
      g.clearRect(0, 0, innerWidth, innerHeight);
      g.globalCompositeOperation = 'lighter';
      this.ps = this.ps.filter((p) => {
        p.life += dt;
        if (p.life >= p.max) return false;
        p.vy += p.g * dt; p.vx *= 0.98; p.x += p.vx * dt; p.y += p.vy * dt;
        const k = 1 - p.life / p.max;
        g.globalAlpha = k;
        g.fillStyle = p.color;
        g.beginPath(); g.arc(p.x, p.y, p.size * k + 0.5, 0, Math.PI * 2); g.fill();
        return true;
      });
      g.globalAlpha = 1;
      if (this.ps.length) this.loop(now); else { this.raf = 0; g.clearRect(0, 0, innerWidth, innerHeight); }
    });
  };
}

export const fx2d = new Fx2D();

export function floatNumber(x: number, y: number, text: string, color: string) {
  const el = document.createElement('div');
  el.className = 'float-num';
  el.textContent = text;
  el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.color = color;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

export function floatAt(target: Element, text: string, color: string) {
  const r = target.getBoundingClientRect();
  floatNumber(r.left + r.width / 2, r.top + r.height * 0.3, text, color);
}

export function flashScreen(color = '#fff') {
  const f = document.createElement('div');
  f.className = 'flash';
  f.style.background = color;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 900);
}
