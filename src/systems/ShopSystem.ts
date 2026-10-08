import { Rng } from '../core/rng';
import { CHESTS, COSMETICS, PACKS, PASS_PREMIUM_PRICE, type ChestId, type PackId, type Reward } from '../data/content';
import type { Ctx } from './context';
import type { EconomySystem, Price } from './EconomySystem';
import type { InventorySystem } from './InventorySystem';
import { todayKey } from './state';

export type ShopSection = 'boosters' | 'gems' | 'cardbacks' | 'effects' | 'cosmetics' | 'bundles' | 'pass' | 'events' | 'chests' | 'deals';

export interface Offer {
  id: string; section: ShopSection; name: string; desc: string; price: Price; rewards: Reward[];
  oneTime?: boolean; discount?: number; icon: string; colors: [string, string]; badge?: string;
}

const BUNDLES: Offer[] = [
  { id: 'bundle_starter', section: 'bundles', name: 'Rookie Bundle', desc: '5 Basic Packs, 1 Elite Pack and the Caldera Sigil card back. One per account.',
    price: { gems: 450 }, rewards: [{ kind: 'pack', id: 'BASIC', amount: 5 }, { kind: 'pack', id: 'ELITE', amount: 1 }, { kind: 'cosmetic', id: 'cb_ember' }], oneTime: true, icon: '🎒', colors: ['#ff8a00', '#ff2e8a'], badge: 'BEST VALUE' },
  { id: 'bundle_collector', section: 'bundles', name: 'Collector Crate', desc: '10 Basic Packs, 2 Elite Packs and 500 Shards.',
    price: { coins: 6000 }, rewards: [{ kind: 'pack', id: 'BASIC', amount: 10 }, { kind: 'pack', id: 'ELITE', amount: 2 }, { kind: 'shards', amount: 500 }], icon: '📦', colors: ['#3a7bff', '#79e0ff'] },
  { id: 'bundle_cosmic', section: 'bundles', name: 'Starfall Bundle', desc: '2 Cosmic Packs + Crystal Chest.',
    price: { gems: 700 }, rewards: [{ kind: 'pack', id: 'COSMIC', amount: 2 }, { kind: 'chest', id: 'CRYSTAL', amount: 1 }], icon: '🌠', colors: ['#2b2bff', '#ff4fd8'] },
];

export class ShopSystem {
  constructor(private ctx: Ctx, private economy: EconomySystem, private inventory: InventorySystem) {}

  packOffers(): Offer[] {
    const out: Offer[] = [];
    for (const p of Object.values(PACKS)) {
      if (!p.sellable || p.id === 'EVENT') continue;
      if (p.price.coins) out.push(this.packOffer(p.id, { coins: p.price.coins }));
      if (p.price.gems) out.push(this.packOffer(p.id, { gems: p.price.gems }));
    }
    return out;
  }
  private packOffer(id: PackId, price: Price, n = 1): Offer {
    const p = PACKS[id];
    return { id: `pack_${id}_${Object.keys(price)[0]}_${n}`, section: id === 'EVENT' ? 'events' : 'boosters', name: n > 1 ? `${n}× ${p.name}` : p.name, desc: p.desc, price, rewards: [{ kind: 'pack', id, amount: n }], icon: p.glyph, colors: p.colors };
  }
  eventOffers(): Offer[] { return [this.packOffer('EVENT', { tickets: 2 }), this.packOffer('EVENT', { gems: 160 })]; }
  chestOffers(): Offer[] {
    return (Object.values(CHESTS)).filter((c) => c.price).map((c) => ({ id: `chest_${c.id}`, section: 'chests' as const, name: c.name, desc: 'Open for coins, packs, gems and shards.', price: c.price as Price, rewards: [{ kind: 'chest', id: c.id as ChestId, amount: 1 }], icon: '🧰', colors: [c.color, c.color2] as [string, string] }));
  }
  cosmeticOffers(kind: 'cardbacks' | 'effects' | 'cosmetics'): Offer[] {
    const kinds = kind === 'cardbacks' ? ['cardback'] : kind === 'effects' ? ['victory', 'summon'] : ['avatar', 'frame', 'board', 'title'];
    return COSMETICS.filter((c) => kinds.includes(c.kind) && c.price).map((c) => ({
      id: `cos_${c.id}`, section: kind, name: c.name, desc: `${c.kind[0].toUpperCase()}${c.kind.slice(1)} cosmetic`, price: c.price as Price,
      rewards: [{ kind: 'cosmetic', id: c.id }], oneTime: true, icon: c.glyph, colors: c.colors,
    }));
  }
  bundles(): Offer[] { return BUNDLES; }
  passOffer(): Offer {
    return { id: 'pass_premium', section: 'pass', name: 'XALA Pass Premium', desc: 'Unlock the premium reward track for this season (earn gems by playing!).', price: { gems: PASS_PREMIUM_PRICE }, rewards: [], oneTime: true, icon: '🎟️', colors: ['#ffcf6b', '#b45cff'] };
  }

