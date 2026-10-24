import { INV_SLOTS } from '../config';
import { ITEMS, type ItemId } from './items';

export interface Stack {
  id: ItemId;
  count: number;
}

/** Inventario de 20 slots con apilado. No depende de Phaser. */
export class Inventory {
  readonly size = INV_SLOTS;
  readonly slots: (Stack | null)[] = Array.from({ length: INV_SLOTS }, () => null);
  selected = 0;

  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  select(index: number): void {
    const i = Math.max(0, Math.min(this.size - 1, index));
    if (i !== this.selected) {
      this.selected = i;
      this.emit();
    }
  }

  get selectedStack(): Stack | null {
    return this.slots[this.selected];
  }

  /** ¿Cabe `count` unidades de `id`? */
  canAdd(id: ItemId, count = 1): boolean {
    const max = ITEMS[id].maxStack;
    let room = 0;
    for (const s of this.slots) {
      if (!s) room += max;
      else if (s.id === id) room += max - s.count;
      if (room >= count) return true;
    }
    return room >= count;
  }

  /** Añade objetos; devuelve cuántos NO cupieron. */
  add(id: ItemId, count = 1): number {
    const max = ITEMS[id].maxStack;
    let left = count;
    for (const s of this.slots) {
      if (left <= 0) break;
      if (s && s.id === id && s.count < max) {
        const n = Math.min(max - s.count, left);
        s.count += n;
        left -= n;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(max, left);
        this.slots[i] = { id, count: n };
        left -= n;
      }
    }
    this.emit();
    return left;
  }

  /** Quita `count` unidades del slot. */
  removeFromSlot(index: number, count = 1): boolean {
    const s = this.slots[index];
    if (!s || s.count < count) return false;
    s.count -= count;
    if (s.count <= 0) this.slots[index] = null;
    this.emit();
    return true;
  }
}
