import type { EventBus } from '../core/events';
import type { CardSystem } from './CardSystem';
import type { PlayerData } from './state';

/** Minimal shared context given to every gameplay system. */
export interface Ctx {
  data: PlayerData;
  cards: CardSystem;
  bus: EventBus;
  changed(): void;
  stat(key: string, delta?: number): void;
}
