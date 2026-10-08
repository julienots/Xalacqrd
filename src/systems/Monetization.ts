// In-app purchase architecture.
//
// Real-money purchases must go through a store provider (Google Play Billing on
// Android). This build ships WITHOUT a configured billing provider: no fake
// purchase is ever granted and no real payment can happen during testing.
// When a provider is plugged in, every transaction is verified (server-side
// validation hook), granted exactly once (idempotent by transaction id), and
// can be restored.

import type { Reward } from '../data/content';
import type { Ctx } from './context';
import type { EconomySystem } from './EconomySystem';

export interface IapProduct { sku: string; name: string; gems: number; bonus: number; displayPrice?: string }

export const IAP_PRODUCTS: IapProduct[] = [
  { sku: 'gems_pouch', name: 'Pouch of Gems', gems: 100, bonus: 0 },
  { sku: 'gems_sack', name: 'Sack of Gems', gems: 550, bonus: 50 },
  { sku: 'gems_chest', name: 'Chest of Gems', gems: 1200, bonus: 200 },
  { sku: 'gems_vault', name: 'Vault of Gems', gems: 2500, bonus: 600 },
];

export interface Transaction { id: string; sku: string; receipt: string; purchaseTime: number }

export interface StoreProvider {
  readonly name: string;
  available(): Promise<boolean>;
  products(skus: string[]): Promise<IapProduct[]>;
  purchase(sku: string): Promise<Transaction>;
  restore(): Promise<Transaction[]>;
  finish(tx: Transaction): Promise<void>;
}

export interface ReceiptValidator { validate(tx: Transaction): Promise<boolean> }

/** Default provider: no store configured. Every call fails safely. */
export class UnavailableStore implements StoreProvider {
  readonly name = 'none';
  async available() { return false; }
  async products() { return []; }
  async purchase(): Promise<Transaction> { throw new Error('In-app purchases are not available in this build.'); }
  async restore() { return []; }
  async finish() { /* noop */ }
}

/** Rejects everything until a real server-side validator is configured. */
export class StrictValidator implements ReceiptValidator {
  async validate() { return false; }
}

export class Monetization {
  store: StoreProvider = new UnavailableStore();
  validator: ReceiptValidator = new StrictValidator();
  constructor(private ctx: Ctx, private economy: EconomySystem) {}

  async isAvailable() { try { return await this.store.available(); } catch { return false; } }

  /** Grants a verified transaction exactly once. Returns null if invalid or already processed. */
  async deliver(tx: Transaction): Promise<Reward[] | null> {
    const processed = this.ctx.data.purchases.processed;
    if (processed.includes(tx.id)) { await this.store.finish(tx); return null; } // prevents double rewards
    const product = IAP_PRODUCTS.find((p) => p.sku === tx.sku);
    if (!product) return null;
    const valid = await this.validator.validate(tx).catch(() => false);
    if (!valid) return null;
    processed.push(tx.id);
    const rewards = this.economy.grant([{ kind: 'gems', amount: product.gems + product.bonus }]);
    this.ctx.changed();
    await this.store.finish(tx);
    return rewards;
  }

  async buy(sku: string): Promise<{ ok: boolean; error?: string; rewards?: Reward[] }> {
    if (!(await this.isAvailable())) return { ok: false, error: 'The store is not available in this build. Gems can be earned through missions, achievements and the XALA Pass.' };
    try {
      const tx = await this.store.purchase(sku);
      const rewards = await this.deliver(tx);
      return rewards ? { ok: true, rewards } : { ok: false, error: 'Purchase could not be verified.' };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Purchase cancelled' };
    }
  }

  async restore(): Promise<number> {
    if (!(await this.isAvailable())) return 0;
    let n = 0;
    for (const tx of await this.store.restore()) if (await this.deliver(tx)) n++;
    return n;
  }
}
