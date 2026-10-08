// Static game content: packs, chests, cosmetics, achievements, quests, events,
// pass rewards, ranked ladder and campaign.

import type { Finish, FactionId, Rarity } from '../core/types';
import type { BattleRules } from '../systems/BattleSystem';
import type { Difficulty } from '../systems/CombatAI';

// ---------------- rewards ----------------

export type Reward =
  | { kind: 'coins'; amount: number }
  | { kind: 'gems'; amount: number }
  | { kind: 'tickets'; amount: number }
  | { kind: 'shards'; amount: number }
  | { kind: 'pack'; id: PackId; amount: number }
  | { kind: 'chest'; id: ChestId; amount: number }
  | { kind: 'cosmetic'; id: string }
  | { kind: 'card'; id: string; finish?: Finish }
  | { kind: 'xp'; amount: number };

// ---------------- packs ----------------

export type PackId = 'STARTER' | 'BASIC' | 'ELITE' | 'COSMIC' | 'SECRET' | 'EVENT';

export interface SlotDef { count: number; rarities: [Rarity, number][]; }

export interface PackDef {
  id: PackId;
  name: string;
  desc: string;
  cards: number;
  slots: SlotDef[];
  finishBoost: number;     // multiplies non-normal finish weights
  minFinish?: Finish;      // guaranteed finish floor
  price: { coins?: number; gems?: number; tickets?: number };
  colors: [string, string];
  glyph: string;
  sellable: boolean;
}

const RARE_SLOT: [Rarity, number][] = [['RARE', 70], ['EPIC', 20], ['LEGENDARY', 6.5], ['MYTHIC', 2], ['ANCIENT', 0.8], ['CELESTIAL', 0.4], ['SECRET', 0.2], ['PRISMATIC', 0.1]];
const EPIC_SLOT: [Rarity, number][] = [['EPIC', 72], ['LEGENDARY', 18], ['MYTHIC', 6], ['ANCIENT', 2], ['CELESTIAL', 1], ['SECRET', 0.6], ['PRISMATIC', 0.4]];
const LEGEND_SLOT: [Rarity, number][] = [['LEGENDARY', 62], ['MYTHIC', 20], ['ANCIENT', 8], ['CELESTIAL', 5], ['SECRET', 3], ['PRISMATIC', 2]];
const UNC_SLOT: [Rarity, number][] = [['UNCOMMON', 85], ['RARE', 13], ['EPIC', 2]];

export const PACKS: Record<PackId, PackDef> = {
  STARTER: { id: 'STARTER', name: 'Starter Pack', desc: '10 cards to begin your journey. One Rare or better guaranteed.', cards: 10,
    slots: [{ count: 6, rarities: [['COMMON', 1]] }, { count: 2, rarities: UNC_SLOT }, { count: 2, rarities: RARE_SLOT }],
    finishBoost: 1, price: { coins: 300 }, colors: ['#3a7bff', '#79e0ff'], glyph: '✧', sellable: false },
  BASIC: { id: 'BASIC', name: 'Basic Pack', desc: '8 cards. One Rare or better guaranteed.', cards: 8,
    slots: [{ count: 5, rarities: [['COMMON', 1]] }, { count: 2, rarities: UNC_SLOT }, { count: 1, rarities: RARE_SLOT }],
    finishBoost: 1, price: { coins: 400 }, colors: ['#ffb347', '#ff5f6d'], glyph: '◈', sellable: true },
  ELITE: { id: 'ELITE', name: 'Elite Pack', desc: '10 cards with boosted odds: two Rare+ and one Epic+ slot.', cards: 10,
    slots: [{ count: 4, rarities: [['COMMON', 1]] }, { count: 3, rarities: UNC_SLOT }, { count: 2, rarities: RARE_SLOT }, { count: 1, rarities: EPIC_SLOT }],
    finishBoost: 1.8, price: { gems: 120, coins: 1500 }, colors: ['#b45cff', '#ff7ad9'], glyph: '✦', sellable: true },
  COSMIC: { id: 'COSMIC', name: 'Cosmic Pack', desc: '6 special-finish cards. Every card is Foil or better, two Epic+ slots.', cards: 6,
    slots: [{ count: 2, rarities: UNC_SLOT }, { count: 2, rarities: RARE_SLOT }, { count: 2, rarities: EPIC_SLOT }],
    finishBoost: 4, minFinish: 'FOIL', price: { gems: 300 }, colors: ['#2b2bff', '#ff4fd8'], glyph: '🌌', sellable: true },
  SECRET: { id: 'SECRET', name: 'Secret Pack', desc: '5 cards. Guaranteed Legendary or better — Secret odds x10.', cards: 5,
    slots: [{ count: 2, rarities: RARE_SLOT }, { count: 2, rarities: EPIC_SLOT }, { count: 1, rarities: LEGEND_SLOT }],
    finishBoost: 6, minFinish: 'HOLOGRAPHIC', price: { gems: 800 }, colors: ['#111111', '#ff2e2e'], glyph: '⚡', sellable: true },
  EVENT: { id: 'EVENT', name: 'Event Pack', desc: '8 cards including one guaranteed Festival Promo from the current event.', cards: 8,
    slots: [{ count: 4, rarities: [['COMMON', 1]] }, { count: 2, rarities: UNC_SLOT }, { count: 2, rarities: RARE_SLOT }],
    finishBoost: 2, price: { tickets: 2 }, colors: ['#ff8a00', '#ff2e8a'], glyph: '❖', sellable: true },
};

