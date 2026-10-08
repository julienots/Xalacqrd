// DOM card components: thumbnails, the layered 2.5D parallax card and the
// detail inspector.

import type { CardDef, Finish } from '../core/types';
import { FACTIONS } from '../data/factions';
import { FINISHES, RARITIES } from '../data/rarities';
import { KEYWORDS, TRIGGER_DESC } from '../data/effectText';
import { SET_BY_CODE } from '../data/sets';
import { artLayers, cardFaceURL, cardFrameLayer, layout } from '../render/cardFace';
import type { App } from './app';
import { h, modal, toast, ui } from './dom';

export function fxClass(card: CardDef, finish: Finish) {
  return `fin-${finish.toLowerCase()} rar-${card.rarity.toLowerCase()}`;
}

/** Lightweight thumbnail (single JPEG + CSS finish overlay). */
export function cardThumb(card: CardDef, finish: Finish = 'NORMAL', opts: { count?: number; isNew?: boolean; missing?: boolean; fav?: boolean; onClick?: () => void; size?: number } = {}): HTMLElement {
  const el = h('div', { class: `card-thumb ${fxClass(card, finish)} ${opts.missing ? 'missing' : ''}`, 'data-id': card.id },
    h('img', { src: cardFaceURL(card, finish, opts.size ?? 240), alt: card.name, loading: 'lazy', draggable: false }),
    finish !== 'NORMAL' ? h('div', { class: 'fx' }) : null,
    opts.isNew ? h('span', { class: 'badge-new' }, 'NEW') : null,
    opts.fav ? h('span', { class: 'badge-fav' }, '★') : null,
    opts.count && opts.count > 1 ? h('span', { class: 'badge-count' }, `×${opts.count}`) : null,
  );
  if (opts.onClick) el.addEventListener('click', () => { ui.sfx('tap'); opts.onClick!(); });
  return el;
}

/** Lazy thumbnail: renders the face only when scrolled into view. */
const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target as HTMLElement & { __render?: () => void };
    io!.unobserve(el);
    el.__render?.();
  }
}, { rootMargin: '300px' }) : null;

export function lazyThumb(card: CardDef, finish: Finish, opts: Parameters<typeof cardThumb>[2] = {}): HTMLElement {
  const holder = h('div', { class: `card-slot ${opts.missing ? 'missing' : ''}` }) as HTMLElement & { __render?: () => void };
  holder.__render = () => holder.replaceChildren(cardThumb(card, finish, opts));
  if (io) io.observe(holder); else holder.__render();
  if (opts.missing) holder.appendChild(h('div', { class: 'slot-ph' }, h('span', null, `#${card.num}`)));
  return holder;
}

/** Layered card with parallax tilt, glare and animated finish. */
export function cardLarge(card: CardDef, finish: Finish = 'NORMAL', W = 420, opts: { gyro?: boolean; autoTilt?: boolean } = {}): HTMLElement & { dispose: () => void } {
  const L = layout(W);
  const { bg, fg } = artLayers(card, W);
  const frame = cardFrameLayer(card, finish, W);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const artBox = `left:${pct(L.art.x, W)};top:${pct(L.art.y, L.H)};width:${pct(L.art.w, W)};height:${pct(L.art.h, L.H)}`;
  const bgImg = bg.cloneNode() as HTMLCanvasElement; bgImg.getContext('2d')!.drawImage(bg, 0, 0);
  const fgImg = fg.cloneNode() as HTMLCanvasElement; fgImg.getContext('2d')!.drawImage(fg, 0, 0);
  bgImg.className = 'layer-bg'; fgImg.className = 'layer-fg'; frame.className = 'layer-frame';
  const inner = h('div', { class: 'cl-inner' },
    h('div', { class: 'cl-art', style: artBox }, bgImg, fgImg),
    frame,
    h('div', { class: 'fx' }),
    h('div', { class: 'glare' }),
  );
  const el = h("div", { class: `card-large ${fxClass(card, finish)}` }, inner) as unknown as HTMLElement & { dispose: () => void };
  let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0, dragging = false;
  const t0 = performance.now();
  const apply = () => {
    rx += (tx - rx) * 0.15; ry += (ty - ry) * 0.15;
    if (opts.autoTilt && !dragging) { const t = (performance.now() - t0) / 1000; tx = Math.sin(t * 0.8) * 8; ty = Math.cos(t * 0.6) * 10; }
    inner.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    const mx = 50 + ry * 2.2, my = 50 - rx * 2.2;
    el.style.setProperty('--mx', `${mx}%`); el.style.setProperty('--my', `${my}%`);
    el.style.setProperty('--tilt', `${Math.hypot(rx, ry) / 20}`);
    bgImg.style.transform = `translate(${-ry * 0.5}px, ${rx * 0.5}px) scale(1.08)`;
    fgImg.style.transform = `translate(${ry * 0.9}px, ${-rx * 0.9}px) scale(1.04)`;
    raf = requestAnimationFrame(apply);
  };
  raf = requestAnimationFrame(apply);
  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    ty = px * 30; tx = -py * 30; dragging = true;
  };
  const onLeave = () => { tx = 0; ty = 0; dragging = false; };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointerup', onLeave);
  const onOrient = (e: DeviceOrientationEvent) => {
    if (dragging || e.beta == null || e.gamma == null) return;
    tx = Math.max(-18, Math.min(18, (e.beta - 45) * 0.5)); ty = Math.max(-18, Math.min(18, e.gamma * 0.6));
  };
  if (opts.gyro) window.addEventListener('deviceorientation', onOrient);
  el.dispose = () => { cancelAnimationFrame(raf); window.removeEventListener('deviceorientation', onOrient); };
  return el;
}

