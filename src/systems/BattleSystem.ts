// XALACARDS battle engine — pure, deterministic, serialisable.
//
// The UI and the AI both drive the same engine. Every action returns a list of
// BattleEvents that the presentation layer animates.

import { Rng } from '../core/rng';
import type { CardDef, Effect, FactionId, Keyword, TargetKind, Trigger } from '../core/types';

export type PlayerIdx = 0 | 1;
export type TargetRef = string; // "u:<uid>" | "h:<player>"

export interface Unit {
  uid: number;
  cardId: string;
  owner: PlayerIdx;
  baseAtk: number;
  baseHp: number;
  bonusAtk: number;
  bonusHp: number;
  def: number;
  damage: number;
  keywords: Keyword[];
  attacksLeft: number;
  sick: boolean;
  frozen: number;
  shield: boolean;
  rekindled: boolean;
  equipment: string[];
  faction: FactionId;
}

export interface Permanent { uid: number; cardId: string; owner: PlayerIdx }

export interface HandCard { uid: number; cardId: string }

export interface PlayerState {
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  deck: string[];
  hand: HandCard[];
  board: Unit[];
  discard: string[];
  terrain: Permanent | null;
  relics: Permanent[];
  fatigue: number;
  stats: { damageDealt: number; cardsPlayed: number; creaturesKilled: number; damageTaken: number };
}

export interface BattleRules {
  heroHp: number;
  startMana: number;     // extra essence each turn
  allSurge: boolean;
  dawnBurn: number;      // both heroes take damage at dawn
  extraDraw: number;     // extra cards drawn per turn
  maxBoard: number;
  label?: string;
}

export const DEFAULT_RULES: BattleRules = { heroHp: 30, startMana: 0, allSurge: false, dawnBurn: 0, extraDraw: 0, maxBoard: 6 };

export interface BattleState {
  players: [PlayerState, PlayerState];
  turn: PlayerIdx;
  turnNumber: number;
  rngState: number;
  uid: number;
  winner: -1 | 0 | 1 | 2; // 2 = draw
  rules: BattleRules;
  first: PlayerIdx;
}

export type BattleEvent =
  | { t: 'turn'; p: PlayerIdx; n: number }
  | { t: 'draw'; p: PlayerIdx; uid: number; cardId: string }
  | { t: 'burn'; p: PlayerIdx; cardId: string }
  | { t: 'fatigue'; p: PlayerIdx; amount: number }
  | { t: 'play'; p: PlayerIdx; uid: number; cardId: string; target?: TargetRef }
  | { t: 'summon'; p: PlayerIdx; uid: number; cardId: string; index: number; token?: boolean }
  | { t: 'spell'; p: PlayerIdx; cardId: string }
  | { t: 'equip'; p: PlayerIdx; uid: number; cardId: string }
  | { t: 'terrain'; p: PlayerIdx; cardId: string }
  | { t: 'relic'; p: PlayerIdx; cardId: string }
  | { t: 'trigger'; source: TargetRef; trigger: Trigger; cardId: string }
  | { t: 'attack'; from: number; to: TargetRef }
  | { t: 'damage'; target: TargetRef; amount: number; source?: TargetRef }
  | { t: 'shieldBreak'; target: TargetRef }
  | { t: 'heal'; target: TargetRef; amount: number }
  | { t: 'buff'; target: TargetRef; atk: number; hp: number; def?: number; keyword?: Keyword }
  | { t: 'freeze'; target: TargetRef }
  | { t: 'bounce'; uid: number; p: PlayerIdx; cardId: string }
  | { t: 'death'; uid: number; cardId: string; p: PlayerIdx }
  | { t: 'rekindle'; uid: number }
  | { t: 'mana'; p: PlayerIdx; max: number }
  | { t: 'gameOver'; winner: -1 | 0 | 1 | 2 };

export type Action =
  | { kind: 'play'; handUid: number; target?: TargetRef; index?: number }
  | { kind: 'attack'; attacker: number; target: TargetRef }
  | { kind: 'end' };

export type CardLookup = (id: string) => CardDef;

const CHOOSE: TargetKind[] = ['chooseEnemy', 'chooseEnemyUnit', 'chooseAlly', 'chooseAny'];