export const FINISH_WEIGHTS: [Finish, number][] = [
  ['NORMAL', 80], ['FOIL', 10], ['HOLOGRAPHIC', 5], ['GOLD', 2], ['COSMIC', 1.2], ['PRISM', 0.9], ['SIGNATURE', 0.6], ['SECRET', 0.3],
];

export const PITY_THRESHOLD = 30; // packs without Legendary+ before a guarantee

// ---------------- chests ----------------

export type ChestId = 'WOODEN' | 'SILVER' | 'GOLD' | 'CRYSTAL' | 'CELESTIAL';

export interface ChestDef {
  id: ChestId; name: string; color: string; color2: string;
  price?: { coins?: number; gems?: number };
  loot: { reward: Reward; chance: number }[];
}

export const CHESTS: Record<ChestId, ChestDef> = {
  WOODEN: { id: 'WOODEN', name: 'Wooden Chest', color: '#8a5a2b', color2: '#d4a26a', price: { coins: 250 },
    loot: [{ reward: { kind: 'coins', amount: 150 }, chance: 1 }, { reward: { kind: 'shards', amount: 30 }, chance: 0.6 }, { reward: { kind: 'pack', id: 'BASIC', amount: 1 }, chance: 0.25 }] },
  SILVER: { id: 'SILVER', name: 'Silver Chest', color: '#9aa7b8', color2: '#eef3ff', price: { coins: 700 },
    loot: [{ reward: { kind: 'coins', amount: 300 }, chance: 1 }, { reward: { kind: 'pack', id: 'BASIC', amount: 1 }, chance: 1 }, { reward: { kind: 'gems', amount: 10 }, chance: 0.4 }, { reward: { kind: 'shards', amount: 60 }, chance: 0.7 }] },
  GOLD: { id: 'GOLD', name: 'Gold Chest', color: '#d99a1e', color2: '#fff0a8', price: { gems: 80 },
    loot: [{ reward: { kind: 'coins', amount: 600 }, chance: 1 }, { reward: { kind: 'pack', id: 'BASIC', amount: 2 }, chance: 1 }, { reward: { kind: 'pack', id: 'ELITE', amount: 1 }, chance: 0.5 }, { reward: { kind: 'gems', amount: 20 }, chance: 0.6 }] },
  CRYSTAL: { id: 'CRYSTAL', name: 'Crystal Chest', color: '#47d6ff', color2: '#e0fbff', price: { gems: 200 },
    loot: [{ reward: { kind: 'gems', amount: 50 }, chance: 1 }, { reward: { kind: 'pack', id: 'ELITE', amount: 1 }, chance: 1 }, { reward: { kind: 'tickets', amount: 2 }, chance: 0.8 }, { reward: { kind: 'shards', amount: 300 }, chance: 1 }, { reward: { kind: 'pack', id: 'COSMIC', amount: 1 }, chance: 0.25 }] },
  CELESTIAL: { id: 'CELESTIAL', name: 'Celestial Chest', color: '#fff6c9', color2: '#a07bff',
    loot: [{ reward: { kind: 'gems', amount: 100 }, chance: 1 }, { reward: { kind: 'pack', id: 'COSMIC', amount: 1 }, chance: 1 }, { reward: { kind: 'pack', id: 'ELITE', amount: 2 }, chance: 1 }, { reward: { kind: 'pack', id: 'SECRET', amount: 1 }, chance: 0.15 }, { reward: { kind: 'shards', amount: 800 }, chance: 1 }] },
};

// ---------------- cosmetics ----------------

export type CosmeticKind = 'cardback' | 'board' | 'avatar' | 'frame' | 'title' | 'victory' | 'summon';

export interface CosmeticDef {
  id: string; kind: CosmeticKind; name: string; desc: string;
  colors: [string, string]; glyph: string;
  price?: { coins?: number; gems?: number; tickets?: number };
  source?: string; // how to obtain if not purchasable
}

const C = (id: string, kind: CosmeticKind, name: string, colors: [string, string], glyph: string, price?: CosmeticDef['price'], source?: string, desc = ''): CosmeticDef =>
  ({ id, kind, name, colors, glyph, price, source, desc });

