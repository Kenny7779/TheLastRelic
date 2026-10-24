import { BlockId } from './blocks';

export type ItemId = 'wood' | 'stone' | 'ore' | 'fire_gem';

export interface ItemDef {
  name: string;
  maxStack: number;
  /** Bloque que se coloca al usar el objeto (si se puede colocar). */
  place?: number;
  /** Si es true, sobre el agua coloca un puente en vez del bloque normal. */
  bridge?: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { name: 'Madera', maxStack: 64, place: BlockId.WOOD_WALL, bridge: true },
  stone: { name: 'Piedra', maxStack: 64, place: BlockId.STONE_WALL },
  ore: { name: 'Mineral', maxStack: 64 },
  fire_gem: { name: 'Gema de Fuego', maxStack: 1 },
};
