import {
  ACHIEVEMENTS, CAMPAIGN, MASTER_STARS_TO_GM, PASS_PREMIUM_PRICE, PASS_TIERS, PASS_XP_PER_TIER, STARS_PER_DIVISION,
  passReward, seasonRewards, type AchievementDef, type Reward,
} from '../data/content';
import type { CollectionSystem } from './CollectionSystem';
import type { Ctx } from './context';
import type { EconomySystem } from './EconomySystem';
import { dayIndex } from './state';

export const levelXp = (level: number) => 400 + level * 150;

export function passSeason(now = new Date()) { return now.getUTCFullYear() * 12 + now.getUTCMonth(); }
export function rankedSeason(now = new Date()) { return Math.floor(dayIndex(now) / 30); }
export function seasonEnds(now = new Date()) { return (rankedSeason(now) + 1) * 30 * 86400000; }

export interface MatchOutcome { mode: string; won: boolean; perfect: boolean; difficulty: string; stageKey?: string; tournamentWin?: boolean }

export class ProgressionSystem {
  constructor(private ctx: Ctx, private economy: EconomySystem, private collection: CollectionSystem) {}
  private get d() { return this.ctx.data; }

  // ---------- player level ----------
  addXp(amount: number) {
    const p = this.d.profile;
    p.xp += amount;
    while (p.xp >= levelXp(p.level)) {
      p.xp -= levelXp(p.level);
      p.level++;
      this.economy.grant([{ kind: 'coins', amount: 100 + p.level * 10 }, ...(p.level % 5 === 0 ? [{ kind: 'pack', id: 'ELITE', amount: 1 } as Reward] : [{ kind: 'pack', id: 'BASIC', amount: 1 } as Reward])]);
      this.ctx.bus.emit({ type: 'levelUp', level: p.level });
    }
    this.addPassXp(amount);
    this.ctx.changed();
  }

  // ---------- XALA pass ----------
  ensurePassSeason(now = new Date()) {
    const s = passSeason(now);
    if (this.d.pass.season !== s) this.d.pass = { season: s, xp: 0, premium: false, claimedFree: [], claimedPremium: [] };
  }
  addPassXp(n: number) { this.ensurePassSeason(); this.d.pass.xp = Math.min(this.d.pass.xp + n, PASS_TIERS * PASS_XP_PER_TIER); }
  passTier() { return Math.min(PASS_TIERS, Math.floor(this.d.pass.xp / PASS_XP_PER_TIER)); }
  claimPass(tier: number, premium: boolean): Reward[] | null {
    this.ensurePassSeason();
    const list = premium ? this.d.pass.claimedPremium : this.d.pass.claimedFree;
    if (tier < 1 || tier > this.passTier() || list.includes(tier)) return null;
    if (premium && !this.d.pass.premium) return null;
    list.push(tier);
    return this.economy.grant(passReward(tier, premium));
  }
  claimAllPass(): Reward[] {
    const out: Reward[] = [];
    for (let t = 1; t <= this.passTier(); t++) {
      out.push(...(this.claimPass(t, false) ?? []));
      if (this.d.pass.premium) out.push(...(this.claimPass(t, true) ?? []));
    }
    return out;
  }
  unlockPremium(): boolean {
    this.ensurePassSeason();
    if (this.d.pass.premium) return false;
    if (!this.economy.spend({ gems: PASS_PREMIUM_PRICE })) return false;
    this.d.pass.premium = true;
    this.ctx.changed();
    return true;
  }

  // ---------- ranked ----------
  ensureRankedSeason(now = new Date()): Reward[] | null {
    const s = rankedSeason(now);
    const r = this.d.ranked;
    if (r.season === s) return null;
    let rewards: Reward[] | null = null;
    if (r.season !== 0 && r.lastRewardSeason !== r.season && (r.index > 0 || r.stars > 0)) {
      rewards = this.economy.grant(seasonRewards(r.index));
      r.lastRewardSeason = r.season;
    }
    // soft reset: drop 4 divisions
    r.season = s;
    r.index = Math.max(0, Math.min(r.index, 15) - 4);
    r.stars = 0;
    r.winStreak = 0;
    this.ctx.changed();
    return rewards;
  }