export const uRef = (uid: number): TargetRef => `u:${uid}`;
export const hRef = (p: PlayerIdx): TargetRef => `h:${p}`;
export const isUnitCard = (c: CardDef) => c.type === 'creature' || c.type === 'champion';

export function createBattle(
  decks: [string[], string[]], names: [string, string], cards: CardLookup,
  opts: { seed?: number; rules?: Partial<BattleRules>; first?: PlayerIdx } = {},
): Battle {
  const rules = { ...DEFAULT_RULES, ...opts.rules };
  const rng = new Rng(opts.seed ?? Date.now());
  const mk = (i: PlayerIdx): PlayerState => ({
    name: names[i], hp: rules.heroHp, maxHp: rules.heroHp, mana: 0, maxMana: 0,
    deck: rng.shuffle([...decks[i]]), hand: [], board: [], discard: [], terrain: null, relics: [], fatigue: 0,
    stats: { damageDealt: 0, cardsPlayed: 0, creaturesKilled: 0, damageTaken: 0 },
  });
  const first: PlayerIdx = opts.first ?? (rng.chance(0.5) ? 0 : 1);
  const state: BattleState = {
    players: [mk(0), mk(1)], turn: first, turnNumber: 0, rngState: rng.state, uid: 1, winner: -1, rules, first,
  };
  const b = new Battle(state, cards);
  for (let i = 0; i < 3; i++) { b.draw(0); b.draw(1); }
  b.draw((1 - first) as PlayerIdx);
  b.startTurn();
  return b;
}

export class Battle {
  events: BattleEvent[] = [];
  private rng: Rng;

  constructor(public state: BattleState, public cards: CardLookup) {
    this.rng = new Rng(1);
    this.rng.state = state.rngState;
  }

  clone(): Battle {
    this.state.rngState = this.rng.state;
    return new Battle(structuredClone(this.state), this.cards);
  }

  private emit(e: BattleEvent) { this.events.push(e); }
  takeEvents(): BattleEvent[] { const e = this.events; this.events = []; return e; }

  get over() { return this.state.winner !== -1; }
  p(i: PlayerIdx) { return this.state.players[i]; }
  foe(i: PlayerIdx): PlayerIdx { return (1 - i) as PlayerIdx; }
  private nextUid() { return this.state.uid++; }

  // ---------- stat helpers ----------

  aura(owner: PlayerIdx, faction: FactionId): { atk: number; hp: number; def: number } {
    const pl = this.p(owner);
    const out = { atk: 0, hp: 0, def: 0 };
    const add = (cardId: string) => {
      const a = this.cards(cardId).aura;
      if (a && (!a.faction || a.faction === faction)) { out.atk += a.atk; out.hp += a.hp; out.def += a.def; }
    };
    if (pl.terrain) add(pl.terrain.cardId);
    for (const r of pl.relics) add(r.cardId);
    for (const u of pl.board) if (this.cards(u.cardId).type === 'champion' && this.cards(u.cardId).aura) add(u.cardId);
    return out;
  }
  atk(u: Unit) { return Math.max(0, u.baseAtk + u.bonusAtk + this.aura(u.owner, u.faction).atk); }
  maxHp(u: Unit) { return u.baseHp + u.bonusHp + this.aura(u.owner, u.faction).hp; }
  hp(u: Unit) { return this.maxHp(u) - u.damage; }
  def(u: Unit) { return u.def + this.aura(u.owner, u.faction).def; }
  has(u: Unit, k: Keyword) { return u.keywords.includes(k); }

  findUnit(uid: number): Unit | undefined {
    return this.state.players[0].board.find((u) => u.uid === uid) ?? this.state.players[1].board.find((u) => u.uid === uid);
  }
  resolveRef(ref: TargetRef): { unit?: Unit; hero?: PlayerIdx } {
    const [k, v] = ref.split(':');
    if (k === 'h') return { hero: Number(v) as PlayerIdx };
    return { unit: this.findUnit(Number(v)) };
  }

  // ---------- turn flow ----------

