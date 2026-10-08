import type { CardType } from '../../core/types';
import { FACTIONS } from '../../data/factions';
import { RARITIES } from '../../data/rarities';
import { cardFaceURL } from '../../render/cardFace';
import type { CardFilter, SortKey } from '../../systems/CardSystem';
import { DECK_SIZE, MAX_DECKS } from '../../systems/DeckSystem';
import type { Deck } from '../../systems/state';
import { header, type App, type Screen } from '../app';
import { cardThumb, openCardDetail } from '../cardView';
import { confirmDialog, h, modal, promptDialog, toast, ui } from '../dom';
import { filterControls } from './collection';
import { startMatch } from './play';

function cover(app: App, d: Deck) {
  const g = app.game;
  const best = [...d.cards].map((id) => g.cards.has(id) ? g.cards.get(id) : null).filter(Boolean).sort((a, b) => RARITIES[b!.rarity].tier - RARITIES[a!.rarity].tier)[0];
  return h('div', { class: 'deck-cover' }, best ? h('img', { src: cardFaceURL(best, 'NORMAL', 240) }) : h('div', { style: 'width:100%;height:100%;background:#222' }));
}

export function decksScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  function render() {
    el.replaceChildren(
      h('div', { class: 'row between' }, h('h1', { class: 'screen-title' }, 'Decks'), h('span', { class: 'muted' }, `${g.data.decks.length}/${MAX_DECKS}`)),
      h('button', { class: 'btn primary wide', style: 'margin:8px 0 12px', onclick: async () => {
        const name = await promptDialog('New deck', 'My Deck');
        if (name == null) return;
        const d = g.decks.create(name || 'My Deck');
        if (!d) { toast('Deck limit reached', 'bad'); return; }
        app.push('deckEditor', { id: d.id });
      } }, '+ Create Deck'),
      ...g.data.decks.map((d) => {
        const st = g.decks.stats(d);
        const errs = g.decks.validate(d);
        const facs = (Object.entries(st.factions) as [keyof typeof FACTIONS, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return h('div', { class: `deck-tile ${d.id === g.data.activeDeck ? 'active' : ''}` },
          cover(app, d),
          h('div', { class: 'grow', onclick: () => app.push('deckEditor', { id: d.id }) },
            h('div', { style: 'font-weight:800;font-size:16px' }, d.name, d.id === g.data.activeDeck ? h('span', { class: 'tag', style: 'color:var(--gold);margin-left:6px' }, 'ACTIVE') : null),
            h('div', { class: 'muted' }, `${st.count}/${DECK_SIZE} · avg cost ${st.avgCost.toFixed(1)} · ${facs.map(([f]) => FACTIONS[f].icon).join('')}`),
            errs.length ? h('div', { style: 'color:var(--bad);font-size:12px' }, `⚠ ${errs[0]}`) : null),
          h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
            d.id !== g.data.activeDeck && !errs.length ? h('button', { class: 'btn small', onclick: () => { g.decks.setActive(d.id); ui.sfx('menu'); render(); } }, 'Use') : null,
            h('button', { class: 'btn small ghost', onclick: () => deckMenu(d) }, '⋯')));
      }),
    );
  }
  function deckMenu(d: Deck) {
    const m = modal([
      h('button', { class: 'btn wide', onclick: () => { m.close(); app.push('deckEditor', { id: d.id }); } }, '✏️ Edit'),
      h('button', { class: 'btn wide mt', onclick: async () => { m.close(); const n = await promptDialog('Rename deck', d.name); if (n) { g.decks.rename(d.id, n); render(); } } }, '🏷️ Rename'),
      h('button', { class: 'btn wide mt', onclick: () => { m.close(); if (g.decks.duplicate(d.id)) { toast('Deck duplicated', 'good'); render(); } else toast('Deck limit reached', 'bad'); } }, '📄 Duplicate'),
      h('button', { class: 'btn wide mt', onclick: () => { m.close(); if (g.decks.validate(d).length) { toast('Deck must be valid to test', 'bad'); return; } startMatch(app, { mode: 'test', difficulty: 'EASY', deckId: d.id }); } }, '🧪 Test vs AI'),
      h('button', { class: 'btn danger wide mt', onclick: async () => { m.close(); if (await confirmDialog('Delete deck?', `"${d.name}" will be removed.`, 'Delete', true)) { g.decks.remove(d.id); render(); } } }, '🗑️ Delete'),
    ], { title: d.name });
  }
  render();
  return { el, refresh: render, onShow: render };
}

