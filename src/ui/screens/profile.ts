import { COSMETICS, RANK_COLORS, RANK_ICONS, rankName, rankTier, type CosmeticKind } from '../../data/content';
import { cardBackURL } from '../../render/cardFace';
import { header, type App, type Screen } from '../app';
import { cardThumb, openCardDetail } from '../cardView';
import { h, progressBar, promptDialog, rewardChips, showRewards, tabs, toast, ui } from '../dom';

type Tab = 'overview' | 'achievements' | 'customize';

export function profileScreen(app: App, params: { tab?: Tab } = {}): Screen {
  const g = app.game;
  let tab: Tab = params.tab ?? 'overview';
  let kind: CosmeticKind = 'cardback';
  const el = h('div');

  function overview() {
    const s = g.profile.summary();
    const lp = g.profile.levelProgress();
    const av = g.profile.avatar();
    const fr = g.profile.frame();
    const rt = rankTier(g.data.ranked.index);
    return h('div', null,
      h('div', { class: 'panel', style: 'text-align:center' },
        h('div', { class: 'frame-ring', style: `background:linear-gradient(135deg,${fr.colors[0]},${fr.colors[1]})` }, h('span', { class: 'avatar lg', style: `background:linear-gradient(135deg,${av.colors[0]},${av.colors[1]})` }, av.glyph)),
        h('div', { style: 'font-family:var(--serif);font-size:26px;font-weight:900;margin-top:8px' }, g.data.profile.name, h('button', { class: 'btn small ghost', onclick: async () => { const n = await promptDialog('Collector name', g.data.profile.name); if (n != null) { if (!g.profile.setName(n)) toast('Name must be 2-16 characters', 'bad'); render(); app.renderHud(); } } }, '✏️')),
        h('div', { style: 'color:var(--gold);font-weight:800' }, `「${g.profile.titleText()}」`),
        h('div', { class: 'row gap center mt' }, h('span', { class: 'tag' }, `Level ${lp.level}`), h('span', { class: 'tag', style: `color:${RANK_COLORS[rt]}` }, `${RANK_ICONS[rt]} ${rankName(g.data.ranked.index)}`)),
        h('div', { class: 'mt' }, progressBar(lp.xp, lp.need, 'gold'), h('div', { class: 'muted' }, `${lp.xp}/${lp.need} XP`))),
      h('div', { class: 'section-title' }, 'Statistics'),
      h('div', { class: 'stat-grid' },
        ...([['Matches', s.games], ['Wins', s.wins], ['Win rate', `${s.winRate}%`], ['Cards', `${s.unique}/${s.total}`], ['Packs opened', s.packs], ['Legendary+', s.legendaries], ['Perfect wins', s.perfect], ['Decks', s.decks], ['Best rank', rankName(g.data.ranked.best)]] as [string, string | number][])
          .map(([k, v]) => h('div', { class: 'stat-box' }, h('b', null, String(v)), h('span', null, k)))),
      h('div', { class: 'section-title' }, 'Rarest cards'),
      h('div', { class: 'card-grid' }, g.profile.showcase(6).map((c) => cardThumb(c, g.collection.bestFinish(c.id), { onClick: () => openCardDetail(app, c) }))),
      h('div', { class: 'section-title' }, 'Decks'),
      ...g.data.decks.map((d) => h('div', { class: 'list-item' }, h('span', { class: 'li-ic' }, '🧱'), h('div', { class: 'li-main' }, h('div', { class: 'li-title' }, d.name), h('div', { class: 'li-sub' }, `${d.cards.length} cards`)))),
    );
  }

  function achievements() {
    const list = g.progression.achievements();
    return h('div', null,
      h('div', { class: 'muted', style: 'margin-bottom:8px' }, `${list.filter((a) => a.unlocked).length}/${list.length} unlocked`),
      ...list.map((a) => h('div', { class: `ach ${a.unlocked ? '' : 'locked'}` },
        h('span', { class: 'ai' }, a.def.icon),
        h('div', { class: 'grow' }, h('b', null, a.def.name), h('div', { class: 'muted' }, a.def.desc), progressBar(a.progress, a.def.goal), h('div', { style: 'transform:scale(.85);transform-origin:left' }, rewardChips(a.def.reward))),
        a.unlocked && !a.claimed ? h('button', { class: 'btn small primary', onclick: async () => { const r = g.progression.claimAchievement(a.def.id); if (r) { ui.sfx('reward'); await showRewards(a.def.name, r); render(); app.renderHud(); } } }, 'Claim') : a.claimed ? h('span', null, '✔') : null)));
  }

  function customize() {
    const kinds: [CosmeticKind, string][] = [['cardback', 'Card backs'], ['board', 'Boards'], ['avatar', 'Avatars'], ['frame', 'Frames'], ['title', 'Titles'], ['victory', 'Victory FX'], ['summon', 'Summon FX']];
    const items = COSMETICS.filter((c) => c.kind === kind);
    return h('div', null,
      tabs(kinds, kind, (k) => { kind = k; render(); }),
      h('div', { class: 'cos-grid' }, items.map((c) => {
        const owned = g.inventory.ownsCosmetic(c.id);
        const eq = g.inventory.isEquipped(c.id);
        const visual = c.kind === 'cardback' ? h('img', { src: cardBackURL(c.id, 160), style: 'height:100%;border-radius:4px' }) : c.kind === 'title' ? h('span', { style: 'font-size:11px' }, `「${c.name}」`) : c.glyph;
        return h('button', { class: `cos-item ${eq ? 'equipped' : ''} ${owned ? '' : 'locked'}`, onclick: () => {
          if (!owned) { toast(c.price ? 'Available in the Shop' : `Unlock: ${c.source ?? 'special'}`, 'info'); return; }
          g.inventory.equip(c.id); ui.sfx('menu'); render(); app.renderHud();
        } }, h('div', { class: 'ci', style: `background:linear-gradient(135deg,${c.colors[0]},${c.colors[1]})` }, visual), c.name, owned ? null : h('div', { class: 'muted', style: 'font-size:9px' }, c.price ? 'Shop' : c.source ?? ''));
      })));
  }

  function render() {
    el.replaceChildren(header(app, 'Profile'), tabs([['overview', 'Overview'], ['achievements', `Achievements${g.progression.unclaimedAchievements() ? ' •' : ''}`], ['customize', 'Customize']], tab, (t) => { tab = t; render(); }),
      tab === 'overview' ? overview() : tab === 'achievements' ? achievements() : customize());
  }
  render();
  return { el, refresh: render, onShow: () => { g.progression.checkAchievements(); render(); } };
}