  draw(i: PlayerIdx, n = 1) {
    const pl = this.p(i);
    for (let k = 0; k < n; k++) {
      const id = pl.deck.shift();
      if (!id) {
        pl.fatigue++;
        this.emit({ t: 'fatigue', p: i, amount: pl.fatigue });
        this.damageHero(i, pl.fatigue);
        continue;
      }
      if (pl.hand.length >= 10) { pl.discard.push(id); this.emit({ t: 'burn', p: i, cardId: id }); continue; }
      const hc = { uid: this.nextUid(), cardId: id };
      pl.hand.push(hc);
      this.emit({ t: 'draw', p: i, uid: hc.uid, cardId: id });
    }
  }

  startTurn() {
    const s = this.state;
    const i = s.turn;
    const pl = this.p(i);
    s.turnNumber++;
    pl.maxMana = Math.min(10, pl.maxMana + 1);
    const bonus = s.turnNumber === 2 && i !== s.first ? 1 : 0; // going-second compensation
    pl.mana = Math.min(10 + s.rules.startMana, pl.maxMana + s.rules.startMana + bonus);
    this.emit({ t: 'turn', p: i, n: s.turnNumber });
    for (const u of pl.board) {
      u.sick = false;
      u.attacksLeft = u.frozen > 0 ? 0 : this.has(u, 'frenzy') ? 2 : 1;
    }
    this.draw(i, 1 + s.rules.extraDraw);
    if (s.rules.dawnBurn) { this.damageHero(i, s.rules.dawnBurn); }
    this.runTriggers(i, 'dawn');
    this.cleanup();
  }

  endTurn() {
    if (this.over) return;
    const i = this.state.turn;
    this.runTriggers(i, 'dusk');
    for (const u of this.p(i).board) if (u.frozen > 0) u.frozen--;
    this.cleanup();
    if (this.over) return;
    this.state.turn = this.foe(i);
    this.startTurn();
  }

  private runTriggers(i: PlayerIdx, trig: Trigger) {
    const pl = this.p(i);
    const sources: { ref: TargetRef; cardId: string; uid?: number }[] = [];
    if (pl.terrain) sources.push({ ref: hRef(i), cardId: pl.terrain.cardId });
    for (const r of pl.relics) sources.push({ ref: hRef(i), cardId: r.cardId });
    for (const u of pl.board) sources.push({ ref: uRef(u.uid), cardId: u.cardId, uid: u.uid });
    for (const src of sources) {
      const effs = this.cards(src.cardId).effects.filter((e) => e.trigger === trig);
      if (!effs.length) continue;
      if (src.uid != null && !this.findUnit(src.uid)) continue;
      this.emit({ t: 'trigger', source: src.ref, trigger: trig, cardId: src.cardId });
      for (const e of effs) this.applyEffect(e, i, src.uid, undefined);
      if (this.over) return;
    }
  }

  // ---------- targeting ----------

  requiredTarget(card: CardDef): TargetKind | null {
    if (card.type === 'equipment') return 'chooseAlly';
    const e = card.effects.find((x) => x.trigger === 'play' && CHOOSE.includes(x.target));
    return e ? e.target : null;
  }

  validTargets(kind: TargetKind, owner: PlayerIdx): TargetRef[] {
    const foe = this.foe(owner);
    const enemyUnits = this.p(foe).board.filter((u) => !this.has(u, 'veil')).map((u) => uRef(u.uid));
    const allyUnits = this.p(owner).board.map((u) => uRef(u.uid));
    switch (kind) {
      case 'chooseEnemy': return [...enemyUnits, hRef(foe)];
      case 'chooseEnemyUnit': return enemyUnits;
      case 'chooseAlly': return allyUnits;
      case 'chooseAny': return [...enemyUnits, ...allyUnits, hRef(foe), hRef(owner)];
      default: return [];
    }
  }

  canPlay(i: PlayerIdx, handUid: number): boolean {
    if (this.over || this.state.turn !== i) return false;
    const pl = this.p(i);
    const hc = pl.hand.find((h) => h.uid === handUid);
    if (!hc) return false;
    const c = this.cards(hc.cardId);
    if (c.cost > pl.mana) return false;
    if (isUnitCard(c) && pl.board.length >= this.state.rules.maxBoard) return false;
    if (c.type === 'relic' && pl.relics.length >= 2) return false;
    const req = this.requiredTarget(c);
    if (req && !isUnitCard(c) && this.validTargets(req, i).length === 0) return false;
    return true;
  }

