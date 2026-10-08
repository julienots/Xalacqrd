// Deterministic card database generator.
//
// Every card is produced from a seeded RNG so the database is identical on every
// device (saves only store card ids). The architecture scales to thousands of
// cards: add a SetDef with a size and the generator fills it, or append
// hand-authored CardDefs to HANDCRAFTED.

import { Rng } from '../core/rng';
import type { CardDef, CardType, Effect, FactionId, Finish, Keyword, Rarity, SetDef, TargetKind, Trigger, ActionKind } from '../core/types';
import { FACTIONS, FACTION_IDS } from './factions';
import { RARITY_ORDER, RARITIES } from './rarities';
import { SETS } from './sets';
import { ADJ, ARCH_NOUNS, ACTION_NOUNS, EQUIP_NOUNS, TERRAIN_PLACES, TERRAIN_PREFIX, RELIC_OBJECTS, SYL, CHAMPION_TITLES, FLAVOR } from './names';
import { effectText, auraText, KEYWORDS } from './effectText';

// ---------- tokens ----------

const TOKEN_SPECS: Record<FactionId, { name: string; atk: number; hp: number; kw: Keyword[]; arch: string }> = {
  EMBER: { name: 'Cinder Imp', atk: 2, hp: 1, kw: ['surge'], arch: 'elemental' },
  VERDANT: { name: 'Sproutling', atk: 1, hp: 2, kw: [], arch: 'spirit' },
  ABYSS: { name: 'Tide Wisp', atk: 1, hp: 2, kw: ['veil'], arch: 'spirit' },
  VOLT: { name: 'Spark Drone', atk: 1, hp: 1, kw: ['surge'], arch: 'construct' },
  VOID: { name: 'Hollow Shade', atk: 2, hp: 1, kw: [], arch: 'spirit' },
  AETHER: { name: 'Lumen Mote', atk: 1, hp: 1, kw: ['aegis'], arch: 'spirit' },
  TITAN: { name: 'Pebble Guard', atk: 0, hp: 3, kw: ['bulwark'], arch: 'golem' },
  COSMOS: { name: 'Stardust Sprite', atk: 1, hp: 1, kw: [], arch: 'elemental' },
};

function makeTokens(): CardDef[] {
  return FACTION_IDS.map((f, i) => {
    const t = TOKEN_SPECS[f];
    return {
      id: `TOK-${f}`, set: 'TOK', num: i + 1, name: t.name, type: 'creature' as CardType, faction: f, rarity: 'COMMON' as Rarity,
      cost: 1, attack: t.atk, defense: 0, hp: t.hp, keywords: t.kw, effects: [], text: t.kw.map((k) => KEYWORDS[k].name).join(', '),
      flavor: 'Summoned, not collected.', level: 1, anim: animFor(f), finishes: ['NORMAL'],
      art: { seed: 1000 + i, archetype: t.arch, hue: FACTIONS[f].hue, hue2: FACTIONS[f].hue2 }, token: true,
    };
  });
}

function animFor(f: FactionId): string {
  return ({ EMBER: 'flame', VERDANT: 'bloom', ABYSS: 'tide', VOLT: 'spark', VOID: 'shadow', AETHER: 'radiance', TITAN: 'quake', COSMOS: 'starfall' } as const)[f];
}

// ---------- effect templates ----------

interface Tmpl {
  trigger: Trigger; action: ActionKind; target: TargetKind;
  unit: number;      // value per amount point
  max: number;       // max amount
  fixed?: number;    // fixed amount (no scaling)
  kw?: Keyword;
  buffSplit?: boolean;
  summon?: boolean;
  w: number;         // weight
  selfOk?: boolean;  // valid on non-creatures
  creatureOnly?: boolean;
}

const T = (trigger: Trigger, action: ActionKind, target: TargetKind, unit: number, max: number, w: number, extra: Partial<Tmpl> = {}): Tmpl =>
  ({ trigger, action, target, unit, max, w, ...extra });

