// Tiny typed event bus used to decouple systems (quests, achievements, UI, audio).

export type GameEvent =
  | { type: 'packOpened'; packId: string; cards: { id: string; rarity: string; finish: string }[] }
  | { type: 'cardAcquired'; id: string; rarity: string; finish: string; isNew: boolean }
  | { type: 'matchEnd'; mode: string; won: boolean; perfect: boolean; turns: number; damageDealt: number; cardsPlayed: number; faction?: string }
  | { type: 'cardPlayed'; id: string; cardType: string; faction: string }
  | { type: 'creatureKilled' }
  | { type: 'currencySpent'; currency: string; amount: number }
  | { type: 'currencyChanged' }
  | { type: 'chestOpened'; chestId: string }
  | { type: 'deckSaved' }
  | { type: 'cardCrafted'; id: string }
  | { type: 'pageCompleted'; key: string }
  | { type: 'levelUp'; level: number }
  | { type: 'stateChanged' };

type Handler = (e: GameEvent) => void;

export class EventBus {
  private handlers = new Set<Handler>();
  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  emit(e: GameEvent): void {
    for (const h of [...this.handlers]) {
      try { h(e); } catch (err) { console.error('[EventBus]', err); }
    }
  }
}
