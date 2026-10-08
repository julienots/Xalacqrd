// Game root: owns the player data and wires every system together.

import { EventBus } from '../core/events';
import type { Reward } from '../data/content';
import { AudioSystem } from './AudioSystem';
import { BoosterSystem } from './BoosterSystem';
import { CardSystem } from './CardSystem';
import { CollectionSystem } from './CollectionSystem';
import { buildAIDeck } from './CombatAI';
import type { Ctx } from './context';
import { DeckSystem } from './DeckSystem';
import { EconomySystem } from './EconomySystem';
import { EventSystem } from './EventSystem';
import { HapticsSystem } from './HapticsSystem';
import { InventorySystem } from './InventorySystem';
import { Monetization } from './Monetization';
import { ProfileSystem } from './ProfileSystem';
import { ProgressionSystem, type MatchOutcome } from './ProgressionSystem';
import { QuestSystem } from './QuestSystem';
import { SaveSystem, type StorageAdapter, LocalStorageAdapter } from './SaveSystem';
import { ShopSystem } from './ShopSystem';
import { defaultData, migrate, type PlayerData } from './state';

export interface MatchStats { cardsPlayed: number; actionsPlayed: number; damageDealt: number; creaturesKilled: number; damageTaken: number; turns: number }

export class Game implements Ctx {
  data: PlayerData = defaultData();
  readonly bus = new EventBus();
  readonly cards = new CardSystem();
  readonly save: SaveSystem<PlayerData>;
  readonly inventory: InventorySystem;
  readonly collection: CollectionSystem;
  readonly economy: EconomySystem;
  readonly boosters: BoosterSystem;
  readonly decks: DeckSystem;
  readonly quests: QuestSystem;
  readonly events: EventSystem;
  readonly progression: ProgressionSystem;
  readonly shop: ShopSystem;
  readonly monetization: Monetization;
  readonly profile: ProfileSystem;
  readonly audio = new AudioSystem();
  readonly haptics = new HapticsSystem();
  private listeners = new Set<() => void>();
  isNewPlayer = false;

  constructor(storage: StorageAdapter = new LocalStorageAdapter()) {
    this.save = new SaveSystem<PlayerData>(storage, migrate);
    this.inventory = new InventorySystem(this);
    this.collection = new CollectionSystem(this);
    this.economy = new EconomySystem(this, this.inventory, this.collection);
    this.boosters = new BoosterSystem(this, this.inventory, this.collection);
    this.decks = new DeckSystem(this, this.collection);
    this.quests = new QuestSystem(this, this.economy);
    this.events = new EventSystem(this, this.economy);
    this.progression = new ProgressionSystem(this, this.economy, this.collection);
    this.shop = new ShopSystem(this, this.economy, this.inventory);
    this.monetization = new Monetization(this, this.economy);
    this.profile = new ProfileSystem(this, this.collection);
    this.economy.progression = this.progression;
    this.quests.addXp = (n) => this.progression.addXp(n);
    this.events.addXp = (n) => this.progression.addXp(n);
  }

  async load(): Promise<void> {
    const loaded = await this.save.load();
    if (loaded) this.data = loaded;
    else { this.data = defaultData(); this.isNewPlayer = true; this.grantStarterCollection(); }
    this.applySettings();
    this.dailyRefresh();
    await this.save.flush(this.data);
  }

  dailyRefresh() {
    this.quests.refresh();
    this.progression.ensurePassSeason();
    const seasonRewards = this.progression.ensureRankedSeason();
    if (seasonRewards) this.pendingSeasonRewards = seasonRewards;
    this.progression.checkAchievements();
  }
  pendingSeasonRewards: Reward[] | null = null;

  applySettings() {
    const s = this.data.settings;
    this.audio.setVolumes(s.sfx, s.music);
    this.haptics.enabled = s.haptics;
  }

  /** New players receive a playable starter collection and two ready decks. */
  grantStarterCollection() {
    const pool = this.cards.bySet('ORI');
    const decks: [string, string[]][] = [
      ['Ember Blitz', buildAIDeck(pool, { factions: ['EMBER', 'VOLT'], maxRarity: 'RARE', seed: 11 })],
      ['Verdant Wall', buildAIDeck(pool, { factions: ['VERDANT', 'TITAN'], maxRarity: 'RARE', seed: 12 })],
    ];
    for (const [, ids] of decks) {
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [id, n] of counts) {
        const c = this.cards.get(id);
        while (this.collection.total(id) < n) this.collection.add(c, 'NORMAL', { silent: true });
        this.data.collection[id].isNew = false;
      }
    }
    for (const [name, ids] of decks) this.decks.create(name, ids);
    this.data.activeDeck = this.data.decks[0]?.id ?? null;
  }

  // ---------- Ctx ----------
  changed() {
    this.save.schedule(() => this.data);
    for (const l of this.listeners) l();
  }
  stat(key: string, delta = 1) {
    this.data.stats[key] = (this.data.stats[key] ?? 0) + delta;
  }
  onChange(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  // ---------- matches ----------
  recordMatch(o: MatchOutcome & { eventMatch?: boolean }, ms: MatchStats): Reward[] {
    this.stat('matches');
    this.stat(o.won ? 'wins' : 'losses');
    this.stat('cardsPlayed', ms.cardsPlayed);
    this.stat('actionsPlayed', ms.actionsPlayed);
    this.stat('damageDealt', ms.damageDealt);
    this.stat('creaturesKilled', ms.creaturesKilled);
    if (o.won && ms.damageTaken === 0) { this.stat('perfectWins'); o.perfect = true; }
    if (o.won && o.difficulty === 'MASTER') this.stat('masterWins');
    if (o.mode === 'ranked' && o.won) this.stat('rankedWins');
    if (o.mode === 'event') { this.stat('eventCards', ms.cardsPlayed); if (o.won) this.stat('eventWins'); }
    if (o.tournamentWin) this.stat('tournamentsWon');
    this.data.tutorial.firstBattle = true;
    this.bus.emit({ type: 'matchEnd', mode: o.mode, won: o.won, perfect: o.perfect, turns: ms.turns, damageDealt: ms.damageDealt, cardsPlayed: ms.cardsPlayed });
    const rewards = this.progression.matchRewards(o);
    this.changed();
    return rewards;
  }

  async resetAll() {
    await this.save.wipe();
    this.data = defaultData();
    this.grantStarterCollection();
    this.dailyRefresh();
    await this.save.flush(this.data);
    this.changed();
  }
}