export const COSMETICS: CosmeticDef[] = [
  // card backs
  C('cb_classic', 'cardback', 'Xala Classic', ['#1b1340', '#5b3cff'], '✧', undefined, 'Default'),
  C('cb_ember', 'cardback', 'Caldera Sigil', ['#3a0c00', '#ff6a2b'], '🔥', { gems: 150 }),
  C('cb_verdant', 'cardback', 'Rootmind Weave', ['#062a12', '#4fd06b'], '🌿', { gems: 150 }),
  C('cb_abyss', 'cardback', 'Drowned Lantern', ['#001a33', '#2fa8ff'], '🌊', { gems: 150 }),
  C('cb_void', 'cardback', 'Hollow Eye', ['#0b0014', '#a15cff'], '🌑', { gems: 150 }),
  C('cb_aether', 'cardback', 'Synod Halo', ['#2a2410', '#fff3b0'], '✨', { coins: 3000 }),
  C('cb_cosmos', 'cardback', 'Star Atlas', ['#05051f', '#6a7bff'], '🌌', undefined, 'XALA Pass'),
  C('cb_prism', 'cardback', 'Prism Vault', ['#200030', '#ff9af5'], '🌈', undefined, 'Achievement: Prismatic'),
  C('cb_festival', 'cardback', 'Festival Lights', ['#2a0010', '#ff8a00'], '❖', undefined, 'Events'),
  C('cb_titan', 'cardback', 'Bedrock Rune', ['#1e140a', '#c8935a'], '🪨', { coins: 3000 }),
  // boards
  C('bd_obsidian', 'board', 'Obsidian Table', ['#0d0b1a', '#2c2550'], '◆', undefined, 'Default'),
  C('bd_caldera', 'board', 'Caldera Forge', ['#1a0500', '#7a2300'], '🔥', { gems: 250 }),
  C('bd_grove', 'board', 'Greenveil Grove', ['#03140a', '#1c5a2e'], '🌿', { gems: 250 }),
  C('bd_reef', 'board', 'Drowned Reef', ['#001022', '#0b4a7a'], '🌊', { coins: 5000 }),
  C('bd_observatory', 'board', 'Star Observatory', ['#04031a', '#2a1f7a'], '🌌', undefined, 'XALA Pass'),
  C('bd_skybridge', 'board', 'Sky Bridge', ['#1a1a2a', '#8a8fb8'], '✨', { gems: 250 }),
  // avatars
  ...([['EMBER', '🔥', 'Pyre Crest'], ['VERDANT', '🌿', 'Grove Crest'], ['ABYSS', '🌊', 'Tide Crest'], ['VOLT', '⚡', 'Storm Crest'], ['VOID', '🌑', 'Hollow Crest'], ['AETHER', '✨', 'Halo Crest'], ['TITAN', '🪨', 'Peak Crest'], ['COSMOS', '🌌', 'Star Crest']] as const)
    .map(([f, g, n], i) => C(`av_${f.toLowerCase()}`, 'avatar', n, avColors()[i], g, i < 2 ? undefined : { coins: 1500 }, i < 2 ? 'Default' : undefined)),
  C('av_dragon', 'avatar', 'Skyfang', ['#3a0c00', '#ffd04a'], '🐉', undefined, 'XALA Pass'),
  C('av_crown', 'avatar', 'Collector Crown', ['#2a1a00', '#ffcf6b'], '👑', undefined, 'Achievement: Master Collector'),
  C('av_mask', 'avatar', 'Festival Mask', ['#2a0010', '#ff8ad1'], '🎭', undefined, 'Events'),
  // frames
  C('fr_basic', 'frame', 'Simple Frame', ['#3a3a4a', '#8a8aa0'], '○', undefined, 'Default'),
  C('fr_bronze', 'frame', 'Bronze Frame', ['#5a3210', '#d08a4a'], '◎', undefined, 'Ranked: Bronze'),
  C('fr_gold', 'frame', 'Gold Frame', ['#6a4a00', '#ffd76a'], '◉', undefined, 'Ranked: Gold'),
  C('fr_diamond', 'frame', 'Diamond Frame', ['#004a6a', '#9af0ff'], '◇', undefined, 'Ranked: Diamond'),
  C('fr_prism', 'frame', 'Prism Frame', ['#ff4fd8', '#4fd8ff'], '❂', { gems: 400 }),
  C('fr_celestial', 'frame', 'Celestial Frame', ['#fff6c9', '#a07bff'], '✺', undefined, 'XALA Pass Premium'),
  // titles
  ...['Newcomer', 'Card Shark', 'Pack Ripper', 'Collector', 'Champion', 'Archivist', 'Star Reader', 'Void Touched', 'Flamebearer', 'Unbreakable', 'Grandmaster', 'Prism Hunter', 'Festival Star', 'Legend Finder']
    .map((t, i) => C(`ti_${t.toLowerCase().replace(/ /g, '_')}`, 'title', t, ['#333', '#999'], '❝', i === 0 ? undefined : i < 3 ? { coins: 800 } : undefined, i === 0 ? 'Default' : i < 3 ? undefined : 'Achievements / Pass')),
  // victory effects
  C('vx_fireworks', 'victory', 'Fireworks', ['#ff5f6d', '#ffc371'], '🎆', undefined, 'Default'),
  C('vx_starburst', 'victory', 'Starburst', ['#6a7bff', '#ff9af5'], '🌟', { gems: 200 }),
  C('vx_petals', 'victory', 'Petal Storm', ['#4fd06b', '#ffb3d9'], '🌸', { gems: 200 }),
  C('vx_lightning', 'victory', 'Thunderclap', ['#ffe23a', '#7ad7ff'], '⚡', undefined, 'XALA Pass'),
  // summon effects
  C('sx_default', 'summon', 'Arcane Ring', ['#5b3cff', '#9fe8ff'], '◌', undefined, 'Default'),
  C('sx_flames', 'summon', 'Flame Pillar', ['#ff6a2b', '#ffd04a'], '🔥', { gems: 180 }),
  C('sx_stardust', 'summon', 'Stardust', ['#6a7bff', '#ffffff'], '✨', { gems: 180 }),
  C('sx_shadow', 'summon', 'Shadow Bloom', ['#a15cff', '#200030'], '🌑', undefined, 'Events'),
];

