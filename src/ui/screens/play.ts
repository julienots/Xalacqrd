import type { FactionId, Rarity } from '../../core/types';
import { CAMPAIGN, RANK_COLORS, RANK_ICONS, STARS_PER_DIVISION, MASTER_STARS_TO_GM, TOURNAMENT_ENTRY, TOURNAMENT_REWARDS, TOURNAMENT_ROUNDS, rankDifficulty, rankName, rankTier, seasonRewards } from '../../data/content';
import { FACTION_IDS, FACTIONS } from '../../data/factions';
import { SETS } from '../../data/sets';
import { buildAIDeck, DIFFICULTIES, type Difficulty } from '../../systems/CombatAI';
import { seasonEnds } from '../../systems/ProgressionSystem';
import type { BattleRules } from '../../systems/BattleSystem';
import { header, type App, type Screen } from '../app';
import { countdown, h, modal, rewardChips, showRewards, toast, ui } from '../dom';
import { opponentFor, type MatchMode, type MatchSpec } from './battle';

const DIFF_RARITY: Record<Difficulty, Rarity> = { EASY: 'RARE', NORMAL: 'EPIC', HARD: 'LEGENDARY', EXPERT: 'MYTHIC', MASTER: 'PRISMATIC' };
const DIFF_DESC: Record<Difficulty, string> = {
  EASY: 'Relaxed opponent, makes mistakes.', NORMAL: 'Plays sensibly with decent cards.', HARD: 'Plans its turn and trades well.',
  EXPERT: 'Searches deep combos, anticipates your attacks.', MASTER: 'Ruthless search, the strongest decks.',
};

export function startMatch(app: App, o: { mode: MatchMode; difficulty: Difficulty; factions?: FactionId[]; rules?: Partial<BattleRules>; stage?: { chapter: number; stage: number }; onFinish?: (won: boolean) => void; deckId?: string; opponentName?: string; bossSet?: string }) {
  const g = app.game;
  const deck = o.deckId ? g.decks.get(o.deckId) : g.decks.active();
  if (!deck || g.decks.validate(deck).length) {
    toast('Your active deck is not valid. Fix it in the Deck Builder.', 'bad', 3000);
    app.go('decks');
    return;
  }
  const seed = Date.now();
  const factions = o.factions ?? [FACTION_IDS[seed % 8], FACTION_IDS[(seed >> 3) % 8]].filter((f, i, a) => a.indexOf(f) === i);
  let pool = g.cards.collectible;
  if (o.bossSet) pool = pool.filter((c) => c.set === o.bossSet || c.set === 'ORI');
  const aiDeck = buildAIDeck(pool, { factions, maxRarity: DIFF_RARITY[o.difficulty], seed });
  const opp = opponentFor(factions, seed);
  if (o.opponentName) opp.name = o.opponentName;
  const spec: MatchSpec = { mode: o.mode, difficulty: o.difficulty, deck: deck.cards, deckName: deck.name, opponent: { ...opp, deck: aiDeck }, rules: o.rules, stage: o.stage, onFinish: o.onFinish };
  g.data.lastDifficulty = o.difficulty;
  app.push('battle', spec);
}

function deckBar(app: App) {
  const g = app.game;
  const d = g.decks.active();
  const valid = d && !g.decks.validate(d).length;
  return h('div', { class: 'panel row gap' },
    h('span', { style: 'font-size:26px' }, '🧱'),
    h('div', { class: 'grow' }, h('div', { style: 'font-weight:800' }, d ? d.name : 'No deck'), h('div', { class: valid ? 'muted' : '', style: valid ? '' : 'color:var(--bad);font-size:12px' }, valid ? `${d!.cards.length} cards · ready` : 'Deck invalid — tap to fix')),
    h('button', { class: 'btn small', onclick: () => pickDeck(app) }, 'Change'));
}

