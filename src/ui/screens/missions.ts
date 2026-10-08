import { CHESTS, LOGIN_REWARDS, type ChestId } from '../../data/content';
import { weekKey } from '../../systems/state';
import { ChestScene } from '../../vfx/ChestScene';
import { webglAvailable } from '../../vfx/core';
import { header, type App, type Screen } from '../app';
import { h, modal, progressBar, rewardChips, rewardLabel, showRewards, toast, ui } from '../dom';
import { flashScreen } from '../fx2d';
import type { QuestView } from '../../systems/QuestSystem';

export function missionsScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  function questRow(q: QuestView, kind: 'daily' | 'weekly') {
    return h('div', { class: `list-item ${q.done ? 'done' : ''} ${q.claimed ? 'claimed' : ''}` },
      h('div', { class: 'li-main' }, h('div', { class: 'li-title' }, q.def.desc), progressBar(q.progress, q.def.goal), h('div', { class: 'li-sub' }, `${q.progress}/${q.def.goal} · +${q.def.xp} XP`), rewardChips(q.def.reward)),
      h('button', { class: `btn small ${q.done && !q.claimed ? 'primary' : 'disabled'}`, onclick: async () => { const r = g.quests.claim(kind, q.def.id); if (r) { ui.sfx('reward'); await showRewards('Mission complete', r); render(); app.renderHud(); } } }, q.claimed ? '✔' : 'Claim'));
  }
  function render() {
    g.quests.refresh();
    const day = g.quests.loginDay();
    const canLogin = g.quests.canClaimLogin();
    el.replaceChildren(header(app, 'Missions'),
      h('div', { class: 'section-title' }, `Daily login · streak ${g.data.login.streak}`),
      h('div', { class: 'row gap', style: 'overflow-x:auto;padding-bottom:6px' }, LOGIN_REWARDS.map((r, i) => {
        const l = rewardLabel(r);
        const past = i < day || (i === day && !canLogin && false);
        return h('div', { class: `cos-item ${i === day && canLogin ? 'equipped' : ''} ${past ? 'locked' : ''}`, style: 'min-width:64px' }, h('div', { class: 'ci', style: 'background:rgba(255,255,255,0.06)' }, l.icon), `Day ${i + 1}`);
      })),
      canLogin ? h('button', { class: 'btn primary wide', onclick: async () => { const r = g.quests.claimLogin(); if (r) { await showRewards('Daily login', r.rewards); render(); app.renderHud(); } } }, 'Claim daily login') : h('div', { class: 'muted' }, 'Login reward claimed today ✔'),
      h('div', { class: 'section-title' }, 'Daily missions', h('span', { class: 'muted' }, 'reset at midnight')),
      ...g.quests.daily().map((q) => questRow(q, 'daily')),
      h('div', { class: 'section-title' }, 'Weekly missions', h('span', { class: 'muted' }, weekKey())),
      ...g.quests.weekly().map((q) => questRow(q, 'weekly')),
      h('button', { class: 'btn wide mt', onclick: () => app.push('profile', { tab: 'achievements' }) }, `🏆 Achievements${g.progression.unclaimedAchievements() ? ` (${g.progression.unclaimedAchievements()} to claim)` : ''}`),
    );
  }
  render();
  return { el, refresh: render, onShow: render };
}

export function chestsScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  function openChest(id: ChestId) {
    if (g.inventory.chests(id) <= 0) return;
    const stage = h('div', { class: 'chest-stage' });
    const info = h('div', { style: 'text-align:center;min-height:120px' }, h('div', { class: 'booster-hint', style: 'position:static' }, 'Tap the chest to open'));
    let scene: ChestScene | null = null;
    let opened = false;
    const doOpen = async () => {
      if (opened) return;
      opened = true;
      const loot = g.economy.openChest(id);
      if (!loot) return;
      const show = () => { ui.sfx('chestOpen'); ui.haptic('medium'); flashScreen(CHESTS[id].color2); info.replaceChildren(rewardChips(loot), h('button', { class: 'btn primary wide mt', onclick: () => { m.close(); } }, 'Collect')); app.renderHud(); };
      if (scene) await scene.open(show); else show();
      g.progression.checkAchievements();
    };
    stage.addEventListener('click', doOpen);
    const m = modal([stage, info], { title: CHESTS[id].name, onClose: () => { scene?.dispose(); render(); } });
    if (webglAvailable()) { try { scene = new ChestScene(stage, id); scene.start(); } catch { scene = null; } }
    if (!scene) { stage.textContent = '🧰'; stage.style.cssText = 'font-size:120px;text-align:center;height:200px'; }
  }
  function render() {
    const ids = Object.keys(CHESTS) as ChestId[];
    el.replaceChildren(header(app, 'Chests', h('button', { class: 'btn small', onclick: () => app.go('shop', { tab: 'boosters' }) }, '+ Shop')),
      h('p', { class: 'muted' }, 'Chests are earned from wins, missions, the XALA Pass and achievements — or bought with coins and gems.'),
      ...ids.map((id) => {
        const c = CHESTS[id]; const n = g.inventory.chests(id);
        return h('div', { class: 'list-item' },
          h('span', { class: 'li-ic', style: `filter:drop-shadow(0 0 10px ${c.color2})` }, '🧰'),
          h('div', { class: 'li-main' }, h('div', { class: 'li-title', style: `color:${c.color2}` }, c.name), h('div', { class: 'li-sub' }, c.loot.map((l) => `${rewardLabel(l.reward).icon}${l.chance < 1 ? ` ${Math.round(l.chance * 100)}%` : ''}`).join('  '))),
          h('b', null, `×${n}`),
          h('button', { class: `btn small ${n ? 'primary' : 'disabled'}`, onclick: () => n ? openChest(id) : toast('None owned', 'info') }, 'Open'));
      }));
  }
  render();
  return { el, refresh: render, onShow: render };
}

export const _modal = modal;
