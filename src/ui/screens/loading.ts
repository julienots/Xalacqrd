import type { Game } from '../../systems/Game';
import { cardBackURL, cardFaceURL } from '../../render/cardFace';
import { h, sleep } from '../dom';

const LINES = ['Shuffling the deck...', 'Preparing your collection...', 'Opening the vault...', 'Charging the holofoil...', 'Waking the Titans...', 'Aligning the constellations...'];

export function runLoading(game: Game) {
  const fill = h('div', { class: 'load-fill' });
  const text = h('div', { class: 'load-text' }, LINES[0]);
  const parts = h('div', { class: 'particles' });
  for (let i = 0; i < 40; i++) {
    const p = h('i', { class: 'particle', style: `left:${Math.random() * 100}%;--dx:${(Math.random() - 0.5) * 120}px;animation-duration:${4 + Math.random() * 6}s;animation-delay:${-Math.random() * 8}s` });
    parts.appendChild(p);
  }
  const hero = game.cards.collectible.find((c) => c.rarity === 'PRISMATIC') ?? game.cards.collectible[0];
  const cardInner = h('div', { class: 'load-card-inner' },
    h('img', { src: cardFaceURL(hero, 'PRISM', 300), alt: '' }),
    h('img', { class: 'back', src: cardBackURL('cb_classic', 300), alt: '' }));
  const logo = h('div', { class: 'logo' }, ...'XALACARDS'.split('').map((ch, i) => h('span', { style: `animation-delay:${i * 0.07}s` }, ch)));
  const el = h('div', { class: 'loading' }, parts, logo, h('div', { class: 'logo-sub' }, 'TRADING CARD GAME'), h('div', { class: 'load-card' }, cardInner), h('div', { class: 'load-bar' }, fill), text);
  document.body.appendChild(el);
  let li = 0;
  const cycle = setInterval(() => { li = (li + 1) % LINES.length; text.textContent = LINES[li]; }, 1400);
  const started = performance.now();
  return {
    async step(progress: number, label: string, fn: () => unknown) {
      text.textContent = label;
      await sleep(30);
      await fn();
      fill.style.width = `${progress * 100}%`;
    },
    async warmup() {
      // pre-render a few faces so the first screens are instant
      for (const c of game.cards.collectible.filter((_, i) => i % 97 === 0)) cardFaceURL(c, 'NORMAL', 240);
    },
    async finish() {
      const min = 2200 - (performance.now() - started);
      if (min > 0) await sleep(min);
      clearInterval(cycle);
      el.classList.add('done');
      setTimeout(() => el.remove(), 700);
    },
  };
}
