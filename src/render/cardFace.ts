// Card face compositor: frame, art window, name banner, stats and text.
// All renders are cached; the DOM consumes JPEG/PNG data URLs, Three.js
// consumes the canvases directly as textures.

import type { CardDef, Finish, Rarity } from '../core/types';
import { FACTIONS } from '../data/factions';
import { RARITIES } from '../data/rarities';
import { SET_BY_CODE } from '../data/sets';
import { KEYWORDS, TRIGGER_NAMES } from '../data/effectText';
import { COSMETIC_BY_ID } from '../data/content';
import { makeCanvas, paintBackground, paintSubject, hsl } from './cardArt';

export const CARD_RATIO = 1.4;

const TYPE_LABEL: Record<string, string> = { creature: 'Creature', action: 'Action', equipment: 'Equipment', terrain: 'Terrain', relic: 'Relic', champion: 'Champion' };

interface FrameStyle { a: string; b: string; c: string; edge: string; ink: string; panel: string }

export function frameStyle(rarity: Rarity, finish: Finish): FrameStyle {
  if (finish === 'GOLD') return { a: '#7a5208', b: '#ffe08a', c: '#b8860b', edge: '#fff4c2', ink: '#2a1a00', panel: 'rgba(40,26,0,0.78)' };
  if (finish === 'SECRET') return { a: '#050505', b: '#2a0000', c: '#ff2e2e', edge: '#ff5050', ink: '#ffdede', panel: 'rgba(10,0,0,0.85)' };
  switch (rarity) {
    case 'COMMON': return { a: '#5a6170', b: '#aab2c0', c: '#7c8494', edge: '#d8dee8', ink: '#0d0f14', panel: 'rgba(12,14,22,0.82)' };
    case 'UNCOMMON': return { a: '#2f6a46', b: '#9ee0b6', c: '#4c9a6a', edge: '#d6ffe4', ink: '#04140a', panel: 'rgba(6,20,14,0.82)' };
    case 'RARE': return { a: '#1d4f9a', b: '#8fd0ff', c: '#3a7bd5', edge: '#d6efff', ink: '#020a18', panel: 'rgba(4,12,30,0.82)' };
    case 'EPIC': return { a: '#5a1d9a', b: '#d9a6ff', c: '#8a3fd5', edge: '#f0dcff', ink: '#12021f', panel: 'rgba(18,4,32,0.82)' };
    case 'LEGENDARY': return { a: '#8a5a00', b: '#ffe08a', c: '#d99a1e', edge: '#fff6cf', ink: '#1f1400', panel: 'rgba(30,18,0,0.8)' };
    case 'MYTHIC': return { a: '#8a1f4a', b: '#ffb0cf', c: '#e0457e', edge: '#ffe3ee', ink: '#1f0410', panel: 'rgba(32,4,16,0.8)' };
    case 'ANCIENT': return { a: '#0d4f48', b: '#9dfff0', c: '#2a9d8f', edge: '#e0fffa', ink: '#021412', panel: 'rgba(2,22,20,0.82)' };
    case 'CELESTIAL': return { a: '#3a4a8a', b: '#ffffff', c: '#a8c4ff', edge: '#ffffff', ink: '#0a1030', panel: 'rgba(10,16,48,0.8)' };
    case 'SECRET': return { a: '#0a0a0a', b: '#4a0000', c: '#ff2e2e', edge: '#ff7070', ink: '#ffe0e0', panel: 'rgba(12,0,0,0.86)' };
    case 'PRISMATIC': return { a: '#ff4fd8', b: '#4fd8ff', c: '#ffe24f', edge: '#ffffff', ink: '#1a0020', panel: 'rgba(20,4,30,0.8)' };
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (g.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export interface Layout { W: number; H: number; m: number; art: { x: number; y: number; w: number; h: number } }
export function layout(W: number): Layout {
  const m = W * 0.04;
  return { W, H: Math.round(W * CARD_RATIO), m, art: { x: m * 1.35, y: W * 0.155, w: W - m * 2.7, h: W * 0.64 } };
}

const artCache = new Map<string, { bg: HTMLCanvasElement; fg: HTMLCanvasElement }>();

export function artLayers(card: CardDef, W: number) {
  const key = `${card.id}@${W}`;
  let v = artCache.get(key);
  if (!v) {
    const L = layout(W);
    const aw = Math.round(L.art.w), ah = Math.round(L.art.h);
    const bg = makeCanvas(aw, ah), fg = makeCanvas(aw, ah);
    paintBackground(bg.getContext('2d')!, card, aw, ah);
    paintSubject(fg.getContext('2d')!, card, aw, ah);
    v = { bg, fg };
    if (artCache.size > 400) artCache.delete(artCache.keys().next().value!);
    artCache.set(key, v);
  }
  return v;
}

function gem(g: CanvasRenderingContext2D, x: number, y: number, r: number, c1: string, c2: string, label: string, font: number, ink = '#fff') {
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, c2); gr.addColorStop(1, c1);
  g.fillStyle = gr;
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = r * 0.4; g.shadowOffsetY = r * 0.1;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = r * 0.12; g.stroke();
  g.fillStyle = ink; g.font = `900 ${font}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = font * 0.18; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.strokeText(label, x, y + font * 0.04);
  g.fillText(label, x, y + font * 0.04);
}

/** Draws frame + text. If `artHole` the art window is left transparent (for DOM parallax). */
function drawFrame(g: CanvasRenderingContext2D, card: CardDef, finish: Finish, W: number, artHole: boolean, noSubject = false) {
  const L = layout(W); const H = L.H; const m = L.m;
  const fs = frameStyle(card.rarity, finish);
  const fac = FACTIONS[card.faction];
  // outer frame
  const fg = g.createLinearGradient(0, 0, W, H);
  fg.addColorStop(0, fs.b); fg.addColorStop(0.35, fs.a); fg.addColorStop(0.65, fs.c); fg.addColorStop(1, fs.a);
  g.fillStyle = fg; roundRect(g, 0, 0, W, H, W * 0.05); g.fill();
  if (card.rarity === 'PRISMATIC' && finish !== 'GOLD' && finish !== 'SECRET') {
    const pg = g.createLinearGradient(0, 0, W, H);
    for (let i = 0; i <= 6; i++) pg.addColorStop(i / 6, hsl(i * 60, 90, 65));
    g.fillStyle = pg; roundRect(g, 0, 0, W, H, W * 0.05); g.fill();
  }
  // filigree for high rarities
  const tier = RARITIES[card.rarity].tier;
  g.strokeStyle = fs.edge; g.globalAlpha = 0.9; g.lineWidth = W * 0.006;
  roundRect(g, m * 0.45, m * 0.45, W - m * 0.9, H - m * 0.9, W * 0.04); g.stroke();
  g.globalAlpha = 1;
  if (tier >= 4) {
    g.save(); g.strokeStyle = fs.edge; g.globalAlpha = 0.55; g.lineWidth = W * 0.004;
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(cx + sx * m * 1.1, cy + sy * m * 1.1, m * 0.5 * k, 0, Math.PI * 2); g.stroke(); }
    }
    g.restore();
  }
  // inner body panel
  g.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(g, m, m, W - m * 2, H - m * 2, W * 0.03); g.fill();
  // art window (border)
  const a = L.art;
  g.fillStyle = fs.edge;
  roundRect(g, a.x - W * 0.008, a.y - W * 0.008, a.w + W * 0.016, a.h + W * 0.016, W * 0.02); g.fill();
  if (artHole) {
    g.save(); g.globalCompositeOperation = 'destination-out';
    roundRect(g, a.x, a.y, a.w, a.h, W * 0.015); g.fill(); g.restore();
  } else {
    const { bg, fg: sub } = artLayers(card, W);
    g.save(); roundRect(g, a.x, a.y, a.w, a.h, W * 0.015); g.clip();
    g.drawImage(bg, a.x, a.y, a.w, a.h); if (!noSubject) g.drawImage(sub, a.x, a.y, a.w, a.h);
    g.restore();
  }
  // name banner
  const bx = m * 1.2, by = m * 1.05, bw = W - m * 2.4, bh = W * 0.09;
  const bgr = g.createLinearGradient(bx, by, bx + bw, by);
  bgr.addColorStop(0, fac.color); bgr.addColorStop(1, fac.color2);
  g.fillStyle = bgr; roundRect(g, bx, by, bw, bh, bh * 0.35); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(g, bx + 2, by + 2, bw - 4, bh - 4, bh * 0.32); g.fill();
  const nameFont = W * (card.name.length > 24 ? 0.043 : card.name.length > 18 ? 0.05 : 0.056);
  g.font = `800 ${nameFont}px Georgia, 'Times New Roman', serif`;
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = W * 0.01;
  g.fillText(card.name, bx + W * 0.13, by + bh / 2 + 1, bw - W * 0.2);
  g.shadowBlur = 0;
  // faction icon right in banner
  g.font = `${W * 0.05}px system-ui`; g.textAlign = 'center';
  g.fillText(fac.icon, bx + bw - W * 0.045, by + bh / 2 + 1);
  // cost gem
  gem(g, m * 1.9, m * 1.95, W * 0.075, '#123a8a', '#8fd8ff', String(card.cost), W * 0.085);

  // type line
  const ty = a.y + a.h + W * 0.018, th = W * 0.065;
  g.fillStyle = fs.panel; roundRect(g, bx, ty, bw, th, th * 0.3); g.fill();
  g.font = `700 ${W * 0.036}px system-ui, sans-serif`; g.fillStyle = '#e9ecff'; g.textAlign = 'left';
  const archLabel = card.type === 'creature' || card.type === 'champion' ? ` — ${card.art.archetype[0].toUpperCase()}${card.art.archetype.slice(1)}` : '';
  g.fillText(`${TYPE_LABEL[card.type]}${archLabel}`, bx + W * 0.03, ty + th / 2 + 1);
  // rarity gem + level pips
  const rc = RARITIES[card.rarity];
  g.save();
  g.translate(bx + bw - W * 0.05, ty + th / 2);
  g.rotate(Math.PI / 4);
  g.fillStyle = card.rarity === 'PRISMATIC' ? (() => { const pg = g.createLinearGradient(-10, -10, 10, 10); pg.addColorStop(0, '#ff4fd8'); pg.addColorStop(0.5, '#ffe24f'); pg.addColorStop(1, '#4fd8ff'); return pg; })() : rc.color;
  g.shadowColor = rc.glow; g.shadowBlur = W * 0.02;
  g.fillRect(-W * 0.018, -W * 0.018, W * 0.036, W * 0.036);
  g.restore();
  g.fillStyle = '#ffd76a'; g.font = `${W * 0.026}px system-ui`; g.textAlign = 'right';
  g.fillText('★'.repeat(card.level), bx + bw - W * 0.09, ty + th / 2 + 1);

  // text box
  const tby = ty + th + W * 0.015, tbh = H - tby - W * 0.14;
  g.fillStyle = fs.panel; roundRect(g, bx, tby, bw, tbh, W * 0.02); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.stroke();
  const pad = W * 0.03;
  let fsz = W * 0.04;
  g.textAlign = 'left'; g.textBaseline = 'top';
  let lines: string[] = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    g.font = `600 ${fsz}px system-ui, sans-serif`;
    lines = wrap(g, card.text || '', bw - pad * 2);
    if (lines.length * fsz * 1.2 <= tbh - pad * 1.2) break;
    fsz *= 0.88;
  }
  let yy = tby + pad * 0.7;
  for (const line of lines) {
    const kwLine = card.keywords.length && line === lines[0] && Object.values(KEYWORDS).some((k) => line.startsWith(k.name));
    const trig = Object.values(TRIGGER_NAMES).find((t) => line.startsWith(t + ':'));
    if (trig) {
      g.font = `800 ${fsz}px system-ui, sans-serif`; g.fillStyle = fac.color2;
      g.fillText(trig + ':', bx + pad, yy);
      const tw = g.measureText(trig + ': ').width;
      g.font = `600 ${fsz}px system-ui, sans-serif`; g.fillStyle = '#f2f3ff';
      g.fillText(line.slice(trig.length + 1).trim(), bx + pad + tw, yy);
    } else {
      g.font = `${kwLine ? 800 : 600} ${fsz}px system-ui, sans-serif`;
      g.fillStyle = kwLine ? '#ffe9a8' : '#f2f3ff';
      g.fillText(line, bx + pad, yy);
    }
    yy += fsz * 1.2;
  }
  // flavor if room
  g.font = `italic ${W * 0.031}px Georgia, serif`;
  const fl = wrap(g, card.flavor, bw - pad * 2);
  const flH = fl.length * W * 0.036;
  if (yy + flH + pad * 0.5 < tby + tbh) {
    g.fillStyle = 'rgba(220,225,255,0.6)';
    let fy = tby + tbh - flH - pad * 0.5;
    for (const l of fl) { g.fillText(l, bx + pad, fy); fy += W * 0.036; }
  }
  g.textBaseline = 'middle';

  // stats
  const sy = H - W * 0.075;
  if (card.type === 'creature' || card.type === 'champion') {
    gem(g, m * 2.1, sy, W * 0.07, '#8a1010', '#ff8a6a', String(card.attack), W * 0.075);
    gem(g, W - m * 2.1, sy, W * 0.07, '#0e6a2a', '#8affa8', String(card.hp), W * 0.075);
    if (card.defense > 0) gem(g, W - m * 2.1 - W * 0.13, sy + W * 0.01, W * 0.048, '#4a4f60', '#d0d6e8', String(card.defense), W * 0.05);
  } else if (card.equip) {
    gem(g, m * 2.1, sy, W * 0.06, '#8a1010', '#ff8a6a', `+${card.equip.atk}`, W * 0.05);
    gem(g, W - m * 2.1, sy, W * 0.06, '#0e6a2a', '#8affa8', `+${card.equip.hp}`, W * 0.05);
  }
  // collector number
  const set = SET_BY_CODE[card.set];
  g.font = `700 ${W * 0.028}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillStyle = fs.ink === '#ffdede' || fs.ink === '#ffe0e0' ? '#ffb0b0' : 'rgba(255,255,255,0.85)';
  g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 3;
  g.fillText(`${set?.symbol ?? ''} ${card.set} · ${String(card.num).padStart(3, '0')}/${set?.size ?? '?'} · ${rc.name.toUpperCase()}`, W / 2, H - W * 0.06);
  g.shadowBlur = 0;

  // finish-specific print marks
  if (finish === 'SIGNATURE' && card.signature) {
    g.save();
    g.translate(a.x + a.w * 0.62, a.y + a.h * 0.86); g.rotate(-0.12);
    g.font = `italic 700 ${W * 0.075}px 'Brush Script MT', 'Segoe Script', cursive`;
    g.fillStyle = '#ffd76a'; g.shadowColor = '#000'; g.shadowBlur = 6; g.textAlign = 'center';
    g.fillText(card.signature, 0, 0);
    g.restore();
  }
  if (finish === 'SECRET') {
    g.font = `900 ${W * 0.03}px system-ui`; g.fillStyle = '#ff4040'; g.textAlign = 'right';
    g.fillText('SECRET PRINT', W - m * 1.6, m * 0.55 + W * 0.005);
  }
}

const faceCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

export function cardFace(card: CardDef, finish: Finish = 'NORMAL', W = 360, noSubject = false): HTMLCanvasElement {
  const key = `${card.id}|${finish}|${W}|${noSubject}`;
  let c = faceCache.get(key);
  if (!c) {
    c = makeCanvas(W, Math.round(W * CARD_RATIO));
    drawFrame(c.getContext('2d')!, card, finish, W, false, noSubject);
    if (faceCache.size > 120) faceCache.delete(faceCache.keys().next().value!);
    faceCache.set(key, c);
  }
  return c;
}

export function cardFrameLayer(card: CardDef, finish: Finish, W: number): HTMLCanvasElement {
  const c = makeCanvas(W, Math.round(W * CARD_RATIO));
  drawFrame(c.getContext('2d')!, card, finish, W, true);
  return c;
}

/** JPEG data URL of a card face (cached). Corners are clipped by CSS border-radius. */
export function cardFaceURL(card: CardDef, finish: Finish = 'NORMAL', W = 240): string {
  const key = `${card.id}|${finish}|${W}`;
  let u = urlCache.get(key);
  if (!u) {
    u = cardFace(card, finish, W).toDataURL('image/jpeg', 0.88);
    if (urlCache.size > 1200) urlCache.delete(urlCache.keys().next().value!);
    urlCache.set(key, u);
  }
  return u;
}

// ---------------- card backs ----------------

const backCache = new Map<string, HTMLCanvasElement>();
export function cardBack(id: string, W = 360): HTMLCanvasElement {
  const key = `${id}|${W}`;
  let c = backCache.get(key);
  if (c) return c;
  const def = COSMETIC_BY_ID[id] ?? COSMETIC_BY_ID['cb_classic'];
  const H = Math.round(W * CARD_RATIO);
  c = makeCanvas(W, H);
  const g = c.getContext('2d')!;
  const [c1, c2] = def.colors;
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, c1); gr.addColorStop(0.5, c2); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, W, H, W * 0.05); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = W * 0.012;
  g.beginPath(); g.roundRect(W * 0.04, W * 0.04, W * 0.92, H - W * 0.08, W * 0.04); g.stroke();
  // guilloche pattern
  g.save(); g.translate(W / 2, H / 2);
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
  for (let k = 0; k < 36; k++) { g.rotate(Math.PI / 18); g.beginPath(); g.ellipse(0, 0, W * 0.42, W * 0.14, 0, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  const rg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.35);
  rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(W / 2, H / 2, W * 0.35, 0, Math.PI * 2); g.fill();
  g.font = `${W * 0.22}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  g.fillText(def.glyph, W / 2, H / 2);
  g.font = `900 ${W * 0.075}px Georgia, serif`; g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillText('XALACARDS', W / 2, H * 0.12);
  g.font = `700 ${W * 0.04}px system-ui`; g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillText(def.name.toUpperCase(), W / 2, H * 0.9);
  backCache.set(key, c);
  return c;
}

const backUrlCache = new Map<string, string>();
export function cardBackURL(id: string, W = 240) {
  const k = `${id}|${W}`;
  let u = backUrlCache.get(k);
  if (!u) { u = cardBack(id, W).toDataURL('image/png'); backUrlCache.set(k, u); }
  return u;
}
