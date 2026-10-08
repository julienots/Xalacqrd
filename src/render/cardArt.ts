// Procedural illustration engine. Every card gets a unique, deterministic
// painting: an environment layer (background) and a subject layer (creature,
// artifact, sigil...) rendered separately so the UI can parallax them.

import { Rng } from '../core/rng';
import type { CardDef, FactionId } from '../core/types';

type C2D = CanvasRenderingContext2D;

export const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------------- backgrounds ----------------

function skyGradient(g: C2D, w: number, h: number, top: string, mid: string, bottom: string) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

function glow(g: C2D, x: number, y: number, r: number, color: string, alpha = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = alpha;
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
}

function stars(g: C2D, rng: Rng, w: number, h: number, n: number, color = '#fff') {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const r = rng.next() * 1.4 * (w / 300) + 0.3;
    g.globalAlpha = 0.3 + rng.next() * 0.7;
    g.beginPath(); g.arc(rng.next() * w, rng.next() * h, r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

function mountains(g: C2D, rng: Rng, w: number, h: number, baseY: number, amp: number, color: string, jag = 9) {
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, h);
  g.lineTo(0, baseY);
  const step = w / jag;
  for (let x = 0; x <= w + step; x += step) g.lineTo(x, baseY - rng.next() * amp);
  g.lineTo(w, h); g.closePath(); g.fill();
}

function hills(g: C2D, rng: Rng, w: number, h: number, baseY: number, amp: number, color: string) {
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, h); g.lineTo(0, baseY);
  let x = 0;
  while (x < w) {
    const nx = x + w * (0.2 + rng.next() * 0.25);
    g.quadraticCurveTo((x + nx) / 2, baseY - amp * (0.4 + rng.next()), nx, baseY + (rng.next() - 0.5) * amp * 0.3);
    x = nx;
  }
  g.lineTo(w, h); g.closePath(); g.fill();
}

function rays(g: C2D, x: number, y: number, len: number, n: number, color: string, alpha: number, rng: Rng) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const wid = 0.03 + rng.next() * 0.08;
    g.globalAlpha = alpha * (0.3 + rng.next() * 0.7);
    const gr = g.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.cos(a - wid) * len, y + Math.sin(a - wid) * len);
    g.lineTo(x + Math.cos(a + wid) * len, y + Math.sin(a + wid) * len);
    g.closePath(); g.fill();
  }
  g.restore();
}

