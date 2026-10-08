import type { CardDef, CardType, FactionId, Rarity } from '../../core/types';
import { FACTION_IDS, FACTIONS } from '../../data/factions';
import { RARITIES, RARITY_ORDER } from '../../data/rarities';
import { SETS } from '../../data/sets';
import type { CardFilter, SortKey } from '../../systems/CardSystem';
import { PAGE_SIZE } from '../../systems/CollectionSystem';
import type { App, Screen } from '../app';
import { lazyThumb, openCardDetail } from '../cardView';
import { h, modal, progressBar, tabs, toast, ui } from '../dom';
import { fx2d } from '../fx2d';

type Section = 'all' | 'owned' | 'missing' | 'favorites' | 'new' | 'rare' | 'sets' | 'factions' | 'rarities';

const TYPES: CardType[] = ['creature', 'champion', 'action', 'equipment', 'terrain', 'relic'];

export function filterControls(f: CardFilter, onChange: () => void, opts: { owned?: boolean } = {}): HTMLElement {
  const chipToggle = <T extends string>(list: T[] | undefined, v: T): T[] => { const s = new Set(list ?? []); if (s.has(v)) s.delete(v); else s.add(v); return [...s]; };
  const chips = <T extends string>(label: string, values: T[], get: () => T[] | undefined, set: (v: T[]) => void, text: (v: T) => string, color?: (v: T) => string) =>
    h('div', null, h('label', null, label), h('div', { class: 'chip-row' }, values.map((v) => h('button', { class: `chip ${get()?.includes(v) ? 'on' : ''}`, style: color && !get()?.includes(v) ? `color:${color(v)}` : '', onclick: (e: Event) => { set(chipToggle(get(), v)); (e.currentTarget as HTMLElement).classList.toggle('on'); onChange(); } }, text(v)))));
  const num = (label: string, minK: keyof CardFilter, maxK: keyof CardFilter, max: number) => {
    const sel = (k: keyof CardFilter) => {
      const s = h('select', { class: 'input', style: 'padding:6px' }, h('option', { value: '' }, k === minK ? 'min' : 'max'), Array.from({ length: max + 1 }, (_, i) => h('option', { value: String(i), selected: (f as any)[k] === i }, String(i)))) as HTMLSelectElement;
      s.addEventListener('change', () => { (f as any)[k] = s.value === '' ? undefined : Number(s.value); onChange(); });
      return s;
    };
    return h('div', null, h('label', null, label), h('div', { class: 'row gap' }, sel(minK), sel(maxK)));
  };
  return h('div', { class: 'panel filter-panel' },
    h('div', { style: 'grid-column:1/-1' }, chips('Rarity', RARITY_ORDER, () => f.rarity, (v) => (f.rarity = v as Rarity[]), (r) => RARITIES[r].name, (r) => RARITIES[r].color)),
    h('div', { style: 'grid-column:1/-1' }, chips('Faction', FACTION_IDS, () => f.faction, (v) => (f.faction = v as FactionId[]), (x) => `${FACTIONS[x].icon} ${FACTIONS[x].name}`)),
    h('div', { style: 'grid-column:1/-1' }, chips('Type', TYPES, () => f.type, (v) => (f.type = v as CardType[]), (t) => t[0].toUpperCase() + t.slice(1))),
    h('div', { style: 'grid-column:1/-1' }, chips('Set', SETS.map((s) => s.code), () => f.set, (v) => (f.set = v), (c) => `${SETS.find((s) => s.code === c)!.symbol} ${SETS.find((s) => s.code === c)!.name}`)),
    num('Cost', 'costMin', 'costMax', 10), num('Attack', 'atkMin', 'atkMax', 15), num('Defense', 'defMin', 'defMax', 4),
    opts.owned !== false ? h('div', null, h('label', null, 'Ownership'), (() => { const s = h('select', { class: 'input', style: 'padding:6px' }, ...['all', 'owned', 'missing'].map((v) => h('option', { value: v, selected: (f.owned ?? 'all') === v }, v))) as HTMLSelectElement; s.addEventListener('change', () => { f.owned = s.value as any; onChange(); }); return s; })()) : null,
  );
}

