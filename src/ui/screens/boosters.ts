import { PACKS, type PackId } from '../../data/content';
import { FINISHES, RARITIES } from '../../data/rarities';
import { SETS } from '../../data/sets';
import type { PackResult, PulledCard } from '../../systems/BoosterSystem';
import { BoosterScene } from '../../vfx/BoosterScene';
import { webglAvailable } from '../../vfx/core';
import { header, type App, type Screen } from '../app';
import { cardThumb, openCardDetail } from '../cardView';
import { h, modal, toast, ui } from '../dom';
import { flashScreen } from '../fx2d';

export function packArt(id: PackId, count?: number) {
  const p = PACKS[id];
  return h('div', { class: 'pack-art', style: `background:linear-gradient(135deg,${p.colors[0]},${p.colors[1]})` },
    count != null ? h('span', { class: 'pack-count' }, `×${count}`) : null,
    h('span', { class: 'pg' }, p.glyph), h('span', { class: 'pn' }, p.name));
}

export function boostersScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  let setCode = 'ORI';
  function render() {
    const owned = (Object.keys(PACKS) as PackId[]).filter((id) => g.inventory.packs(id) > 0);
    el.replaceChildren(
      header(app, 'Boosters', h('button', { class: 'btn small', onclick: () => app.go('shop') }, '+ Shop')),
      h('div', { class: 'section-title' }, 'Choose an expansion'),
      h('div', { class: 'tabs' }, SETS.filter((s) => s.code !== 'EVT').map((s) => h('button', { class: `tab ${s.code === setCode ? 'on' : ''}`, onclick: () => { setCode = s.code; ui.sfx('tap'); render(); } }, `${s.symbol} ${s.name}`))),
      h('div', { class: 'muted' }, 'Basic, Elite, Cosmic and Secret packs draw from the selected expansion. Starter packs are always Origins; Event packs include festival promos. Pity: a Legendary+ is guaranteed within 30 packs.',
        h('b', null, ` (${g.data.pity}/30)`)),
      owned.length ? h('div', { class: 'shop-grid mt' }, owned.map((id) => h('div', { class: 'offer' },
        packArt(id, g.inventory.packs(id)),
        h('div', { class: 'row gap mt' },
          h('button', { class: 'btn small ghost', onclick: () => showOdds(id) }, 'Odds'),
          h('button', { class: 'btn small primary', onclick: () => openPack(id) }, 'Open')))))
        : h('div', { class: 'panel mt', style: 'text-align:center' }, h('p', null, 'No boosters left.'), h('button', { class: 'btn primary', onclick: () => app.go('shop') }, 'Visit the Shop')),
    );
  }
  function showOdds(id: PackId) {
    modal([
      h('p', { class: 'modal-text' }, PACKS[id].desc),
      h('div', { class: 'section-title' }, 'Best slot odds'),
      ...g.boosters.odds(id).map((o) => h('div', { class: 'row between', style: `color:${RARITIES[o.rarity].color};padding:3px 0` }, h('b', null, RARITIES[o.rarity].name), `${o.pct.toFixed(2)}%`)),
      h('div', { class: 'section-title' }, 'Finish odds (per card)'),
      h('div', { class: 'muted' }, 'Normal ~80% · Foil ~10% · Holographic ~5% · Gold 2% · Cosmic 1.2% · Prism 0.9% · Signature 0.6% · Secret 0.3% (boosted in premium packs, limited by card).'),
    ], { title: `${PACKS[id].name} odds` });
  }
  function openPack(id: PackId) {
    const ev = g.events.current();
    const pool = id === 'EVENT' ? g.cards.eventCards(ev.def.id) : [];
    const result = g.boosters.open(id, id === 'EVENT' ? 'ALL' : setCode, pool);
    if (!result) { toast('No pack available', 'bad'); return; }
    app.push('opening', { result });
  }
  render();
  return { el, refresh: render, onShow: render };
}

