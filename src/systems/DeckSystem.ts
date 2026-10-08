import type { CardDef, CardType, FactionId } from '../core/types';
import { RARITIES } from '../data/rarities';
import type { CollectionSystem } from './CollectionSystem';
import type { Ctx } from './context';
import type { Deck } from './state';
import { buildAIDeck } from './CombatAI';

export const DECK_SIZE = 30;
export const MAX_DECKS = 20;

export interface DeckStats {
  count: number; avgCost: number; curve: number[]; types: Record<CardType, number>; factions: Partial<Record<FactionId, number>>;
  creatures: number; avgAttack: number; avgHp: number;
}

export class DeckSystem {
  constructor(private ctx: Ctx, private collection: CollectionSystem) {}

  get decks() { return this.ctx.data.decks; }
  get(id: string) { return this.decks.find((d) => d.id === id); }

  maxCopies(card: CardDef) { return RARITIES[card.rarity].maxCopies; }

  create(name = 'New Deck', cards: string[] = []): Deck | null {
    if (this.decks.length >= MAX_DECKS) return null;
    const d: Deck = { id: `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, name: name.slice(0, 24), cards: [...cards], created: Date.now(), updated: Date.now() };
    this.decks.push(d);
    if (!this.ctx.data.activeDeck) this.ctx.data.activeDeck = d.id;
    this.ctx.changed();
    return d;
  }
  rename(id: string, name: string) { const d = this.get(id); if (d) { d.name = name.trim().slice(0, 24) || d.name; d.updated = Date.now(); this.ctx.changed(); } }
  remove(id: string) {
    this.ctx.data.decks = this.decks.filter((d) => d.id !== id);
    if (this.ctx.data.activeDeck === id) this.ctx.data.activeDeck = this.ctx.data.decks[0]?.id ?? null;
    this.ctx.changed();
  }
  duplicate(id: string) { const d = this.get(id); return d ? this.create(`${d.name} (copy)`.slice(0, 24), d.cards) : null; }
  setActive(id: string) { if (this.get(id)) { this.ctx.data.activeDeck = id; this.ctx.changed(); } }
  active(): Deck | undefined { return this.get(this.ctx.data.activeDeck ?? '') ?? this.decks.find((d) => this.validate(d).length === 0); }

  copiesIn(deck: Deck, id: string) { return deck.cards.filter((x) => x === id).length; }

  canAdd(deck: Deck, card: CardDef): string | null {
    if (card.token) return 'Tokens cannot be added';
    if (deck.cards.length >= DECK_SIZE) return `Deck is full (${DECK_SIZE})`;
    const inDeck = this.copiesIn(deck, card.id);
    if (inDeck >= this.maxCopies(card)) return `Max ${this.maxCopies(card)} copies of a ${RARITIES[card.rarity].name}`;
    if (inDeck >= this.collection.total(card.id)) return 'You do not own enough copies';
    return null;
  }
  add(deck: Deck, card: CardDef): boolean {
    if (this.canAdd(deck, card)) return false;
    deck.cards.push(card.id);
    deck.updated = Date.now();
    this.ctx.changed();
    return true;
  }
  removeCard(deck: Deck, id: string): boolean {
    const i = deck.cards.lastIndexOf(id);
    if (i < 0) return false;
    deck.cards.splice(i, 1);
    deck.updated = Date.now();
    this.ctx.changed();
    return true;
  }
  save(deck: Deck) {
    deck.updated = Date.now();
    this.ctx.stat('decksSaved');
    this.ctx.bus.emit({ type: 'deckSaved' });
    this.ctx.changed();
  }

  validate(deck: Deck): string[] {
    const errs: string[] = [];
    if (deck.cards.length !== DECK_SIZE) errs.push(`Deck needs exactly ${DECK_SIZE} cards (${deck.cards.length}).`);
    const counts = new Map<string, number>();
    for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, n] of counts) {
      if (!this.ctx.cards.has(id)) { errs.push(`Unknown card ${id}.`); continue; }
      const c = this.ctx.cards.get(id);
      if (n > this.maxCopies(c)) errs.push(`Too many copies of ${c.name}.`);
      if (n > this.collection.total(id)) errs.push(`Not enough copies of ${c.name} owned.`);
    }
    return errs;
  }

  stats(deck: Deck): DeckStats {
    const cards = deck.cards.filter((id) => this.ctx.cards.has(id)).map((id) => this.ctx.cards.get(id));
    const curve = new Array(8).fill(0);
    const types = { creature: 0, action: 0, equipment: 0, terrain: 0, relic: 0, champion: 0 } as Record<CardType, number>;
    const factions: Partial<Record<FactionId, number>> = {};
    let cost = 0, atk = 0, hp = 0, creatures = 0;
    for (const c of cards) {
      curve[Math.min(7, c.cost)]++;
      types[c.type]++;
      factions[c.faction] = (factions[c.faction] ?? 0) + 1;
      cost += c.cost;
      if (c.type === 'creature' || c.type === 'champion') { creatures++; atk += c.attack; hp += c.hp; }
    }
    return { count: cards.length, avgCost: cards.length ? cost / cards.length : 0, curve, types, factions, creatures, avgAttack: creatures ? atk / creatures : 0, avgHp: creatures ? hp / creatures : 0 };
  }

  /** Fills a deck up to 30 with the best owned cards, favouring its main factions. */
  autoComplete(deck: Deck) {
    const st = this.stats(deck);
    const mainFactions = (Object.entries(st.factions) as [FactionId, number][]).sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 2);
    const owned = this.ctx.cards.collectible.filter((c) => this.collection.owned(c.id));
    const pool = owned.filter((c) => !mainFactions.length || mainFactions.includes(c.faction));
    const suggestions = buildAIDeck(pool.length >= 15 ? pool : owned, { factions: mainFactions.length ? mainFactions : undefined, maxRarity: 'PRISMATIC', seed: deck.cards.length + 7, size: 60 });
    const allOwned = [...suggestions, ...owned.sort((a, b) => a.cost - b.cost).map((c) => c.id)];
    for (const id of allOwned) {
      if (deck.cards.length >= DECK_SIZE) break;
      const c = this.ctx.cards.get(id);
      if (!this.canAdd(deck, c)) deck.cards.push(id);
    }
    deck.updated = Date.now();
    this.ctx.changed();
  }
}