function embers(g: C2D, rng: Rng, w: number, h: number, n: number, hue: number) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = rng.next() * w, y = rng.next() * h, r = (0.5 + rng.next() * 2.5) * (w / 300);
    glow(g, x, y, r * 4, hsl(hue + rng.int(-10, 20), 100, 60, 0.9), 0.5);
    g.fillStyle = hsl(hue + 20, 100, 85); g.beginPath(); g.arc(x, y, r * 0.6, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

export function paintBackground(g: C2D, card: CardDef, w: number, h: number) {
  const rng = new Rng(card.art.seed);
  const { hue, hue2 } = card.art;
  const f: FactionId = card.faction;
  switch (f) {
    case 'EMBER':
      skyGradient(g, w, h, hsl(hue - 10, 70, 12), hsl(hue, 85, 30), hsl(hue + 25, 100, 55));
      glow(g, w * (0.3 + rng.next() * 0.4), h * 0.55, w * 0.7, hsl(hue + 30, 100, 60, 0.8), 0.7);
      mountains(g, rng, w, h, h * 0.62, h * 0.3, hsl(hue - 5, 60, 10), 6);
      mountains(g, rng, w, h, h * 0.8, h * 0.18, hsl(hue, 70, 6), 11);
      g.strokeStyle = hsl(hue + 30, 100, 60, 0.8); g.lineWidth = w / 120;
      for (let i = 0; i < 4; i++) { g.beginPath(); let x = rng.next() * w, y = h * 0.8; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rng.next() - 0.5) * w * 0.15; y += h * 0.04; g.lineTo(x, y); } g.stroke(); }
      embers(g, rng, w, h, 28, hue + 10);
      break;
    case 'VERDANT':
      skyGradient(g, w, h, hsl(hue2, 50, 70), hsl(hue, 45, 35), hsl(hue + 10, 60, 12));
      rays(g, w * 0.7, -h * 0.1, h * 1.2, 9, hsl(hue2, 90, 85, 0.6), 0.5, rng);
      for (let i = 0; i < 7; i++) {
        const x = rng.next() * w, tw = w * (0.04 + rng.next() * 0.05);
        g.fillStyle = hsl(hue + 10, 40, 10 + rng.next() * 12, 0.9);
        g.fillRect(x - tw / 2, h * 0.15, tw, h);
        glow(g, x, h * 0.2, w * 0.18, hsl(hue, 60, 25, 0.9), 0.8);
      }
      hills(g, rng, w, h, h * 0.82, h * 0.1, hsl(hue, 55, 14));
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) glow(g, rng.next() * w, rng.next() * h, w / 60, hsl(hue2, 100, 75, 0.9), 0.6);
      g.restore();
      break;
    case 'ABYSS':
      skyGradient(g, w, h, hsl(hue2, 60, 35), hsl(hue, 70, 18), hsl(hue + 10, 80, 6));
      rays(g, w * 0.5, -h * 0.2, h * 1.3, 7, hsl(hue2, 90, 80, 0.5), 0.35, rng);
      g.strokeStyle = hsl(hue2, 80, 70, 0.15); g.lineWidth = w / 200;
      for (let i = 0; i < 18; i++) { g.beginPath(); const y = rng.next() * h * 0.6; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.6, y - 10, w, y + rng.next() * 10); g.stroke(); }
      for (let i = 0; i < 6; i++) {
        const x = rng.next() * w; g.fillStyle = hsl(hue + 30, 50, 10, 0.9);
        g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + (rng.next() - 0.5) * w * 0.2, h * 0.7, x + (rng.next() - 0.5) * w * 0.1, h * (0.55 + rng.next() * 0.2)); g.lineTo(x + w * 0.02, h); g.fill();
      }
      g.strokeStyle = hsl(hue2, 100, 85, 0.5); g.lineWidth = w / 300;
      for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(rng.next() * w, rng.next() * h, (1 + rng.next() * 4) * (w / 300), 0, Math.PI * 2); g.stroke(); }
      break;
    case 'VOLT': {
      skyGradient(g, w, h, hsl(hue2 + 30, 50, 10), hsl(hue2, 40, 24), hsl(hue2 - 20, 30, 12));
      for (let i = 0; i < 9; i++) glow(g, rng.next() * w, rng.next() * h * 0.6, w * (0.2 + rng.next() * 0.25), hsl(hue2, 20, 40, 0.8), 0.6);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) {
        let x = rng.next() * w, y = 0;
        g.strokeStyle = hsl(hue, 100, 80); g.lineWidth = (1 + rng.next() * 2) * (w / 300); g.shadowColor = hsl(hue2, 100, 70); g.shadowBlur = 12;
        g.beginPath(); g.moveTo(x, y);
        while (y < h * 0.85) { x += (rng.next() - 0.5) * w * 0.12; y += h * (0.04 + rng.next() * 0.06); g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
      mountains(g, rng, w, h, h * 0.86, h * 0.25, hsl(hue2 + 20, 30, 8), 5);
      break;
    }
    case 'VOID': {
      skyGradient(g, w, h, hsl(hue, 60, 6), hsl(hue, 50, 12), hsl(hue2, 60, 8));
      stars(g, rng, w, h, 60, hsl(hue2, 80, 85));
      const cx = w * (0.35 + rng.next() * 0.3), cy = h * (0.3 + rng.next() * 0.2);
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = hsl(hue + i * 8, 90, 55, 0.35 - i * 0.04); g.lineWidth = w / 50;
        g.beginPath(); g.ellipse(cx, cy, w * (0.12 + i * 0.07), h * (0.05 + i * 0.03), rng.next(), 0, Math.PI * 2); g.stroke();
      }
      glow(g, cx, cy, w * 0.2, hsl(hue2, 100, 60, 0.9), 0.7);
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(cx, cy, w * 0.07, h * 0.035, 0, 0, Math.PI * 2); g.fill();
      mountains(g, rng, w, h, h * 0.85, h * 0.12, hsl(hue, 40, 4), 14);
      break;
    }
    case 'AETHER':
      skyGradient(g, w, h, hsl(hue2, 70, 80), hsl(hue, 80, 85), hsl(hue + 10, 60, 60));
      glow(g, w * 0.5, h * 0.35, w * 0.8, hsl(hue, 100, 95, 1), 0.9);
      rays(g, w * 0.5, h * 0.35, h, 18, hsl(hue, 100, 90, 0.8), 0.6, rng);
      for (let i = 0; i < 7; i++) {
        const y = h * (0.55 + rng.next() * 0.4);
        for (let k = 0; k < 4; k++) glow(g, rng.next() * w, y + (rng.next() - 0.5) * h * 0.05, w * (0.12 + rng.next() * 0.12), hsl(hue2, 40, 96, 0.9), 0.85);
      }
      g.strokeStyle = hsl(hue + 10, 80, 60, 0.6); g.lineWidth = w / 100;
      g.beginPath(); g.arc(w * 0.5, h * 0.35, w * 0.32, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      break;
    case 'TITAN':
      skyGradient(g, w, h, hsl(hue + 180, 20, 55), hsl(hue, 25, 45), hsl(hue, 30, 18));
      mountains(g, rng, w, h, h * 0.5, h * 0.3, hsl(hue, 18, 34), 5);
      mountains(g, rng, w, h, h * 0.68, h * 0.25, hsl(hue, 22, 24), 7);
      mountains(g, rng, w, h, h * 0.85, h * 0.15, hsl(hue, 25, 13), 10);
      for (let i = 0; i < 10; i++) { g.fillStyle = hsl(hue, 20, 15 + rng.next() * 15, 0.9); const x = rng.next() * w, y = h * (0.8 + rng.next() * 0.2), r = w * (0.02 + rng.next() * 0.05); g.beginPath(); g.ellipse(x, y, r * 1.4, r, rng.next(), 0, Math.PI * 2); g.fill(); }
      glow(g, w * 0.8, h * 0.15, w * 0.3, hsl(40, 90, 80, 0.7), 0.6);
      break;
    case 'COSMOS': {
      skyGradient(g, w, h, hsl(hue, 70, 8), hsl(hue + 20, 60, 14), hsl(hue2, 50, 12));
      for (let i = 0; i < 6; i++) glow(g, rng.next() * w, rng.next() * h, w * (0.2 + rng.next() * 0.3), hsl(i % 2 ? hue : hue2, 90, 55, 0.6), 0.45);
      stars(g, rng, w, h, 120);
      const px = w * (0.15 + rng.next() * 0.7), py = h * (0.15 + rng.next() * 0.3), pr = w * (0.08 + rng.next() * 0.1);
      const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
      pg.addColorStop(0, hsl(hue2 + 30, 80, 80)); pg.addColorStop(1, hsl(hue, 60, 20));
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = hsl(hue2, 80, 80, 0.6); g.lineWidth = w / 150;
      g.beginPath(); g.ellipse(px, py, pr * 1.8, pr * 0.4, -0.3, 0, Math.PI * 2); g.stroke();
      break;
    }
  }
  // atmospheric vignette
  const v = g.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}

// ---------------- subjects ----------------

interface Pal { body: string; dark: string; light: string; accent: string; eye: string; glowC: string }

function palette(card: CardDef, rng: Rng): Pal {
  const { hue, hue2 } = card.art;
  const f = card.faction;
  const sat = f === 'TITAN' ? 25 : f === 'AETHER' ? 60 : 70;
  const lit = f === 'VOID' ? 28 : f === 'AETHER' ? 78 : f === 'TITAN' ? 45 : 45;
  return {
    body: hsl(hue + rng.int(-8, 8), sat, lit),
    dark: hsl(hue - 10, sat, Math.max(6, lit - 28)),
    light: hsl(hue + 15, sat + 10, Math.min(95, lit + 25)),
    accent: hsl(hue2, 90, 60),
    eye: hsl(hue2 + 40, 100, 75),
    glowC: hsl(hue2, 100, 65),
  };
}