function avColors(): [string, string][] {
  return [['#3a0c00', '#ff6a2b'], ['#062a12', '#4fd06b'], ['#001a33', '#2fa8ff'], ['#2a2600', '#ffe23a'], ['#0b0014', '#a15cff'], ['#2a2410', '#fff3b0'], ['#1e140a', '#c8935a'], ['#05051f', '#6a7bff']];
}

export const COSMETIC_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
export const DEFAULT_COSMETICS = COSMETICS.filter((c) => c.source === 'Default').map((c) => c.id);

// ---------------- achievements ----------------

export interface AchievementDef {
  id: string; name: string; desc: string; icon: string;
  stat: string; goal: number; reward: Reward[];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_pack', name: 'First Rip', desc: 'Open your first booster.', icon: '📦', stat: 'packsOpened', goal: 1, reward: [{ kind: 'coins', amount: 200 }] },
  { id: 'packs_25', name: 'Pack Ripper', desc: 'Open 25 boosters.', icon: '🎁', stat: 'packsOpened', goal: 25, reward: [{ kind: 'gems', amount: 50 }, { kind: 'cosmetic', id: 'ti_pack_ripper' }] },
  { id: 'packs_100', name: 'Vault Breaker', desc: 'Open 100 boosters.', icon: '🏦', stat: 'packsOpened', goal: 100, reward: [{ kind: 'pack', id: 'COSMIC', amount: 1 }] },
  { id: 'cards_100', name: '100 Cards', desc: 'Own 100 different cards.', icon: '🃏', stat: 'uniqueCards', goal: 100, reward: [{ kind: 'gems', amount: 50 }, { kind: 'cosmetic', id: 'ti_collector' }] },
  { id: 'cards_300', name: 'Archivist', desc: 'Own 300 different cards.', icon: '📚', stat: 'uniqueCards', goal: 300, reward: [{ kind: 'gems', amount: 150 }, { kind: 'cosmetic', id: 'ti_archivist' }] },
  { id: 'cards_600', name: 'Master Collector', desc: 'Own 600 different cards.', icon: '👑', stat: 'uniqueCards', goal: 600, reward: [{ kind: 'cosmetic', id: 'av_crown' }, { kind: 'chest', id: 'CELESTIAL', amount: 1 }] },
  { id: 'first_legendary', name: 'First Legendary', desc: 'Find a Legendary card or better.', icon: '🌟', stat: 'legendaries', goal: 1, reward: [{ kind: 'gems', amount: 30 }, { kind: 'cosmetic', id: 'ti_legend_finder' }] },
  { id: 'mythic', name: 'Mythbreaker', desc: 'Find a Mythic card or better.', icon: '🌌', stat: 'mythics', goal: 1, reward: [{ kind: 'gems', amount: 60 }] },
  { id: 'secret', name: 'Secret Keeper', desc: 'Find a Secret card.', icon: '⚡', stat: 'secrets', goal: 1, reward: [{ kind: 'gems', amount: 150 }] },
  { id: 'prismatic', name: 'Prismatic', desc: 'Find a Prismatic card.', icon: '🌈', stat: 'prismatics', goal: 1, reward: [{ kind: 'cosmetic', id: 'cb_prism' }, { kind: 'cosmetic', id: 'ti_prism_hunter' }] },
  { id: 'special_finish', name: 'Shiny!', desc: 'Pull a Holographic or rarer finish.', icon: '💿', stat: 'specialFinishes', goal: 1, reward: [{ kind: 'coins', amount: 300 }] },
  { id: 'set_complete', name: 'Set Complete', desc: 'Complete any set.', icon: '🏆', stat: 'setsCompleted', goal: 1, reward: [{ kind: 'chest', id: 'CELESTIAL', amount: 1 }] },
  { id: 'page_complete', name: 'Page Turner', desc: 'Complete a Codex page.', icon: '📖', stat: 'pagesCompleted', goal: 1, reward: [{ kind: 'coins', amount: 250 }] },
  { id: 'win_1', name: 'First Victory', desc: 'Win a match.', icon: '⚔️', stat: 'wins', goal: 1, reward: [{ kind: 'pack', id: 'BASIC', amount: 1 }] },
  { id: 'win_10', name: 'Duelist', desc: 'Win 10 matches.', icon: '🗡️', stat: 'wins', goal: 10, reward: [{ kind: 'gems', amount: 40 }, { kind: 'cosmetic', id: 'ti_card_shark' }] },
  { id: 'win_100', name: '100 Victories', desc: 'Win 100 matches.', icon: '🏅', stat: 'wins', goal: 100, reward: [{ kind: 'gems', amount: 200 }, { kind: 'cosmetic', id: 'ti_champion' }] },
  { id: 'perfect', name: 'Perfect Victory', desc: 'Win a match without your hero taking damage.', icon: '💎', stat: 'perfectWins', goal: 1, reward: [{ kind: 'gems', amount: 50 }, { kind: 'cosmetic', id: 'ti_unbreakable' }] },
  { id: 'master_ai', name: 'Mastermind', desc: 'Defeat the MASTER AI.', icon: '🧠', stat: 'masterWins', goal: 1, reward: [{ kind: 'gems', amount: 100 }] },
  { id: 'campaign_1', name: 'Origins Cleared', desc: 'Clear Campaign chapter 1.', icon: '🗺️', stat: 'chaptersCleared', goal: 1, reward: [{ kind: 'pack', id: 'ELITE', amount: 1 }] },
  { id: 'campaign_all', name: 'Realm Walker', desc: 'Clear every Campaign chapter.', icon: '🌍', stat: 'chaptersCleared', goal: 4, reward: [{ kind: 'pack', id: 'SECRET', amount: 1 }] },
  { id: 'tournament', name: 'Tournament Champion', desc: 'Win a tournament.', icon: '🏆', stat: 'tournamentsWon', goal: 1, reward: [{ kind: 'gems', amount: 100 }] },
  { id: 'gold_rank', name: 'Gilded', desc: 'Reach Gold in Ranked.', icon: '🥇', stat: 'bestRank', goal: 6, reward: [{ kind: 'cosmetic', id: 'fr_gold' }] },
  { id: 'diamond_rank', name: 'Diamond Mind', desc: 'Reach Diamond in Ranked.', icon: '💠', stat: 'bestRank', goal: 12, reward: [{ kind: 'cosmetic', id: 'fr_diamond' }] },
  { id: 'gm_rank', name: 'Grandmaster', desc: 'Reach Grandmaster in Ranked.', icon: '👑', stat: 'bestRank', goal: 17, reward: [{ kind: 'cosmetic', id: 'ti_grandmaster' }, { kind: 'chest', id: 'CELESTIAL', amount: 1 }] },
  { id: 'deck_builder', name: 'Architect', desc: 'Save a custom deck.', icon: '🧱', stat: 'decksSaved', goal: 1, reward: [{ kind: 'coins', amount: 200 }] },
  { id: 'crafter', name: 'Shardsmith', desc: 'Craft a card with shards.', icon: '🔨', stat: 'cardsCrafted', goal: 1, reward: [{ kind: 'shards', amount: 100 }] },
  { id: 'chests_10', name: 'Treasure Hunter', desc: 'Open 10 chests.', icon: '🗝️', stat: 'chestsOpened', goal: 10, reward: [{ kind: 'gems', amount: 40 }] },
  { id: 'level_10', name: 'Rising Star', desc: 'Reach player level 10.', icon: '⭐', stat: 'level', goal: 10, reward: [{ kind: 'cosmetic', id: 'ti_star_reader' }] },
];