  attackTargets(attackerUid: number): TargetRef[] {
    const u = this.findUnit(attackerUid);
    if (!u || !this.canAttack(u)) return [];
    const foe = this.foe(u.owner);
    const visible = this.p(foe).board.filter((x) => !this.has(x, 'veil'));
    const guards = visible.filter((x) => this.has(x, 'bulwark'));
    if (guards.length) return guards.map((x) => uRef(x.uid));
    return [...visible.map((x) => uRef(x.uid)), hRef(foe)];
  }

  canAttack(u: Unit): boolean {
    if (this.over || this.state.turn !== u.owner) return false;
    if (u.attacksLeft <= 0 || u.frozen > 0 || this.atk(u) <= 0) return false;
    if (u.sick && !(this.has(u, 'surge') || this.state.rules.allSurge)) return false;
    return true;
  }

  legalActions(i: PlayerIdx): Action[] {
    const out: Action[] = [];
    if (this.over || this.state.turn !== i) return out;
    const pl = this.p(i);
    for (const hc of pl.hand) {
      if (!this.canPlay(i, hc.uid)) continue;
      const c = this.cards(hc.cardId);
      const req = this.requiredTarget(c);
      const targets = req ? this.validTargets(req, i) : [];
      if (targets.length) for (const t of targets) out.push({ kind: 'play', handUid: hc.uid, target: t });
      else out.push({ kind: 'play', handUid: hc.uid });
    }
    for (const u of pl.board) for (const t of this.attackTargets(u.uid)) out.push({ kind: 'attack', attacker: u.uid, target: t });
    out.push({ kind: 'end' });
    return out;
  }

  // ---------- actions ----------

  apply(i: PlayerIdx, a: Action): boolean {
    if (this.over || this.state.turn !== i) return false;
    let ok = false;
    if (a.kind === 'end') { this.endTurn(); ok = true; }
    else if (a.kind === 'play') ok = this.playCard(i, a.handUid, a.target, a.index);
    else if (a.kind === 'attack') ok = this.attack(i, a.attacker, a.target);
    this.state.rngState = this.rng.state;
    return ok;
  }

  /** Opening-hand mulligan: shuffles the chosen cards back and draws replacements. */
  mulligan(i: PlayerIdx, handUids: number[]) {
    const pl = this.p(i);
    const back = pl.hand.filter((h) => handUids.includes(h.uid));
    if (!back.length) return;
    pl.hand = pl.hand.filter((h) => !handUids.includes(h.uid));
    pl.deck.push(...back.map((h) => h.cardId));
    this.rng.shuffle(pl.deck);
    for (let k = 0; k < back.length; k++) {
      const id = pl.deck.shift()!;
      pl.hand.push({ uid: this.nextUid(), cardId: id });
    }
    this.state.rngState = this.rng.state;
  }

  concede(i: PlayerIdx) {
    if (this.over) return;
    this.state.winner = this.foe(i);
    this.emit({ t: 'gameOver', winner: this.state.winner });
  }