function shade(g: C2D, x: number, y: number, r: number, p: Pal) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.05, x, y, r * 1.1);
  gr.addColorStop(0, p.light); gr.addColorStop(0.45, p.body); gr.addColorStop(1, p.dark);
  return gr;
}

function eyes(g: C2D, x: number, y: number, s: number, p: Pal, spread = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const dx of [-s * 0.5 * spread, s * 0.5 * spread]) {
    glow(g, x + dx, y, s * 0.9, p.eye, 0.9);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x + dx, y, s * 0.28, s * 0.16, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function rim(g: C2D, color: string, blur: number) { g.shadowColor = color; g.shadowBlur = blur; }

function drawDrake(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const cx = w * 0.5, cy = h * 0.55, s = w * 0.3;
  // wings
  for (const side of [-1, 1]) {
    g.fillStyle = p.dark; g.globalAlpha = 0.92;
    g.beginPath();
    g.moveTo(cx + side * s * 0.2, cy - s * 0.3);
    g.quadraticCurveTo(cx + side * s * 1.2, cy - s * 1.6, cx + side * s * 1.65, cy - s * 0.9);
    for (let k = 0; k < 4; k++) g.quadraticCurveTo(cx + side * s * (1.45 - k * 0.3), cy - s * (0.4 - k * 0.05), cx + side * s * (1.3 - k * 0.32), cy - s * (0.1 - k * 0.12));
    g.closePath(); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = p.accent; g.lineWidth = w / 160;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(cx + side * s * 0.25, cy - s * 0.35); g.lineTo(cx + side * s * (1.6 - k * 0.32), cy - s * (0.9 - k * 0.25)); g.stroke(); }
  }
  // tail
  g.strokeStyle = p.body; g.lineWidth = s * 0.22; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy + s * 0.3); g.bezierCurveTo(cx + s * 0.9, cy + s * 0.9, cx - s * 0.6, cy + s * 1.1, cx + s * 0.4 * (rng.next() > 0.5 ? 1 : -1), cy + s * 1.25); g.stroke();
  // body
  rim(g, p.glowC, w / 30);
  g.fillStyle = shade(g, cx, cy, s * 0.6, p);
  g.beginPath(); g.ellipse(cx, cy + s * 0.1, s * 0.5, s * 0.62, 0, 0, Math.PI * 2); g.fill();
  // belly plates
  g.shadowBlur = 0;
  g.fillStyle = p.light; g.globalAlpha = 0.5;
  for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx, cy - s * 0.15 + k * s * 0.15, s * 0.22 - k * 0.01 * s, s * 0.05, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  // neck + head
  g.fillStyle = shade(g, cx, cy - s * 0.7, s * 0.4, p);
  g.beginPath(); g.moveTo(cx - s * 0.2, cy - s * 0.3); g.quadraticCurveTo(cx - s * 0.1, cy - s * 0.85, cx, cy - s * 0.95); g.quadraticCurveTo(cx + s * 0.1, cy - s * 0.85, cx + s * 0.2, cy - s * 0.3); g.fill();
  rim(g, p.glowC, w / 40);
  g.beginPath(); g.ellipse(cx, cy - s * 1.0, s * 0.28, s * 0.22, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx - s * 0.15, cy - s * 0.92); g.lineTo(cx, cy - s * 0.62); g.lineTo(cx + s * 0.15, cy - s * 0.92); g.fill();
  g.shadowBlur = 0;
  // horns
  g.fillStyle = p.light;
  for (const side of [-1, 1]) { g.beginPath(); g.moveTo(cx + side * s * 0.15, cy - s * 1.15); g.quadraticCurveTo(cx + side * s * 0.45, cy - s * 1.35, cx + side * s * 0.5, cy - s * 1.6); g.quadraticCurveTo(cx + side * s * 0.3, cy - s * 1.3, cx + side * s * 0.05, cy - s * 1.18); g.fill(); }
  eyes(g, cx, cy - s * 1.02, s * 0.2, p);
}

function drawBeast(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const cx = w * 0.5, cy = h * 0.6, s = w * 0.3;
  g.fillStyle = p.dark;
  for (const [lx, ly] of [[-0.45, 0.3], [-0.2, 0.35], [0.25, 0.35], [0.5, 0.3]]) { g.beginPath(); g.roundRect(cx + lx * s - s * 0.08, cy + ly * s, s * 0.16, s * 0.65, s * 0.06); g.fill(); }
  // tail
  g.strokeStyle = p.body; g.lineWidth = s * 0.1; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx + s * 0.6, cy); g.quadraticCurveTo(cx + s * 1.1, cy - s * 0.3, cx + s * 0.95, cy - s * 0.8); g.stroke();
  rim(g, p.glowC, w / 30);
  g.fillStyle = shade(g, cx, cy, s * 0.7, p);
  g.beginPath(); g.ellipse(cx, cy, s * 0.75, s * 0.42, 0, 0, Math.PI * 2); g.fill();
  // mane
  g.fillStyle = p.accent; g.globalAlpha = 0.85;
  for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 - 1.2 + k * 0.3; g.beginPath(); g.moveTo(cx - s * 0.55, cy - s * 0.35); g.lineTo(cx - s * 0.55 + Math.cos(a) * s * 0.55, cy - s * 0.35 + Math.sin(a) * s * 0.55); g.lineTo(cx - s * 0.55 + Math.cos(a + 0.2) * s * 0.3, cy - s * 0.35 + Math.sin(a + 0.2) * s * 0.3); g.fill(); }
  g.globalAlpha = 1;
  // head
  g.fillStyle = shade(g, cx - s * 0.7, cy - s * 0.45, s * 0.35, p);
  g.beginPath(); g.ellipse(cx - s * 0.7, cy - s * 0.45, s * 0.3, s * 0.26, -0.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx - s * 0.95, cy - s * 0.35, s * 0.18, s * 0.12, -0.2, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  // ears / antlers
  g.fillStyle = p.dark;
  if (rng.next() > 0.5) {
    g.strokeStyle = p.light; g.lineWidth = s * 0.05;
    for (const side of [-1, 1]) { g.beginPath(); g.moveTo(cx - s * 0.7 + side * s * 0.1, cy - s * 0.65); g.lineTo(cx - s * 0.7 + side * s * 0.3, cy - s * 1.15); g.moveTo(cx - s * 0.7 + side * s * 0.2, cy - s * 0.9); g.lineTo(cx - s * 0.7 + side * s * 0.45, cy - s * 1.0); g.stroke(); }
  } else for (const side of [-1, 1]) { g.beginPath(); g.moveTo(cx - s * 0.7 + side * s * 0.05, cy - s * 0.65); g.lineTo(cx - s * 0.7 + side * s * 0.22, cy - s * 0.98); g.lineTo(cx - s * 0.7 + side * s * 0.25, cy - s * 0.6); g.fill(); }
  eyes(g, cx - s * 0.78, cy - s * 0.5, s * 0.14, p, 1.2);
}

