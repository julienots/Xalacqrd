import { COSMETIC_BY_ID, rankName } from '../data/content';
import { RARITIES } from '../data/rarities';
import type { CollectionSystem } from './CollectionSystem';
import type { Ctx } from './context';
import { levelXp } from './ProgressionSystem';

export class ProfileSystem {
  constructor(private ctx: Ctx, private collection: CollectionSystem) {}
  get p() { return this.ctx.data.profile; }

  setName(name: string): boolean {
    const clean = name.replace(/[<>]/g, '').trim().slice(0, 16);
    if (clean.length < 2) return false;
    this.p.name = clean;
    this.ctx.changed();
    return true;
  }
  titleText() { return COSMETIC_BY_ID[this.p.title]?.name ?? 'Newcomer'; }
  avatar() { return COSMETIC_BY_ID[this.p.avatar] ?? COSMETIC_BY_ID['av_ember']; }
  frame() { return COSMETIC_BY_ID[this.p.frame] ?? COSMETIC_BY_ID['fr_basic']; }
  levelProgress() { return { level: this.p.level, xp: this.p.xp, need: levelXp(this.p.level) }; }
  rank() { return rankName(this.ctx.data.ranked.index); }

  /** Rarest owned cards for the profile showcase. */
  showcase(n = 6) {
    return this.ctx.cards.collectible
      .filter((c) => this.collection.owned(c.id))
      .sort((a, b) => RARITIES[b.rarity].tier - RARITIES[a.rarity].tier || b.cost - a.cost)
      .slice(0, n);
  }

  summary() {
    const s = this.ctx.data.stats;
    const games = (s.wins ?? 0) + (s.losses ?? 0);
    return {
      games, wins: s.wins ?? 0, losses: s.losses ?? 0, winRate: games ? Math.round(((s.wins ?? 0) / games) * 100) : 0,
      packs: s.packsOpened ?? 0, unique: this.collection.uniqueOwned(), total: this.ctx.cards.collectible.length,
      perfect: s.perfectWins ?? 0, legendaries: s.legendaries ?? 0, decks: this.ctx.data.decks.length,
    };
  }
}