const FACTION_TMPL: Record<FactionId, Tmpl[]> = {
  EMBER: [
    T('play', 'damage', 'chooseEnemy', 1.2, 6, 5), T('play', 'damage', 'randomEnemy', 0.9, 5, 3), T('play', 'damage', 'enemyHero', 0.75, 6, 3),
    T('play', 'damage', 'allEnemies', 2.3, 3, 2), T('death', 'damage', 'randomEnemy', 0.8, 4, 2, { creatureOnly: true }),
    T('attack', 'damage', 'enemyHero', 1.1, 2, 1, { creatureOnly: true }), T('play', 'summon', 'none', 1, 2, 1, { summon: true }),
    T('dawn', 'damage', 'randomEnemy', 1.4, 3, 1), T('play', 'grant', 'chooseAlly', 1.3, 1, 1, { fixed: 1, kw: 'surge' }),
  ],
  VERDANT: [
    T('play', 'buff', 'chooseAlly', 0.9, 4, 4, { buffSplit: true }), T('play', 'buff', 'allAllies', 1.9, 2, 2, { buffSplit: true }),
    T('play', 'heal', 'ownHero', 0.45, 8, 3), T('play', 'summon', 'none', 1, 3, 4, { summon: true }),
    T('death', 'summon', 'none', 0.9, 2, 2, { summon: true, creatureOnly: true }), T('dawn', 'buff', 'self', 1.4, 2, 2, { buffSplit: true, creatureOnly: true }),
    T('dawn', 'heal', 'ownHero', 0.7, 3, 1), T('play', 'grant', 'chooseAlly', 1.2, 1, 1, { fixed: 1, kw: 'rekindle' }),
  ],
  ABYSS: [
    T('play', 'freeze', 'chooseEnemyUnit', 1.4, 1, 4, { fixed: 1 }), T('play', 'draw', 'none', 1.6, 3, 4), T('play', 'bounce', 'chooseEnemyUnit', 2.6, 1, 2, { fixed: 1 }),
    T('play', 'freeze', 'allEnemies', 3.2, 1, 1, { fixed: 1 }), T('death', 'draw', 'none', 1.4, 2, 2, { creatureOnly: true }),
    T('play', 'damage', 'chooseEnemyUnit', 1.1, 4, 2), T('dusk', 'draw', 'none', 2.2, 1, 1),
  ],
  VOLT: [
    T('play', 'damage', 'randomEnemy', 0.9, 4, 4), T('play', 'draw', 'none', 1.6, 2, 2), T('play', 'grant', 'chooseAlly', 1.3, 1, 2, { fixed: 1, kw: 'frenzy' }),
    T('attack', 'damage', 'randomEnemy', 1.2, 2, 2, { creatureOnly: true }), T('play', 'damage', 'chooseEnemy', 1.2, 5, 3),
    T('play', 'summon', 'none', 1, 2, 2, { summon: true }), T('dawn', 'damage', 'randomEnemy', 1.4, 2, 1),
  ],
  VOID: [
    T('play', 'destroy', 'chooseEnemyUnit', 5.5, 1, 2, { fixed: 1 }), T('death', 'damage', 'enemyHero', 0.8, 4, 3, { creatureOnly: true }),
    T('death', 'summon', 'none', 0.9, 2, 3, { summon: true, creatureOnly: true }), T('play', 'damage', 'chooseEnemyUnit', 1.1, 5, 3),
    T('play', 'grant', 'chooseAlly', 1.3, 1, 1, { fixed: 1, kw: 'blight' }), T('play', 'damage', 'allCreatures', 1.4, 4, 1),
    T('dusk', 'damage', 'enemyHero', 1.3, 2, 1),
  ],
  AETHER: [
    T('play', 'shield', 'chooseAlly', 1.3, 1, 3, { fixed: 1 }), T('play', 'heal', 'ownHero', 0.45, 8, 3), T('play', 'shield', 'allAllies', 2.8, 1, 1, { fixed: 1 }),
    T('play', 'buff', 'chooseAlly', 0.9, 3, 3, { buffSplit: true }), T('dawn', 'heal', 'ownHero', 0.7, 3, 2),
    T('play', 'summon', 'none', 1, 2, 2, { summon: true }), T('play', 'damage', 'chooseEnemyUnit', 1.1, 4, 1),
  ],
  TITAN: [
    T('play', 'armor', 'chooseAlly', 1.8, 2, 3), T('play', 'armor', 'allAllies', 3.0, 1, 2), T('play', 'buff', 'chooseAlly', 0.9, 4, 3, { buffSplit: true }),
    T('dawn', 'buff', 'self', 1.4, 2, 2, { buffSplit: true, creatureOnly: true }), T('play', 'summon', 'none', 1, 2, 2, { summon: true }),
    T('play', 'damage', 'allEnemies', 2.3, 2, 1), T('death', 'armor', 'allAllies', 2.4, 1, 1, { creatureOnly: true }),
  ],
  COSMOS: [
    T('play', 'mana', 'none', 2.2, 1, 3, { fixed: 1 }), T('play', 'draw', 'none', 1.6, 3, 3), T('play', 'damage', 'allEnemies', 2.3, 4, 2),
    T('play', 'summon', 'none', 1, 3, 3, { summon: true }), T('dawn', 'draw', 'none', 2.4, 1, 1),
    T('play', 'damage', 'chooseEnemy', 1.2, 6, 2), T('play', 'buff', 'allAllies', 1.9, 2, 1, { buffSplit: true }),
  ],
};