function drawElemental(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const cx = w * 0.5, cy = h * 0.52, s = w * 0.3;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + rng.next() * 0.3;
    const len = s * (0.9 + rng.next() * 0.8);
    g.fillStyle = hsl(Number(p.accent.match(/\d+/)![0]) + k * 3, 90, 55, 0.35);
    g.beginPath(); g.moveTo(cx, cy);
    g.quadraticCurveTo(cx + Math.cos(a + 0.5) * len * 0.6, cy + Math.sin(a + 0.5) * len * 0.6, cx + Math.cos(a) * len, cy + Math.sin(a) * len - s * 0.3);
    g.quadraticCurveTo(cx + Math.cos(a - 0.4) * len * 0.5, cy + Math.sin(a - 0.4) * len * 0.5, cx, cy);
    g.fill();
  }
  glow(g, cx, cy, s * 1.1, p.glowC, 0.8);
  g.restore();
  rim(g, p.glowC, w / 20);
  g.fillStyle = shade(g, cx, cy, s * 0.5, p);
  g.beginPath(); g.arc(cx, cy, s * 0.48, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  // orbiting shards
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, r = s * 0.85;
    g.fillStyle = p.light;
    g.beginPath(); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.5;
    g.moveTo(x, y - s * 0.12); g.lineTo(x + s * 0.06, y); g.lineTo(x, y + s * 0.12); g.lineTo(x - s * 0.06, y); g.fill();
  }
  eyes(g, cx, cy - s * 0.05, s * 0.22, p);
}