// ---------------- quests ----------------

export interface QuestDef { id: string; desc: string; stat: string; goal: number; reward: Reward[]; xp: number }

export const DAILY_QUESTS: QuestDef[] = [
  { id: 'd_win2', desc: 'Win 2 matches', stat: 'wins', goal: 2, reward: [{ kind: 'coins', amount: 150 }, { kind: 'gems', amount: 10 }], xp: 300 },
  { id: 'd_play20', desc: 'Play 20 cards', stat: 'cardsPlayed', goal: 20, reward: [{ kind: 'coins', amount: 120 }], xp: 250 },
  { id: 'd_open2', desc: 'Open 2 boosters', stat: 'packsOpened', goal: 2, reward: [{ kind: 'coins', amount: 100 }, { kind: 'shards', amount: 40 }], xp: 250 },
  { id: 'd_dmg60', desc: 'Deal 60 damage', stat: 'damageDealt', goal: 60, reward: [{ kind: 'coins', amount: 150 }], xp: 250 },
  { id: 'd_kill10', desc: 'Destroy 10 enemy creatures', stat: 'creaturesKilled', goal: 10, reward: [{ kind: 'coins', amount: 150 }], xp: 250 },
  { id: 'd_match3', desc: 'Play 3 matches', stat: 'matches', goal: 3, reward: [{ kind: 'coins', amount: 100 }, { kind: 'tickets', amount: 1 }], xp: 250 },
  { id: 'd_action8', desc: 'Cast 8 Action cards', stat: 'actionsPlayed', goal: 8, reward: [{ kind: 'gems', amount: 10 }], xp: 250 },
  { id: 'd_chest1', desc: 'Open a chest', stat: 'chestsOpened', goal: 1, reward: [{ kind: 'coins', amount: 80 }], xp: 200 },
];

