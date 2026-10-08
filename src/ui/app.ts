// Application shell: router with history integration (Android back button),
// persistent HUD and bottom navigation.

import type { Game } from '../systems/Game';
import { h, clear, ui, fmt } from './dom';

export interface Screen {
  el: HTMLElement;
  nav?: boolean;       // show bottom navigation
  hud?: boolean;       // show currency HUD
  bg?: string;         // css class for background theme
  onShow?(): void;
  onHide?(): void;
  destroy?(): void;
  refresh?(): void;
  /** Return false to block navigating back (e.g. during a match). */
  canLeave?(): boolean | Promise<boolean>;
}

export type ScreenFactory = (app: App, params: any) => Screen;

export const NAV_ITEMS: [string, string, string][] = [
  ['play', '⚔️', 'Play'],
  ['collection', '📖', 'Codex'],
  ['decks', '🧱', 'Decks'],
  ['home', '🏠', 'Home'],
  ['shop', '💎', 'Shop'],
  ['events', '🎉', 'Events'],
  ['pass', '🎟️', 'Pass'],
];

export class App {
  root: HTMLElement;
  stage: HTMLElement;
  hud: HTMLElement;
  nav: HTMLElement;
  stack: { name: string; screen: Screen; params: any }[] = [];
  factories = new Map<string, ScreenFactory>();
  private unsub: () => void;
  private navigating = false;

  constructor(public game: Game, root: HTMLElement) {
    this.root = root;
    clear(root);
    this.hud = h('div', { class: 'hud' });
    this.stage = h('div', { class: 'stage' });
    this.nav = h('nav', { class: 'bottom-nav' });
    root.append(this.stage, this.hud, this.nav);
    this.buildNav();
    this.unsub = game.onChange(() => this.renderHud());
    window.addEventListener('popstate', () => this.onPop());
    void this.unsub;
  }

  register(name: string, f: ScreenFactory) { this.factories.set(name, f); }

  private buildNav() {
    clear(this.nav);
    for (const [id, icon, label] of NAV_ITEMS) {
      const b = h('button', { class: `nav-btn ${id === 'home' ? 'home' : ''}`, 'data-nav': id, onclick: () => { ui.sfx('menu'); ui.haptic('light'); this.go(id); } },
        h('span', { class: 'nav-ic' }, icon), h('span', { class: 'nav-lb' }, label), h('span', { class: 'nav-badge' }));
      this.nav.appendChild(b);
    }
  }

  updateBadges() {
    const g = this.game;
    const counts: Record<string, number> = {
      home: g.quests.claimableCount() + g.progression.unclaimedAchievements(),
      pass: (() => { let n = 0; for (let t = 1; t <= g.progression.passTier(); t++) { if (!g.data.pass.claimedFree.includes(t)) n++; if (g.data.pass.premium && !g.data.pass.claimedPremium.includes(t)) n++; } return n; })(),
      events: g.events.missions().filter((m) => m.done && !m.claimed).length,
      shop: g.shop.canClaimGift() ? 1 : 0,
      collection: Object.values(g.data.collection).filter((o) => o.isNew).length,
    };
    this.nav.querySelectorAll<HTMLElement>('.nav-btn').forEach((b) => {
      const n = counts[b.dataset.nav!] ?? 0;
      const badge = b.querySelector('.nav-badge') as HTMLElement;
      badge.textContent = n > 99 ? '99+' : n > 0 ? String(n) : '';
      badge.style.display = n > 0 ? '' : 'none';
    });
  }