function drawKnight(g: C2D, w: number, h: number, p: Pal, rng: Rng, champion = false) {
  const cx = w * 0.5, cy = h * 0.55, s = w * 0.3;
  // cape
  g.fillStyle = p.accent; g.globalAlpha = 0.9;
  g.beginPath(); g.moveTo(cx - s * 0.45, cy - s * 0.55); g.quadraticCurveTo(cx - s * 0.9, cy + s * 0.6, cx - s * 0.7, cy + s * 1.3); g.lineTo(cx + s * 0.7, cy + s * 1.3); g.quadraticCurveTo(cx + s * 0.9, cy + s * 0.6, cx + s * 0.45, cy - s * 0.55); g.fill();
  g.globalAlpha = 1;
  // weapon
  const lance = rng.next() > 0.5;
  g.save(); g.translate(cx + s * 0.7, cy); g.rotate(lance ? -0.25 : -0.5);
  rim(g, p.glowC, w / 25);
  g.fillStyle = p.light;
  if (lance) { g.beginPath(); g.moveTo(-s * 0.04, s * 0.9); g.lineTo(-s * 0.04, -s * 1.3); g.lineTo(0, -s * 1.6); g.lineTo(s * 0.04, -s * 1.3); g.lineTo(s * 0.04, s * 0.9); g.fill(); }
  else { g.beginPath(); g.moveTo(-s * 0.07, 0); g.lineTo(0, -s * 1.3); g.lineTo(s * 0.07, 0); g.fill(); g.fillStyle = p.accent; g.fillRect(-s * 0.2, -s * 0.02, s * 0.4, s * 0.07); g.fillStyle = p.dark; g.fillRect(-s * 0.04, 0, s * 0.08, s * 0.3); }
  g.restore();
  g.shadowBlur = 0;
  // body armor
  rim(g, p.glowC, w / 30);
  g.fillStyle = shade(g, cx, cy, s * 0.6, p);
  g.beginPath(); g.moveTo(cx - s * 0.4, cy - s * 0.5); g.lineTo(cx + s * 0.4, cy - s * 0.5); g.lineTo(cx + s * 0.3, cy + s * 0.5); g.lineTo(cx + s * 0.38, cy + s * 1.2); g.lineTo(cx - s * 0.38, cy + s * 1.2); g.lineTo(cx - s * 0.3, cy + s * 0.5); g.closePath(); g.fill();
  // pauldrons
  for (const side of [-1, 1]) { g.beginPath(); g.ellipse(cx + side * s * 0.45, cy - s * 0.45, s * 0.24, s * 0.16, side * 0.3, 0, Math.PI * 2); g.fill(); }
  // helmet
  g.beginPath(); g.ellipse(cx, cy - s * 0.85, s * 0.22, s * 0.28, 0, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = p.dark; g.fillRect(cx - s * 0.16, cy - s * 0.88, s * 0.32, s * 0.06);
  eyes(g, cx, cy - s * 0.85, s * 0.12, p, 1.1);
  // crest / crown
  g.fillStyle = champion ? '#ffd76a' : p.accent;
  if (champion) { g.beginPath(); for (let k = 0; k < 5; k++) { const x = cx - s * 0.2 + k * s * 0.1; g.moveTo(x, cy - s * 1.08); g.lineTo(x + s * 0.05, cy - s * 1.3); g.lineTo(x + s * 0.1, cy - s * 1.08); } g.fill(); }
  else { g.beginPath(); g.moveTo(cx - s * 0.05, cy - s * 1.1); g.quadraticCurveTo(cx + s * 0.3, cy - s * 1.5, cx + s * 0.5, cy - s * 1.2); g.quadraticCurveTo(cx + s * 0.2, cy - s * 1.25, cx + s * 0.05, cy - s * 1.08); g.fill(); }
  // chest emblem
  glow(g, cx, cy - s * 0.1, s * 0.2, p.glowC, 0.9);
}

function drawSerpent(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const s = w * 0.3;
  const pts: [number, number][] = [];
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    pts.push([w * 0.5 + Math.sin(t * Math.PI * 2.4 + rng.next() * 0.05) * w * 0.28 * (1 - t * 0.3), h * 0.95 - t * h * 0.68]);
  }
  rim(g, p.glowC, w / 30);
  for (let k = 0; k < pts.length; k++) {
    const t = k / pts.length;
    const r = s * (0.12 + t * 0.14);
    g.fillStyle = shade(g, pts[k][0], pts[k][1], r, p);
    g.beginPath(); g.arc(pts[k][0], pts[k][1], r, 0, Math.PI * 2); g.fill();
  }
  g.shadowBlur = 0;
  // scales highlights
  g.fillStyle = p.light; g.globalAlpha = 0.35;
  for (let k = 2; k < pts.length; k += 3) { g.beginPath(); g.arc(pts[k][0] - s * 0.05, pts[k][1] - s * 0.05, s * 0.06, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  const [hx, hy] = pts[pts.length - 1];
  // fins
  g.fillStyle = p.accent;
  for (const side of [-1, 1]) { g.beginPath(); g.moveTo(hx + side * s * 0.15, hy); g.quadraticCurveTo(hx + side * s * 0.6, hy - s * 0.4, hx + side * s * 0.45, hy + s * 0.2); g.fill(); }
  rim(g, p.glowC, w / 30);
  g.fillStyle = shade(g, hx, hy, s * 0.35, p);
  g.beginPath(); g.ellipse(hx, hy, s * 0.32, s * 0.26, 0, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  eyes(g, hx, hy - s * 0.04, s * 0.18, p, 1.1);
  g.fillStyle = '#fff'; for (const side of [-1, 1]) { g.beginPath(); g.moveTo(hx + side * s * 0.08, hy + s * 0.14); g.lineTo(hx + side * s * 0.05, hy + s * 0.28); g.lineTo(hx + side * s * 0.02, hy + s * 0.14); g.fill(); }
}

function drawGolem(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const cx = w * 0.5, cy = h * 0.58, s = w * 0.3;
  const block = (x: number, y: number, bw: number, bh: number) => {
    g.fillStyle = shade(g, x, y, Math.max(bw, bh), p);
    g.beginPath();
    g.moveTo(x - bw / 2 + rng.next() * bw * 0.1, y - bh / 2);
    g.lineTo(x + bw / 2, y - bh / 2 + rng.next() * bh * 0.15);
    g.lineTo(x + bw / 2 - rng.next() * bw * 0.1, y + bh / 2);
    g.lineTo(x - bw / 2, y + bh / 2 - rng.next() * bh * 0.1);
    g.closePath(); g.fill();
  };
  rim(g, p.glowC, w / 30);
  block(cx - s * 0.35, cy + s * 0.85, s * 0.35, s * 0.55); block(cx + s * 0.35, cy + s * 0.85, s * 0.35, s * 0.55);
  block(cx, cy, s * 1.1, s * 1.0);
  block(cx - s * 0.75, cy + s * 0.1, s * 0.4, s * 0.9); block(cx + s * 0.75, cy + s * 0.1, s * 0.4, s * 0.9);
  block(cx - s * 0.62, cy - s * 0.45, s * 0.5, s * 0.4); block(cx + s * 0.62, cy - s * 0.45, s * 0.5, s * 0.4);
  block(cx, cy - s * 0.72, s * 0.45, s * 0.4);
  g.shadowBlur = 0;
  // runes and crystals
  g.strokeStyle = p.glowC; g.lineWidth = w / 120; rim(g, p.glowC, w / 40);
  for (let k = 0; k < 5; k++) { const x = cx + (rng.next() - 0.5) * s * 0.8, y = cy + (rng.next() - 0.5) * s * 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 0.08, y + s * 0.1); g.lineTo(x - s * 0.03, y + s * 0.18); g.stroke(); }
  g.shadowBlur = 0;
  g.fillStyle = p.accent;
  for (let k = 0; k < 3; k++) { const x = cx + (k - 1) * s * 0.35, y = cy - s * 0.95 - (k === 1 ? s * 0.15 : 0); g.beginPath(); g.moveTo(x - s * 0.06, y + s * 0.1); g.lineTo(x, y - s * 0.25); g.lineTo(x + s * 0.06, y + s * 0.1); g.fill(); }
  glow(g, cx, cy, s * 0.25, p.glowC, 0.9);
  eyes(g, cx, cy - s * 0.74, s * 0.13, p, 1.3);
}

function drawInsect(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const cx = w * 0.5, cy = h * 0.56, s = w * 0.3;
  // wings
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) for (const k of [0, 1]) {
    g.fillStyle = hsl(Number(p.accent.match(/\d+/)![0]), 80, 70, 0.3);
    g.beginPath(); g.ellipse(cx + side * s * (0.55 + k * 0.1), cy - s * (0.5 - k * 0.5), s * 0.6, s * 0.22, side * (0.5 - k * 0.9), 0, Math.PI * 2); g.fill();
    g.strokeStyle = p.light; g.lineWidth = w / 300; g.stroke();
  }
  g.restore();
  // legs
  g.strokeStyle = p.dark; g.lineWidth = s * 0.05;
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx, cy + k * s * 0.15); g.lineTo(cx + side * s * 0.5, cy + k * s * 0.2 - s * 0.1); g.lineTo(cx + side * s * 0.65, cy + s * 0.4 + k * s * 0.2); g.stroke(); }
  rim(g, p.glowC, w / 30);
  g.fillStyle = shade(g, cx, cy + s * 0.55, s * 0.4, p);
  g.beginPath(); g.ellipse(cx, cy + s * 0.55, s * 0.26, s * 0.45, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = shade(g, cx, cy, s * 0.3, p);
  g.beginPath(); g.ellipse(cx, cy, s * 0.22, s * 0.25, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx, cy - s * 0.38, s * 0.2, s * 0.17, 0, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = p.accent; g.globalAlpha = 0.6;
  for (let k = 0; k < 4; k++) { g.fillRect(cx - s * 0.22, cy + s * 0.3 + k * s * 0.15, s * 0.44, s * 0.04); }
  g.globalAlpha = 1;
  g.strokeStyle = p.light; g.lineWidth = w / 200;
  for (const side of [-1, 1]) { g.beginPath(); g.moveTo(cx + side * s * 0.08, cy - s * 0.5); g.quadraticCurveTo(cx + side * s * 0.3, cy - s * 1.0, cx + side * s * (0.5 + rng.next() * 0.1), cy - s * 0.95); g.stroke(); }
  eyes(g, cx, cy - s * 0.4, s * 0.16, p, 1.2);
}

function drawSpirit(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const cx = w * 0.5, cy = h * 0.48, s = w * 0.3;
  g.save(); g.globalCompositeOperation = 'lighter';
  glow(g, cx, cy, s * 1.3, p.glowC, 0.5);
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = hsl(Number(p.body.match(/\d+/)![0]), 70, 60 + layer * 10, 0.25);
    g.beginPath();
    g.moveTo(cx - s * 0.45, cy);
    g.quadraticCurveTo(cx - s * 0.5, cy - s * 0.8, cx, cy - s * 0.85);
    g.quadraticCurveTo(cx + s * 0.5, cy - s * 0.8, cx + s * 0.45, cy);
    const sway = (rng.next() - 0.5) * s;
    g.bezierCurveTo(cx + s * 0.5, cy + s * 0.7, cx + sway, cy + s * 0.9, cx + sway * 1.5, cy + s * 1.6);
    g.bezierCurveTo(cx - s * 0.1, cy + s * 0.9, cx - s * 0.6, cy + s * 0.7, cx - s * 0.45, cy);
    g.fill();
  }
  // arms wisps
  g.strokeStyle = hsl(Number(p.accent.match(/\d+/)![0]), 90, 70, 0.4); g.lineWidth = s * 0.08; g.lineCap = 'round';
  for (const side of [-1, 1]) { g.beginPath(); g.moveTo(cx + side * s * 0.35, cy - s * 0.2); g.quadraticCurveTo(cx + side * s * 0.9, cy - s * 0.1, cx + side * s * 0.8, cy + s * 0.5); g.stroke(); }
  g.restore();
  eyes(g, cx, cy - s * 0.45, s * 0.2, p, 1.1);
  // halo / crown of motes
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; glow(g, cx + Math.cos(a) * s * 0.55, cy - s * 0.95 + Math.sin(a) * s * 0.12, s * 0.07, p.eye, 0.9); }
  g.restore();
}

