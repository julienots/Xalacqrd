import type { FactionId } from '../core/types';

// Original vocabulary for procedural naming. Every combination is checked for
// uniqueness by the card generator.

export const ADJ: Record<FactionId, string[]> = {
  EMBER: ['Cinder', 'Pyre', 'Ashen', 'Scorch', 'Blaze', 'Kiln', 'Magma', 'Flare', 'Smolder', 'Searing', 'Ignis', 'Brand', 'Furnace', 'Ember', 'Molten', 'Sunforged'],
  VERDANT: ['Moss', 'Thorn', 'Bloom', 'Briar', 'Fern', 'Rootbound', 'Sap', 'Wildwood', 'Pollen', 'Grove', 'Ivy', 'Lichen', 'Willow', 'Canopy', 'Seedling', 'Greenveil'],
  ABYSS: ['Tide', 'Brine', 'Drowned', 'Coral', 'Fathom', 'Kelp', 'Riptide', 'Pearl', 'Undertow', 'Lantern', 'Deepwater', 'Frost', 'Glacial', 'Mist', 'Shoal', 'Hollowtide'],
  VOLT: ['Static', 'Storm', 'Arc', 'Thunder', 'Galvanic', 'Spark', 'Surge', 'Ion', 'Pulse', 'Zephyr', 'Tempest', 'Charged', 'Flicker', 'Skyrail', 'Bolt', 'Ozone'],
  VOID: ['Hollow', 'Umbral', 'Gloom', 'Null', 'Wraith', 'Dusk', 'Shade', 'Rift', 'Eclipse', 'Grim', 'Nether', 'Whisper', 'Veiled', 'Ruin', 'Abyssal', 'Ashbone'],
  AETHER: ['Lumen', 'Dawn', 'Radiant', 'Halo', 'Gleam', 'Seraph', 'Sky', 'Bright', 'Gilded', 'Solace', 'Clarion', 'Aurora', 'Haloed', 'Sunlit', 'Vesper', 'Choir'],
  TITAN: ['Granite', 'Basalt', 'Boulder', 'Iron', 'Obsidian', 'Bedrock', 'Quarry', 'Cliff', 'Monolith', 'Slate', 'Marble', 'Ridge', 'Cairn', 'Bastion', 'Deepstone', 'Crag'],
  COSMOS: ['Astral', 'Nebula', 'Stellar', 'Comet', 'Orbit', 'Zenith', 'Quasar', 'Starlit', 'Lunar', 'Void-Star', 'Celestine', 'Pulsar', 'Meteor', 'Galactic', 'Equinox', 'Parallax'],
};

export const ARCH_NOUNS: Record<string, string[]> = {
  drake: ['Drake', 'Wyrmling', 'Wyvern', 'Dragon', 'Hatchling', 'Skyfang', 'Wyrm', 'Drakon', 'Scalewing', 'Broodmother', 'Firstwing', 'Crestdrake'],
  beast: ['Hound', 'Stag', 'Lynx', 'Boar', 'Ram', 'Wolf', 'Prowler', 'Bison', 'Panther', 'Strider', 'Howler', 'Tusker'],
  elemental: ['Elemental', 'Wisp', 'Sprite', 'Vortex', 'Shard', 'Storm-heart', 'Avatar', 'Essence', 'Kindling', 'Maelstrom', 'Spark', 'Flux'],
  knight: ['Knight', 'Warden', 'Sentinel', 'Vanguard', 'Lancer', 'Duelist', 'Paladin', 'Templar', 'Outrider', 'Captain', 'Squire', 'Marshal'],
  serpent: ['Serpent', 'Eel', 'Naga', 'Viper', 'Coil', 'Leviathan', 'Basilisk', 'Asp', 'Sea-snake', 'Slither', 'Hydra', 'Lamprey'],
  golem: ['Golem', 'Colossus', 'Behemoth', 'Juggernaut', 'Monolith', 'Treant', 'Guardian', 'Hulk', 'Titan', 'Bulwark', 'Effigy', 'Statue'],
  insect: ['Mantis', 'Beetle', 'Swarm', 'Moth', 'Scarab', 'Hornet', 'Locust', 'Weaver', 'Cicada', 'Firefly', 'Stinger', 'Chrysalis'],
  spirit: ['Spirit', 'Phantom', 'Shade', 'Specter', 'Wraith', 'Seraph', 'Banshee', 'Revenant', 'Apparition', 'Echo', 'Familiar', 'Will-o'],
  construct: ['Automaton', 'Engine', 'Sentry', 'Drone', 'Mech', 'Turret', 'Clockwork', 'Servitor', 'Dynamo', 'Gyre', 'Frame', 'Matrix'],
  mage: ['Seer', 'Oracle', 'Magus', 'Astromancer', 'Hexer', 'Scribe', 'Acolyte', 'Invoker', 'Sage', 'Cartographer', 'Mystic', 'Chanter'],
};