export function pickDeck(app: App, onPick?: () => void) {
  const g = app.game;
  const m = modal([
    ...g.data.decks.map((d) => {
      const errs = g.decks.validate(d);
      return h('button', { class: `deck-tile ${d.id === g.data.activeDeck ? 'active' : ''}`, style: 'width:100%;text-align:left', onclick: () => { if (errs.length) { toast(errs[0], 'bad'); return; } g.decks.setActive(d.id); m.close(); onPick?.(); app.current()?.screen.refresh?.(); } },
        h('div', { class: 'grow' }, h('b', null, d.name), h('div', { class: 'muted' }, errs.length ? `⚠ ${errs[0]}` : `${d.cards.length} cards`)));
    }),
    h('button', { class: 'btn wide mt', onclick: () => { m.close(); app.go('decks'); } }, 'Open Deck Builder'),
  ], { title: 'Choose your deck' });
}

export function chooseDifficulty(title: string, onPick: (d: Difficulty) => void, def: Difficulty = 'NORMAL') {
  const m = modal(DIFFICULTIES.map((d, i) => h('button', { class: `list-item ${d === def ? 'done' : ''}`, style: 'width:100%;text-align:left', onclick: () => { m.close(); onPick(d); } },
    h('span', { class: 'li-ic' }, ['🌱', '⚔️', '🔥', '💀', '👑'][i]),
    h('div', { class: 'li-main' }, h('div', { class: 'li-title' }, d), h('div', { class: 'li-sub' }, DIFF_DESC[d])))), { title });
}

export function playScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  function render() {
    const ev = g.events.current();
    const mode = (icon: string, t1: string, t2: string, colors: [string, string], fn: () => void) =>
      h('button', { class: 'mode-card', style: `background:linear-gradient(120deg,${colors[0]},${colors[1]})`, onclick: () => { ui.sfx('menu'); ui.haptic('light'); fn(); } },
        h('span', { class: 'mi' }, icon), h('div', null, h('div', { class: 'mt1' }, t1), h('div', { class: 'mt2' }, t2)));
    el.replaceChildren(
      h('h1', { class: 'screen-title', style: 'margin-bottom:10px' }, 'Play'),
      deckBar(app),
      h('div', { class: 'mt' }),
      mode('🗺️', 'Campaign', `Solo journey across 4 realms · ${g.data.campaign.cleared.length}/${CAMPAIGN.length} stages`, ['#3a1a6a', '#1a0a3a'], () => app.push('campaign')),
      mode('🏆', 'Ranked', `${rankName(g.data.ranked.index)} · climb the seasonal ladder`, ['#6a4a00', '#2a1a00'], () => app.push('ranked')),
      mode('⚔️', 'Casual', 'Relaxed duel vs a random opponent — coins & XP', ['#0a3a5a', '#05182a'], () => startMatch(app, { mode: 'casual', difficulty: 'NORMAL' })),
      mode('🎯', 'Practice', 'Pick any AI difficulty from EASY to MASTER', ['#0a4a2a', '#042010'], () => chooseDifficulty('Practice — AI level', (d) => startMatch(app, { mode: 'practice', difficulty: d }), g.data.lastDifficulty)),
      mode('🏅', 'Tournament', `8-player bracket · entry ${TOURNAMENT_ENTRY.tickets} 🎟️`, ['#5a0a2a', '#200010'], () => app.push('tournament')),
      mode(ev.def.icon, `Event: ${ev.def.name}`, ev.def.ruleText, ev.def.colors, () => startMatch(app, { mode: 'event', difficulty: 'HARD', rules: ev.def.rules, factions: [ev.def.faction, FACTION_IDS[Date.now() % 8]] })),
    );
  }
  render();
  return { el, refresh: render, onShow: render };
}