function drawConstruct(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const cx = w * 0.5, cy = h * 0.56, s = w * 0.3;
  // gears behind
  g.strokeStyle = p.dark; g.lineWidth = s * 0.06;
  for (const [gx, gy, gr] of [[cx - s * 0.75, cy - s * 0.6, s * 0.35], [cx + s * 0.8, cy - s * 0.2, s * 0.28]]) {
    g.beginPath(); g.arc(gx, gy, gr, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.moveTo(gx + Math.cos(a) * gr, gy + Math.sin(a) * gr); g.lineTo(gx + Math.cos(a) * gr * 1.25, gy + Math.sin(a) * gr * 1.25); g.stroke(); }
  }
  rim(g, p.glowC, w / 30);
  g.fillStyle = shade(g, cx, cy, s * 0.7, p);
  // legs
  g.fillRect(cx - s * 0.45, cy + s * 0.5, s * 0.22, s * 0.7); g.fillRect(cx + s * 0.23, cy + s * 0.5, s * 0.22, s * 0.7);
  // torso hex
  g.beginPath();
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * s * 0.62, cy + Math.sin(a) * s * 0.55); }
  g.closePath(); g.fill();
  // arms
  g.fillRect(cx - s * 0.95, cy - s * 0.3, s * 0.28, s * 0.8); g.fillRect(cx + s * 0.67, cy - s * 0.3, s * 0.28, s * 0.8);
  // head
  g.beginPath(); g.roundRect(cx - s * 0.25, cy - s * 0.95, s * 0.5, s * 0.35, s * 0.08); g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = p.light; g.lineWidth = w / 200;
  g.beginPath(); g.moveTo(cx, cy - s * 0.95); g.lineTo(cx + s * 0.1, cy - s * 1.25); g.stroke();
  glow(g, cx + s * 0.1, cy - s * 1.27, s * 0.08, p.eye, 1);
  // core
  g.save(); g.globalCompositeOperation = 'lighter';
  glow(g, cx, cy, s * 0.4, p.glowC, 1);
  g.restore();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, s * 0.08, 0, Math.PI * 2); g.fill();
  // visor
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = p.eye; g.fillRect(cx - s * 0.18, cy - s * 0.82, s * 0.36, s * 0.07);
  glow(g, cx, cy - s * 0.79, s * 0.25, p.eye, 0.6);
  g.restore();
  void rng;
}