  playCard(i: PlayerIdx, handUid: number, target?: TargetRef, index?: number): boolean {
    if (!this.canPlay(i, handUid)) return false;
    const pl = this.p(i);
    const hi = pl.hand.findIndex((h) => h.uid === handUid);
    const hc = pl.hand[hi];
    const c = this.cards(hc.cardId);
    const req = this.requiredTarget(c);
    if (req) {
      const valid = this.validTargets(req, i);
      if (target && !valid.includes(target)) return false;
      if (!target && valid.length && !isUnitCard(c)) return false;
      if (!target && valid.length && isUnitCard(c)) target = undefined; // herald fizzles if player skips
    }
    pl.hand.splice(hi, 1);
    pl.mana -= c.cost;
    pl.stats.cardsPlayed++;
    this.emit({ t: 'play', p: i, uid: hc.uid, cardId: c.id, target });

    let sourceUid: number | undefined;
    if (isUnitCard(c)) {
      const u = this.summon(i, c.id, index, false, hc.uid);
      sourceUid = u?.uid;
    } else if (c.type === 'action') {
      this.emit({ t: 'spell', p: i, cardId: c.id });
      pl.discard.push(c.id);
    } else if (c.type === 'equipment') {
      const t = target ? this.resolveRef(target).unit : undefined;
      if (t && c.equip) {
        t.bonusAtk += c.equip.atk;
        t.bonusHp += c.equip.hp;
        t.def += c.equip.def;
        if (c.equip.keyword && !t.keywords.includes(c.equip.keyword)) {
          t.keywords.push(c.equip.keyword);
          if (c.equip.keyword === 'aegis') t.shield = true;
          if (c.equip.keyword === 'frenzy' && t.attacksLeft === 1) t.attacksLeft = 2;
        }
        t.equipment.push(c.id);
        this.emit({ t: 'equip', p: i, uid: t.uid, cardId: c.id });
        this.emit({ t: 'buff', target: uRef(t.uid), atk: c.equip.atk, hp: c.equip.hp, def: c.equip.def, keyword: c.equip.keyword });
      }
    } else if (c.type === 'terrain') {
      if (pl.terrain) pl.discard.push(pl.terrain.cardId);
      pl.terrain = { uid: hc.uid, cardId: c.id, owner: i };
      this.emit({ t: 'terrain', p: i, cardId: c.id });
    } else if (c.type === 'relic') {
      pl.relics.push({ uid: hc.uid, cardId: c.id, owner: i });
      this.emit({ t: 'relic', p: i, cardId: c.id });
    }

    for (const e of c.effects.filter((x) => x.trigger === 'play')) {
      this.applyEffect(e, i, sourceUid, CHOOSE.includes(e.target) ? target : undefined);
      if (this.over) break;
    }
    this.cleanup();
    return true;
  }

  summon(i: PlayerIdx, cardId: string, index?: number, token = false, uid?: number): Unit | undefined {
    const pl = this.p(i);
    if (pl.board.length >= this.state.rules.maxBoard) return undefined;
    const c = this.cards(cardId);
    const u: Unit = {
      uid: uid ?? this.nextUid(), cardId, owner: i, baseAtk: c.attack, baseHp: c.hp, bonusAtk: 0, bonusHp: 0, def: c.defense,
      damage: 0, keywords: [...c.keywords], attacksLeft: c.keywords.includes('frenzy') ? 2 : 1, sick: true, frozen: 0,
      shield: c.keywords.includes('aegis'), rekindled: false, equipment: [], faction: c.faction,
    };
    const idx = index == null ? pl.board.length : Math.max(0, Math.min(pl.board.length, index));
    pl.board.splice(idx, 0, u);
    this.emit({ t: 'summon', p: i, uid: u.uid, cardId, index: idx, token });
    return u;
  }

  attack(i: PlayerIdx, attackerUid: number, target: TargetRef): boolean {
    const a = this.findUnit(attackerUid);
    if (!a || a.owner !== i) return false;
    if (!this.attackTargets(attackerUid).includes(target)) return false;
    a.attacksLeft--;
    if (this.has(a, 'veil')) a.keywords = a.keywords.filter((k) => k !== 'veil');
    this.emit({ t: 'attack', from: a.uid, to: target });
    for (const e of this.cards(a.cardId).effects.filter((x) => x.trigger === 'attack')) {
      this.emit({ t: 'trigger', source: uRef(a.uid), trigger: 'attack', cardId: a.cardId });
      this.applyEffect(e, i, a.uid, undefined);
    }
    if (this.over || !this.findUnit(a.uid)) { this.cleanup(); return true; }
    const tr = this.resolveRef(target);
    const dmg = this.atk(a);
    if (tr.hero != null) {
      const dealt = this.damageHero(tr.hero, dmg, uRef(a.uid));
      if (this.has(a, 'siphon') && dealt > 0) this.healHero(i, dealt);
    } else if (tr.unit) {
      const d = tr.unit;
      const back = this.atk(d);
      const dealt = this.damageUnit(d, dmg, a);
      if (this.has(a, 'siphon') && dealt > 0) this.healHero(i, dealt);
      if (!this.has(a, 'volley') && back > 0) {
        const got = this.damageUnit(a, back, d);
        if (this.has(d, 'siphon') && got > 0) this.healHero(d.owner, got);
      }
    }
    this.cleanup();
    return true;
  }

  // ---------- damage / healing ----------