export function deckEditorScreen(app: App, params: { id: string }): Screen {
  const g = app.game;
  const deck = g.decks.get(params.id)!;
  const el = h('div', { class: 'deck-edit' });
  const filter: CardFilter = { owned: 'owned' };
  let sort: SortKey = 'cost';
  let showFilters = false;
  let showStats = false;
  const search = h('input', { class: 'input', placeholder: '🔎 Search…' }) as HTMLInputElement;
  search.addEventListener('input', () => { filter.text = search.value; renderPool(); });
  const pool = h('div', { class: 'card-grid' });
  const strip = h('div', { class: 'deck-strip' });
  const statsBox = h('div');
  const headEl = h('div');
  let limit = 60;

  function renderHead() {
    const errs = g.decks.validate(deck);
    headEl.replaceChildren(header(app, deck.name, h('button', { class: `btn small ${errs.length ? '' : 'primary'}`, onclick: save }, 'Save'), () => save()),
      h('div', { class: 'row between' }, h('b', { style: `color:${deck.cards.length === DECK_SIZE ? 'var(--good)' : 'var(--gold)'}` }, `${deck.cards.length}/${DECK_SIZE} cards`),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn small ghost', onclick: async () => { const n = await promptDialog('Rename deck', deck.name); if (n) { g.decks.rename(deck.id, n); renderHead(); } } }, '🏷️'),
          h('button', { class: 'btn small ghost', onclick: () => { showStats = !showStats; renderStats(); } }, '📊'),
          h('button', { class: 'btn small ghost', onclick: () => { g.decks.autoComplete(deck); ui.sfx('cardSlide'); renderAll(); } }, '✨ Auto'),
          h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmDialog('Clear deck?', 'Remove all cards from this deck?', 'Clear', true)) { deck.cards = []; g.changed(); renderAll(); } } }, '🗑️'))));
  }

  function renderStrip() {
    const counts = new Map<string, number>();
    for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    const ids = [...counts.keys()].filter((id) => g.cards.has(id)).sort((a, b) => g.cards.get(a).cost - g.cards.get(b).cost);
    strip.replaceChildren(...ids.map((id) => {
      const c = g.cards.get(id);
      return h('div', { class: 'ds-card', onclick: () => { g.decks.removeCard(deck, id); ui.sfx('cardSlide'); renderAll(); } }, cardThumb(c, 'NORMAL', { count: counts.get(id) }));
    }), ids.length ? '' : h('div', { class: 'muted', style: 'padding:20px' }, 'Tap cards below to add them to your deck.'));
  }

  function renderStats() {
    if (!showStats) { statsBox.replaceChildren(); return; }
    const st = g.decks.stats(deck);
    const max = Math.max(1, ...st.curve);
    const types = Object.entries(st.types).filter(([, n]) => n > 0) as [CardType, number][];
    statsBox.replaceChildren(h('div', { class: 'panel', style: 'margin-bottom:8px' },
      h('div', { class: 'row between' }, h('b', null, 'Essence curve'), h('span', { class: 'muted' }, `avg ${st.avgCost.toFixed(2)}`)),
      h('div', { class: 'curve' }, st.curve.map((n, i) => h('div', { class: 'cv' }, h('span', null, String(n)), h('i', { style: `height:${(n / max) * 100}%` }), h('span', null, i === 7 ? '7+' : String(i))))),
      h('div', { class: 'stat-pills mt' },
        ...types.map(([t, n]) => h('span', null, `${t}: ${n}`)),
        ...(Object.entries(st.factions) as [keyof typeof FACTIONS, number][]).map(([f, n]) => h('span', { style: `color:${FACTIONS[f].color}` }, `${FACTIONS[f].icon} ${n}`)),
        h('span', null, `avg ⚔ ${st.avgAttack.toFixed(1)} / ❤ ${st.avgHp.toFixed(1)}`))));
  }

  function renderPool() {
    const owned = (id: string) => g.collection.owned(id);
    const cards = g.cards.sort(g.cards.filter(g.cards.collectible, filter, owned), sort);
    pool.replaceChildren(...cards.slice(0, limit).map((c) => {
      const inDeck = g.decks.copiesIn(deck, c.id);
      const wrap = h('div', { class: 'builder-card' }, cardThumb(c, owned(c.id) ? g.collection.bestFinish(c.id) : 'NORMAL', { count: g.collection.total(c.id), missing: !owned(c.id) }),
        inDeck ? h('span', { class: 'in-deck' }, `${inDeck}/${Math.min(g.decks.maxCopies(c), g.collection.total(c.id))}`) : null);
      let pressT: ReturnType<typeof setTimeout> | null = null, long = false;
      wrap.addEventListener('pointerdown', () => { long = false; pressT = setTimeout(() => { long = true; openCardDetail(app, c); }, 450); });
      wrap.addEventListener('pointerup', () => { if (pressT) clearTimeout(pressT); if (long) return; const err = g.decks.canAdd(deck, c); if (err) { toast(err, 'bad'); return; } g.decks.add(deck, c); ui.sfx('cardPlace'); ui.haptic('light'); renderAll(false); });
      wrap.addEventListener('pointerleave', () => { if (pressT) clearTimeout(pressT); });
      wrap.addEventListener('contextmenu', (e) => e.preventDefault());
      return wrap;
    }));
    if (cards.length > limit) pool.appendChild(h('button', { class: 'btn wide', style: 'grid-column:1/-1', onclick: () => { limit += 90; renderPool(); } }, `Show more (${cards.length - limit})`));
  }

  function renderAll(full = true) {
    renderHead(); renderStrip(); renderStats();
    if (full) renderPool(); else {
      // update only the in-deck badges for speed
      renderPool();
    }
  }

  function save() {
    const errs = g.decks.validate(deck);
    g.decks.save(deck);
    g.progression.checkAchievements();
    if (errs.length) toast(`Saved (incomplete): ${errs[0]}`, 'info', 2600);
    else { toast('Deck saved ✔', 'good'); if (!g.data.activeDeck || g.decks.validate(g.decks.get(g.data.activeDeck)!).length) g.decks.setActive(deck.id); }
    app.back();
  }

  const sortSel = h('select', { class: 'input', style: 'width:auto;padding:8px' }, ...(['cost', 'name', 'rarity', 'attack', 'hp', 'number'] as SortKey[]).map((k) => h('option', { value: k }, `Sort: ${k}`))) as HTMLSelectElement;
  sortSel.addEventListener('change', () => { sort = sortSel.value as SortKey; renderPool(); });
  const filtersBox = h('div');
  el.append(headEl, strip, statsBox,
    h('div', { class: 'search-row' }, search, h('button', { class: 'btn small', onclick: () => { showFilters = !showFilters; filtersBox.replaceChildren(showFilters ? filterControls(filter, () => renderPool()) : ''); } }, 'Filters'), sortSel),
    filtersBox, pool);
  renderAll();
  return { el, nav: false, refresh: () => renderAll() };
}