function drawMage(g: C2D, w: number, h: number, p: Pal, rng: Rng, champion = false) {
  const cx = w * 0.5, cy = h * 0.55, s = w * 0.3;
  // staff
  g.strokeStyle = p.dark; g.lineWidth = s * 0.06;
  g.beginPath(); g.moveTo(cx + s * 0.6, cy + s * 1.3); g.lineTo(cx + s * 0.6, cy - s * 1.0); g.stroke();
  g.save(); g.globalCompositeOperation = 'lighter';
  glow(g, cx + s * 0.6, cy - s * 1.1, s * 0.45, p.glowC, 1);
  g.restore();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + s * 0.6, cy - s * 1.1, s * 0.09, 0, Math.PI * 2); g.fill();
  // robe
  rim(g, p.glowC, w / 30);
  g.fillStyle = shade(g, cx, cy, s * 0.8, p);
  g.beginPath(); g.moveTo(cx - s * 0.25, cy - s * 0.6); g.quadraticCurveTo(cx - s * 0.7, cy + s * 0.5, cx - s * 0.65, cy + s * 1.3); g.lineTo(cx + s * 0.65, cy + s * 1.3); g.quadraticCurveTo(cx + s * 0.7, cy + s * 0.5, cx + s * 0.25, cy - s * 0.6); g.fill();
  // hood
  g.beginPath(); g.moveTo(cx - s * 0.32, cy - s * 0.45); g.quadraticCurveTo(cx - s * 0.35, cy - s * 1.1, cx, cy - s * 1.2); g.quadraticCurveTo(cx + s * 0.35, cy - s * 1.1, cx + s * 0.32, cy - s * 0.45); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(0,0,0,0.75)'; g.beginPath(); g.ellipse(cx, cy - s * 0.75, s * 0.18, s * 0.24, 0, 0, Math.PI * 2); g.fill();
  eyes(g, cx, cy - s * 0.78, s * 0.12, p, 1);
  // trims & runes
  g.strokeStyle = champion ? '#ffd76a' : p.accent; g.lineWidth = s * 0.04;
  g.beginPath(); g.moveTo(cx, cy - s * 0.5); g.lineTo(cx, cy + s * 1.3); g.stroke();
  g.save(); g.globalCompositeOperation = 'lighter'; g.font = `${s * 0.22}px serif`; g.fillStyle = p.eye;
  const runes = '✦✧⟡◈⌘☉✶⋄';
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; g.globalAlpha = 0.7; g.fillText(runes[rng.int(0, runes.length - 1)], cx + Math.cos(a) * s * 0.95 - s * 0.08, cy + Math.sin(a) * s * 0.45); }
  g.restore();
}

function drawSigil(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const cx = w * 0.5, cy = h * 0.5, s = w * 0.36;
  g.save(); g.globalCompositeOperation = 'lighter';
  glow(g, cx, cy, s * 1.2, p.glowC, 0.8);
  rim(g, p.glowC, w / 20);
  g.strokeStyle = p.eye; g.lineWidth = w / 90;
  g.beginPath(); g.arc(cx, cy, s * 0.8, 0, Math.PI * 2); g.stroke();
  g.lineWidth = w / 200; g.beginPath(); g.arc(cx, cy, s * 0.68, 0, Math.PI * 2); g.stroke();
  const n = rng.int(3, 8);
  g.lineWidth = w / 120; g.beginPath();
  for (let k = 0; k <= n; k++) { const a = (k * 2 * Math.PI * 2) / n - Math.PI / 2; g.lineTo(cx + Math.cos(a) * s * 0.68, cy + Math.sin(a) * s * 0.68); }
  g.stroke();
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 - Math.PI / 2; glow(g, cx + Math.cos(a) * s * 0.8, cy + Math.sin(a) * s * 0.8, s * 0.1, p.accent, 1); }
  // burst
  rays(g, cx, cy, s * 1.6, 22, p.eye, 0.5, rng);
  glow(g, cx, cy, s * 0.3, '#ffffff', 1);
  g.restore();
}

function drawEquipment(g: C2D, w: number, h: number, p: Pal, rng: Rng, name: string) {
  const cx = w * 0.5, cy = h * 0.5, s = w * 0.32;
  g.save(); g.globalCompositeOperation = 'lighter'; glow(g, cx, cy, s * 1.3, p.glowC, 0.55); g.restore();
  rim(g, p.glowC, w / 25);
  const n = name.toLowerCase();
  g.fillStyle = shade(g, cx, cy, s, p);
  if (/aegis|cloak|mantle|helm/.test(n)) {
    g.beginPath(); g.moveTo(cx, cy - s); g.quadraticCurveTo(cx + s * 0.85, cy - s * 0.85, cx + s * 0.75, cy); g.quadraticCurveTo(cx + s * 0.55, cy + s * 0.8, cx, cy + s * 1.05); g.quadraticCurveTo(cx - s * 0.55, cy + s * 0.8, cx - s * 0.75, cy); g.quadraticCurveTo(cx - s * 0.85, cy - s * 0.85, cx, cy - s); g.fill();
    g.shadowBlur = 0; g.strokeStyle = p.accent; g.lineWidth = s * 0.08; g.stroke();
    glow(g, cx, cy - s * 0.1, s * 0.3, p.eye, 1);
  } else if (/crown|pendant|talisman/.test(n)) {
    g.beginPath(); g.moveTo(cx - s * 0.8, cy + s * 0.4);
    for (let k = 0; k < 5; k++) { g.lineTo(cx - s * 0.8 + k * s * 0.4, cy - s * (k % 2 ? 0.2 : 0.7)); }
    g.lineTo(cx + s * 0.8, cy + s * 0.4); g.closePath(); g.fill();
    g.shadowBlur = 0;
    for (let k = 0; k < 3; k++) glow(g, cx - s * 0.4 + k * s * 0.4, cy + s * 0.15, s * 0.12, p.eye, 1);
  } else if (/bow/.test(n)) {
    g.lineWidth = s * 0.12; g.strokeStyle = p.body; g.beginPath(); g.arc(cx - s * 0.5, cy, s, -1, 1); g.stroke();
    g.lineWidth = w / 300; g.strokeStyle = p.light; g.beginPath(); g.moveTo(cx - s * 0.5 + Math.cos(-1) * s, cy + Math.sin(-1) * s); g.lineTo(cx - s * 0.5 + Math.cos(1) * s, cy + Math.sin(1) * s); g.stroke();
  } else if (/hammer|scepter/.test(n)) {
    g.save(); g.translate(cx, cy); g.rotate(-0.6);
    g.fillStyle = p.dark; g.fillRect(-s * 0.06, -s * 0.4, s * 0.12, s * 1.5);
    g.fillStyle = shade(g, 0, -s * 0.6, s * 0.5, p); g.beginPath(); g.roundRect(-s * 0.5, -s * 0.85, s, s * 0.45, s * 0.08); g.fill();
    g.restore();
  } else {
    g.save(); g.translate(cx, cy); g.rotate(-0.7 + rng.next() * 0.2);
    g.beginPath(); g.moveTo(-s * 0.1, s * 0.3); g.lineTo(-s * 0.08, -s * 1.1); g.lineTo(0, -s * 1.35); g.lineTo(s * 0.08, -s * 1.1); g.lineTo(s * 0.1, s * 0.3); g.fill();
    g.fillStyle = p.accent; g.fillRect(-s * 0.35, s * 0.3, s * 0.7, s * 0.1);
    g.fillStyle = p.dark; g.fillRect(-s * 0.06, s * 0.4, s * 0.12, s * 0.45);
    glow(g, 0, s * 0.35, s * 0.15, p.eye, 1);
    g.restore();
  }
  g.shadowBlur = 0;
}

