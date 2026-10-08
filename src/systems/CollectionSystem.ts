import type { CardDef, Finish } from '../core/types';
import { RARITIES, FINISHES } from '../data/rarities';
import { SETS } from '../data/sets';
import type { Ctx } from './context';

export const PAGE_SIZE = 9;

export interface AddResult { id: string; finish: Finish; isNew: boolean; newFinish: boolean; shards: number }

export class CollectionSystem {
  constructor(private ctx: Ctx) {}

  private get col() { return this.ctx.data.collection; }

  owned(id: string): boolean { return !!this.col[id] && this.total(id) > 0; }
  total(id: string): number {
    const o = this.col[id];
    if (!o) return 0;
    return Object.values(o.counts).reduce((a, b) => a + (b ?? 0), 0);
  }
  finishes(id: string): Finish[] {
    const o = this.col[id];
    return o ? (Object.keys(o.counts) as Finish[]).filter((f) => (o.counts[f] ?? 0) > 0) : [];
  }
  bestFinish(id: string): Finish {
    const fs = this.finishes(id);
    return fs.sort((a, b) => FINISHES[b].tier - FINISHES[a].tier)[0] ?? 'NORMAL';
  }
  uniqueOwned(): number { return Object.keys(this.col).filter((id) => this.total(id) > 0).length; }
  isNew(id: string) { return !!this.col[id]?.isNew; }
  isFav(id: string) { return !!this.col[id]?.fav; }

  add(card: CardDef, finish: Finish, opts: { silent?: boolean } = {}): AddResult {
    const existing = this.col[card.id];
    const isNew = !existing || this.total(card.id) === 0;
    const o = existing ?? (this.col[card.id] = { counts: {}, first: Date.now(), isNew: true, fav: false });
    const newFinish = !(o.counts[finish] ?? 0);
    const playset = RARITIES[card.rarity].maxCopies;
    let shards = 0;
    // Duplicates beyond the playset (for NORMAL prints) become shards — anti pay-to-win.
    if (!newFinish && finish === 'NORMAL' && this.total(card.id) >= playset) {
      shards = Math.round(RARITIES[card.rarity].shardValue * FINISHES[finish].shardBonus);
      this.ctx.data.currencies.shards += shards;
    } else {
      o.counts[finish] = (o.counts[finish] ?? 0) + 1;
    }
    if (isNew) o.isNew = true;
    if (!opts.silent) this.ctx.bus.emit({ type: 'cardAcquired', id: card.id, rarity: card.rarity, finish, isNew });
    this.checkPages(card);
    return { id: card.id, finish, isNew, newFinish, shards };
  }

  markSeen(id: string) { const o = this.col[id]; if (o?.isNew) { o.isNew = false; this.ctx.changed(); } }
  markAllSeen() { for (const o of Object.values(this.col)) o.isNew = false; this.ctx.changed(); }
  toggleFav(id: string) { const o = this.col[id]; if (o) { o.fav = !o.fav; this.ctx.changed(); } }

  craftCost(card: CardDef) { return RARITIES[card.rarity].craftCost; }
  canCraft(card: CardDef) { return this.ctx.data.currencies.shards >= this.craftCost(card) && this.total(card.id) < RARITIES[card.rarity].maxCopies; }
  craft(card: CardDef): boolean {
    if (!this.canCraft(card)) return false;
    this.ctx.data.currencies.shards -= this.craftCost(card);
    this.add(card, 'NORMAL');
    this.ctx.stat('cardsCrafted');
    this.ctx.bus.emit({ type: 'cardCrafted', id: card.id });
    this.ctx.changed();
    return true;
  }
  /** Converts copies beyond the playset into shards. */
  disenchantExtras(): number {
    let gained = 0;
    for (const [id, o] of Object.entries(this.col)) {
      const c = this.ctx.cards.has(id) ? this.ctx.cards.get(id) : null;
      if (!c) continue;
      const extra = (o.counts.NORMAL ?? 0) - RARITIES[c.rarity].maxCopies;
      if (extra > 0) {
        o.counts.NORMAL = RARITIES[c.rarity].maxCopies;
        gained += extra * RARITIES[c.rarity].shardValue;
      }
    }
    this.ctx.data.currencies.shards += gained;
    this.ctx.changed();
    return gained;
  }

  setProgress(code: string): { owned: number; total: number } {
    const cards = this.ctx.cards.bySet(code);
    return { owned: cards.filter((c) => this.owned(c.id)).length, total: cards.length };
  }

  pageKey(card: CardDef) { return `${card.set}:${Math.floor((card.num - 1) / PAGE_SIZE)}`; }
  pageCards(key: string): CardDef[] {
    const [set, p] = key.split(':');
    const idx = Number(p);
    return this.ctx.cards.bySet(set).filter((c) => Math.floor((c.num - 1) / PAGE_SIZE) === idx);
  }

  private checkPages(card: CardDef) {
    const key = this.pageKey(card);
    const done = this.ctx.data.pagesCompleted;
    if (done.includes(key)) return;
    if (this.pageCards(key).every((c) => this.owned(c.id))) {
      done.push(key);
      this.ctx.stat('pagesCompleted');
      this.ctx.bus.emit({ type: 'pageCompleted', key });
      const set = SETS.find((s) => s.code === card.set);
      if (set) {
        const p = this.setProgress(set.code);
        if (p.owned === p.total) this.ctx.stat('setsCompleted');
      }
    }
  }
}
