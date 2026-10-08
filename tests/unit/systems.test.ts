import { Game } from '../../src/systems/Game';
import { MemoryAdapter } from '../../src/systems/SaveSystem';
import { RARITIES } from '../../src/data/rarities';
import { SETS } from '../../src/data/sets';
import { PACKS, PITY_THRESHOLD } from '../../src/data/content';
import type { Transaction, StoreProvider } from '../../src/systems/Monetization';

async function newGame(storage = new MemoryAdapter()) {
  const g = new Game(storage);
  await g.load();
  return { g, storage };
}

describe('Card database', () => {
  it('has hundreds of unique, valid cards across all sets', async () => {
    const { g } = await newGame();
    const cards = g.cards.collectible;
    expect(cards.length).toBeGreaterThan(700);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    expect(new Set(cards.map((c) => c.name)).size).toBe(cards.length);
    for (const s of SETS) expect(g.cards.bySet(s.code).length).toBe(s.size);
    for (const c of cards) {
      expect(c.cost).toBeGreaterThanOrEqual(0);
      expect(c.cost).toBeLessThanOrEqual(10);
      expect(c.text.length + c.flavor.length).toBeGreaterThan(0);
      if (c.type === 'creature' || c.type === 'champion') expect(c.hp).toBeGreaterThan(0);
      expect(c.finishes).toContain('NORMAL');
    }
    // every rarity and type is represented
    for (const r of Object.keys(RARITIES)) expect(cards.some((c) => c.rarity === r)).toBe(true);
    for (const t of ['creature', 'action', 'equipment', 'terrain', 'relic', 'champion']) expect(cards.some((c) => c.type === t)).toBe(true);
  });
  it('is deterministic', async () => {
    const a = (await newGame()).g.cards.get('VRS-042');
    const b = (await newGame()).g.cards.get('VRS-042');
    expect(a).toEqual(b);
  });
});

describe('New player', () => {
  it('starts with two valid decks and currencies', async () => {
    const { g } = await newGame();
    expect(g.data.decks.length).toBe(2);
    for (const d of g.data.decks) expect(g.decks.validate(d)).toEqual([]);
    expect(g.data.currencies.coins).toBeGreaterThan(0);
    expect(g.inventory.packs('STARTER')).toBe(2);
  });
});

describe('BoosterSystem', () => {
  it('opens packs with the right card count and guaranteed slot', async () => {
    const { g } = await newGame();
    g.inventory.addPack('BASIC', 50);
    for (let i = 0; i < 50; i++) {
      const res = g.boosters.open('BASIC', SETS[i % 4].code, [], 1000 + i)!;
      expect(res.cards.length).toBe(PACKS.BASIC.cards);
      expect(res.cards.some((c) => RARITIES[c.rarity].tier >= 2)).toBe(true);
      // best card revealed last
      const tiers = res.cards.map((c) => RARITIES[c.rarity].tier);
      expect(tiers[tiers.length - 1]).toBe(Math.max(...tiers));
    }
    expect(g.data.stats.packsOpened).toBe(50);
  });
  it('cannot open packs you do not own', async () => {
    const { g } = await newGame();
    expect(g.boosters.open('SECRET')).toBeNull();
  });
  it('pity timer guarantees a Legendary+', async () => {
    const { g } = await newGame();
    g.data.pity = PITY_THRESHOLD - 1;
    g.inventory.addPack('BASIC', 1);
    const res = g.boosters.open('BASIC', 'ORI', [], 42)!;
    expect(res.cards.some((c) => RARITIES[c.rarity].tier >= 4)).toBe(true);
    expect(g.data.pity).toBe(0);
  });
  it('rarity distribution roughly follows the odds over many packs', async () => {
    const { g } = await newGame();
    let rarePlus = 0, legendaryPlus = 0, foil = 0, total = 0;
    for (let i = 0; i < 3000; i++) {
      const r = g.boosters.roll('BASIC', 'ORI', i * 7919);
      for (const c of r.cards) {
        total++;
        if (RARITIES[c.card.rarity].tier >= 2) rarePlus++;
        if (RARITIES[c.card.rarity].tier >= 4) legendaryPlus++;
        if (c.finish !== 'NORMAL') foil++;
      }
    }
    expect(legendaryPlus / 3000).toBeGreaterThan(0.06);
    expect(legendaryPlus / 3000).toBeLessThan(0.2);
    expect(rarePlus / 3000).toBeGreaterThanOrEqual(1);
    expect(foil / total).toBeGreaterThan(0.1);
    expect(foil / total).toBeLessThan(0.35);
  });
  it('cosmic packs never contain NORMAL finishes', async () => {
    const { g } = await newGame();
    for (let i = 0; i < 200; i++) for (const c of g.boosters.roll('COSMIC', 'CLF', i).cards) expect(c.finish).not.toBe('NORMAL');
  });
});

