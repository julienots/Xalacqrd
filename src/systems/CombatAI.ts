// Combat AI with five difficulty levels. All levels drive the same engine via
// legal actions; higher levels search deeper with a better evaluation.

import { Rng } from '../core/rng';
import type { CardDef, FactionId, Rarity } from '../core/types';
import { Battle, type Action, type PlayerIdx, type Unit } from './BattleSystem';
import { RARITIES } from '../data/rarities';
import { FACTION_IDS } from '../data/factions';

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' | 'MASTER';
export const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'];

interface Profile { beam: number; depth: number; noise: number; randomness: number; lookahead: boolean; maxNodes: number }
const PROFILES: Record<Difficulty, Profile> = {
  EASY: { beam: 1, depth: 1, noise: 6, randomness: 0.45, lookahead: false, maxNodes: 40 },
  NORMAL: { beam: 1, depth: 1, noise: 4, randomness: 0.18, lookahead: false, maxNodes: 80 },
  HARD: { beam: 2, depth: 2, noise: 1.5, randomness: 0, lookahead: false, maxNodes: 220 },
  EXPERT: { beam: 3, depth: 3, noise: 0.2, randomness: 0, lookahead: true, maxNodes: 450 },
  MASTER: { beam: 4, depth: 4, noise: 0, randomness: 0, lookahead: true, maxNodes: 900 },
};

const KW_EVAL: Record<string, number> = { bulwark: 1, surge: 0.3, siphon: 1, volley: 1.2, veil: 1, blight: 2, frenzy: 1.5, aegis: 1.5, rekindle: 1.5 };

export class CombatAI {
  private rng: Rng;
  constructor(public difficulty: Difficulty, seed = Date.now()) { this.rng = new Rng(seed); }

  unitValue(b: Battle, u: Unit): number {
    const atk = b.atk(u), hp = b.hp(u);
    let v = atk * 1.1 + hp * 0.9 + b.def(u) * 1.4 + Math.sqrt(Math.max(0, atk * hp)) * 0.6;
    for (const k of u.keywords) v += KW_EVAL[k] ?? 0;
    if (u.shield) v += 1;
    if (u.frozen) v -= atk * 0.5;
    const c = b.cards(u.cardId);
    v += c.effects.filter((e) => e.trigger === 'dawn' || e.trigger === 'dusk').length * 2;
    return v + 1;
  }

  evaluate(b: Battle, me: PlayerIdx): number {
    const s = b.state;
    if (s.winner === me) return 10000;
    if (s.winner !== -1 && s.winner !== me) return s.winner === 2 ? -5000 : -10000;
    const foe = b.foe(me);
    const P = b.p(me), F = b.p(foe);
    let v = 0;
    v += (P.hp - F.hp) * 0.7;
    v += Math.max(0, 12 - F.hp) * 0.6; // pressure when enemy is low
    v -= Math.max(0, 12 - P.hp) * 0.8;
    for (const u of P.board) v += this.unitValue(b, u);
    for (const u of F.board) v -= this.unitValue(b, u) * 1.05;
    v += P.hand.length * 0.9 - F.hand.length * 0.6;
    v += (P.terrain ? 2.5 : 0) + P.relics.length * 4 - (F.terrain ? 2.5 : 0) - F.relics.length * 4;
    if (PROFILES[this.difficulty].lookahead) {
      // threat: how much the enemy could hit us for next turn
      let threat = 0;
      for (const u of F.board) threat += b.atk(u) * (b.has(u, 'frenzy') ? 2 : 1);
      const guards = P.board.filter((u) => b.has(u, 'bulwark')).reduce((a, u) => a + b.hp(u), 0);
      threat = Math.max(0, threat - guards);
      if (threat >= P.hp) v -= 400;
      else v -= threat * 0.25;
      // our lethal next turn potential
      let ours = 0;
      for (const u of P.board) if (!u.frozen) ours += b.atk(u) * (b.has(u, 'frenzy') ? 2 : 1);
      if (ours >= F.hp && !F.board.some((u) => b.has(u, 'bulwark'))) v += 60;
    }
    return v;
  }

  private simulate(b: Battle, me: PlayerIdx, a: Action): Battle {
    const c = b.clone();
    c.apply(me, a);
    c.takeEvents();
    return c;
  }