function drawRelic(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  const cx = w * 0.5, cy = h * 0.5, s = w * 0.3;
  g.save(); g.globalCompositeOperation = 'lighter';
  rays(g, cx, cy, s * 2, 26, p.eye, 0.5, rng);
  glow(g, cx, cy, s * 1.4, p.glowC, 0.7);
  g.restore();
  // ornate ring
  rim(g, p.glowC, w / 20);
  g.strokeStyle = '#ffd76a'; g.lineWidth = s * 0.08;
  g.beginPath(); g.arc(cx, cy, s * 0.85, 0, Math.PI * 2); g.stroke();
  g.lineWidth = s * 0.03;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * s * 0.85, cy + Math.sin(a) * s * 0.85); g.lineTo(cx + Math.cos(a) * s * 1.1, cy + Math.sin(a) * s * 1.1); g.stroke(); }
  // crystal
  g.fillStyle = shade(g, cx, cy, s * 0.6, p);
  g.beginPath(); g.moveTo(cx, cy - s * 0.7); g.lineTo(cx + s * 0.4, cy - s * 0.1); g.lineTo(cx + s * 0.25, cy + s * 0.6); g.lineTo(cx - s * 0.25, cy + s * 0.6); g.lineTo(cx - s * 0.4, cy - s * 0.1); g.closePath(); g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = p.light; g.lineWidth = w / 250;
  g.beginPath(); g.moveTo(cx, cy - s * 0.7); g.lineTo(cx, cy + s * 0.6); g.moveTo(cx - s * 0.4, cy - s * 0.1); g.lineTo(cx + s * 0.4, cy - s * 0.1); g.stroke();
  g.save(); g.globalCompositeOperation = 'lighter'; glow(g, cx, cy - s * 0.1, s * 0.35, '#fff', 0.9); g.restore();
}

function drawTerrainFocus(g: C2D, w: number, h: number, p: Pal, rng: Rng) {
  // a landmark in the distance: spire / arch / tree
  const cx = w * (0.4 + rng.next() * 0.2), base = h * 0.82;
  rim(g, p.glowC, w / 25);
  g.fillStyle = p.dark;
  const kind = rng.int(0, 2);
  if (kind === 0) { g.beginPath(); g.moveTo(cx - w * 0.08, base); g.lineTo(cx - w * 0.02, h * 0.2); g.lineTo(cx + w * 0.02, h * 0.2); g.lineTo(cx + w * 0.08, base); g.fill(); glow(g, cx, h * 0.2, w * 0.12, p.eye, 0.9); }
  else if (kind === 1) { g.lineWidth = w * 0.05; g.strokeStyle = p.dark; g.beginPath(); g.arc(cx, base, w * 0.22, Math.PI, 0); g.stroke(); g.save(); g.globalCompositeOperation = 'lighter'; glow(g, cx, base - w * 0.1, w * 0.2, p.glowC, 0.8); g.restore(); }
  else { g.fillRect(cx - w * 0.03, h * 0.45, w * 0.06, base - h * 0.45); for (let k = 0; k < 7; k++) glow(g, cx + (rng.next() - 0.5) * w * 0.35, h * (0.3 + rng.next() * 0.2), w * 0.12, p.body, 0.95); }
  g.shadowBlur = 0;
}

export function paintSubject(g: C2D, card: CardDef, w: number, h: number) {
  const rng = new Rng(card.art.seed ^ 0x5bd1e995);
  const p = palette(card, rng);
  const champion = card.type === 'champion';
  const arch = card.art.archetype;
  g.save();
  switch (arch) {
    case 'drake': drawDrake(g, w, h, p, rng); break;
    case 'beast': drawBeast(g, w, h, p, rng); break;
    case 'elemental': drawElemental(g, w, h, p, rng); break;
    case 'knight': drawKnight(g, w, h, p, rng, champion); break;
    case 'serpent': drawSerpent(g, w, h, p, rng); break;
    case 'golem': drawGolem(g, w, h, p, rng); break;
    case 'insect': drawInsect(g, w, h, p, rng); break;
    case 'spirit': drawSpirit(g, w, h, p, rng); break;
    case 'construct': drawConstruct(g, w, h, p, rng); break;
    case 'mage': drawMage(g, w, h, p, rng, champion); break;
    case 'action': drawSigil(g, w, h, p, rng); break;
    case 'equipment': drawEquipment(g, w, h, p, rng, card.name); break;
    case 'relic': drawRelic(g, w, h, p, rng); break;
    case 'terrain': drawTerrainFocus(g, w, h, p, rng); break;
    default: drawSigil(g, w, h, p, rng);
  }
  g.restore();
  if (champion) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 18; k++) glow(g, rng.next() * w, rng.next() * h, w / 40, '#ffe8a0', 0.7);
    g.restore();
  }
}