export function openingScreen(app: App, params: { result: PackResult }): Screen {
  const g = app.game;
  const result = params.result;
  const canvasBox = h('div', { class: 'booster-canvas' });
  const hint = h('div', { class: 'booster-hint' });
  const title = h('div', { class: 'reveal-title' });
  const skipBtn = h('button', { class: 'btn small ghost', onclick: () => scene ? scene.skip() : showSummary() }, 'Skip ⏭');
  const openBtn = h('button', { class: 'btn primary big booster-open', onclick: (e: Event) => { e.stopPropagation(); scene?.open(); } }, '✦ OPEN PACK ✦');
  const uiLayer = h('div', { class: 'booster-ui' }, h('div', { class: 'booster-top' }, h('span', { class: 'chip' }, `${PACKS[result.packId].glyph} ${PACKS[result.packId].name}`), skipBtn), title, hint, openBtn);
  const el = h('div', { class: 'booster-screen full' }, canvasBox, uiLayer);
  let scene: BoosterScene | null = null;
  let summaryShown = false;

  function setTitle(p: PulledCard | null) {
    if (!p) { title.replaceChildren(); return; }
    const r = RARITIES[p.rarity];
    const fin = FINISHES[p.finish];
    const color = p.rarity === 'PRISMATIC' ? '#fff' : r.color;
    title.replaceChildren(
      h('div', { class: 'rt-rar', style: `color:${color}` }, r.name.toUpperCase()),
      r.tier >= 2 || p.isNew ? h('div', { class: 'rt-name', style: `color:${color}` }, p.card.name) : '',
      h('div', { class: 'rt-fin' }, [fin.tier > 0 ? fin.name.toUpperCase() : '', p.isNew ? '✦ NEW ✦' : p.shards ? `+${p.shards} 🔹` : ''].filter(Boolean).join('  ·  ')),
    );
  }

  function showSummary() {
    if (summaryShown) return;
    summaryShown = true;
    ui.sfx('reward');
    const best = Math.max(...result.cards.map((c) => RARITIES[c.rarity].tier));
    const again = g.inventory.packs(result.packId) > 0;
    const summary = h('div', { class: 'booster-summary' },
      h('div', { class: 'screen-title', style: 'text-align:center;margin-bottom:6px' }, 'Pack Contents'),
      h('div', { class: 'muted', style: 'text-align:center;margin-bottom:12px' }, `${result.cards.filter((c) => c.isNew).length} new · best: ${Object.values(RARITIES).find((r) => r.tier === best)?.name}${result.pityTriggered ? ' · Pity bonus!' : ''}`),
      h('div', { class: 'card-grid', style: 'row-gap:22px' }, [...result.cards].reverse().map((p, i) => h('div', { class: 'sum-card', style: `animation-delay:${i * 0.06}s` },
        cardThumb(p.card, p.finish, { isNew: p.isNew, onClick: () => openCardDetail(app, p.card, p.finish) }),
        h('div', { class: 'sum-tag', style: `color:${RARITIES[p.rarity].color}` }, `${RARITIES[p.rarity].name}${p.finish !== 'NORMAL' ? ' · ' + FINISHES[p.finish].name : ''}${p.shards ? ` · +${p.shards}🔹` : ''}`)))),
      h('div', { class: 'row gap center', style: 'margin-top:30px' },
        h('button', { class: 'btn', onclick: () => app.back() }, 'Done'),
        again ? h('button', { class: 'btn primary', onclick: () => {
          const ev = g.events.current();
          const r = g.boosters.open(result.packId, result.set, result.packId === 'EVENT' ? g.cards.eventCards(ev.def.id) : []);
          if (r) app.replace('opening', { result: r });
        } }, `Open another (${g.inventory.packs(result.packId)})`) : null),
    );
    uiLayer.appendChild(summary);
    skipBtn.remove();
  }

  const hooks = {
    sfx: (n: string, a?: any) => g.audio.play(n, a),
    music: (m: any) => g.audio.music(m),
    haptic: (l: any) => g.haptics.impact(l),
    epic: () => g.haptics.epic(),
    hint: (t: string) => { hint.textContent = t; },
    phase: (p: 'idle' | 'opening' | 'reveal') => { openBtn.style.display = p === 'idle' ? '' : 'none'; },
    title: setTitle,
    flash: (c: string) => flashScreen(c),
    shake: () => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); },
    done: showSummary,
  };

  return {
    el, nav: false, hud: false, bg: 'bg-booster',
    onShow() {
      if (scene || summaryShown) return;
      if (!webglAvailable()) { showSummary(); return; }
      try {
        scene = new BoosterScene(canvasBox, result, g.data.equipped.cardback, hooks, g.data.settings.fastReveal);
        scene.start();
        scene.host.fpsEl = document.getElementById('fps');
      } catch (e) { console.error(e); showSummary(); }
    },
    destroy() { scene?.dispose(); scene = null; g.audio.music('menu'); },
  };
}