export const ACTION_NOUNS = ['Burst', 'Volley', 'Rite', 'Surge', 'Hex', 'Tide', 'Edict', 'Blessing', 'Ruin', 'Ritual', 'Command', 'Rupture', 'Torrent', 'Ward', 'Call', 'Gambit', 'Requiem', 'Spiral', 'Verdict', 'Uprising', 'Cascade', 'Nova'];
export const EQUIP_NOUNS = ['Blade', 'Aegis', 'Gauntlet', 'Crown', 'Lance', 'Mantle', 'Talisman', 'Helm', 'Bracers', 'Banner', 'Scepter', 'Greaves', 'Pendant', 'Hammer', 'Bow', 'Cloak'];
export const TERRAIN_PLACES: Record<FactionId, string[]> = {
  EMBER: ['Caldera', 'Forge-Fields', 'Ashlands', 'Kiln Gate', 'Lava Steppe', 'Cinder Throne'],
  VERDANT: ['Greenveil', 'Rootmind Hollow', 'Bloomfall Vale', 'Elder Canopy', 'Thornmaze', 'Seedvault'],
  ABYSS: ['Drowned Lanterns', 'Pale Reef', 'Frostmere', 'Sunken Choir', 'Kelp Cathedral', 'Glacier Tomb'],
  VOLT: ['Static Spires', 'Thunder Plateau', 'Skyrail Docks', 'Ion Steppes', 'Storm Crown', 'Arc Foundry'],
  VOID: ['Hollow Expanse', 'Eclipse Gate', 'Shade Mire', 'Null Cathedral', 'Rift Scar', 'Ashbone Fields'],
  AETHER: ['Lumen Bridge', 'Dawn Sanctum', 'Halo Gardens', 'Seraph Spire', 'Clarion Steps', 'Aurora Terrace'],
  TITAN: ['Granite Bastion', 'Sleeping Peaks', 'Quarry Deep', 'Monolith Ring', 'Bedrock Hall', 'Cairn Valley'],
  COSMOS: ['Star Observatory', 'Nebula Sea', 'Orbit Station', 'Zenith Gate', 'Comet Trail', 'Meridian Vault'],
};
export const TERRAIN_PREFIX = ['', 'Burning ', 'Ancient ', 'Hidden ', 'Shattered ', 'Eternal ', 'Lost ', 'Silent '];

export const RELIC_OBJECTS = ['Heart', 'Lantern', 'Codex', 'Crown', 'Prism', 'Hourglass', 'Chalice', 'Compass', 'Seed', 'Eye', 'Mirror', 'Bell', 'Orb', 'Key', 'Astrolabe', 'Sigil'];

// Syllables for champion names (invented).
export const SYL: Record<FactionId, [string[], string[]]> = {
  EMBER: [['Kae', 'Vor', 'Siz', 'Ign', 'Pyr', 'Ash', 'Bra', 'Cal'], ['lith', 'run', 'ra', 'atz', 'eon', 'wyn', 'dor', 'vex']],
  VERDANT: [['Syl', 'Bri', 'Thal', 'Oro', 'Fen', 'Lio', 'Mer', 'Ama'], ['wen', 'ara', 'dris', 'mos', 'ielle', 'thorn', 'gru', 'la']],
  ABYSS: [['Nai', 'Mar', 'Ondi', 'Pel', 'Ys', 'Cor', 'Thal', 'Neri'], ['ra', 'ussa', 'ne', 'agra', 'olde', 'vin', 'assa', 'ith']],
  VOLT: [['Zek', 'Vol', 'Tes', 'Ari', 'Jax', 'Kir', 'Rai', 'Fyn'], ['ra', 'tane', 'sio', 'ka', 'enn', 'tor', 'ix', 'dell']],
  VOID: [['Mor', 'Xyl', 'Nyx', 'Ves', 'Zhal', 'Umb', 'Cael', 'Drev'], ['akai', 'oth', 'ara', 'per', 'eth', 'riel', 'ion', 'ane']],
  AETHER: [['Ael', 'Sera', 'Lum', 'Cel', 'Orie', 'Hel', 'Ili', 'Sol'], ['ys', 'phine', 'ara', 'estin', 'lle', 'ion', 'ane', 'ace']],
  TITAN: [['Gor', 'Bram', 'Kord', 'Ulm', 'Tor', 'Grun', 'Hald', 'Oss'], ['ak', 'bolt', 'rek', 'dan', 'gar', 'mund', 'rik', 'veld']],
  COSMOS: [['Ast', 'Ori', 'Vel', 'Lyr', 'Cas', 'Zen', 'Nov', 'Elu'], ['eria', 'on', 'ara', 'ix', 'sia', 'ith', 'ella', 'ion']],
};