const FACTION_KW: Record<FactionId, [Keyword, number][]> = {
  EMBER: [['surge', 4], ['frenzy', 2], ['siphon', 1], ['blight', 0.3]],
  VERDANT: [['bulwark', 3], ['rekindle', 3], ['siphon', 1]],
  ABYSS: [['veil', 3], ['siphon', 2], ['bulwark', 1]],
  VOLT: [['volley', 4], ['surge', 3], ['frenzy', 2]],
  VOID: [['blight', 3], ['veil', 2], ['siphon', 2], ['rekindle', 1]],
  AETHER: [['aegis', 4], ['bulwark', 1], ['siphon', 2]],
  TITAN: [['bulwark', 5], ['aegis', 1], ['rekindle', 1]],
  COSMOS: [['veil', 1], ['aegis', 2], ['volley', 2], ['surge', 1]],
};

const KW_VALUE: Record<Keyword, number> = {
  bulwark: 0.8, surge: 1.4, siphon: 1.3, volley: 1.5, veil: 1.0, blight: 2.0, frenzy: 0, aegis: 1.5, rekindle: 2.0,
};

// ---------- type / cost distributions ----------

function pickType(rng: Rng, rarity: Rarity): CardType {
  const t = RARITIES[rarity].tier;
  if (t <= 1) return rng.weighted([['creature', 60], ['action', 25], ['equipment', 10], ['terrain', 5]] as const);
  if (t <= 3) return rng.weighted([['creature', 55], ['action', 21], ['equipment', 13], ['terrain', 11]] as const);
  if (t === 4) return rng.weighted([['champion', 50], ['creature', 30], ['action', 10], ['terrain', 10]] as const);
  if (t === 5) return rng.weighted([['champion', 40], ['relic', 30], ['creature', 30]] as const);
  return rng.weighted([['champion', 60], ['relic', 40]] as const);
}

function pickCost(rng: Rng, rarity: Rarity, type: CardType): number {
  const t = RARITIES[rarity].tier;
  const ranges: [number, number][] = [[1, 5], [1, 6], [2, 7], [2, 8], [4, 9], [5, 9], [5, 10], [6, 10], [6, 10], [7, 10]];
  let [lo, hi] = ranges[t];
  if (type === 'terrain') { lo = Math.max(1, lo - 1); hi = Math.min(hi, 5); }
  if (type === 'equipment') { hi = Math.min(hi, 6); }
  if (type === 'relic') { lo = Math.max(lo, 3); hi = Math.min(hi, 8); }
  // triangular distribution towards the middle-low
  const a = rng.int(lo, hi), b = rng.int(lo, hi);
  return Math.round((a + b) / 2);
}

