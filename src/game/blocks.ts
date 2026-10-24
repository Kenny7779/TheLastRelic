import type { ItemId } from './items';

export const BlockId = {
  NONE: 0,
  TREE: 1,
  ROCK: 2,
  ORE: 3,
  WOOD_WALL: 4,
  STONE_WALL: 5,
  GEM: 6,
  BRIDGE: 7,
} as const;

export interface BlockDef {
  name: string;
  /** Si bloquea el paso del jugador. */
  solid: boolean;
  /** Segundos que cuesta romperlo con las manos. */
  hardness: number;
  drop?: ItemId;
  dropCount?: number;
}

export const BLOCKS: Record<number, BlockDef> = {
  [BlockId.TREE]: { name: 'Árbol', solid: true, hardness: 0.7, drop: 'wood', dropCount: 2 },
  [BlockId.ROCK]: { name: 'Roca', solid: true, hardness: 1.0, drop: 'stone', dropCount: 1 },
  [BlockId.ORE]: { name: 'Mineral', solid: true, hardness: 1.4, drop: 'ore', dropCount: 1 },
  [BlockId.WOOD_WALL]: { name: 'Pared de madera', solid: true, hardness: 0.5, drop: 'wood', dropCount: 1 },
  [BlockId.STONE_WALL]: { name: 'Muro de piedra', solid: true, hardness: 0.9, drop: 'stone', dropCount: 1 },
  [BlockId.GEM]: { name: 'Gema de Fuego', solid: true, hardness: 1.8, drop: 'fire_gem', dropCount: 1 },
  [BlockId.BRIDGE]: { name: 'Puente', solid: false, hardness: 0.4, drop: 'wood', dropCount: 1 },
};

/** Índice del tile del tileset para un bloque (los 4 primeros son terreno). */
export const blockTileIndex = (id: number): number => 3 + id;