export const WEEKLY_QUESTS: QuestDef[] = [
  { id: 'w_win10', desc: 'Win 10 matches', stat: 'wins', goal: 10, reward: [{ kind: 'pack', id: 'ELITE', amount: 1 }], xp: 1500 },
  { id: 'w_open10', desc: 'Open 10 boosters', stat: 'packsOpened', goal: 10, reward: [{ kind: 'gems', amount: 50 }], xp: 1200 },
  { id: 'w_play120', desc: 'Play 120 cards', stat: 'cardsPlayed', goal: 120, reward: [{ kind: 'chest', id: 'GOLD', amount: 1 }], xp: 1200 },
  { id: 'w_ranked5', desc: 'Win 5 Ranked matches', stat: 'rankedWins', goal: 5, reward: [{ kind: 'tickets', amount: 3 }], xp: 1500 },
  { id: 'w_daily', desc: 'Complete 10 daily missions', stat: 'dailyDone', goal: 10, reward: [{ kind: 'chest', id: 'CRYSTAL', amount: 1 }], xp: 2000 },
];

export const LOGIN_REWARDS: Reward[] = [
  { kind: 'coins', amount: 150 }, { kind: 'pack', id: 'BASIC', amount: 1 }, { kind: 'gems', amount: 20 }, { kind: 'tickets', amount: 1 },
  { kind: 'chest', id: 'SILVER', amount: 1 }, { kind: 'pack', id: 'ELITE', amount: 1 }, { kind: 'chest', id: 'GOLD', amount: 1 },
];

// ---------------- live events ----------------

export interface LiveEventDef {
  id: string; name: string; icon: string; desc: string; faction: FactionId;
  colors: [string, string]; rules: Partial<BattleRules>; ruleText: string;
  missions: QuestDef[]; rewardCosmetics: string[];
}