function rarityCounts(size: number): Record<Rarity, number> {
  const frac: [Rarity, number][] = [['UNCOMMON', 0.23], ['RARE', 0.167], ['EPIC', 0.107], ['LEGENDARY', 0.067], ['MYTHIC', 0.04], ['ANCIENT', 0.02], ['CELESTIAL', 0.0134], ['SECRET', 0.0134], ['PRISMATIC', 0.0067]];
  const counts = {} as Record<Rarity, number>;
  let used = 0;
  for (const [r, f] of frac) { counts[r] = Math.max(1, Math.round(size * f)); used += counts[r]; }
  counts.COMMON = size - used;
  return counts;
}

function finishesFor(rarity: Rarity, type: CardType): Finish[] {
  const t = RARITIES[rarity].tier;
  const f: Finish[] = ['NORMAL', 'FOIL', 'HOLOGRAPHIC'];
  if (t >= 2) f.push('GOLD', 'SECRET');
  if (t >= 3) f.push('COSMIC', 'PRISM');
  if (type === 'champion' || t >= 4) f.push('SIGNATURE');
  return f;
}

// ---------- generator ----------

class NameRegistry {
  used = new Set<string>();
  take(rng: Rng, gen: () => string, fallback: () => string): string {
    for (let i = 0; i < 40; i++) {
      const n = gen();
      if (!this.used.has(n)) { this.used.add(n); return n; }
    }
    let n = fallback();
    let k = 2;
    while (this.used.has(n)) n = `${fallback()} ${['II', 'III', 'IV', 'V', 'VI'][k++ % 5]}`;
    this.used.add(n);
    void rng;
    return n;
  }
}

function amountFor(tm: Tmpl, budget: number, rng: Rng, faction?: FactionId): number {
  if (tm.fixed) return tm.fixed;
  let unit = tm.unit;
  if (tm.summon && faction) { const t = TOKEN_SPECS[faction]; unit = (t.atk + t.hp) * 0.85 * tm.unit; }
  const raw = budget / unit;
  return Math.max(1, Math.min(tm.max, Math.round(raw * (0.8 + rng.next() * 0.4))));
}

function buildEffect(tm: Tmpl, amount: number, faction: FactionId, rng: Rng): { e: Effect; value: number } {
  const e: Effect = { trigger: tm.trigger, action: tm.action, target: tm.target };
  let value = amount * tm.unit;
  if (tm.summon) {
    const count = Math.max(1, Math.min(tm.max, amount));
    e.token = `TOK-${faction}`;
    e.count = count;
    const tok = TOKEN_SPECS[faction];
    value = count * (tok.atk + tok.hp) * 0.85 * tm.unit;
  } else if (tm.buffSplit) {
    const atk = Math.max(0, Math.round(amount * (0.3 + rng.next() * 0.4)));
    const hp = Math.max(1, amount - atk);
    e.amount = Math.max(atk, 0);
    e.amount2 = hp;
    if (e.amount === 0 && rng.chance(0.5)) { e.amount = 1; e.amount2 = Math.max(1, hp - 1); }
    value = ((e.amount ?? 0) + (e.amount2 ?? 0)) * tm.unit;
  } else {
    e.amount = amount;
    if (tm.kw) e.keyword = tm.kw;
  }
  if (tm.action === 'freeze' || tm.action === 'destroy' || tm.action === 'shield' || tm.action === 'bounce' || tm.action === 'grant') value = tm.unit;
  return { e, value };
}

interface GenCtx { rng: Rng; names: NameRegistry; set: SetDef }

function champName(ctx: GenCtx, f: FactionId): string {
  const [a, b] = SYL[f];
  return ctx.names.take(ctx.rng, () => `${ctx.rng.pick(a)}${ctx.rng.pick(b)}, ${ctx.rng.pick(CHAMPION_TITLES[f])}`,
    () => `${ctx.rng.pick(a)}${ctx.rng.pick(b)}${ctx.rng.pick(b)}, ${ctx.rng.pick(CHAMPION_TITLES[f])}`);
}

