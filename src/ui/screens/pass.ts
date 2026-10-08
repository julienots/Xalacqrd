import { PASS_PREMIUM_PRICE, PASS_TIERS, PASS_XP_PER_TIER, passReward } from '../../data/content';
import type { App, Screen } from '../app';
import { confirmDialog, h, rewardLabel, showRewards, toast, ui, countdown } from '../dom';

export function passScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  function render() {
    g.progression.ensurePassSeason();
    const p = g.data.pass;
    const tier = g.progression.passTier();
    const inTier = p.xp - tier * PASS_XP_PER_TIER;
    const now = new Date();
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const cell = (t: number, premium: boolean) => {
      const rewards = passReward(t, premium);
      const claimed = (premium ? p.claimedPremium : p.claimedFree).includes(t);
      const reachable = t <= tier && (!premium || p.premium);
      const l = rewardLabel(rewards[0]);
      return h('div', { class: `pass-cell ${premium ? 'premium' : ''} ${claimed ? 'claimed' : reachable ? 'claimable' : t > tier ? 'locked' : ''}`, onclick: async () => {
        if (!reachable || claimed) { if (premium && !p.premium) toast('Unlock Premium to claim', 'info'); return; }
        const r = g.progression.claimPass(t, premium);
        if (r) { ui.sfx('reward'); await showRewards(`Tier ${t}`, r); render(); app.renderHud(); }
      } }, h('span', { class: 'pi' }, premium && !p.premium ? '🔒' : l.icon), h('span', null, rewards.map((r) => rewardLabel(r).text).join(' + ')));
    };
    const rows: Node[] = [];
    for (let t = 1; t <= PASS_TIERS; t++) rows.push(h('div', { class: 'pass-row', id: t === Math.max(1, tier) ? 'pass-current' : undefined }, h('div', { class: `pass-tier ${t <= tier ? 'reached' : ''}` }, String(t)), cell(t, false), cell(t, true)));
    el.replaceChildren(
      h('h1', { class: 'screen-title', style: 'margin-bottom:8px' }, 'XALA Pass'),
      h('div', { class: 'pass-head' },
        h('div', { class: 'row between' }, h('b', { style: 'font-family:var(--serif);font-size:20px' }, `Season ${p.season % 100}`), h('span', { class: 'muted' }, `ends in ${countdown(end - Date.now())}`)),
        h('div', { style: 'font-size:34px;font-weight:900;color:var(--gold);margin:6px 0' }, `Tier ${tier}`, h('span', { class: 'muted' }, ` / ${PASS_TIERS}`)),
        h('div', { class: 'bar gold' }, h('div', { class: 'bar-fill', style: `width:${tier >= PASS_TIERS ? 100 : (inTier / PASS_XP_PER_TIER) * 100}%` })),
        h('div', { class: 'muted', style: 'margin-top:4px' }, tier >= PASS_TIERS ? 'Max tier reached!' : `${inTier}/${PASS_XP_PER_TIER} XP — earn XP from matches, missions and events`),
        h('div', { class: 'row gap mt' },
          p.premium ? h('span', { class: 'tag', style: 'color:var(--gold)' }, '👑 PREMIUM ACTIVE') : h('button', { class: 'btn primary', onclick: async () => {
            if (!(await confirmDialog('Unlock Premium?', `Unlock the premium track for ${PASS_PREMIUM_PRICE} 💎 (earned in-game).`, 'Unlock'))) return;
            if (g.progression.unlockPremium()) { ui.sfx('purchase'); toast('Premium unlocked!', 'good'); render(); } else toast(`You need ${PASS_PREMIUM_PRICE} 💎`, 'bad');
          } }, `👑 Premium · ${PASS_PREMIUM_PRICE} 💎`),
          h('button', { class: 'btn', onclick: async () => { const r = g.progression.claimAllPass(); if (r.length) { await showRewards('Pass rewards', r); render(); } else toast('Nothing to claim', 'info'); } }, 'Claim all'))),
      h('div', { class: 'pass-row', style: 'margin:12px 0 6px;font-weight:900;font-size:12px;color:var(--muted)' }, h('span', null, 'TIER'), h('span', null, 'FREE'), h('span', { style: 'color:var(--gold)' }, 'PREMIUM')),
      h('div', { class: 'pass-track' }, rows),
    );
    requestAnimationFrame(() => document.getElementById('pass-current')?.scrollIntoView({ block: 'center' }));
  }
  render();
  return { el, refresh: render, onShow: render };
}