export const LIVE_EVENTS: LiveEventDef[] = [
  { id: 'cosmic_week', name: 'Cosmic Week', icon: '🌌', faction: 'COSMOS', colors: ['#120a4a', '#ff9af5'],
    desc: 'The stars align: every duel starts with surplus essence.', rules: { startMana: 1, label: 'Cosmic Week' }, ruleText: '+1 Essence every turn.',
    missions: [
      { id: 'e_cw_win', desc: 'Win 3 Event matches', stat: 'eventWins', goal: 3, reward: [{ kind: 'pack', id: 'EVENT', amount: 1 }], xp: 600 },
      { id: 'e_cw_play', desc: 'Play 30 cards in Event matches', stat: 'eventCards', goal: 30, reward: [{ kind: 'tickets', amount: 2 }], xp: 400 },
      { id: 'e_cw_open', desc: 'Open 2 Event packs', stat: 'eventPacks', goal: 2, reward: [{ kind: 'cosmetic', id: 'cb_festival' }], xp: 400 },
    ], rewardCosmetics: ['cb_festival'] },
  { id: 'ember_festival', name: 'Ember Festival', icon: '🔥', faction: 'EMBER', colors: ['#3a0c00', '#ffd04a'],
    desc: 'Lanterns burn in the Caldera — every creature charges into battle.', rules: { allSurge: true, label: 'Ember Festival' }, ruleText: 'All creatures have Surge.',
    missions: [
      { id: 'e_ef_win', desc: 'Win 3 Event matches', stat: 'eventWins', goal: 3, reward: [{ kind: 'pack', id: 'EVENT', amount: 1 }], xp: 600 },
      { id: 'e_ef_play', desc: 'Play 30 cards in Event matches', stat: 'eventCards', goal: 30, reward: [{ kind: 'tickets', amount: 2 }], xp: 400 },
      { id: 'e_ef_open', desc: 'Open 2 Event packs', stat: 'eventPacks', goal: 2, reward: [{ kind: 'cosmetic', id: 'av_mask' }], xp: 400 },
    ], rewardCosmetics: ['av_mask'] },
  { id: 'frozen_realm', name: 'Frozen Realm', icon: '❄️', faction: 'ABYSS', colors: ['#001a33', '#bff4ff'],
    desc: 'Glacier winds chill both heroes — draw deeper to survive.', rules: { extraDraw: 1, heroHp: 25, label: 'Frozen Realm' }, ruleText: 'Draw 2 cards per turn. Heroes start at 25 HP.',
    missions: [
      { id: 'e_fr_win', desc: 'Win 3 Event matches', stat: 'eventWins', goal: 3, reward: [{ kind: 'pack', id: 'EVENT', amount: 1 }], xp: 600 },
      { id: 'e_fr_play', desc: 'Play 30 cards in Event matches', stat: 'eventCards', goal: 30, reward: [{ kind: 'tickets', amount: 2 }], xp: 400 },
      { id: 'e_fr_open', desc: 'Open 2 Event packs', stat: 'eventPacks', goal: 2, reward: [{ kind: 'cosmetic', id: 'cb_festival' }], xp: 400 },
    ], rewardCosmetics: ['cb_festival'] },
  { id: 'void_event', name: 'Void Eclipse', icon: '🌑', faction: 'VOID', colors: ['#0b0014', '#ff4fa0'],
    desc: 'The Hollow bleeds into the arena: both heroes suffer at dawn.', rules: { dawnBurn: 1, label: 'Void Eclipse' }, ruleText: 'Each hero takes 1 damage at the start of their turn.',
    missions: [
      { id: 'e_ve_win', desc: 'Win 3 Event matches', stat: 'eventWins', goal: 3, reward: [{ kind: 'pack', id: 'EVENT', amount: 1 }], xp: 600 },
      { id: 'e_ve_play', desc: 'Play 30 cards in Event matches', stat: 'eventCards', goal: 30, reward: [{ kind: 'tickets', amount: 2 }], xp: 400 },
      { id: 'e_ve_open', desc: 'Open 2 Event packs', stat: 'eventPacks', goal: 2, reward: [{ kind: 'cosmetic', id: 'sx_shadow' }], xp: 400 },
    ], rewardCosmetics: ['sx_shadow'] },
];

// ---------------- XALA pass ----------------

export const PASS_TIERS = 50;
export const PASS_XP_PER_TIER = 1000;
export const PASS_PREMIUM_PRICE = 950; // gems (earnable in-game)

export function passReward(tier: number, premium: boolean): Reward[] {
  // tier is 1-based
  if (!premium) {
    if (tier % 10 === 0) return [{ kind: 'pack', id: 'ELITE', amount: 1 }];
    if (tier % 5 === 0) return [{ kind: 'chest', id: 'SILVER', amount: 1 }];
    if (tier % 2 === 0) return [{ kind: 'pack', id: 'BASIC', amount: 1 }];
    return [{ kind: 'coins', amount: 100 + tier * 5 }];
  }
  const special: Record<number, Reward[]> = {
    1: [{ kind: 'cosmetic', id: 'av_dragon' }],
    10: [{ kind: 'cosmetic', id: 'cb_cosmos' }],
    20: [{ kind: 'cosmetic', id: 'vx_lightning' }],
    30: [{ kind: 'cosmetic', id: 'bd_observatory' }],
    40: [{ kind: 'pack', id: 'SECRET', amount: 1 }],
    50: [{ kind: 'cosmetic', id: 'fr_celestial' }, { kind: 'chest', id: 'CELESTIAL', amount: 1 }],
  };
  if (special[tier]) return special[tier];
  if (tier % 5 === 0) return [{ kind: 'pack', id: 'COSMIC', amount: 1 }];
  if (tier % 3 === 0) return [{ kind: 'pack', id: 'ELITE', amount: 1 }];
  if (tier % 2 === 0) return [{ kind: 'gems', amount: 25 }];
  return [{ kind: 'pack', id: 'BASIC', amount: 1 }, { kind: 'shards', amount: 50 }];
}

// ---------------- ranked ----------------

export const RANK_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster'] as const;
export const RANK_ICONS = ['🥉', '🥈', '🥇', '💠', '💎', '🔮', '👑'];
export const RANK_COLORS = ['#cd7f32', '#c0c8d8', '#ffd24a', '#5fe3d0', '#7ab8ff', '#c07bff', '#ff4f8b'];
// rank index: 0..14 for Bronze III..Diamond I (3 divisions each), 15 = Master, 16 = Grandmaster (17 levels => bestRank goal uses index+1)
export const STARS_PER_DIVISION = 3;
export const MASTER_STARS_TO_GM = 15;

export function rankName(index: number): string {
  if (index >= 16) return 'Grandmaster';
  if (index === 15) return 'Master';
  const tier = Math.floor(index / 3);
  const div = 3 - (index % 3);
  return `${RANK_TIERS[tier]} ${['I', 'II', 'III'][div - 1]}`;
}
export function rankTier(index: number): number { return index >= 16 ? 6 : index === 15 ? 5 : Math.floor(index / 3); }

