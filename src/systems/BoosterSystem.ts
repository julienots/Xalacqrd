import { Rng } from '../core/rng';
import type { CardDef, Finish, Rarity } from '../core/types';
import { FINISH_WEIGHTS, PACKS, PITY_THRESHOLD, type PackId } from '../data/content';
import { FINISHES, RARITIES } from '../data/rarities';
import { SETS } from '../data/sets';
import type { CollectionSystem, AddResult } from './CollectionSystem';
import type { Ctx } from './context';
import type { InventorySystem } from './InventorySystem';

export interface PulledCard extends AddResult { card: CardDef; rarity: Rarity }

export interface PackResult { packId: PackId; set: string; seed: number; cards: PulledCard[]; pityTriggered: boolean }

export class BoosterSystem {
  constructor(private ctx: Ctx, private inventory: InventorySystem, private collection: CollectionSystem) {}

  /** Pool of cards for a pack, by set. Event packs use the current event pool + all sets. */
  pool(setCode: string): CardDef[] {
    if (setCode === 'ALL') return this.ctx.cards.collectible.filter((c) => c.set !== 'EVT');
    return this.ctx.cards.bySet(setCode);
  }

  rollFinish(rng: Rng, card: CardDef, boost: number, min?: Finish): Finish {
    const minTier = min ? FINISHES[min].tier : 0;
    const entries = FINISH_WEIGHTS
      .filter(([f]) => card.finishes.includes(f) && FINISHES[f].tier >= minTier)
      .map(([f, w]) => [f, f === 'NORMAL' ? w : w * boost] as const);
    if (!entries.length) return card.finishes[card.finishes.length - 1];
    return rng.weighted(entries);
  }

  private pickCard(rng: Rng, pool: CardDef[], rarity: Rarity): CardDef {
    let candidates = pool.filter((c) => c.rarity === rarity);
    // fall back to the nearest lower rarity if a set lacks one
    let t = RARITIES[rarity].tier;
    while (!candidates.length && t > 0) {
      t--;
      candidates = pool.filter((c) => RARITIES[c.rarity].tier === t);
    }
    return rng.pick(candidates.length ? candidates : pool);
  }

  /** Pure roll without side effects (used by tests and odds display). */
  roll(packId: PackId, setCode: string, seed: number, pity = 0, eventPool: CardDef[] = []): { cards: { card: CardDef; finish: Finish }[]; pityTriggered: boolean } {
    const def = PACKS[packId];
    const rng = new Rng(seed);
    const pool = this.pool(setCode);
    const out: { card: CardDef; finish: Finish }[] = [];
    let pityTriggered = false;
    const pityDue = pity + 1 >= PITY_THRESHOLD;
    def.slots.forEach((slot, si) => {
      for (let i = 0; i < slot.count; i++) {
        let rarity = rng.weighted(slot.rarities);
        const isLastSlot = si === def.slots.length - 1 && i === slot.count - 1;
        if (isLastSlot && pityDue && RARITIES[rarity].tier < 4 && !out.some((o) => RARITIES[o.card.rarity].tier >= 4)) {
          rarity = 'LEGENDARY';
          pityTriggered = true;
        }
        let card = this.pickCard(rng, pool, rarity);
        if (packId === 'EVENT' && isLastSlot && eventPool.length) card = rng.pick(eventPool);
        out.push({ card, finish: this.rollFinish(rng, card, def.finishBoost, def.minFinish) });
      }
    });
    // reveal order: worst first, best last (by rarity tier then finish)
    out.sort((a, b) => RARITIES[a.card.rarity].tier - RARITIES[b.card.rarity].tier || FINISHES[a.finish].tier - FINISHES[b.finish].tier);
    return { cards: out, pityTriggered };
  }

  /** Opens a pack from the inventory, adds cards to the collection and returns the result. */
  open(packId: PackId, setCode = 'ORI', eventPool: CardDef[] = [], seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0): PackResult | null {
    if (!this.inventory.takePack(packId)) return null;
    if (packId === 'STARTER') setCode = 'ORI';
    if (!SETS.some((s) => s.code === setCode) && setCode !== 'ALL') setCode = 'ORI';
    const d = this.ctx.data;
    const { cards, pityTriggered } = this.roll(packId, setCode, seed, d.pity, eventPool);
    const pulled: PulledCard[] = cards.map(({ card, finish }) => ({ ...this.collection.add(card, finish), card, rarity: card.rarity }));
    const best = Math.max(...pulled.map((p) => RARITIES[p.rarity].tier));
    d.pity = best >= 4 ? 0 : d.pity + 1;
    this.ctx.stat('packsOpened');
    this.ctx.stat('cardsOpened', pulled.length);
    for (const p of pulled) {
      const t = RARITIES[p.rarity].tier;
      if (t >= 4) this.ctx.stat('legendaries');
      if (t >= 5) this.ctx.stat('mythics');
      if (p.rarity === 'SECRET') this.ctx.stat('secrets');
      if (p.rarity === 'PRISMATIC') this.ctx.stat('prismatics');
      if (FINISHES[p.finish].tier >= 2) this.ctx.stat('specialFinishes');
    }
    if (packId === 'EVENT') this.ctx.stat('eventPacks');
    d.tutorial.firstPack = true;
    this.ctx.bus.emit({ type: 'packOpened', packId, cards: pulled.map((p) => ({ id: p.id, rarity: p.rarity, finish: p.finish })) });
    this.ctx.changed();
    return { packId, set: setCode, seed, cards: pulled, pityTriggered };
  }

  /** Displayed odds for the rare slot (transparency). */
  odds(packId: PackId): { rarity: Rarity; pct: number }[] {
    const def = PACKS[packId];
    const slot = def.slots[def.slots.length - 1];
    const total = slot.rarities.reduce((a, [, w]) => a + w, 0);
    return slot.rarities.map(([r, w]) => ({ rarity: r, pct: (w / total) * 100 }));
  }
}