export function campaignScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  function render() {
    el.replaceChildren(header(app, 'Campaign'),
      ...[1, 2, 3, 4].map((ch) => {
        const set = SETS[ch - 1];
        const stages = CAMPAIGN.filter((s) => s.chapter === ch);
        const cleared = stages.filter((s) => g.progression.isCleared(s.chapter, s.stage)).length;
        return h('div', { class: 'chapter' },
          h('div', { class: 'set-tile', style: `background:linear-gradient(120deg,hsl(${set.hue},50%,22%),hsl(${set.hue},40%,8%))` }, h('span', { class: 'st-sym' }, set.symbol),
            h('div', { style: 'font-family:var(--serif);font-size:20px;font-weight:900' }, `Chapter ${ch} — ${set.name}`), h('div', { class: 'muted' }, `${set.motto} · ${cleared}/6`)),
          h('div', { class: 'stages' }, stages.map((s) => {
            const unlocked = g.progression.isUnlocked(s.chapter, s.stage);
            const done = g.progression.isCleared(s.chapter, s.stage);
            return h('button', { class: `stage-node ${done ? 'cleared' : ''} ${unlocked ? '' : 'locked'} ${s.boss ? 'boss' : ''}`, onclick: () => {
              if (!unlocked) { toast('Clear the previous stage first', 'bad'); return; }
              const m = modal([
                h('p', { class: 'modal-text' }, s.story),
                h('div', { class: 'row gap center wrap' }, s.factions.map((f) => h('span', { class: 'tag', style: `color:${FACTIONS[f].color}` }, `${FACTIONS[f].icon} ${FACTIONS[f].name}`)), h('span', { class: 'tag' }, s.difficulty)),
                h('div', { class: 'section-title' }, done ? 'Replay reward' : 'First-clear reward'), done ? h('div', { class: 'muted', style: 'text-align:center' }, '40 🪙') : rewardChips(s.reward),
                h('button', { class: 'btn primary wide mt', onclick: () => { m.close(); startMatch(app, { mode: 'campaign', difficulty: s.difficulty, factions: s.factions, stage: { chapter: s.chapter, stage: s.stage }, opponentName: s.boss ? `Guardian of ${set.name}` : undefined, bossSet: set.code }); } }, s.boss ? '⚔ Face the Guardian' : '⚔ Duel'),
              ], { title: `${ch}-${s.stage} · ${s.name}` });
            } }, h('div', { class: 'sn-ic' }, done ? '✅' : unlocked ? (s.boss ? '👑' : '⚔️') : '🔒'), `${ch}-${s.stage}`, h('div', { class: 'muted', style: 'font-size:10px' }, s.name));
          })));
      }));
  }
  render();
  return { el, refresh: render, onShow: render };
}

export function rankedScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  function render() {
    g.progression.ensureRankedSeason();
    const r = g.data.ranked;
    const tier = rankTier(r.index);
    const starsNeeded = r.index >= 15 ? MASTER_STARS_TO_GM : STARS_PER_DIVISION;
    el.replaceChildren(header(app, 'Ranked'),
      h('div', { class: 'panel', style: `text-align:center;background:linear-gradient(180deg,${RANK_COLORS[tier]}33,var(--panel));border-color:${RANK_COLORS[tier]}` },
        h('div', { style: 'font-size:64px;filter:drop-shadow(0 0 20px ' + RANK_COLORS[tier] + ')' }, RANK_ICONS[tier]),
        h('div', { style: `font-family:var(--serif);font-size:28px;font-weight:900;color:${RANK_COLORS[tier]}` }, rankName(r.index)),
        r.index < 16 ? h('div', { style: 'font-size:22px;letter-spacing:4px;margin:6px 0' }, '★'.repeat(Math.min(r.stars, starsNeeded)) + '☆'.repeat(Math.max(0, starsNeeded - r.stars))) : h('div', null, 'Top of the ladder'),
        h('div', { class: 'muted' }, `Season ends in ${countdown(seasonEnds() - Date.now())} · Best: ${rankName(r.best)} · Win streak: ${r.winStreak}`),
        h('div', { class: 'muted', style: 'margin-top:4px' }, `Opponent level: ${rankDifficulty(r.index)} · Win streaks of 3+ earn bonus stars. No star loss in Bronze.`),
        h('button', { class: 'btn primary big wide mt', onclick: () => startMatch(app, { mode: 'ranked', difficulty: rankDifficulty(r.index) }) }, '⚔ Find Match')),
      deckBar(app),
      h('div', { class: 'section-title' }, 'Season rewards for your best rank'),
      h('div', { class: 'panel' }, rewardChips(seasonRewards(r.best))),
      h('div', { class: 'section-title' }, 'Ladder'),
      h('div', { class: 'row wrap gap' }, ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster'].map((n, i) => h('span', { class: 'tag', style: `color:${RANK_COLORS[i]};border-color:${RANK_COLORS[i]};${i === tier ? 'background:rgba(255,255,255,0.1)' : ''}` }, `${RANK_ICONS[i]} ${n}`))),
    );
  }
  render();
  return { el, refresh: render, onShow: render };
}

