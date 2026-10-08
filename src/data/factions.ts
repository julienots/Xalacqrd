import type { FactionDef, FactionId } from '../core/types';

export const FACTIONS: Record<FactionId, FactionDef> = {
  EMBER: {
    id: 'EMBER', name: 'Ember', icon: '🔥', color: '#ff6a2b', color2: '#ffd04a', hue: 18, hue2: 45,
    strategy: 'Aggression — burn damage, Surge creatures and fast finishes.',
    lore: 'Forge-clans of the Caldera Crown who believe every flame remembers the first spark of Xala.',
    archetypes: ['drake', 'beast', 'elemental', 'knight', 'serpent'],
  },
  VERDANT: {
    id: 'VERDANT', name: 'Verdant', icon: '🌿', color: '#4fd06b', color2: '#c6ff7a', hue: 130, hue2: 80,
    strategy: 'Growth — buffs, healing and wide boards that snowball.',
    lore: 'The Rootmind spans the Greenveil; its wardens speak through bark, pollen and patient thunder.',
    archetypes: ['beast', 'golem', 'insect', 'spirit', 'serpent'],
  },
  ABYSS: {
    id: 'ABYSS', name: 'Abyss', icon: '🌊', color: '#2fa8ff', color2: '#7af5ff', hue: 200, hue2: 180,
    strategy: 'Control — freeze, card draw and bouncing threats back.',
    lore: 'Below the Drowned Lanterns lies a sea that dreams. Its tides answer only to the Pale Choir.',
    archetypes: ['serpent', 'beast', 'spirit', 'elemental', 'insect'],
  },
  VOLT: {
    id: 'VOLT', name: 'Volt', icon: '⚡', color: '#ffe23a', color2: '#7ad7ff', hue: 52, hue2: 195,
    strategy: 'Tempo — Volley strikes, Frenzy and lightning-fast trades.',
    lore: 'Storm-riders of the Static Spires harness the sky-current that hums beneath every cloud.',
    archetypes: ['construct', 'beast', 'elemental', 'knight', 'insect'],
  },
  VOID: {
    id: 'VOID', name: 'Void', icon: '🌑', color: '#a15cff', color2: '#ff4fa0', hue: 275, hue2: 320,
    strategy: 'Attrition — Blight, destruction and value from death.',
    lore: 'Where the map ends, the Hollow begins. Those who return bring back things that should not echo.',
    archetypes: ['spirit', 'serpent', 'insect', 'mage', 'drake'],
  },
  AETHER: {
    id: 'AETHER', name: 'Aether', icon: '✨', color: '#fff3b0', color2: '#9fe8ff', hue: 50, hue2: 190,
    strategy: 'Protection — Aegis shields, healing and resilient creatures.',
    lore: 'The Lumen Synod keeps the sky-bridges lit. Their wings are woven from dawn itself.',
    archetypes: ['spirit', 'knight', 'mage', 'construct', 'drake'],
  },
  TITAN: {
    id: 'TITAN', name: 'Titan', icon: '🪨', color: '#c8935a', color2: '#e6d3b0', hue: 30, hue2: 40,
    strategy: 'Fortress — high defense, Bulwark walls and crushing late game.',
    lore: 'The mountain-born sleep for centuries. When the Titans wake, continents are rearranged.',
    archetypes: ['golem', 'beast', 'knight', 'construct', 'elemental'],
  },
  COSMOS: {
    id: 'COSMOS', name: 'Cosmos', icon: '🌌', color: '#6a7bff', color2: '#ff9af5', hue: 235, hue2: 300,
    strategy: 'Ramp — extra mana, huge spells and star-born giants.',
    lore: 'Star-cartographers who read fate in constellations — and occasionally rewrite them.',
    archetypes: ['mage', 'spirit', 'drake', 'construct', 'elemental'],
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];