  /** Chooses the next action for player `me`. */
  chooseAction(b: Battle, me: PlayerIdx): Action {
    const prof = PROFILES[this.difficulty];
    const actions = b.legalActions(me);
    if (actions.length <= 1) return { kind: 'end' };
    const nonEnd = actions.filter((a) => a.kind !== 'end');

    // lethal check for everyone above EASY: face attacks that win immediately
    if (this.difficulty !== 'EASY') {
      for (const a of nonEnd) {
        const sim = this.simulate(b, me, a);
        if (sim.state.winner === me) return a;
      }
    }

    if (this.rng.chance(prof.randomness)) {
      return this.rng.chance(0.85) ? this.rng.pick(nonEnd) : { kind: 'end' };
    }

    const baseScore = this.evaluate(b, me);
    let nodes = 0;
    type Node = { first: Action; battle: Battle; score: number };
    let frontier: Node[] = [];
    for (const a of nonEnd) {
      if (nodes++ > prof.maxNodes) break;
      const sim = this.simulate(b, me, a);
      frontier.push({ first: a, battle: sim, score: this.evaluate(sim, me) + (this.rng.next() - 0.5) * prof.noise });
    }
    if (!frontier.length) return { kind: 'end' };
    let best: Node = frontier.reduce((x, y) => (y.score > x.score ? y : x));

    for (let d = 1; d < prof.depth; d++) {
      frontier.sort((x, y) => y.score - x.score);
      frontier = frontier.slice(0, prof.beam);
      const next: Node[] = [];
      for (const n of frontier) {
        if (n.battle.over || n.battle.state.turn !== me) continue;
        for (const a of n.battle.legalActions(me)) {
          if (a.kind === 'end') continue;
          if (nodes++ > prof.maxNodes) break;
          const sim = this.simulate(n.battle, me, a);
          const node = { first: n.first, battle: sim, score: this.evaluate(sim, me) + (this.rng.next() - 0.5) * prof.noise };
          next.push(node);
          if (node.score > best.score) best = node;
        }
      }
      if (!next.length) break;
      frontier = next;
    }
    // Only act if it improves the position (ending the turn otherwise)
    if (best.score <= baseScore + 0.05) {
      // still develop the board: playing creatures is almost always good
      const plays = nonEnd.filter((a) => a.kind === 'play');
      if (plays.length && this.difficulty !== 'MASTER') return plays[0];
      return { kind: 'end' };
    }
    return best.first;
  }
}

// ---------- AI deck building ----------

export function buildAIDeck(pool: CardDef[], opts: { factions?: FactionId[]; maxRarity?: Rarity; seed?: number; size?: number } = {}): string[] {
  const rng = new Rng(opts.seed ?? Date.now());
  const size = opts.size ?? 30;
  const factions = opts.factions ?? rng.shuffle([...FACTION_IDS]).slice(0, 2);
  const maxTier = RARITIES[opts.maxRarity ?? 'LEGENDARY'].tier;
  const candidates = pool.filter((c) => !c.token && factions.includes(c.faction) && RARITIES[c.rarity].tier <= maxTier);
  const score = (c: CardDef) => {
    let s = c.attack + c.hp + c.defense * 2 + c.effects.length * 2.5 + c.keywords.length * 1.5 + RARITIES[c.rarity].tier * 0.8;
    if (c.type === 'action' || c.type === 'equipment') s += c.cost * 1.6;
    if (c.type === 'terrain' || c.type === 'relic') s += 4;
    return s / Math.max(1, c.cost) + rng.next() * 1.5;
  };
  // target curve: weighted by cost bucket
  const curve: Record<number, number> = { 1: 3, 2: 5, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1, 9: 1, 10: 0 };
  const deck: string[] = [];
  const count = (id: string) => deck.filter((x) => x === id).length;
  const sorted = [...candidates].sort((a, b) => score(b) - score(a));
  for (let cost = 1; cost <= 10; cost++) {
    const want = curve[cost] ?? 0;
    let got = 0;
    for (const c of sorted.filter((x) => x.cost === cost)) {
      const max = Math.min(2, RARITIES[c.rarity].maxCopies);
      while (count(c.id) < max && got < want) { deck.push(c.id); got++; }
      if (got >= want) break;
    }
  }
  for (const c of sorted) {
    if (deck.length >= size) break;
    const max = Math.min(2, RARITIES[c.rarity].maxCopies);
    while (count(c.id) < max && deck.length < size) deck.push(c.id);
  }
  // ensure enough creatures
  const units = (ids: string[]) => ids.filter((id) => { const c = pool.find((p) => p.id === id)!; return c.type === 'creature' || c.type === 'champion'; }).length;
  if (units(deck) < size * 0.5) {
    const creatures = sorted.filter((c) => (c.type === 'creature' || c.type === 'champion'));
    for (let i = deck.length - 1; i >= 0 && units(deck) < size * 0.55; i--) {
      const c = pool.find((p) => p.id === deck[i])!;
      if (c.type === 'creature' || c.type === 'champion') continue;
      const rep = creatures.find((x) => count(x.id) < Math.min(2, RARITIES[x.rarity].maxCopies));
      if (!rep) break;
      deck[i] = rep.id;
    }
  }
  return deck.slice(0, size);
}
