import type { ChestId, CosmeticKind, PackId } from '../data/content';
import { COSMETIC_BY_ID } from '../data/content';
import type { Ctx } from './context';

export class InventorySystem {
  constructor(private ctx: Ctx) {}
  private get inv() { return this.ctx.data.inventory; }

  packs(id: PackId) { return this.inv.packs[id] ?? 0; }
  totalPacks() { return Object.values(this.inv.packs).reduce((a, b) => a + (b ?? 0), 0); }
  addPack(id: PackId, n = 1) { this.inv.packs[id] = this.packs(id) + n; this.ctx.changed(); }
  takePack(id: PackId): boolean {
    if (this.packs(id) <= 0) return false;
    this.inv.packs[id] = this.packs(id) - 1;
    this.ctx.changed();
    return true;
  }

  chests(id: ChestId) { return this.inv.chests[id] ?? 0; }
  totalChests() { return Object.values(this.inv.chests).reduce((a, b) => a + (b ?? 0), 0); }
  addChest(id: ChestId, n = 1) { this.inv.chests[id] = this.chests(id) + n; this.ctx.changed(); }
  takeChest(id: ChestId): boolean {
    if (this.chests(id) <= 0) return false;
    this.inv.chests[id] = this.chests(id) - 1;
    this.ctx.changed();
    return true;
  }

  ownsCosmetic(id: string) { return this.inv.cosmetics.includes(id); }
  addCosmetic(id: string): boolean {
    if (!COSMETIC_BY_ID[id] || this.ownsCosmetic(id)) return false;
    this.inv.cosmetics.push(id);
    this.ctx.changed();
    return true;
  }
  equip(id: string): boolean {
    const c = COSMETIC_BY_ID[id];
    if (!c || !this.ownsCosmetic(id)) return false;
    const d = this.ctx.data;
    const map: Partial<Record<CosmeticKind, () => void>> = {
      cardback: () => (d.equipped.cardback = id),
      board: () => (d.equipped.board = id),
      victory: () => (d.equipped.victory = id),
      summon: () => (d.equipped.summon = id),
      avatar: () => (d.profile.avatar = id),
      frame: () => (d.profile.frame = id),
      title: () => (d.profile.title = id),
    };
    map[c.kind]?.();
    this.ctx.changed();
    return true;
  }
  isEquipped(id: string) {
    const d = this.ctx.data;
    return [d.equipped.cardback, d.equipped.board, d.equipped.victory, d.equipped.summon, d.profile.avatar, d.profile.frame, d.profile.title].includes(id);
  }
}
