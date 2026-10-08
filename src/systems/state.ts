// Persistent player data model. Everything the save system stores lives here.

import type { Finish } from '../core/types';
import type { ChestId, PackId } from '../data/content';
import { DEFAULT_COSMETICS } from '../data/content';
import type { Difficulty } from './CombatAI';

export interface OwnedCard { counts: Partial<Record<Finish, number>>; first: number; isNew: boolean; fav: boolean }

export interface Deck { id: string; name: string; cards: string[]; cardBack?: string; created: number; updated: number }

export interface QuestProgress { id: string; progress: number; claimed: boolean }

export type Quality = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

export interface Settings {
  music: number; sfx: number; haptics: boolean; quality: Quality; reducedMotion: boolean; fastReveal: boolean; showFps: boolean;
}

export interface PlayerData {
  version: number;
  created: number;
  profile: { name: string; level: number; xp: number; avatar: string; frame: string; title: string };
  currencies: { coins: number; gems: number; tickets: number; shards: number };
  collection: Record<string, OwnedCard>;
  decks: Deck[];
  activeDeck: string | null;
  inventory: { packs: Partial<Record<PackId, number>>; chests: Partial<Record<ChestId, number>>; cosmetics: string[] };
  equipped: { cardback: string; board: string; victory: string; summon: string };
  stats: Record<string, number>;
  pity: number;
  achievements: Record<string, { at: number; claimed: boolean }>;
  quests: { dailyDate: string; daily: QuestProgress[]; weekKey: string; weekly: QuestProgress[]; base: Record<string, number> };
  login: { lastDate: string; streak: number; day: number };
  pass: { season: number; xp: number; premium: boolean; claimedFree: number[]; claimedPremium: number[] };
  ranked: { season: number; index: number; stars: number; best: number; winStreak: number; lastRewardSeason: number };
  campaign: { cleared: string[] };
  events: Record<string, { progress: Record<string, number>; claimed: string[] }>;
  pagesCompleted: string[];
  purchases: { processed: string[]; oneTime: string[] };
  shop: { dealsDate: string; boughtDeals: string[]; freeGiftDate: string };
  tutorial: { firstBattle: boolean; firstPack: boolean };
  lastDifficulty: Difficulty;
  tournament: { round: number; results: boolean[]; opponents: { name: string; factions: string[] }[] } | null;
  settings: Settings;
}

export const CURRENT_VERSION = 1;

export function defaultData(): PlayerData {
  return {
    version: CURRENT_VERSION,
    created: Date.now(),
    profile: { name: 'Collector', level: 1, xp: 0, avatar: 'av_ember', frame: 'fr_basic', title: 'ti_newcomer' },
    currencies: { coins: 1500, gems: 150, tickets: 3, shards: 200 },
    collection: {},
    decks: [],
    activeDeck: null,
    inventory: { packs: { STARTER: 2, BASIC: 1 }, chests: { WOODEN: 1 }, cosmetics: [...DEFAULT_COSMETICS] },
    equipped: { cardback: 'cb_classic', board: 'bd_obsidian', victory: 'vx_fireworks', summon: 'sx_default' },
    stats: {},
    pity: 0,
    achievements: {},
    quests: { dailyDate: '', daily: [], weekKey: '', weekly: [], base: {} },
    login: { lastDate: '', streak: 0, day: 0 },
    pass: { season: 0, xp: 0, premium: false, claimedFree: [], claimedPremium: [] },
    ranked: { season: 0, index: 0, stars: 0, best: 0, winStreak: 0, lastRewardSeason: -1 },
    campaign: { cleared: [] },
    events: {},
    pagesCompleted: [],
    purchases: { processed: [], oneTime: [] },
    shop: { dealsDate: '', boughtDeals: [], freeGiftDate: '' },
    tutorial: { firstBattle: false, firstPack: false },
    lastDifficulty: 'NORMAL',
    tournament: null,
    settings: { music: 0.5, sfx: 0.8, haptics: true, quality: 'HIGH', reducedMotion: false, fastReveal: false, showFps: false },
  };
}

/** Upgrades older saves and fills missing fields so new features never crash old data. */
export function migrate(raw: any, _fromVersion: number): PlayerData {
  const base = defaultData();
  const out: any = { ...base, ...raw };
  for (const k of Object.keys(base) as (keyof PlayerData)[]) {
    const b = base[k] as any;
    if (b && typeof b === 'object' && !Array.isArray(b)) out[k] = { ...b, ...(raw?.[k] ?? {}) };
  }
  out.version = CURRENT_VERSION;
  return out as PlayerData;
}

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const weekKey = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7)}`;
};
export const dayIndex = (d = new Date()) => Math.floor(d.getTime() / 86400000);
