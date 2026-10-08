import type { CardDef, CardType, FactionId, Rarity } from '../core/types';
import { generateDatabase, EVENT_CARD_MAP } from '../data/cardGen';
import { RARITIES } from '../data/rarities';

export interface CardFilter {
  text?: string;
  rarity?: Rarity[];
  type?: CardType[];
  faction?: FactionId[];
  set?: string[];
  costMin?: number; costMax?: number;
  atkMin?: number; atkMax?: number;
  defMin?: number; defMax?: number;
  owned?: 'all' | 'owned' | 'missing';
}

export type SortKey = 'number' | 'name' | 'cost' | 'rarity' | 'attack' | 'hp';

export const isUnit = (c: CardDef) => c.type === 'creature' || c.type === 'champion';

export class CardSystem {
  readonly all: CardDef[];
  readonly collectible: CardDef[];
  private byId: Map<string, CardDef>;

  constructor() {
    this.all = generateDatabase();
    this.collectible = this.all.filter((c) => !c.token);
    this.byId = new Map(this.all.map((c) => [c.id, c]));
  }

  get(id: string): CardDef {
    const c = this.byId.get(id);
    if (!c) throw new Error(`Unknown card ${id}`);
    return c;
  }
  has(id: string): boolean { return this.byId.has(id); }
  bySet(code: string): CardDef[] { return this.collectible.filter((c) => c.set === code); }
  eventCards(eventId: string): CardDef[] { return (EVENT_CARD_MAP[eventId] ?? []).map((id) => this.get(id)); }

  filter(cards: CardDef[], f: CardFilter, owned?: (id: string) => boolean): CardDef[] {
    const q = f.text?.trim().toLowerCase();
    return cards.filter((c) => {
      if (q && !(c.name.toLowerCase().includes(q) || c.text.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))) return false;
      if (f.rarity?.length && !f.rarity.includes(c.rarity)) return false;
      if (f.type?.length && !f.type.includes(c.type)) return false;
      if (f.faction?.length && !f.faction.includes(c.faction)) return false;
      if (f.set?.length && !f.set.includes(c.set)) return false;
      if (f.costMin != null && c.cost < f.costMin) return false;
      if (f.costMax != null && c.cost > f.costMax) return false;
      if (f.atkMin != null && c.attack < f.atkMin) return false;
      if (f.atkMax != null && c.attack > f.atkMax) return false;
      if (f.defMin != null && c.defense < f.defMin) return false;
      if (f.defMax != null && c.defense > f.defMax) return false;
      if (owned && f.owned === 'owned' && !owned(c.id)) return false;
      if (owned && f.owned === 'missing' && owned(c.id)) return false;
      return true;
    });
  }

  sort(cards: CardDef[], key: SortKey, desc = false): CardDef[] {
    const setIdx = (c: CardDef) => ['ORI', 'VRS', 'CLF', 'LRL', 'EVT'].indexOf(c.set);
    const cmp: Record<SortKey, (a: CardDef, b: CardDef) => number> = {
      number: (a, b) => setIdx(a) - setIdx(b) || a.num - b.num,
      name: (a, b) => a.name.localeCompare(b.name),
      cost: (a, b) => a.cost - b.cost || a.name.localeCompare(b.name),
      rarity: (a, b) => RARITIES[a.rarity].tier - RARITIES[b.rarity].tier || a.cost - b.cost,
      attack: (a, b) => a.attack - b.attack,
      hp: (a, b) => a.hp - b.hp,
    };
    const out = [...cards].sort(cmp[key]);
    return desc ? out.reverse() : out;
  }
}
