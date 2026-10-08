import type { Finish, Rarity } from '../core/types';

export interface RarityDef {
  id: Rarity;
  name: string;
  tier: number;          // 0..9
  color: string;
  glow: string;
  maxCopies: number;     // deck limit
  shardValue: number;    // shards gained when a duplicate exceeds the playset
  craftCost: number;     // shards needed to craft
  reveal: 'quick' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'ancient' | 'celestial' | 'secret' | 'prismatic';
  haptic: 'none' | 'light' | 'medium' | 'heavy';
}

export const RARITIES: Record<Rarity, RarityDef> = {
  COMMON:    { id: 'COMMON',    name: 'Common',    tier: 0, color: '#b8c0cc', glow: '#ffffff', maxCopies: 3, shardValue: 5,    craftCost: 40,    reveal: 'quick',     haptic: 'none' },
  UNCOMMON:  { id: 'UNCOMMON',  name: 'Uncommon',  tier: 1, color: '#5ee08a', glow: '#8affb0', maxCopies: 3, shardValue: 10,   craftCost: 100,   reveal: 'quick',     haptic: 'light' },
  RARE:      { id: 'RARE',      name: 'Rare',      tier: 2, color: '#4aa8ff', glow: '#8fd0ff', maxCopies: 2, shardValue: 25,   craftCost: 250,   reveal: 'rare',      haptic: 'light' },
  EPIC:      { id: 'EPIC',      name: 'Epic',      tier: 3, color: '#b45cff', glow: '#d9a6ff', maxCopies: 2, shardValue: 60,   craftCost: 600,   reveal: 'epic',      haptic: 'medium' },
  LEGENDARY: { id: 'LEGENDARY', name: 'Legendary', tier: 4, color: '#ffb52e', glow: '#ffe08a', maxCopies: 1, shardValue: 200,  craftCost: 1600,  reveal: 'legendary', haptic: 'medium' },
  MYTHIC:    { id: 'MYTHIC',    name: 'Mythic',    tier: 5, color: '#ff4f8b', glow: '#ff9ac0', maxCopies: 1, shardValue: 300,  craftCost: 2400,  reveal: 'mythic',    haptic: 'heavy' },
  ANCIENT:   { id: 'ANCIENT',   name: 'Ancient',   tier: 6, color: '#3de0c8', glow: '#9dfff0', maxCopies: 1, shardValue: 400,  craftCost: 3200,  reveal: 'ancient',   haptic: 'heavy' },
  CELESTIAL: { id: 'CELESTIAL', name: 'Celestial', tier: 7, color: '#c9e4ff', glow: '#ffffff', maxCopies: 1, shardValue: 500,  craftCost: 4000,  reveal: 'celestial', haptic: 'heavy' },
  SECRET:    { id: 'SECRET',    name: 'Secret',    tier: 8, color: '#ff2e2e', glow: '#ffb0b0', maxCopies: 1, shardValue: 800,  craftCost: 6400,  reveal: 'secret',    haptic: 'heavy' },
  PRISMATIC: { id: 'PRISMATIC', name: 'Prismatic', tier: 9, color: '#ffffff', glow: '#ffffff', maxCopies: 1, shardValue: 1000, craftCost: 8000,  reveal: 'prismatic', haptic: 'heavy' },
};

export const RARITY_ORDER: Rarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'ANCIENT', 'CELESTIAL', 'SECRET', 'PRISMATIC'];

export const rarityTier = (r: Rarity) => RARITIES[r].tier;

export interface FinishDef {
  id: Finish;
  name: string;
  tier: number;
  desc: string;
  shardBonus: number; // multiplier for duplicate shards
}

export const FINISHES: Record<Finish, FinishDef> = {
  NORMAL:      { id: 'NORMAL',      name: 'Normal',      tier: 0, desc: 'Standard print.', shardBonus: 1 },
  FOIL:        { id: 'FOIL',        name: 'Foil',        tier: 1, desc: 'Metallic sheen that follows the light.', shardBonus: 1.5 },
  HOLOGRAPHIC: { id: 'HOLOGRAPHIC', name: 'Holographic', tier: 2, desc: 'Rainbow interference pattern.', shardBonus: 2 },
  GOLD:        { id: 'GOLD',        name: 'Gold',        tier: 3, desc: 'Gilded metallic frame.', shardBonus: 2.5 },
  COSMIC:      { id: 'COSMIC',      name: 'Cosmic',      tier: 4, desc: 'Animated starfield beneath the art.', shardBonus: 3 },
  PRISM:       { id: 'PRISM',       name: 'Prism',       tier: 5, desc: 'Prismatic refraction across the card.', shardBonus: 3.5 },
  SIGNATURE:   { id: 'SIGNATURE',   name: 'Signature',   tier: 6, desc: 'Signed by the character themself.', shardBonus: 4 },
  SECRET:      { id: 'SECRET',      name: 'Secret',      tier: 7, desc: 'Black-ink print with a hidden animation.', shardBonus: 5 },
};

export const FINISH_ORDER: Finish[] = ['NORMAL', 'FOIL', 'HOLOGRAPHIC', 'GOLD', 'COSMIC', 'PRISM', 'SIGNATURE', 'SECRET'];