export function collectionScreen(app: App, params: { section?: Section } = {}): Screen {
  const g = app.game;
  let section: Section = params.section ?? 'all';
  const filter: CardFilter = {};
  let sort: SortKey = 'number';
  let showFilters = false;
  let limit = 60;
  const el = h('div');
  const grid = h('div', { class: 'card-grid' });
  const search = h('input', { class: 'input', placeholder: '🔎 Search name, text, ID…', value: '' }) as HTMLInputElement;
  search.addEventListener('input', () => { filter.text = search.value; limit = 60; renderGrid(); });
  const owned = (id: string) => g.collection.owned(id);
  let lastPages = g.data.pagesCompleted.length;

  function cardsForSection(): CardDef[] {
    let cards = g.cards.collectible;
    switch (section) {
      case 'owned': cards = cards.filter((c) => owned(c.id)); break;
      case 'missing': cards = cards.filter((c) => !owned(c.id)); break;
      case 'favorites': cards = cards.filter((c) => g.collection.isFav(c.id)); break;
      case 'new': cards = cards.filter((c) => g.collection.isNew(c.id)); break;
      case 'rare': cards = cards.filter((c) => owned(c.id) && RARITIES[c.rarity].tier >= 4); break;
    }
    return g.cards.sort(g.cards.filter(cards, filter, owned), sort, sort !== 'number' && sort !== 'name');
  }

  function renderGrid() {
    const cards = cardsForSection();
    grid.replaceChildren(...cards.slice(0, limit).map((c) => lazyThumb(c, owned(c.id) ? g.collection.bestFinish(c.id) : 'NORMAL', {
      missing: !owned(c.id), isNew: g.collection.isNew(c.id), fav: g.collection.isFav(c.id), count: g.collection.total(c.id),
      onClick: () => { openCardDetail(app, c); setTimeout(checkPageFx, 300); },
    })));
    if (cards.length > limit) grid.appendChild(h('button', { class: 'btn wide', style: 'grid-column:1/-1', onclick: () => { limit += 90; renderGrid(); } }, `Show more (${cards.length - limit})`));
    if (!cards.length) grid.appendChild(h('div', { class: 'muted', style: 'grid-column:1/-1;text-align:center;padding:30px' }, 'No cards match.'));
    countEl.textContent = `${cards.length} cards`;
  }
  const countEl = h('span', { class: 'muted' });

  function renderSets() {
    return h('div', null, SETS.map((s) => {
      const p = g.collection.setProgress(s.code);
      const pages = Math.ceil(s.size / PAGE_SIZE);
      const done = g.data.pagesCompleted.filter((k) => k.startsWith(s.code + ':')).length;
      return h('button', { class: 'set-tile', style: `width:100%;text-align:left;background:linear-gradient(120deg,hsl(${s.hue},55%,24%),hsl(${s.hue},40%,8%))`, onclick: () => openSetPages(s.code) },
        h('span', { class: 'st-sym' }, s.symbol),
        h('div', { style: 'font-family:var(--serif);font-size:20px;font-weight:900' }, `${s.symbol} ${s.name}`),
        h('div', { class: 'muted' }, `${s.motto}`),
        h('div', { class: 'row gap mt' }, h('div', { class: 'bar gold grow' }, h('div', { class: 'bar-fill', style: `width:${(p.owned / p.total) * 100}%` })), h('b', null, `${p.owned}/${p.total}`)),
        h('div', { class: 'muted', style: 'margin-top:4px' }, `Pages completed: ${done}/${pages}`));
    }));
  }

  function openSetPages(code: string) {
    const set = SETS.find((s) => s.code === code)!;
    const pages = Math.ceil(set.size / PAGE_SIZE);
    let page = 0;
    const body = h('div');
    const draw = () => {
      const key = `${code}:${page}`;
      const cards = g.collection.pageCards(key);
      const complete = g.data.pagesCompleted.includes(key);
      body.replaceChildren(
        h('div', { class: 'row between' },
          h('button', { class: 'btn small', onclick: () => { page = (page - 1 + pages) % pages; ui.sfx('cardSlide'); draw(); } }, '‹'),
          h('b', null, `Page ${page + 1}/${pages}`),
          h('button', { class: 'btn small', onclick: () => { page = (page + 1) % pages; ui.sfx('cardSlide'); draw(); } }, '›')),
        complete ? h('div', { class: 'page-banner' }, '✦ PAGE COMPLETE ✦') : h('div', { class: 'muted', style: 'text-align:center;margin:6px' }, `${cards.filter((c) => owned(c.id)).length}/${cards.length} collected`),
        h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(3,1fr)' }, cards.map((c) => lazyThumb(c, owned(c.id) ? g.collection.bestFinish(c.id) : 'NORMAL', { missing: !owned(c.id), onClick: () => openCardDetail(app, c) }))),
      );
    };
    draw();
    modal(body, { title: `${set.symbol} ${set.name}` });
  }

  function renderGroups(kind: 'factions' | 'rarities') {
    const groups: [string, string, CardDef[], string][] = kind === 'factions'
      ? FACTION_IDS.map((f) => [f, `${FACTIONS[f].icon} ${FACTIONS[f].name}`, g.cards.collectible.filter((c) => c.faction === f), FACTIONS[f].color])
      : RARITY_ORDER.map((r) => [r, RARITIES[r].name, g.cards.collectible.filter((c) => c.rarity === r), RARITIES[r].color]);
    return h('div', null, groups.map(([id, label, cards, color]) => {
      const n = cards.filter((c) => owned(c.id)).length;
      return h('button', { class: 'list-item', style: 'width:100%;text-align:left', onclick: () => {
        if (kind === 'factions') filter.faction = [id as FactionId]; else filter.rarity = [id as Rarity];
        section = 'all'; render();
      } }, h('div', { class: 'li-main' }, h('div', { class: 'li-title', style: `color:${color}` }, label), h('div', { class: 'li-sub' }, kind === 'factions' ? FACTIONS[id as FactionId].strategy : `${RARITIES[id as Rarity].maxCopies} max per deck · craft ${RARITIES[id as Rarity].craftCost} 🔹`)),
        h('b', null, `${n}/${cards.length}`));
    }));
  }

  function checkPageFx() {
    const now = g.data.pagesCompleted.length;
    if (now > lastPages) {
      lastPages = now;
      ui.sfx('page'); ui.haptic('medium');
      const fx = h('div', { class: 'page-complete-fx' }, h('div', { class: 'pc' }, '📖 PAGE COMPLETE!', h('div', { style: 'font-size:16px;letter-spacing:.2em' }, 'Codex updated')));
      document.body.appendChild(fx);
      for (let i = 0; i < 6; i++) setTimeout(() => fx2d.burst(innerWidth * Math.random(), innerHeight * 0.4, ['#ffcf6b', '#fff', '#8a6bff'], 40, 340), i * 200);
      setTimeout(() => fx.remove(), 2500);
    }
  }

  function render() {
    const total = g.cards.collectible.length;
    const own = g.collection.uniqueOwned();
    const sortSel = h('select', { class: 'input', style: 'width:auto;padding:8px' }, ...(['number', 'name', 'cost', 'rarity', 'attack', 'hp'] as SortKey[]).map((k) => h('option', { value: k, selected: k === sort }, `Sort: ${k}`))) as HTMLSelectElement;
    sortSel.addEventListener('change', () => { sort = sortSel.value as SortKey; renderGrid(); });
    const sections: [Section, string][] = [['all', 'All'], ['owned', 'Owned'], ['missing', 'Missing'], ['favorites', '★ Favorites'], ['new', `New (${Object.values(g.data.collection).filter((o) => o.isNew).length})`], ['rare', 'Rares'], ['sets', 'By Set'], ['factions', 'By Faction'], ['rarities', 'By Rarity']];
    const active = (filter.rarity?.length ?? 0) + (filter.faction?.length ?? 0) + (filter.type?.length ?? 0) + (filter.set?.length ?? 0);
    el.replaceChildren(
      h('div', { class: 'row between' }, h('h1', { class: 'screen-title' }, 'XalaCodex'), h('button', { class: 'btn small', onclick: () => { const n = g.collection.disenchantExtras(); toast(n ? `+${n} 🔹 shards from extra copies` : 'No extra copies to convert', n ? 'good' : 'info'); } }, `🔹 ${g.data.currencies.shards}`)),
      h('div', { class: 'codex-progress' }, progressBar(own, total, 'gold'), h('b', null, `${own}/${total}`)),
      h('div', { class: 'mt' }),
      tabs(sections, section, (s) => { section = s; limit = 60; render(); }),
      ...(section === 'sets' ? [renderSets()] : section === 'factions' || section === 'rarities' ? [renderGroups(section)] : [
        h('div', { class: 'search-row' }, search, h('button', { class: `btn small ${active ? 'violet' : ''}`, onclick: () => { showFilters = !showFilters; render(); } }, active ? `Filters (${active})` : 'Filters')),
        showFilters ? filterControls(filter, () => { limit = 60; renderGrid(); }) : '',
        h('div', { class: 'row between', style: 'margin:6px 0' }, countEl, h('div', { class: 'row gap' }, active || filter.text ? h('button', { class: 'btn small ghost', onclick: () => { for (const k of Object.keys(filter)) delete (filter as any)[k]; search.value = ''; render(); } }, 'Reset') : null, section === 'new' ? h('button', { class: 'btn small ghost', onclick: () => { g.collection.markAllSeen(); render(); } }, 'Mark seen') : null, sortSel)),
        grid,
      ]),
    );
    if (section !== 'sets' && section !== 'factions' && section !== 'rarities') renderGrid();
  }
  render();
  return { el, refresh: render, onShow: () => { render(); checkPageFx(); } };
}