  damageHero(i: PlayerIdx, amount: number, source?: TargetRef): number {
    if (amount <= 0) return 0;
    const pl = this.p(i);
    pl.hp -= amount;
    pl.stats.damageTaken += amount;
    this.p(this.foe(i)).stats.damageDealt += amount;
    this.emit({ t: 'damage', target: hRef(i), amount, source });
    if (pl.hp <= 0) this.checkWinner();
    return amount;
  }

  damageUnit(u: Unit, amount: number, source?: Unit): number {
    if (amount <= 0) return 0;
    if (u.shield) {
      u.shield = false;
      u.keywords = u.keywords.filter((k) => k !== 'aegis');
      this.emit({ t: 'shieldBreak', target: uRef(u.uid) });
      return 0;
    }
    const dealt = Math.max(1, amount - this.def(u));
    u.damage += dealt;
    this.p(this.foe(u.owner)).stats.damageDealt += dealt;
    this.emit({ t: 'damage', target: uRef(u.uid), amount: dealt, source: source ? uRef(source.uid) : undefined });
    if (source && this.has(source, 'blight') && this.hp(u) > 0) u.damage = this.maxHp(u);
    return dealt;
  }

  healHero(i: PlayerIdx, amount: number) {
    const pl = this.p(i);
    const h = Math.min(amount, pl.maxHp - pl.hp);
    if (h <= 0) return;
    pl.hp += h;
    this.emit({ t: 'heal', target: hRef(i), amount: h });
  }

  private checkWinner() {
    const [a, b] = this.state.players;
    if (a.hp <= 0 && b.hp <= 0) this.state.winner = 2;
    else if (a.hp <= 0) this.state.winner = 1;
    else if (b.hp <= 0) this.state.winner = 0;
    if (this.state.winner !== -1) this.emit({ t: 'gameOver', winner: this.state.winner });
  }

  cleanup() {
    for (let guard = 0; guard < 20; guard++) {
      if (this.over) return;
      const dead: Unit[] = [];
      for (const pl of this.state.players) for (const u of pl.board) if (this.hp(u) <= 0) dead.push(u);
      if (!dead.length) return;
      for (const u of dead) {
        const pl = this.p(u.owner);
        const idx = pl.board.indexOf(u);
        if (idx < 0) continue;
        if (this.has(u, 'rekindle') && !u.rekindled) {
          u.rekindled = true;
          u.keywords = u.keywords.filter((k) => k !== 'rekindle');
          u.bonusAtk = 0; u.bonusHp = 0; u.equipment.forEach((e) => pl.discard.push(e)); u.equipment = [];
          u.def = this.cards(u.cardId).defense;
          u.damage = this.maxHp(u) - 1;
          this.emit({ t: 'rekindle', uid: u.uid });
          continue;
        }
        pl.board.splice(idx, 1);
        const c = this.cards(u.cardId);
        if (!c.token) pl.discard.push(u.cardId);
        pl.discard.push(...u.equipment);
        this.p(this.foe(u.owner)).stats.creaturesKilled++;
        this.emit({ t: 'death', uid: u.uid, cardId: u.cardId, p: u.owner });
        const echoes = c.effects.filter((e) => e.trigger === 'death');
        if (echoes.length) {
          this.emit({ t: 'trigger', source: uRef(u.uid), trigger: 'death', cardId: u.cardId });
          for (const e of echoes) this.applyEffect(e, u.owner, undefined, undefined);
        }
      }
    }
  }

  // ---------- effects ----------

  private resolveTargets(e: Effect, owner: PlayerIdx, sourceUid?: number, chosen?: TargetRef): TargetRef[] {
    const foe = this.foe(owner);
    const enemyUnits = () => this.p(foe).board.map((u) => uRef(u.uid));
    const allyUnits = () => this.p(owner).board.map((u) => uRef(u.uid));
    switch (e.target) {
      case 'chooseEnemy': case 'chooseEnemyUnit': case 'chooseAlly': case 'chooseAny':
        return chosen ? [chosen] : [];
      case 'randomEnemy': {
        const pool = this.p(foe).board.filter((u) => !this.has(u, 'veil')).map((u) => uRef(u.uid));
        if (e.action === 'damage') pool.push(hRef(foe));
        return pool.length ? [this.rng.pick(pool)] : [];
      }
      case 'allEnemies': return enemyUnits();
      case 'allEnemyAll': return [...enemyUnits(), hRef(foe)];
      case 'allAllies': return allyUnits();
      case 'allCreatures': return [...allyUnits(), ...enemyUnits()];
      case 'self': return sourceUid != null && this.findUnit(sourceUid) ? [uRef(sourceUid)] : [];
      case 'enemyHero': return [hRef(foe)];
      case 'ownHero': return [hRef(owner)];
      case 'randomAlly': {
        const pool = allyUnits().filter((r) => r !== (sourceUid != null ? uRef(sourceUid) : ''));
        return pool.length ? [this.rng.pick(pool)] : [];
      }
      default: return [];
    }
  }