describe('Economy & shop', () => {
  it('spends atomically and refuses unaffordable purchases', async () => {
    const { g } = await newGame();
    g.data.currencies.coins = 100;
    const offer = g.shop.packOffers().find((o) => o.price.coins === 400)!;
    expect(g.shop.buy(offer).ok).toBe(false);
    expect(g.data.currencies.coins).toBe(100);
    g.data.currencies.coins = 1000;
    const before = g.inventory.packs('BASIC');
    expect(g.shop.buy(offer).ok).toBe(true);
    expect(g.data.currencies.coins).toBe(600);
    expect(g.inventory.packs('BASIC')).toBe(before + 1);
  });
  it('one-time bundles and cosmetics cannot be bought twice', async () => {
    const { g } = await newGame();
    g.data.currencies.gems = 5000;
    const bundle = g.shop.bundles().find((b) => b.oneTime)!;
    expect(g.shop.buy(bundle).ok).toBe(true);
    expect(g.shop.buy(bundle).ok).toBe(false);
    const cos = g.shop.cosmeticOffers('cardbacks').find((o) => !g.shop.isSoldOut(o))!;
    expect(g.shop.buy(cos).ok).toBe(true);
    expect(g.shop.buy(cos).ok).toBe(false);
  });
  it('chests grant loot', async () => {
    const { g } = await newGame();
    const coins = g.data.currencies.coins;
    const loot = g.economy.openChest('WOODEN', 1)!;
    expect(loot.length).toBeGreaterThan(0);
    expect(g.data.currencies.coins).toBeGreaterThan(coins);
    expect(g.economy.openChest('WOODEN', 1)).toBeNull();
  });
});

describe('Monetization', () => {
  it('never grants anything without a store', async () => {
    const { g } = await newGame();
    const gems = g.data.currencies.gems;
    const r = await g.monetization.buy('gems_pouch');
    expect(r.ok).toBe(false);
    expect(g.data.currencies.gems).toBe(gems);
  });
  it('delivers a validated transaction exactly once', async () => {
    const { g } = await newGame();
    const tx: Transaction = { id: 'tx-1', sku: 'gems_pouch', receipt: 'r', purchaseTime: 1 };
    const store: StoreProvider = { name: 'test', available: async () => true, products: async () => [], purchase: async () => tx, restore: async () => [tx], finish: async () => {} };
    g.monetization.store = store;
    g.monetization.validator = { validate: async () => true };
    const gems = g.data.currencies.gems;
    expect((await g.monetization.buy('gems_pouch')).ok).toBe(true);
    expect(g.data.currencies.gems).toBe(gems + 100);
    expect(await g.monetization.restore()).toBe(0); // already processed
    expect(g.data.currencies.gems).toBe(gems + 100);
  });
  it('rejects invalid receipts', async () => {
    const { g } = await newGame();
    const tx: Transaction = { id: 'tx-2', sku: 'gems_vault', receipt: 'bad', purchaseTime: 1 };
    g.monetization.store = { name: 'test', available: async () => true, products: async () => [], purchase: async () => tx, restore: async () => [], finish: async () => {} };
    const gems = g.data.currencies.gems;
    expect((await g.monetization.buy('gems_vault')).ok).toBe(false);
    expect(g.data.currencies.gems).toBe(gems);
  });
});