function genCard(ctx: GenCtx, num: number, rarity: Rarity, faction: FactionId, forcedType?: CardType): CardDef {
  const { rng, names, set } = ctx;
  const type = forcedType ?? pickType(rng, rarity);
  const tier = RARITIES[rarity].tier;
  const cost = pickCost(rng, rarity, type);
  const fdef = FACTIONS[faction];
  const archetype = type === 'champion' ? rng.pick(['knight', 'mage', ...fdef.archetypes]) : rng.pick(fdef.archetypes);
  const id = `${set.code}-${String(num).padStart(3, '0')}`;
  const tmpls = FACTION_TMPL[faction];
  const rarityBonus = tier * 0.55 + (set.index - 1) * 0.15;

  let name = '';
  let attack = 0, hp = 0, defense = 0;
  const keywords: Keyword[] = [];
  const effects: Effect[] = [];
  let aura: CardDef['aura'];
  let equip: CardDef['equip'];
  let model: string | undefined;

  const pickTmpl = (filter: (t: Tmpl) => boolean) => {
    let pool = tmpls.filter(filter);
    if (!pool.length) pool = tmpls.filter((t) => t.trigger === 'play' && !t.creatureOnly);
    return rng.weighted(pool.map((t) => [t, t.w] as const));
  };

  if (type === 'creature' || type === 'champion') {
    name = type === 'champion'
      ? champName(ctx, faction)
      : names.take(rng, () => `${rng.pick(ADJ[faction])} ${rng.pick(ARCH_NOUNS[archetype])}`,
        () => `${rng.pick(ADJ[faction])} ${rng.pick(ADJ[faction])} ${rng.pick(ARCH_NOUNS[archetype])}`);
    let budget = cost * 2.15 + 1.6 + rarityBonus + (type === 'champion' ? 2.5 : 0);
    // keywords
    const kwCount = type === 'champion' ? rng.int(1, 2) : tier >= 2 ? (rng.chance(0.6) ? 1 : 0) + (tier >= 4 && rng.chance(0.4) ? 1 : 0) : rng.chance(0.35) ? 1 : 0;
    for (let i = 0; i < kwCount; i++) {
      const kw = rng.weighted(FACTION_KW[faction]);
      if (!keywords.includes(kw)) { keywords.push(kw); budget -= KW_VALUE[kw]; }
    }
    // effects
    const effCount = type === 'champion' ? 2 : tier >= 3 ? rng.int(1, 2) : rng.chance(0.55) ? 1 : 0;
    for (let i = 0; i < effCount && budget > 3; i++) {
      const tm = pickTmpl((t) => !effects.some((e) => e.trigger === t.trigger && e.action === t.action));
      const share = budget * (0.3 + rng.next() * 0.15);
      const amt = amountFor(tm, share, rng, faction);
      const { e, value } = buildEffect(tm, amt, faction, rng);
      effects.push(e);
      budget -= value;
    }
    if (type === 'champion' && rng.chance(0.5)) {
      aura = { atk: 1, hp: rng.chance(0.5) ? 1 : 0, def: 0, faction };
      budget -= 2.5;
    }
    budget = Math.max(budget, cost * 0.75 + 1.2);
    // defense (worth 2 points each, never on very cheap cards)
    const defChance = faction === 'TITAN' ? 0.65 : faction === 'AETHER' || faction === 'VERDANT' ? 0.2 : 0.1;
    if (cost >= 2 && rng.chance(defChance)) { defense = cost >= 6 && rng.chance(0.4) ? 2 : 1; budget -= defense * 2; }
    const atkBias = ({ EMBER: 0.6, VOLT: 0.56, VOID: 0.55, COSMOS: 0.5, ABYSS: 0.45, AETHER: 0.44, VERDANT: 0.42, TITAN: 0.38 } as Record<FactionId, number>)[faction];
    const total = Math.max(2, Math.round(budget));
    attack = Math.max(0, Math.round(total * (atkBias + (rng.next() - 0.5) * 0.2)));
    hp = Math.max(1, total - attack);
    if (keywords.includes('frenzy')) { attack = Math.max(1, Math.round(attack * 0.6)); hp += 1; }
    if (cost <= 1 && attack + hp > 4) { hp = Math.min(hp, 3); attack = Math.min(attack, 2); }
    if (tier >= 2 || type === 'champion' || rng.chance(0.15)) model = archetype;
  } else if (type === 'action') {
    name = names.take(rng, () => `${rng.pick(ADJ[faction])} ${rng.pick(ACTION_NOUNS)}`, () => `${rng.pick(ADJ[faction])} ${rng.pick(ADJ[faction])} ${rng.pick(ACTION_NOUNS)}`);
    let budget = cost * 2.3 + 1.4 + rarityBonus;
    const effCount = tier >= 3 ? 2 : rng.chance(0.35) ? 2 : 1;
    for (let i = 0; i < effCount && budget > 0.8; i++) {
      const tm = pickTmpl((t) => t.trigger === 'play' && !t.creatureOnly && t.target !== 'self' && !effects.some((e) => e.action === t.action));
      const share = i === effCount - 1 ? budget : budget * 0.6;
      const amt = amountFor(tm, share, rng, faction);
      const { e, value } = buildEffect(tm, amt, faction, rng);
      effects.push(e);
      budget -= value;
    }
  } else if (type === 'equipment') {
    name = names.take(rng, () => `${rng.pick(ADJ[faction])} ${rng.pick(EQUIP_NOUNS)}`, () => `${rng.pick(ADJ[faction])} ${rng.pick(ADJ[faction])} ${rng.pick(EQUIP_NOUNS)}`);
    let budget = cost * 2 + 1 + rarityBonus;
    let kw: Keyword | undefined;
    if (rng.chance(0.45)) { kw = rng.weighted(FACTION_KW[faction]); budget -= Math.max(1, KW_VALUE[kw]); }
    let def = 0;
    if ((faction === 'TITAN' || faction === 'AETHER') && rng.chance(0.6)) { def = 1; budget -= 2; }
    const total = Math.max(1, Math.round(budget));
    const atk = Math.max(0, Math.round(total * (0.4 + rng.next() * 0.3)));
    equip = { atk, hp: Math.max(0, total - atk), def, keyword: kw === 'frenzy' ? 'surge' : kw };
  } else if (type === 'terrain') {
    name = names.take(rng, () => `${rng.pick(TERRAIN_PREFIX)}${rng.pick(TERRAIN_PLACES[faction])}`.trim(), () => `${rng.pick(ADJ[faction])} ${rng.pick(TERRAIN_PLACES[faction])}`);
    const strength = Math.max(1, Math.floor((cost + tier) / 3));
    aura = rng.chance(0.5)
      ? { atk: strength, hp: 0, def: 0, faction }
      : rng.chance(0.5) ? { atk: 0, hp: strength, def: 0, faction } : { atk: 0, hp: 0, def: 1, faction };
    if (rng.chance(0.5 + tier * 0.1)) {
      const tm = pickTmpl((t) => t.trigger === 'dawn' && !t.creatureOnly);
      if (tm) {
        const { e } = buildEffect(tm, tm.fixed ?? Math.max(1, Math.min(tm.max, Math.round(cost / 2))), faction, rng);
        effects.push(e);
      }
    }
  } else if (type === 'relic') {
    name = names.take(rng, () => `${rng.pick(RELIC_OBJECTS)} of the ${rng.pick(TERRAIN_PLACES[faction])}`, () => `${rng.pick(ADJ[faction])} ${rng.pick(RELIC_OBJECTS)}`);
    aura = { atk: 1 + (tier >= 7 ? 1 : 0), hp: 1 + (tier >= 6 ? 1 : 0), def: 0 };
    const playTm = pickTmpl((t) => t.trigger === 'play' && !t.creatureOnly && t.target !== 'self');
    effects.push(buildEffect(playTm, amountFor(playTm, cost * 1.4 + tier, rng, faction), faction, rng).e);
    const dawnPool = tmpls.filter((t) => t.trigger === 'dawn' && !t.creatureOnly);
    const dawnTm = dawnPool.length ? rng.pick(dawnPool) : T('dawn', 'heal', 'ownHero', 0.7, 3, 1);
    effects.push(buildEffect(dawnTm, dawnTm.fixed ?? Math.min(dawnTm.max, 1 + Math.floor(tier / 3)), faction, rng).e);
  }

  const card: CardDef = {
    id, set: set.code, num, name, type, faction, rarity, cost, attack, defense, hp, keywords, effects, aura, equip,
    text: '', flavor: rng.pick(FLAVOR[faction]), level: Math.min(5, 1 + Math.floor(tier / 2)), anim: animFor(faction), model,
    finishes: finishesFor(rarity, type),
    art: { seed: rng.int(1, 2 ** 30), archetype: type === 'creature' || type === 'champion' ? archetype : type, hue: fdef.hue + rng.int(-14, 14), hue2: fdef.hue2 + rng.int(-20, 20) },
  };
  if (type === 'champion' || tier >= 4) card.signature = name.split(',')[0].split(' ')[0];
  return card;
}