export const CHAMPION_TITLES: Record<FactionId, string[]> = {
  EMBER: ['Pyre Regent', 'the Ash-Crowned', 'Emberwake', 'Flarewright', 'Kiln Matriarch', 'Last Spark', 'Caldera Queen', 'Furnace Lord'],
  VERDANT: ['Voice of Roots', 'the Evergrowing', 'Bloom Warden', 'Thornmother', 'First Sapling', 'Grove Keeper', 'Wildheart', 'the Patient Storm'],
  ABYSS: ['Pale Chorister', 'Tide Sovereign', 'the Drowned Saint', 'Lantern Bearer', 'Frost Oracle', 'Deep Cartographer', 'Undertow Queen', 'the Still Sea'],
  VOLT: ['Storm Rider', 'the Living Arc', 'Spire Captain', 'Skyrail Ace', 'Tempest Heir', 'Thunder Herald', 'the Unblinking', 'Ion Duelist'],
  VOID: ['the Hollow King', 'Rift Walker', 'Eclipse Widow', 'Null Prophet', 'the Unremembered', 'Shade Sovereign', 'Echo Thief', 'Ashbone Lich'],
  AETHER: ['Lumen Archon', 'Dawnbringer', 'the Bright Wing', 'Synod Voice', 'Halo Knight', 'Bridgekeeper', 'Seraph Prime', 'the Unfading'],
  TITAN: ['Mountain Heart', 'the Waking Peak', 'Quarry King', 'Bedrock Sentinel', 'Stone Chancellor', 'the Unmoved', 'Cairn Father', 'Bastion Lord'],
  COSMOS: ['Star Cartographer', 'the Fatebinder', 'Orbit Sage', 'Nebula Empress', 'Comet Chaser', 'the Last Constellation', 'Zenith Keeper', 'Meridian Oracle'],
};

export const FLAVOR: Record<FactionId, string[]> = {
  EMBER: [
    'It does not burn the forest. It remembers it.',
    '"Every forge-song ends in a roar."',
    'Its footprints stay warm for a hundred years.',
    'The Caldera Crown sends its bravest first — and its hottest.',
    'Ash is just fire taking a breath.',
    'Sparks follow it like loyal hounds.',
  ],
  VERDANT: [
    'The Rootmind is patient. The Rootmind is everywhere.',
    'Where it walks, spring forgets to leave.',
    '"Cut one stem and three will answer."',
    'Its bark is etched with every storm it has outlived.',
    'Pollen drifts in slow constellations around it.',
    'The Greenveil grows a little greener each night.',
  ],
  ABYSS: [
    'Sailors hear its song a heartbeat too late.',
    'The Pale Choir never sings the same tide twice.',
    'It sleeps beneath the ice, counting drowned stars.',
    '"Silence is a current. Learn to swim in it."',
    'Lanterns sink. Lanterns do not go out.',
    'Cold enough to freeze a thought mid-sentence.',
  ],
  VOLT: [
    'It arrives before its own thunder.',
    '"Ride the current or be the ground."',
    'The Static Spires hum its name at night.',
    'Each heartbeat is a lightning strike.',
    'The sky-current bends toward the bold.',
    'Blink, and the duel is already over.',
  ],
  VOID: [
    'Some echoes answer back.',
    'The map ends here. It does not.',
    '"What the Hollow takes, it keeps as a memory."',
    'Its shadow arrives a moment before it does.',
    'Even light forgets which way to go near it.',
    'Every ending is a door it already opened.',
  ],
  AETHER: [
    'Its wings are woven from the first light of morning.',
    '"Stand behind me. Stand in the light."',
    'The Lumen Synod lights one candle for every soul it saves.',
    'Where it hovers, shadows apologise.',
    'A hymn you feel rather than hear.',
    'The sky-bridges never fall while it keeps watch.',
  ],
  TITAN: [
    'It woke up once. The valley is still shaped like it.',
    '"Patience is just strength that has not moved yet."',
    'Moss grows on its shoulders in a single afternoon.',
    'Mountains bow — slowly — when it passes.',
    'Its heartbeat registers as an earthquake.',
    'Built to outlast the kingdoms that carved it.',
  ],
  COSMOS: [
    'It reads tomorrow in the dust between stars.',
    '"Fate is a map. I simply hold the pen."',
    'Born when a constellation blinked.',
    'Its eyes hold two galaxies, gently colliding.',
    'Gravity is merely a suggestion it rarely accepts.',
    'The sky rearranges itself to watch it fight.',
  ],
};
