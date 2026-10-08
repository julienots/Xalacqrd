import type { CardDef, Finish } from '../../core/types';
import { LOGIN_REWARDS } from '../../data/content';
import { RARITIES } from '../../data/rarities';
import { MenuScene } from '../../vfx/MenuScene';
import { webglAvailable } from '../../vfx/core';
import type { App, Screen } from '../app';
import { countdown, h, modal, rewardChips, rewardLabel, showRewards, ui } from '../dom';

export function homeScreen(app: App): Screen {
  const g = app.game;
  const sceneBox = h('div', { class: 'home-scene' });
  let scene: MenuScene | null = null;
  const content = h('div', { class: 'home-content' });
  const el = h('div', { class: 'home' }, sceneBox, content);

  function pickShowcase(): { card: CardDef; finish: Finish }[] {
    const owned = g.cards.collectible.filter((c) => g.collection.owned(c.id)).sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier);
    const pool = owned.length >= 5 ? owned.slice(0, 12) : g.cards.collectible.filter((c) => RARITIES[c.rarity].tier >= 4).slice(0, 12);
    return pool.slice(0, 7).map((card) => ({ card, finish: g.collection.owned(card.id) ? g.collection.bestFinish(card.id) : 'HOLOGRAPHIC' }));
  }
  function guardian(): CardDef | null {
    const owned = g.cards.collectible.filter((c) => c.model && g.collection.owned(c.id) && RARITIES[c.rarity].tier >= 4).sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier);
    return owned[0] ?? g.cards.collectible.find((c) => c.model === 'drake' && RARITIES[c.rarity].tier >= 4) ?? null;
  }

  function startScene() {
    if (!webglAvailable() || scene) return;
    try { scene = new MenuScene(sceneBox, pickShowcase(), guardian(), g.data.equipped.cardback); scene.start(); scene.host.fpsEl = document.getElementById('fps'); } catch (e) { console.warn('menu scene failed', e); }
  }

  function render() {
    const ev = g.events.current();
    const packs = g.inventory.totalPacks();
    const chests = g.inventory.totalChests();
    const claim = g.quests.claimableCount();
    const tile = (icon: string, label: string, badge: number, fn: () => void) =>
      h('button', { class: 'home-tile', onclick: () => { ui.sfx('menu'); ui.haptic('light'); fn(); } }, h('span', { class: 'ti' }, icon), label, badge > 0 ? h('span', { class: 'tb' }, String(badge)) : null);
    content.replaceChildren(
      h('div', { class: 'home-logo' }, h('div', { class: 'logo' }, 'XALACARDS'), h('div', { class: 'logo-sub' }, `SEASON ${g.data.pass.season % 100} · ${g.profile.rank().toUpperCase()}`)),
      h('div', { class: 'home-spacer' }),
      h('button', { class: 'event-banner', style: `background:linear-gradient(120deg,${ev.def.colors[0]},${ev.def.colors[1]})`, onclick: () => app.go('events') },
        h('span', { class: 'ei' }, ev.def.icon),
        h('div', { class: 'grow', style: 'text-align:left' }, h('b', null, ev.def.name), h('div', { style: 'font-size:12px;opacity:.9' }, `${ev.def.ruleText} · ends in ${countdown(ev.endsAt - Date.now())}`)),
        h('span', null, '›')),
      h('button', { class: 'btn primary home-play mt', onclick: () => { ui.sfx('menu'); ui.haptic('medium'); app.go('play'); } }, '⚔ PLAY'),
      h('div', { class: 'home-grid' },
        tile('📦', 'Boosters', packs, () => app.push('boosters')),
        tile('📜', 'Missions', claim, () => app.push('missions')),
        tile('🧰', 'Chests', chests, () => app.push('chests')),
        tile('🗺️', 'Campaign', 0, () => app.push('campaign')),
        tile('🏆', 'Ranked', 0, () => app.push('ranked')),
        tile('🏅', 'Tournament', 0, () => app.push('tournament')),
        tile('👤', 'Profile', g.progression.unclaimedAchievements(), () => app.push('profile')),
        tile('⚙️', 'Settings', 0, () => app.push('settings')),
      ),
    );
  }

  async function popups() {
    if (g.isNewPlayer) {
      g.isNewPlayer = false;
      const input = h('input', { class: 'input', value: g.data.profile.name, maxlength: 16 }) as HTMLInputElement;
      const m = modal([
        h('p', { class: 'modal-text' }, 'Welcome to XALACARDS, Collector! Your journey begins with two starter decks, a stash of boosters and a few chests. Open packs, build decks and duel across the realms.'),
        h('div', { class: 'muted', style: 'margin:8px 0 4px' }, 'Choose your collector name'),
        input,
        h('button', { class: 'btn primary wide mt', onclick: () => { g.profile.setName(input.value); m.close(); } }, 'Begin'),
      ], { title: '✨ Welcome', dismissable: false });
      await m.closed;
    }
    if (g.pendingSeasonRewards) { await showRewards('Ranked Season Rewards', g.pendingSeasonRewards, 'A new season begins!'); g.pendingSeasonRewards = null; }
    if (g.quests.canClaimLogin()) {
      const day = g.quests.loginDay();
      const grid = h('div', { class: 'row wrap gap center' }, LOGIN_REWARDS.map((r, i) => {
        const l = rewardLabel(r);
        return h('div', { class: `cos-item ${i < day ? 'locked' : i === day ? 'equipped' : ''}`, style: 'width:60px' }, h('div', { class: 'ci', style: 'background:rgba(255,255,255,0.06)' }, l.icon), `Day ${i + 1}`);
      }));
      const m = modal([
        h('p', { class: 'modal-text' }, `Day ${day + 1} reward is ready!`),
        grid,
        h('button', { class: 'btn primary wide mt', onclick: () => { const r = g.quests.claimLogin(); m.close(); if (r) showRewards('Daily Login', r.rewards); render(); app.renderHud(); } }, 'Claim'),
      ], { title: '🎁 Daily Login' });
      await m.closed;
    }
    const fresh = g.progression.checkAchievements();
    if (fresh.length) { const m = modal([h('p', { class: 'modal-text' }, 'Achievement unlocked!'), h('div', null, fresh.map((a) => h('div', { class: 'ach' }, h('span', { class: 'ai' }, a.icon), h('div', null, h('b', null, a.name), h('div', { class: 'muted' }, a.desc))))), rewardChips(fresh.flatMap((a) => a.reward)), h('button', { class: 'btn primary wide mt', onclick: () => { m.close(); app.push('profile', { tab: 'achievements' }); } }, 'Claim in Profile')], { title: '🏆 Achievement' }); await m.closed; }
  }

  render();
  return {
    el, bg: 'bg-home',
    onShow() { render(); if (scene) scene.host.start(); else startScene(); g.audio.music('menu'); setTimeout(popups, 400); },
    onHide() { scene?.host.stop(); },
    refresh: render,
    destroy() { scene?.dispose(); scene = null; },
  };
}
