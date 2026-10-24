import { createNoise2D } from 'simplex-noise';
import { WORLD_W, WORLD_H } from '../config';
import { BLOCKS, BlockId } from './blocks';

export const Ground = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  ROCKY: 3,
} as const;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  readonly w = WORLD_W;
  readonly h = WORLD_H;
  readonly ground = new Uint8Array(WORLD_W * WORLD_H);
  readonly blocks = new Uint8Array(WORLD_W * WORLD_H);
  spawn = { x: WORLD_W >> 1, y: WORLD_H >> 1 };
  gem = { x: 0, y: 0 };

  constructor(seed: number) {
    this.generate(seed);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  groundAt(x: number, y: number): number {
    return this.ground[y * this.w + x];
  }

  blockAt(x: number, y: number): number {
    return this.blocks[y * this.w + x];
  }

  setBlock(x: number, y: number, id: number): void {
    this.blocks[y * this.w + x] = id;
  }

  /** ¿Bloquea el paso del jugador? Fuera del mapa y el agua cuentan como sólidos. */
  isSolid(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    const b = this.blockAt(x, y);
    if (b !== BlockId.NONE) return BLOCKS[b].solid;
    return this.groundAt(x, y) === Ground.WATER;
  }

  private generate(seed: number): void {
    const rand = mulberry32(seed);
    const elevNoise = createNoise2D(rand);
    const forestNoise = createNoise2D(rand);
    const { w, h } = this;

    const fbm = (n: (x: number, y: number) => number, x: number, y: number): number => {
      let v = 0;
      let amp = 1;
      let freq = 0.035;
      let sum = 0;
      for (let o = 0; o < 4; o++) {
        v += n(x * freq, y * freq) * amp;
        sum += amp;
        amp *= 0.5;
        freq *= 2;
      }
      return v / sum;
    };

    // Terreno + bloques naturales.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - w / 2) / (w / 2);
        const dy = (y - h / 2) / (h / 2);
        const d = Math.hypot(dx, dy);
        const e = fbm(elevNoise, x, y) + 0.35 - d * d * 0.95;

        let g: number = Ground.GRASS;
        if (e < -0.12) g = Ground.WATER;
        else if (e < -0.02) g = Ground.SAND;
        else if (e > 0.55) g = Ground.ROCKY;
        this.ground[y * w + x] = g;

        const r = rand();
        let b: number = BlockId.NONE;
        if (g === Ground.GRASS) {
          const f = fbm(forestNoise, x + 500, y + 500);
          if (r < (f > 0.1 ? 0.3 : 0.03)) b = BlockId.TREE;
        } else if (g === Ground.SAND) {
          if (r < 0.01) b = BlockId.ROCK;
        } else if (g === Ground.ROCKY) {
          if (r < 0.16) b = BlockId.ROCK;
          else if (r < 0.2) b = BlockId.ORE;
        }
        this.blocks[y * w + x] = b;
      }
    }

    this.spawn = this.findSpawn();
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.blocks[(this.spawn.y + dy) * w + (this.spawn.x + dx)] = BlockId.NONE;
      }
    }

    this.placeGemRuin(rand);
  }

  private isLandArea(cx: number, cy: number, r: number): boolean {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (!this.inBounds(x, y) || this.groundAt(x, y) === Ground.WATER) return false;
      }
    }
    return true;
  }

  /** Busca (en espiral) el punto de tierra más cercano al centro. */
  private findSpawn(): { x: number; y: number } {
    const cx = this.w >> 1;
    const cy = this.h >> 1;
    for (let r = 0; r < this.w / 2 - 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 3 || y < 3 || x >= this.w - 3 || y >= this.h - 3) continue;
          if (this.isLandArea(x, y, 2)) return { x, y };
        }
      }
    }
    return { x: cx, y: cy };
  }

  /** Tiles de tierra alcanzables a pie desde el spawn (sin contar bloques). */
  private reachableLand(): Uint8Array {
    const seen = new Uint8Array(this.w * this.h);
    const stack = [this.spawn.y * this.w + this.spawn.x];
    seen[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % this.w;
      const y = (i - x) / this.w;
      const nbrs = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of nbrs) {
        if (!this.inBounds(nx, ny)) continue;
        const ni = ny * this.w + nx;
        if (seen[ni] || this.ground[ni] === Ground.WATER) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    return seen;
  }

  /** Ruina cerrada con muros de piedra y la Gema de Fuego en el centro. */
  private placeGemRuin(rand: () => number): void {
    const reach = this.reachableLand();
    const candidates: { x: number; y: number }[] = [];
    const collect = (minDist: number, maxDist: number) => {
      for (let y = 5; y < this.h - 5; y++) {
        for (let x = 5; x < this.w - 5; x++) {
          if (!reach[y * this.w + x]) continue;
          const dist = Math.hypot(x - this.spawn.x, y - this.spawn.y);
          if (dist < minDist || dist > maxDist) continue;
          if (this.isLandArea(x, y, 3)) candidates.push({ x, y });
        }
      }
    };
    collect(18, 34);
    if (!candidates.length) collect(10, 70);

    const pick = candidates.length
      ? candidates[Math.floor(rand() * candidates.length)]
      : { x: this.spawn.x + 6, y: this.spawn.y };
    this.gem = pick;

    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = pick.x + dx;
        const y = pick.y + dy;
        if (!this.inBounds(x, y)) continue;
        const i = y * this.w + x;
        this.ground[i] = Ground.ROCKY;
        const edge = Math.max(Math.abs(dx), Math.abs(dy));
        this.blocks[i] = edge === 3 ? BlockId.STONE_WALL : BlockId.NONE;
      }
    }
    this.blocks[pick.y * this.w + pick.x] = BlockId.GEM;
  }
}