describe('Quests, pass, achievements, ranked', () => {
  it('daily quests progress from stats and can only be claimed once', async () => {
    const { g } = await newGame();
    const q = g.quests.daily()[0];
    expect(q.done).toBe(false);
    g.stat(q.def.stat, q.def.goal);
    const v = g.quests.daily()[0];
    expect(v.done).toBe(true);
    expect(g.quests.claim('daily', q.def.id)).not.toBeNull();
    expect(g.quests.claim('daily', q.def.id)).toBeNull();
  });
  it('daily login only once per day', async () => {
    const { g } = await newGame();
    expect(g.quests.claimLogin()).not.toBeNull();
    expect(g.quests.claimLogin()).toBeNull();
  });
  it('pass tiers unlock with xp and premium requires gems', async () => {
    const { g } = await newGame();
    g.progression.addXp(5000);
    expect(g.progression.passTier()).toBeGreaterThanOrEqual(5);
    expect(g.progression.claimPass(1, false)).not.toBeNull();
    expect(g.progression.claimPass(1, false)).toBeNull();
    expect(g.progression.claimPass(1, true)).toBeNull();
    g.data.currencies.gems = 2000;
    expect(g.progression.unlockPremium()).toBe(true);
    expect(g.progression.claimPass(1, true)).not.toBeNull();
  });
  it('ranked climbs and achievements unlock', async () => {
    const { g } = await newGame();
    for (let i = 0; i < 12; i++) g.progression.rankedResult(true);
    expect(g.data.ranked.index).toBeGreaterThan(3);
    g.stat('wins', 1);
    const fresh = g.progression.checkAchievements();
    expect(fresh.some((a) => a.id === 'win_1')).toBe(true);
    expect(g.progression.claimAchievement('win_1')).not.toBeNull();
    expect(g.progression.claimAchievement('win_1')).toBeNull();
  });
  it('crafting uses shards', async () => {
    const { g } = await newGame();
    const c = g.cards.collectible.find((x) => x.rarity === 'RARE' && !g.collection.owned(x.id))!;
    g.data.currencies.shards = 0;
    expect(g.collection.craft(c)).toBe(false);
    g.data.currencies.shards = 1000;
    expect(g.collection.craft(c)).toBe(true);
    expect(g.collection.owned(c.id)).toBe(true);
  });
});

describe('SaveSystem', () => {
  it('round-trips the full player state', async () => {
    const storage = new MemoryAdapter();
    const { g } = await newGame(storage);
    g.data.currencies.coins = 4242;
    g.inventory.addPack('ELITE', 3);
    g.data.profile.name = 'Tester';
    await g.save.flush(g.data);
    const g2 = new Game(storage);
    await g2.load();
    expect(g2.data.currencies.coins).toBe(4242);
    expect(g2.inventory.packs('ELITE')).toBe(3);
    expect(g2.data.profile.name).toBe('Tester');
    expect(g2.data.decks.length).toBe(2);
    expect(g2.isNewPlayer).toBe(false);
  });
  it('falls back to backup on corruption', async () => {
    const storage = new MemoryAdapter();
    const { g } = await newGame(storage);
    g.data.currencies.coins = 777;
    await g.save.flush(g.data);
    g.data.currencies.coins = 888;
    await g.save.flush(g.data);
    storage.data.set('xalacards.save', '{corrupt');
    const g2 = new Game(storage);
    await g2.load();
    expect(g2.data.currencies.coins).toBe(777);
  });
  it('export/import works', async () => {
    const { g } = await newGame();
    g.data.currencies.gems = 321;
    const s = g.save.exportString(g.data);
    expect(g.save.importString(s)!.currencies.gems).toBe(321);
    expect(g.save.importString('garbage')).toBeNull();
  });
});
