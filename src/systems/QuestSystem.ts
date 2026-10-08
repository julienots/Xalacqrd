import { Rng } from '../core/rng';
import { DAILY_QUESTS, LOGIN_REWARDS, WEEKLY_QUESTS, type QuestDef, type Reward } from '../data/content';
import type { Ctx } from './context';
import type { EconomySystem } from './EconomySystem';
import { dayIndex, todayKey, weekKey, type QuestProgress } from './state';

export interface QuestView { def: QuestDef; progress: number; done: boolean; claimed: boolean }

export class QuestSystem {
  addXp: (n: number) => void = () => {};
  constructor(private ctx: Ctx, private economy: EconomySystem) {}

  private statVal(k: string) { return this.ctx.data.stats[k] ?? 0; }

  /** Rolls new daily / weekly missions when the date changes. Quest progress is measured from a stat snapshot. */
  refresh(now = new Date()) {
    const q = this.ctx.data.quests;
    const day = todayKey(now);
    if (q.dailyDate !== day) {
      const rng = new Rng(`daily-${day}`);
      const picks = rng.shuffle([...DAILY_QUESTS]).slice(0, 3);
      q.dailyDate = day;
      q.daily = picks.map((d) => ({ id: d.id, progress: 0, claimed: false }));
      for (const d of picks) q.base[`d:${d.id}`] = this.statVal(d.stat);
      this.ctx.changed();
    }
    const wk = weekKey(now);
    if (q.weekKey !== wk) {
      const rng = new Rng(`weekly-${wk}`);
      const picks = rng.shuffle([...WEEKLY_QUESTS]).slice(0, 3);
      q.weekKey = wk;
      q.weekly = picks.map((d) => ({ id: d.id, progress: 0, claimed: false }));
      for (const d of picks) q.base[`w:${d.id}`] = this.statVal(d.stat);
      this.ctx.changed();
    }
  }

  private view(list: QuestProgress[], defs: QuestDef[], prefix: string): QuestView[] {
    return list.map((p) => {
      const def = defs.find((d) => d.id === p.id)!;
      const progress = Math.min(def.goal, this.statVal(def.stat) - (this.ctx.data.quests.base[`${prefix}:${def.id}`] ?? 0));
      return { def, progress: Math.max(0, progress), done: progress >= def.goal, claimed: p.claimed };
    }).filter((v) => v.def);
  }
  daily(): QuestView[] { return this.view(this.ctx.data.quests.daily, DAILY_QUESTS, 'd'); }
  weekly(): QuestView[] { return this.view(this.ctx.data.quests.weekly, WEEKLY_QUESTS, 'w'); }
  claimableCount(): number { return [...this.daily(), ...this.weekly()].filter((q) => q.done && !q.claimed).length + (this.canClaimLogin() ? 1 : 0); }

  claim(kind: 'daily' | 'weekly', id: string): Reward[] | null {
    const list = kind === 'daily' ? this.ctx.data.quests.daily : this.ctx.data.quests.weekly;
    const p = list.find((x) => x.id === id);
    const v = (kind === 'daily' ? this.daily() : this.weekly()).find((x) => x.def.id === id);
    if (!p || !v || !v.done || p.claimed) return null; // prevents double rewards
    p.claimed = true;
    if (kind === 'daily') this.ctx.stat('dailyDone');
    this.addXp(v.def.xp);
    return this.economy.grant(v.def.reward);
  }

  // ---- daily login ----
  canClaimLogin(now = new Date()) { return this.ctx.data.login.lastDate !== todayKey(now); }
  loginDay(): number { return this.ctx.data.login.day % LOGIN_REWARDS.length; }
  claimLogin(now = new Date()): { day: number; rewards: Reward[] } | null {
    if (!this.canClaimLogin(now)) return null;
    const l = this.ctx.data.login;
    const last = l.lastDate ? dayIndex(new Date(l.lastDate + 'T12:00:00')) : -99;
    const consecutive = dayIndex(now) - last <= 1;
    l.streak = consecutive ? l.streak + 1 : 1;
    const day = l.day % LOGIN_REWARDS.length;
    l.day = day + 1;
    l.lastDate = todayKey(now);
    return { day, rewards: this.economy.grant([LOGIN_REWARDS[day]]) };
  }
}