interface TourneyState { round: number; results: boolean[]; opponents: { name: string; factions: FactionId[] }[] }

export function tournamentScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  let state = g.data.tournament as TourneyState | null;
  const save = () => { g.data.tournament = state; g.changed(); };
  function render() {
    const parts: Node[] = [header(app, 'Tournament')];
    if (!state) {
      parts.push(h('div', { class: 'panel', style: 'text-align:center' },
        h('div', { style: 'font-size:56px' }, '🏅'),
        h('p', null, `Win ${TOURNAMENT_ROUNDS} matches in a row against increasingly tough opponents. Rewards grow with every win — a loss ends your run.`),
        h('div', { class: 'section-title' }, 'Champion prize'), rewardChips(TOURNAMENT_REWARDS[TOURNAMENT_ROUNDS]),
        h('button', { class: 'btn primary big wide mt', onclick: () => {
          if (!g.economy.spend({ tickets: TOURNAMENT_ENTRY.tickets })) { toast('You need a ticket 🎟️ (missions, login, chests)', 'bad'); return; }
          const seed = Date.now();
          state = { round: 0, results: [], opponents: [0, 1, 2].map((i) => { const f = [FACTION_IDS[(seed + i * 3) % 8], FACTION_IDS[(seed + i * 5 + 1) % 8]]; return { name: opponentFor(f, seed + i).name, factions: f }; }) };
          save(); render();
        } }, `Enter (${TOURNAMENT_ENTRY.tickets} 🎟️)`)), deckBar(app));
    } else {
      const diffs: Difficulty[] = ['NORMAL', 'HARD', 'EXPERT'];
      parts.push(h('div', { class: 'bracket' }, state.opponents.map((o, i) => {
        const res = state!.results[i];
        return h('div', { class: `br ${res === true ? 'won' : res === false ? 'lost' : i === state!.round ? 'next' : ''}` },
          h('span', null, `${['Quarterfinal', 'Semifinal', 'Final'][i]} · ${o.name}`), h('span', null, res === true ? '✅' : res === false ? '❌' : `${diffs[i]} ${o.factions.map((f) => FACTIONS[f].icon).join('')}`));
      })));
      const lost = state.results.includes(false);
      const wins = state.results.filter(Boolean).length;
      if (lost || wins >= TOURNAMENT_ROUNDS) {
        parts.push(h('div', { class: 'panel mt', style: 'text-align:center' }, h('h2', null, wins >= TOURNAMENT_ROUNDS ? '🏆 Champion!' : `Run over — ${wins} win${wins === 1 ? '' : 's'}`), rewardChips(TOURNAMENT_REWARDS[wins]),
          h('button', { class: 'btn primary wide mt', onclick: async () => { const r = g.economy.grant(TOURNAMENT_REWARDS[wins]); if (wins >= TOURNAMENT_ROUNDS) { g.stat('tournamentsWon'); g.progression.checkAchievements(); } state = null; save(); await showRewards('Tournament Rewards', r); render(); } }, 'Claim rewards')));
      } else {
        const o = state.opponents[state.round];
        parts.push(h('button', { class: 'btn primary big wide mt', onclick: () => startMatch(app, { mode: 'tournament', difficulty: diffs[state!.round], factions: o.factions, opponentName: o.name, onFinish: (won) => { state!.results.push(won); if (won) state!.round++; save(); } }) }, `⚔ Play ${['Quarterfinal', 'Semifinal', 'Final'][state.round]}`), deckBar(app));
      }
    }
    el.replaceChildren(...parts);
  }
  render();
  return { el, refresh: render, onShow: render };
}
