import { LIVE_EVENTS, type LiveEventDef, type Reward } from '../data/content';
import type { Ctx } from './context';
import type { EconomySystem } from './EconomySystem';

const WEEK = 7 * 86400000;
const EPOCH = Date.UTC(2024, 0, 1); // Monday

export interface EventView { def: LiveEventDef; active: boolean; startsAt: number; endsAt: number }

export class EventSystem {
  addXp: (n: number) => void = () => {};
  constructor(private ctx: Ctx, private economy: EconomySystem) {}

  /** One event is live each week, rotating through the calendar. */
  schedule(now = Date.now()): EventView[] {
    const w = Math.floor((now - EPOCH) / WEEK);
    return [0, 1, 2, 3].map((k) => {
      const week = w + k;
      const def = LIVE_EVENTS[((week % LIVE_EVENTS.length) + LIVE_EVENTS.length) % LIVE_EVENTS.length];
      return { def, active: k === 0, startsAt: EPOCH + week * WEEK, endsAt: EPOCH + (week + 1) * WEEK };
    });
  }
  current(now = Date.now()): EventView { return this.schedule(now)[0]; }

  private state(id: string, now = Date.now()) {
    const evs = this.ctx.data.events;
    const cur = this.current(now);
    const key = `${id}@${cur.startsAt}`;
    if (!evs[key]) {
      const def = LIVE_EVENTS.find((e) => e.id === id)!;
      const progress: Record<string, number> = {};
      for (const m of def.missions) progress[m.stat] = this.ctx.data.stats[m.stat] ?? 0; // snapshot
      evs[key] = { progress, claimed: [] };
      this.ctx.changed();
    }
    return evs[key];
  }

  missions(now = Date.now()) {
    const { def } = this.current(now);
    const st = this.state(def.id, now);
    return def.missions.map((m) => {
      const progress = Math.min(m.goal, Math.max(0, (this.ctx.data.stats[m.stat] ?? 0) - (st.progress[m.stat] ?? 0)));
      return { def: m, progress, done: progress >= m.goal, claimed: st.claimed.includes(m.id) };
    });
  }

  claim(missionId: string, now = Date.now()): Reward[] | null {
    const { def } = this.current(now);
    const st = this.state(def.id, now);
    const m = this.missions(now).find((x) => x.def.id === missionId);
    if (!m || !m.done || m.claimed) return null;
    st.claimed.push(missionId);
    this.addXp(m.def.xp);
    return this.economy.grant(m.def.reward);
  }
}
