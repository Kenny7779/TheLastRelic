import Phaser from 'phaser';
import { BlockId } from './blocks';
import { Ground, World } from './World';

export const MINIMAP_KEY = 'minimap';

const FOG = '#05070b';
const GROUND_COLORS: Record<number, string> = {
  [Ground.WATER]: '#2b6cb0',
  [Ground.SAND]: '#d9c27a',
  [Ground.GRASS]: '#4c9a3f',
  [Ground.ROCKY]: '#7b7f86',
};
const BLOCK_COLORS: Record<number, string> = {
  [BlockId.TREE]: '#1f5e24',
  [BlockId.ROCK]: '#5a5d63',
  [BlockId.ORE]: '#e0a82e',
  [BlockId.WOOD_WALL]: '#8a5a2b',
  [BlockId.STONE_WALL]: '#4b4f55',
  [BlockId.GEM]: '#ff5a1f',
  [BlockId.BRIDGE]: '#8a5a2b',
};

/** Minimapa de 1 píxel por tile con niebla: solo se ve lo que has explorado. */
export class Minimap {
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private dirty = false;
  private timer = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
  ) {
    if (scene.textures.exists(MINIMAP_KEY)) scene.textures.remove(MINIMAP_KEY);
    this.tex = scene.textures.createCanvas(MINIMAP_KEY, world.w, world.h)!;
    this.ctx = this.tex.getContext();
    this.ctx.fillStyle = FOG;
    this.ctx.fillRect(0, 0, world.w, world.h);
    // Pinta lo que ya estuviera explorado.
    for (let y = 0; y < world.h; y++) {
      for (let x = 0; x < world.w; x++) this.paintTile(x, y);
    }
    this.tex.refresh();
  }

  /** Repinta un tile (si está explorado), por ejemplo tras romper o colocar un bloque. */
  paintTile(x: number, y: number): void {
    const w = this.world;
    if (!w.inBounds(x, y) || !w.explored[y * w.w + x]) return;
    const b = w.blockAt(x, y);
    this.ctx.fillStyle = (b !== BlockId.NONE && BLOCK_COLORS[b]) || GROUND_COLORS[w.groundAt(x, y)] || FOG;
    this.ctx.fillRect(x, y, 1, 1);
    this.dirty = true;
  }

  /** Descubre los tiles dentro de un radio alrededor de (cx, cy). */
  reveal(cx: number, cy: number, radius: number): void {
    const w = this.world;
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!w.inBounds(x, y)) continue;
        const i = y * w.w + x;
        if (w.explored[i]) continue;
        w.explored[i] = 1;
        this.paintTile(x, y);
      }
    }
  }

  /** Sube los cambios a la textura como mucho 4 veces por segundo. */
  update(dt: number): void {
    this.timer += dt;
    if (this.dirty && this.timer >= 0.25) {
      this.tex.refresh();
      this.dirty = false;
      this.timer = 0;
    }
  }
}