  /** Three discounted daily deals, identical for the whole day. */
  deals(now = new Date()): Offer[] {
    const day = todayKey(now);
    const s = this.ctx.data.shop;
    if (s.dealsDate !== day) { s.dealsDate = day; s.boughtDeals = []; }
    const rng = new Rng(`deals-${day}`);
    const pool: Offer[] = [
      this.packOffer('BASIC', { coins: 400 }, 3), this.packOffer('ELITE', { gems: 120 }), this.packOffer('ELITE', { coins: 1500 }),
      this.packOffer('COSMIC', { gems: 300 }), ...this.chestOffers(),
    ];
    return rng.shuffle(pool).slice(0, 3).map((o, i) => {
      const discount = [0.3, 0.4, 0.5][i];
      const mult = o.rewards[0].kind === 'pack' && (o.rewards[0] as any).amount > 1 ? (o.rewards[0] as any).amount : 1;
      const price = Object.fromEntries(Object.entries(o.price).map(([k, v]) => [k, Math.round((v! * mult * (1 - discount)) / 5) * 5])) as Price;
      return { ...o, id: `deal_${i}_${o.id}`, section: 'deals', price, discount, badge: `-${Math.round(discount * 100)}%`, oneTime: true };
    });
  }

  canClaimGift(now = new Date()) { return this.ctx.data.shop.freeGiftDate !== todayKey(now); }
  claimGift(now = new Date()): Reward[] | null {
    if (!this.canClaimGift(now)) return null;
    this.ctx.data.shop.freeGiftDate = todayKey(now);
    return this.economy.grant([{ kind: 'coins', amount: 75 }, { kind: 'gems', amount: 5 }]);
  }

  isSoldOut(o: Offer): boolean {
    if (o.section === 'deals') return this.ctx.data.shop.boughtDeals.includes(o.id);
    if (o.id === 'pass_premium') return this.ctx.data.pass.premium;
    if (o.rewards.length === 1 && o.rewards[0].kind === 'cosmetic') return this.inventory.ownsCosmetic(o.rewards[0].id);
    if (o.oneTime) return this.ctx.data.purchases.oneTime.includes(o.id);
    return false;
  }

  buy(o: Offer): { ok: boolean; error?: string; rewards?: Reward[] } {
    if (this.isSoldOut(o)) return { ok: false, error: 'Already owned' };
    if (!this.economy.canAfford(o.price)) return { ok: false, error: 'Not enough currency' };
    if (!this.economy.spend(o.price)) return { ok: false, error: 'Payment failed' };
    if (o.section === 'deals') this.ctx.data.shop.boughtDeals.push(o.id);
    else if (o.oneTime) this.ctx.data.purchases.oneTime.push(o.id);
    if (o.id === 'pass_premium') { this.ctx.data.pass.premium = true; this.ctx.changed(); return { ok: true, rewards: [] }; }
    return { ok: true, rewards: this.economy.grant(o.rewards) };
  }
}