export function rankDifficulty(index: number): Difficulty {
  if (index < 3) return 'EASY';
  if (index < 6) return 'NORMAL';
  if (index < 10) return 'HARD';
  if (index < 15) return 'EXPERT';
  return 'MASTER';
}

export function seasonRewards(bestIndex: number): Reward[] {
  const tier = rankTier(bestIndex);
  const r: Reward[] = [{ kind: 'coins', amount: 300 + tier * 300 }];
  if (tier >= 1) r.push({ kind: 'pack', id: 'ELITE', amount: tier });
  if (tier >= 3) r.push({ kind: 'gems', amount: tier * 40 });
  if (tier >= 5) r.push({ kind: 'chest', id: 'CELESTIAL', amount: 1 });
  return r;
}

// ---------------- campaign ----------------

export interface CampaignStage { chapter: number; stage: number; name: string; factions: FactionId[]; difficulty: Difficulty; boss: boolean; reward: Reward[]; story: string }

const CH = [
  { set: 'ORI', name: 'Origins', places: ['The First Table', 'Caldera Road', 'Greenveil Gate', 'Lantern Shore', 'Spire Steps', 'The Dealer\'s Throne'], factions: [['EMBER'], ['VERDANT'], ['ABYSS'], ['VOLT'], ['EMBER', 'VERDANT'], ['AETHER', 'TITAN']] },
  { set: 'VRS', name: 'Void Rising', places: ['Ash Crossing', 'Shade Mire', 'Rift Scar', 'Null Cathedral', 'Eclipse Gate', 'Heart of the Hollow'], factions: [['VOID'], ['VOID', 'ABYSS'], ['VOID', 'EMBER'], ['VOLT', 'VOID'], ['VOID', 'TITAN'], ['VOID', 'COSMOS']] },
  { set: 'CLF', name: 'Celestial Frontier', places: ['Lumen Bridge', 'Halo Gardens', 'Orbit Station', 'Comet Trail', 'Zenith Gate', 'The Last Constellation'], factions: [['AETHER'], ['COSMOS'], ['AETHER', 'VOLT'], ['COSMOS', 'ABYSS'], ['AETHER', 'COSMOS'], ['COSMOS', 'VOID']] },
  { set: 'LRL', name: 'Lost Realms', places: ['Cairn Valley', 'Sleeping Peaks', 'Thornmaze', 'Glacier Tomb', 'Storm Crown', 'The Map That Redraws'], factions: [['TITAN'], ['TITAN', 'VERDANT'], ['VERDANT', 'VOID'], ['ABYSS', 'TITAN'], ['VOLT', 'EMBER'], ['TITAN', 'COSMOS']] },
];
const CH_DIFF: Difficulty[][] = [
  ['EASY', 'EASY', 'EASY', 'NORMAL', 'NORMAL', 'NORMAL'],
  ['NORMAL', 'NORMAL', 'HARD', 'HARD', 'HARD', 'HARD'],
  ['HARD', 'HARD', 'EXPERT', 'EXPERT', 'EXPERT', 'EXPERT'],
  ['EXPERT', 'EXPERT', 'MASTER', 'MASTER', 'MASTER', 'MASTER'],
];

export const CAMPAIGN: CampaignStage[] = CH.flatMap((ch, ci) => ch.places.map((place, si) => ({
  chapter: ci + 1, stage: si + 1, name: place, factions: ch.factions[si] as FactionId[], difficulty: CH_DIFF[ci][si], boss: si === 5,
  story: si === 5 ? `The guardian of ${ch.name} awaits. Defeat them to unseal the next realm.` : `A duelist blocks the road at ${place}.`,
  reward: si === 5
    ? [{ kind: 'pack', id: 'ELITE', amount: 1 }, { kind: 'gems', amount: 50 + ci * 25 }] as Reward[]
    : [{ kind: 'coins', amount: 150 + ci * 75 + si * 20 }, ...(si % 2 === 1 ? [{ kind: 'pack', id: 'BASIC', amount: 1 } as Reward] : [])],
})));

// ---------------- tournament ----------------
export const TOURNAMENT_ROUNDS = 3; // 8-player bracket
export const TOURNAMENT_ENTRY = { tickets: 1 };
export const TOURNAMENT_REWARDS: Reward[][] = [
  [{ kind: 'coins', amount: 100 }],
  [{ kind: 'coins', amount: 250 }, { kind: 'pack', id: 'BASIC', amount: 1 }],
  [{ kind: 'coins', amount: 500 }, { kind: 'pack', id: 'ELITE', amount: 1 }],
  [{ kind: 'gems', amount: 80 }, { kind: 'pack', id: 'ELITE', amount: 2 }, { kind: 'chest', id: 'CRYSTAL', amount: 1 }],
];