  rankedResult(won: boolean): { before: number; after: number; stars: number } {
    this.ensureRankedSeason();
    const r = this.d.ranked;
    const before = r.index;
    if (won) {
      r.winStreak++;
      const gain = r.winStreak >= 3 && r.index < 15 ? 2 : 1;
      r.stars += gain;
      if (r.index < 15) {
        while (r.stars >= STARS_PER_DIVISION && r.index < 15) { r.stars -= STARS_PER_DIVISION; r.index++; }
        if (r.index === 15) r.stars = 0;
      } else if (r.index === 15 && r.stars >= MASTER_STARS_TO_GM) { r.index = 16; r.stars = 0; }
    } else {
      r.winStreak = 0;
      if (r.index >= 3) { // no star loss in Bronze
        if (r.stars > 0) r.stars--;
        else if (r.index < 15 && r.index % 3 !== 0) { r.index--; r.stars = STARS_PER_DIVISION - 1; }
        else if (r.index >= 15 && r.index === 16 && r.stars === 0) { /* GM floor */ }
      }
    }
    r.best = Math.max(r.best, r.index);
    this.ctx.changed();
    return { before, after: r.index, stars: r.stars };
  }

  // ---------- campaign ----------
  stageKey(ch: number, st: number) { return `${ch}-${st}`; }
  isUnlocked(ch: number, st: number): boolean {
    if (ch === 1 && st === 1) return true;
    const prev = st > 1 ? this.stageKey(ch, st - 1) : this.stageKey(ch - 1, 6);
    return this.d.campaign.cleared.includes(prev);
  }
  isCleared(ch: number, st: number) { return this.d.campaign.cleared.includes(this.stageKey(ch, st)); }
  clearStage(ch: number, st: number): Reward[] {
    const key = this.stageKey(ch, st);
    if (this.d.campaign.cleared.includes(key)) return this.economy.grant([{ kind: 'coins', amount: 40 }]);
    this.d.campaign.cleared.push(key);
    const stage = CAMPAIGN.find((s) => s.chapter === ch && s.stage === st)!;
    if (st === 6) this.ctx.stat('chaptersCleared');
    return this.economy.grant(stage.reward);
  }

  // ---------- match rewards ----------
  matchRewards(o: MatchOutcome): Reward[] {
    const r: Reward[] = [];
    const diffMul = { EASY: 0.8, NORMAL: 1, HARD: 1.2, EXPERT: 1.4, MASTER: 1.7 }[o.difficulty] ?? 1;
    if (o.mode === 'practice') {
      r.push({ kind: 'xp', amount: o.won ? 60 : 30 });
      return this.economy.grant(r);
    }
    const base = o.mode === 'ranked' ? 80 : o.mode === 'event' ? 70 : 60;
    r.push({ kind: 'coins', amount: Math.round((o.won ? base : base * 0.35) * diffMul) });
    r.push({ kind: 'xp', amount: Math.round((o.won ? 220 : 90) * diffMul) });
    if (o.won && this.d.stats.wins % 3 === 0) r.push({ kind: 'chest', id: o.mode === 'ranked' ? 'SILVER' : 'WOODEN', amount: 1 });
    return this.economy.grant(r);
  }

  // ---------- achievements ----------
  derivedStat(stat: string): number {
    switch (stat) {
      case 'uniqueCards': return this.collection.uniqueOwned();
      case 'level': return this.d.profile.level;
      case 'bestRank': return this.d.ranked.best + 1;
      default: return this.d.stats[stat] ?? 0;
    }
  }
  achievements(): { def: AchievementDef; progress: number; unlocked: boolean; claimed: boolean }[] {
    return ACHIEVEMENTS.map((def) => {
      const progress = Math.min(def.goal, this.derivedStat(def.stat));
      const st = this.d.achievements[def.id];
      return { def, progress, unlocked: progress >= def.goal, claimed: !!st?.claimed };
    });
  }
  /** Records newly unlocked achievements; returns the ones that were just unlocked. */
  checkAchievements(): AchievementDef[] {
    const fresh: AchievementDef[] = [];
    for (const a of this.achievements()) {
      if (a.unlocked && !this.d.achievements[a.def.id]) {
        this.d.achievements[a.def.id] = { at: Date.now(), claimed: false };
        fresh.push(a.def);
      }
    }
    if (fresh.length) this.ctx.changed();
    return fresh;
  }
  claimAchievement(id: string): Reward[] | null {
    const st = this.d.achievements[id];
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!st || st.claimed || !def) return null;
    st.claimed = true;
    return this.economy.grant(def.reward);
  }
  unclaimedAchievements() { return Object.values(this.d.achievements).filter((a) => !a.claimed).length; }
}
