// Shared domain types for XALACARDS.

export type FactionId = 'EMBER' | 'VERDANT' | 'ABYSS' | 'VOLT' | 'VOID' | 'AETHER' | 'TITAN' | 'COSMOS';

export type CardType = 'creature' | 'action' | 'equipment' | 'terrain' | 'relic' | 'champion';

export type Rarity =
  | 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
  | 'MYTHIC' | 'ANCIENT' | 'CELESTIAL' | 'SECRET' | 'PRISMATIC';

export type Finish = 'NORMAL' | 'FOIL' | 'HOLOGRAPHIC' | 'COSMIC' | 'PRISM' | 'GOLD' | 'SECRET' | 'SIGNATURE';

export type Keyword = 'bulwark' | 'surge' | 'siphon' | 'volley' | 'veil' | 'blight' | 'frenzy' | 'aegis' | 'rekindle';

export type Trigger = 'play' | 'death' | 'dawn' | 'dusk' | 'attack';

export type ActionKind =
  | 'damage' | 'heal' | 'buff' | 'draw' | 'mana' | 'summon' | 'destroy'
  | 'freeze' | 'shield' | 'grant' | 'armor' | 'bounce';

export type TargetKind =
  | 'chooseEnemy'      // enemy creature or hero, chosen
  | 'chooseEnemyUnit'  // enemy creature, chosen
  | 'chooseAlly'       // allied creature, chosen
  | 'chooseAny'        // any creature or hero, chosen
  | 'randomEnemy'      // random enemy creature (or hero if none)
  | 'allEnemies'       // all enemy creatures
  | 'allEnemyAll'      // all enemy creatures + enemy hero
  | 'allAllies'        // all allied creatures
  | 'allCreatures'
  | 'self'
  | 'enemyHero'
  | 'ownHero'
  | 'randomAlly'
  | 'none';

export interface Effect {
  trigger: Trigger;
  action: ActionKind;
  target: TargetKind;
  amount?: number;   // damage/heal/atk/draw/mana/def
  amount2?: number;  // hp for buffs
  keyword?: Keyword;
  token?: string;    // card id of token for summon
  count?: number;    // number of tokens
}

export interface Aura {
  atk: number;
  hp: number;
  def: number;
  faction?: FactionId; // limit to faction
}

export interface ArtSpec {
  seed: number;
  archetype: string;     // creature archetype / object kind
  hue: number;           // primary hue
  hue2: number;          // secondary hue
}

export interface CardDef {
  id: string;            // e.g. ORI-001
  set: string;           // set code
  num: number;           // collection number in set
  name: string;
  type: CardType;
  faction: FactionId;
  rarity: Rarity;
  cost: number;
  attack: number;
  defense: number;
  hp: number;
  keywords: Keyword[];
  effects: Effect[];
  aura?: Aura;           // terrain / relic / champion continuous effect
  equip?: { atk: number; hp: number; def: number; keyword?: Keyword };
  text: string;          // rules text (generated)
  flavor: string;        // description / lore
  level: number;         // 1..5 power tier
  anim: string;          // summon animation key
  model?: string;        // 3D model key (creatures that materialize in 3D)
  finishes: Finish[];    // finishes this card can be pulled in
  art: ArtSpec;
  token?: boolean;       // tokens are not collectible
  signature?: string;    // signature text for SIGNATURE finish
}

export interface SetDef {
  code: string;
  name: string;
  index: number;
  size: number;
  hue: number;
  accent: string;
  motto: string;
  symbol: string;   // glyph used as set symbol
  released: boolean;
}

export interface FactionDef {
  id: FactionId;
  name: string;
  icon: string;
  color: string;
  color2: string;
  hue: number;
  hue2: number;
  strategy: string;
  lore: string;
  archetypes: string[];
}
