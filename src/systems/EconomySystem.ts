import { Rng } from '../core/rng';
import type { Finish } from '../core/types';
import type { Reward } from '../data/content';
import { CHESTS, type ChestId } from '../data/content';
import type { CollectionSystem } from './CollectionSystem';
import type { Ctx } from './context';
import type { InventorySystem } from './InventorySystem';

export type Currency = 'coins' | 'gems' | 'tickets' | 'shards';
export type Price = Partial<Record<Currency, number>>;

export const CURRENCY_ICON: Record<Currency, string> = { coins: '🪙', gems: '💎', tickets: '🎟️', shards: '🔹' };
export const CURRENCY_NAME: Record<Currency, string> = { coins: 'Coins', gems: 'Gems', tickets: 'Tickets', shards: 'Shards' };

export interface ProgressionHook { addXp(amount: number): void }

export class EconomySystem {
  progression?: ProgressionHook;
  constructor(private ctx: Ctx, private inventory: InventorySystem, private collection: CollectionSystem) {}

  get balances() { return this.ctx.data.currencies; }

  canAfford(price: Price): boolean {
    return (Object.entries(price) as [Currency, number][]).every(([k, v]) => (this.balances[k] ?? 0) >= v);
  }

  /** Atomically spends a price (all currencies or nothing). */
  spend(price: Price): boolean {
    if (!this.canAfford(price)) return false;
    for (const [k, v] of Object.entries(price) as [Currency, number][]) {
      this.balances[k] -= v;
      this.ctx.bus.emit({ type: 'currencySpent', currency: k, amount: v });
    }
    this.ctx.bus.emit({ type: 'currencyChanged' });
    this.ctx.changed();
    return true;
  }

  add(cur: Currency, amount: number) {
    this.balances[cur] = Math.max(0, (this.balances[cur] ?? 0) + Math.floor(amount));
    this.ctx.bus.emit({ type: 'currencyChanged' });
    this.ctx.changed();
  }

  /** Grants a list of rewards; returns them for display. */
  grant(rewards: Reward[]): Reward[] {
    const out: Reward[] = [];
    for (const r of rewards) {
      switch (r.kind) {
        case 'coins': case 'gems': case 'tickets': case 'shards': this.add(r.kind, r.amount); out.push(r); break;
        case 'pack': this.inventory.addPack(r.id, r.amount); out.push(r); break;
        case 'chest': this.inventory.addChest(r.id, r.amount); out.push(r); break;
        case 'cosmetic':
          if (this.inventory.addCosmetic(r.id)) out.push(r);
          else { this.add('coins', 250); out.push({ kind: 'coins', amount: 250 }); } // duplicate cosmetic compensation
          break;
        case 'card': {
          const c = this.ctx.cards.get(r.id);
          this.collection.add(c, (r.finish ?? 'NORMAL') as Finish);
          out.push(r);
          break;
        }
        case 'xp': this.progression?.addXp(r.amount); out.push(r); break;
      }
    }
    this.ctx.changed();
    return out;
  }

  /** Rolls a chest's loot table (seeded so it can be audited). */
  rollChest(id: ChestId, seed = Date.now()): Reward[] {
    const rng = new Rng(seed);
    const def = CHESTS[id];
    const out: Reward[] = [];
    for (const l of def.loot) {
      if (rng.chance(l.chance)) {
        const r = { ...l.reward } as Reward;
        if ('amount' in r && (r.kind === 'coins' || r.kind === 'gems' || r.kind === 'shards')) (r as any).amount = Math.round(r.amount * (0.85 + rng.next() * 0.4));
        out.push(r);
      }
    }
    return out;
  }

  openChest(id: ChestId, seed?: number): Reward[] | null {
    if (!this.inventory.takeChest(id)) return null;
    const loot = this.rollChest(id, seed);
    this.grant(loot);
    this.ctx.stat('chestsOpened');
    this.ctx.bus.emit({ type: 'chestOpened', chestId: id });
    return loot;
  }
}