  renderHud() {
    const c = this.game.data.currencies;
    const top = this.stack[this.stack.length - 1];
    clear(this.hud);
    const p = this.game.profile;
    const av = p.avatar();
    this.hud.append(
      h('button', { class: 'hud-profile', onclick: () => { ui.sfx('menu'); this.push('profile'); } },
        h('span', { class: 'avatar sm', style: `background:linear-gradient(135deg,${av.colors[0]},${av.colors[1]})` }, av.glyph),
        h('span', { class: 'hud-lvl' }, `Lv ${p.p.level}`)),
      h('div', { class: 'hud-cur' },
        h('span', { class: 'cur coins', title: 'Coins' }, '🪙 ', fmt(c.coins)),
        h('span', { class: 'cur gems', title: 'Gems' }, '💎 ', fmt(c.gems)),
        h('span', { class: 'cur tickets', title: 'Tickets' }, '🎟️ ', fmt(c.tickets))),
      h('button', { class: 'hud-gear', 'aria-label': 'Settings', onclick: () => { ui.sfx('menu'); this.push('settings'); } }, '⚙️'),
    );
    this.hud.style.display = top?.screen.hud === false ? 'none' : '';
    this.updateBadges();
  }

  private mount(name: string, params: any): Screen {
    const f = this.factories.get(name);
    if (!f) throw new Error(`No screen ${name}`);
    return f(this, params ?? {});
  }

  private show(entry: { name: string; screen: Screen }) {
    const s = entry.screen;
    s.el.classList.add('screen');
    if (!s.el.parentNode) this.stage.appendChild(s.el);
    s.el.style.display = '';
    s.el.classList.remove('leaving');
    s.el.classList.add('entering');
    requestAnimationFrame(() => requestAnimationFrame(() => s.el.classList.remove('entering')));
    this.root.className = `app ${s.bg ?? ''}`;
    this.nav.style.display = s.nav === false ? 'none' : '';
    this.nav.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.nav === entry.name));
    this.renderHud();
    s.onShow?.();
  }
  private hide(entry: { screen: Screen }, destroy: boolean) {
    const s = entry.screen;
    s.onHide?.();
    if (destroy) { s.destroy?.(); s.el.remove(); }
    else s.el.style.display = 'none';
  }

  current() { return this.stack[this.stack.length - 1]; }

  /** Replace the whole stack (top-level navigation). */
  async go(name: string, params?: any) {
    if (this.navigating) return;
    const cur = this.current();
    if (cur?.name === name && this.stack.length === 1) { cur.screen.refresh?.(); return; }
    if (cur?.screen.canLeave && !(await cur.screen.canLeave())) return;
    while (this.stack.length) this.hide(this.stack.pop()!, true);
    const screen = this.mount(name, params);
    const entry = { name, screen, params };
    this.stack.push(entry);
    history.replaceState({ depth: 1 }, '');
    this.show(entry);
  }

  push(name: string, params?: any) {
    const cur = this.current();
    if (cur) this.hide(cur, false);
    const screen = this.mount(name, params);
    const entry = { name, screen, params };
    this.stack.push(entry);
    history.pushState({ depth: this.stack.length }, '');
    this.show(entry);
  }

  /** Programmatic back (mirrors the hardware back button). */
  back() {
    if (this.stack.length > 1) history.back();
    else if (this.current()?.name !== 'home') this.go('home');
  }

  private async onPop() {
    const cur = this.current();
    if (!cur) return;
    if (this.stack.length <= 1) {
      if (cur.name !== 'home') { this.go('home'); }
      return;
    }
    if (cur.screen.canLeave && !(await cur.screen.canLeave())) { history.pushState({ depth: this.stack.length }, ''); return; }
    this.hide(this.stack.pop()!, true);
    const prev = this.current();
    if (prev) { this.show(prev); prev.screen.refresh?.(); }
  }

  /** Replace the top screen without adding history. */
  replace(name: string, params?: any) {
    const cur = this.stack.pop();
    if (cur) this.hide(cur, true);
    const screen = this.mount(name, params);
    const entry = { name, screen, params };
    this.stack.push(entry);
    this.show(entry);
  }
}

/** Standard screen header with back button. */
export function header(app: App, title: string, extra?: Node | null, onBack?: () => void): HTMLElement {
  return h('div', { class: 'screen-head' },
    h('button', { class: 'back-btn', 'aria-label': 'Back', onclick: () => { ui.sfx('back'); onBack ? onBack() : app.back(); } }, '‹'),
    h('h1', { class: 'screen-title' }, title),
    extra ?? h('span'));
}
