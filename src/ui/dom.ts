// Tiny DOM toolkit (no framework) + shared UI primitives: toasts, modals,
// reward popups.

import type { Reward } from '../data/content';
import { CHESTS, COSMETIC_BY_ID, PACKS } from '../data/content';

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, any> & { class?: string; style?: string | Partial<CSSStyleDeclaration> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') { if (typeof v === 'string') el.setAttribute('style', v); else Object.assign(el.style, v); }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') (el as any)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;
export const clear = (el: Element) => { while (el.firstChild) el.removeChild(el.firstChild); };
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const fmt = (n: number) => n >= 100000 ? `${(n / 1000).toFixed(0)}k` : n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en-US');

// ---------- feedback hooks (wired by main) ----------
export const ui = {
  sfx: (_name: string, _arg?: any) => {},
  haptic: (_l: 'light' | 'medium' | 'heavy') => {},
};

// ---------- toasts ----------
let toastRoot: HTMLElement | null = null;
export function toast(msg: string, kind: 'info' | 'good' | 'bad' = 'info', ms = 2200) {
  if (!toastRoot) { toastRoot = h('div', { class: 'toasts' }); document.body.appendChild(toastRoot); }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastRoot.appendChild(t);
  if (kind === 'bad') ui.sfx('error');
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
}

// ---------- modals ----------
export interface ModalHandle { el: HTMLElement; close: () => void; closed: Promise<void> }

export function modal(content: Node | Node[], opts: { title?: string; className?: string; dismissable?: boolean; onClose?: () => void } = {}): ModalHandle {
  let resolve!: () => void;
  const closed = new Promise<void>((r) => (resolve = r));
  const panel = h('div', { class: `modal-panel ${opts.className ?? ''}` },
    opts.title ? h('div', { class: 'modal-title' }, opts.title) : null,
    opts.dismissable !== false ? h('button', { class: 'modal-x', 'aria-label': 'Close', onclick: () => close() }, '✕') : null,
    ...(Array.isArray(content) ? content : [content]),
  );
  const back = h('div', { class: 'modal-back' }, panel);
  if (opts.dismissable !== false) back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('in'));
  let done = false;
  function close() {
    if (done) return; done = true;
    back.classList.remove('in');
    ui.sfx('back');
    setTimeout(() => { back.remove(); opts.onClose?.(); resolve(); }, 220);
  }
  return { el: panel, close, closed };
}

export function confirmDialog(title: string, text: string, okLabel = 'Confirm', danger = false): Promise<boolean> {
  return new Promise((res) => {
    let answered = false;
    const m = modal([
      h('p', { class: 'modal-text' }, text),
      h('div', { class: 'row gap center' },
        h('button', { class: 'btn ghost', onclick: () => { answered = true; m.close(); res(false); } }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { answered = true; m.close(); res(true); } }, okLabel)),
    ], { title, onClose: () => { if (!answered) res(false); } });
  });
}

export function promptDialog(title: string, value: string, placeholder = ''): Promise<string | null> {
  return new Promise((res) => {
    const input = h('input', { class: 'input', value, placeholder, maxlength: 24 }) as HTMLInputElement;
    let answered = false;
    const m = modal([
      input,
      h('div', { class: 'row gap center mt' },
        h('button', { class: 'btn ghost', onclick: () => { answered = true; m.close(); res(null); } }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: () => { answered = true; m.close(); res(input.value); } }, 'OK')),
    ], { title, onClose: () => { if (!answered) res(null); } });
    setTimeout(() => input.focus(), 50);
  });
}

// ---------- rewards ----------
export function rewardLabel(r: Reward): { icon: string; text: string } {
  switch (r.kind) {
    case 'coins': return { icon: '🪙', text: `${fmt(r.amount)} Coins` };
    case 'gems': return { icon: '💎', text: `${fmt(r.amount)} Gems` };
    case 'tickets': return { icon: '🎟️', text: `${r.amount} Ticket${r.amount > 1 ? 's' : ''}` };
    case 'shards': return { icon: '🔹', text: `${fmt(r.amount)} Shards` };
    case 'xp': return { icon: '✨', text: `${r.amount} XP` };
    case 'pack': return { icon: PACKS[r.id].glyph, text: `${r.amount}× ${PACKS[r.id].name}` };
    case 'chest': return { icon: '🧰', text: `${r.amount}× ${CHESTS[r.id].name}` };
    case 'cosmetic': { const c = COSMETIC_BY_ID[r.id]; return { icon: c?.glyph ?? '🎨', text: c ? `${c.name} (${c.kind})` : r.id }; }
    case 'card': return { icon: '🃏', text: `Card ${r.id}` };
  }
}

export function rewardChips(rewards: Reward[]): HTMLElement {
  return h('div', { class: 'reward-chips' }, rewards.map((r) => {
    const l = rewardLabel(r);
    return h('div', { class: `reward-chip k-${r.kind}` }, h('span', { class: 'ri' }, l.icon), h('span', null, l.text));
  }));
}

export function showRewards(title: string, rewards: Reward[], subtitle?: string): Promise<void> {
  if (!rewards.length) return Promise.resolve();
  ui.sfx('reward'); ui.haptic('light');
  const m = modal([
    subtitle ? h('p', { class: 'modal-text' }, subtitle) : null,
    h('div', { class: 'reward-burst' }),
    rewardChips(rewards),
    h('button', { class: 'btn primary wide mt', onclick: () => m.close() }, 'Collect'),
  ] as Node[], { title, className: 'reward-modal' });
  return m.closed;
}

export function progressBar(value: number, max: number, cls = ''): HTMLElement {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return h('div', { class: `bar ${cls}` }, h('div', { class: 'bar-fill', style: `width:${pct}%` }));
}

/** Simple segmented tabs. */
export function tabs<T extends string>(items: [T, string][], active: T, onPick: (t: T) => void): HTMLElement {
  return h('div', { class: 'tabs' }, items.map(([id, label]) =>
    h('button', { class: `tab ${id === active ? 'on' : ''}`, onclick: () => { ui.sfx('tap'); onPick(id); } }, label)));
}

export function countdown(ms: number): string {
  if (ms <= 0) return 'ended';
  const d = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000), mm = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}d ${hh}h` : hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
}

/** Long-press helper for touch (fires after `ms`). Returns true from handler to suppress click. */
export function onLongPress(el: HTMLElement, fn: () => void, ms = 450) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fired = false;
  let sx = 0, sy = 0;
  el.addEventListener('pointerdown', (e) => {
    fired = false; sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { fired = true; ui.haptic('light'); fn(); }, ms);
  });
  const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  el.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('click', (e) => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