export function buildText(c: CardDef, tokenName: (id: string) => string): string {
  const lines: string[] = [];
  if (c.keywords.length) lines.push(c.keywords.map((k) => KEYWORDS[k].name).join(', '));
  if (c.equip) {
    const parts = [`+${c.equip.atk}/+${c.equip.hp}`];
    if (c.equip.def) parts.push(`+${c.equip.def} Defense`);
    if (c.equip.keyword) parts.push(KEYWORDS[c.equip.keyword].name);
    lines.push(`Attach to an ally: ${parts.join(', ')}.`);
  }
  if (c.aura) lines.push(auraText(c.aura));
  for (const e of c.effects) lines.push(effectText(e, tokenName));
  return lines.join('\n');
}

// Event cards: themed rarity spread for limited-time events.
const EVENT_THEMES: { faction: FactionId; event: string }[] = [
  { faction: 'COSMOS', event: 'cosmic_week' },
  { faction: 'EMBER', event: 'ember_festival' },
  { faction: 'ABYSS', event: 'frozen_realm' },
  { faction: 'VOID', event: 'void_event' },
];
const EVENT_RARITIES: Rarity[] = ['COMMON', 'COMMON', 'UNCOMMON', 'RARE', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

export const EVENT_CARD_MAP: Record<string, string[]> = {};

let CACHE: CardDef[] | null = null;

export function generateDatabase(): CardDef[] {
  if (CACHE) return CACHE;
  const names = new NameRegistry();
  const all: CardDef[] = makeTokens();
  for (const t of all) names.used.add(t.name);
  for (const set of SETS) {
    const rng = new Rng(`xalacards-${set.code}-v1`);
    const ctx: GenCtx = { rng, names, set };
    if (set.code === 'EVT') {
      let num = 1;
      for (const th of EVENT_THEMES) {
        EVENT_CARD_MAP[th.event] = [];
        for (const r of EVENT_RARITIES) {
          const c = genCard(ctx, num++, r, th.faction);
          EVENT_CARD_MAP[th.event].push(c.id);
          all.push(c);
        }
      }
      continue;
    }
    const counts = rarityCounts(set.size);
    const order: Rarity[] = [];
    for (const r of RARITY_ORDER) for (let i = 0; i < counts[r]; i++) order.push(r);
    order.forEach((r, i) => {
      const faction = FACTION_IDS[(i + set.index) % FACTION_IDS.length];
      all.push(genCard(ctx, i + 1, r, faction));
    });
  }
  const byId = new Map(all.map((c) => [c.id, c]));
  const tokenName = (id: string) => byId.get(id)?.name ?? 'token';
  for (const c of all) if (!c.token) c.text = buildText(c, tokenName);
  CACHE = all;
  return all;
}