export function keywordGlossary(card: CardDef): HTMLElement {
  const kws = new Set(card.keywords);
  if (card.equip?.keyword) kws.add(card.equip.keyword);
  for (const e of card.effects) if (e.keyword) kws.add(e.keyword);
  const triggers = new Set(card.effects.map((e) => e.trigger));
  return h('div', { class: 'glossary' },
    [...kws].map((k) => h('div', { class: 'gl' }, h('b', null, `${KEYWORDS[k].icon} ${KEYWORDS[k].name}`), ' — ', KEYWORDS[k].desc)),
    [...triggers].map((t) => h('div', { class: 'gl' }, TRIGGER_DESC[t])),
    card.defense > 0 ? h('div', { class: 'gl' }, h('b', null, '🛡 Defense'), ' — reduces damage taken by this amount (minimum 1).') : null,
  );
}

/** Full-screen card inspector with finish switcher, stats and crafting. */
export function openCardDetail(app: App, card: CardDef, preferFinish?: Finish) {
  const g = app.game;
  g.collection.markSeen(card.id);
  const owned = g.collection.finishes(card.id);
  let finish: Finish = preferFinish ?? (owned.length ? g.collection.bestFinish(card.id) : 'NORMAL');
  const stage = h('div', { class: 'detail-stage' });
  let big: ReturnType<typeof cardLarge> | null = null;
  const W = Math.min(520, Math.round(window.innerWidth * 1.4));
  const renderBig = () => {
    big?.dispose();
    big = cardLarge(card, finish, W, { gyro: true });
    stage.replaceChildren(big);
  };
  renderBig();
  const finishRow = h('div', { class: 'finish-row' }, card.finishes.map((f) => {
    const have = owned.includes(f);
    const b = h('button', { class: `chip ${f === finish ? 'on' : ''} ${have ? 'have' : 'nohave'}`, onclick: () => {
      finish = f; renderBig(); finishRow.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); ui.sfx('cardFlip');
    } }, `${FINISHES[f].name}${have ? ` ×${g.data.collection[card.id]?.counts[f] ?? 0}` : ''}`);
    return b;
  }));
  const r = RARITIES[card.rarity];
  const fac = FACTIONS[card.faction];
  const set = SET_BY_CODE[card.set];
  const total = g.collection.total(card.id);
  const craftBtn = h('button', { class: 'btn small', onclick: () => {
    if (g.collection.craft(card)) { ui.sfx('reveal', r.tier); toast(`Crafted ${card.name}!`, 'good'); m.close(); openCardDetail(app, card, 'NORMAL'); }
    else toast(total >= r.maxCopies ? 'You already own a full playset' : 'Not enough shards', 'bad');
  } }, `🔨 Craft (${r.craftCost} 🔹)`);
  const favBtn = h('button', { class: 'btn small ghost', onclick: () => { g.collection.toggleFav(card.id); favBtn.textContent = g.collection.isFav(card.id) ? '★ Favorite' : '☆ Favorite'; } }, g.collection.isFav(card.id) ? '★ Favorite' : '☆ Favorite');
  const info = h('div', { class: 'detail-info' },
    h('div', { class: 'detail-name' }, card.name),
    h('div', { class: 'detail-tags' },
      h('span', { class: 'tag', style: `color:${r.color};border-color:${r.color}` }, r.name),
      h('span', { class: 'tag', style: `color:${fac.color};border-color:${fac.color}` }, `${fac.icon} ${fac.name}`),
      h('span', { class: 'tag' }, `${set.symbol} ${set.name} #${card.num}`),
      h('span', { class: 'tag' }, `Lv ${card.level}`)),
    h('p', { class: 'detail-flavor' }, `“${card.flavor}”`),
    keywordGlossary(card),
    h('div', { class: 'detail-own' }, total ? `Owned: ${total} copies · Max in deck: ${r.maxCopies}` : 'Not owned yet', g.data.collection[card.id] ? ` · First found ${new Date(g.data.collection[card.id].first).toLocaleDateString()}` : ''),
    finishRow,
    h('div', { class: 'row gap center mt' }, total ? favBtn : null, craftBtn),
  );
  const m = modal([stage, info], { className: 'detail-modal', onClose: () => big?.dispose() });
}