  applyEffect(e: Effect, owner: PlayerIdx, sourceUid?: number, chosen?: TargetRef) {
    if (this.over) return;
    const amt = e.amount ?? 0;
    const src = sourceUid != null ? this.findUnit(sourceUid) : undefined;
    switch (e.action) {
      case 'draw': this.draw(owner, amt); return;
      case 'mana': {
        const pl = this.p(owner);
        pl.maxMana = Math.min(10, pl.maxMana + amt);
        this.emit({ t: 'mana', p: owner, max: pl.maxMana });
        return;
      }
      case 'summon': {
        for (let k = 0; k < (e.count ?? 1); k++) this.summon(owner, e.token!, undefined, true);
        return;
      }
    }
    for (const ref of this.resolveTargets(e, owner, sourceUid, chosen)) {
      const r = this.resolveRef(ref);
      switch (e.action) {
        case 'damage':
          if (r.hero != null) this.damageHero(r.hero, amt, src ? uRef(src.uid) : hRef(owner));
          else if (r.unit) this.damageUnit(r.unit, amt, src);
          if (src && this.has(src, 'siphon')) this.healHero(owner, amt);
          break;
        case 'heal':
          if (r.hero != null) this.healHero(r.hero, amt);
          else if (r.unit) {
            const h = Math.min(amt, r.unit.damage);
            r.unit.damage -= h;
            if (h > 0) this.emit({ t: 'heal', target: ref, amount: h });
          }
          break;
        case 'buff':
          if (r.unit) {
            r.unit.bonusAtk += amt;
            r.unit.bonusHp += e.amount2 ?? 0;
            this.emit({ t: 'buff', target: ref, atk: amt, hp: e.amount2 ?? 0 });
          }
          break;
        case 'armor':
          if (r.unit) { r.unit.def += amt; this.emit({ t: 'buff', target: ref, atk: 0, hp: 0, def: amt }); }
          break;
        case 'destroy':
          if (r.unit) { r.unit.damage = this.maxHp(r.unit) + 99; r.unit.rekindled = r.unit.rekindled; this.emit({ t: 'damage', target: ref, amount: 99 }); }
          break;
        case 'freeze':
          if (r.unit) { r.unit.frozen = 1; r.unit.attacksLeft = 0; this.emit({ t: 'freeze', target: ref }); }
          break;
        case 'shield':
          if (r.unit) {
            r.unit.shield = true;
            if (!r.unit.keywords.includes('aegis')) r.unit.keywords.push('aegis');
            this.emit({ t: 'buff', target: ref, atk: 0, hp: 0, keyword: 'aegis' });
          }
          break;
        case 'grant':
          if (r.unit && e.keyword && !r.unit.keywords.includes(e.keyword)) {
            r.unit.keywords.push(e.keyword);
            if (e.keyword === 'aegis') r.unit.shield = true;
            if (e.keyword === 'frenzy') r.unit.attacksLeft += 1;
            if (e.keyword === 'surge') r.unit.sick = false;
            this.emit({ t: 'buff', target: ref, atk: 0, hp: 0, keyword: e.keyword });
          }
          break;
        case 'bounce':
          if (r.unit) {
            const pl = this.p(r.unit.owner);
            pl.board.splice(pl.board.indexOf(r.unit), 1);
            pl.discard.push(...r.unit.equipment);
            const c = this.cards(r.unit.cardId);
            if (!c.token && pl.hand.length < 10) pl.hand.push({ uid: this.nextUid(), cardId: r.unit.cardId });
            this.emit({ t: 'bounce', uid: r.unit.uid, p: r.unit.owner, cardId: r.unit.cardId });
          }
          break;
      }
      if (this.over) return;
    }
  }
}
