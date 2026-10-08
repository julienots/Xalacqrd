import { FACTION_IDS } from '../../data/factions';
import type { App, Screen } from '../app';
import { lazyThumb, openCardDetail } from '../cardView';
import { countdown, h, progressBar, rewardChips, showRewards, toast, ui } from '../dom';
import { startMatch } from './play';

export function eventsScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  function render() {
    const sched = g.events.schedule();
    const cur = sched[0];
    const missions = g.events.missions();
    const cards = g.cards.eventCards(cur.def.id);
    el.replaceChildren(
      h('h1', { class: 'screen-title', style: 'margin-bottom:8px' }, 'Events'),
      h('div', { class: 'panel', style: `background:linear-gradient(135deg,${cur.def.colors[0]},${cur.def.colors[1]});border-color:rgba(255,255,255,0.3);text-align:center` },
        h('div', { style: 'font-size:58px;filter:drop-shadow(0 0 20px #fff)' }, cur.def.icon),
        h('div', { style: 'font-family:var(--serif);font-size:28px;font-weight:900' }, cur.def.name),
        h('div', { style: 'opacity:.9;margin:4px 0' }, cur.def.desc),
        h('div', { class: 'tag', style: 'background:rgba(0,0,0,0.35)' }, `Special rule: ${cur.def.ruleText}`),
        h('div', { class: 'muted', style: 'color:#fff;opacity:.8;margin-top:6px' }, `Ends in ${countdown(cur.endsAt - Date.now())}`),
        h('div', { class: 'row gap center mt' },
          h('button', { class: 'btn primary', onclick: () => startMatch(app, { mode: 'event', difficulty: 'HARD', rules: cur.def.rules, factions: [cur.def.faction, FACTION_IDS[Date.now() % 8]] }) }, '⚔ Event Match'),
          h('button', { class: 'btn', onclick: () => app.go('shop', { tab: 'events' }) }, `❖ Event Packs`))),
      h('div', { class: 'section-title' }, 'Event missions'),
      ...missions.map((m) => h('div', { class: `list-item ${m.done ? 'done' : ''} ${m.claimed ? 'claimed' : ''}` },
        h('div', { class: 'li-main' }, h('div', { class: 'li-title' }, m.def.desc), progressBar(m.progress, m.def.goal), h('div', { class: 'li-sub' }, `${m.progress}/${m.def.goal}`), rewardChips(m.def.reward)),
        h('button', { class: `btn small ${m.done && !m.claimed ? 'primary' : 'disabled'}`, onclick: async () => { const r = g.events.claim(m.def.id); if (r) { ui.sfx('reward'); await showRewards('Event reward', r); render(); } else toast('Not complete yet', 'info'); } }, m.claimed ? '✔' : 'Claim'))),
      h('div', { class: 'section-title' }, `${cur.def.name} promo cards`),
      h('div', { class: 'card-grid' }, cards.map((c) => lazyThumb(c, g.collection.owned(c.id) ? g.collection.bestFinish(c.id) : 'NORMAL', { missing: !g.collection.owned(c.id), onClick: () => openCardDetail(app, c) }))),
      h('div', { class: 'section-title' }, 'Upcoming'),
      ...sched.slice(1).map((s) => h('div', { class: 'list-item' }, h('span', { class: 'li-ic' }, s.def.icon), h('div', { class: 'li-main' }, h('div', { class: 'li-title' }, s.def.name), h('div', { class: 'li-sub' }, `${s.def.ruleText} · starts in ${countdown(s.startsAt - Date.now())}`)))),
    );
  }
  render();
  return { el, refresh: render, onShow: render };
}
