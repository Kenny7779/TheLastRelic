import Phaser from 'phaser';
import { TILE } from '../config';
import type { DayNight } from './DayNight';
import type { World } from './World';

export const ENEMY_KEY = 'enemy';
const HALF = 8;

export interface Enemy {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  hitCd: number;
  flash: number;
  kx: number;
  ky: number;
  /** 0 = vivo; >0 = progreso de desvanecimiento (0..1). */
  dying: number;
}

/** Enemigos nocturnos: aparecen de noche, persiguen al jugador y se desvanecen al amanecer. */
export class EnemyManager {
  readonly list: Enemy[] = [];
  /** Permite desactivar la aparición automática (útil en pruebas). */
  spawningEnabled = true;
  private spawnTimer = 2;
  private readonly bars: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.bars = scene.add.graphics().setDepth(22);
  }

  /** Máximo de enemigos a la vez; crece con los días. */
  maxCount(day: number): number {
    return Math.min(14, 4 + day * 2);
  }

  update(
    dt: number,
    player: { x: number; y: number },
    clock: DayNight,
    hurtPlayer: (damage: number, fromX: number, fromY: number) => void,
  ): void {
    // --- Aparición (solo de noche) ---
    this.spawnTimer -= dt;
    if (this.spawningEnabled && clock.isNight && this.spawnTimer <= 0 && this.alive() < this.maxCount(clock.day)) {
      this.spawnTimer = 1.6;
      this.trySpawn(player, clock.day);
    }

    // --- Amanecer: los enemigos se desvanecen poco a poco ---
    const dawn = clock.darkness < 0.35;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];

      if (dawn && e.dying === 0 && Math.random() < dt * 0.9) e.dying = 0.001;
      if (e.dying > 0) {
        e.dying += dt / 1.2;
        e.sprite.setAlpha(Math.max(0, 1 - e.dying));
        if (e.dying >= 1) {
          this.remove(i);
          continue;
        }
      }

      e.hitCd = Math.max(0, e.hitCd - dt);
      e.flash = Math.max(0, e.flash - dt);

      // Persecución.
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy);
      let vx = 0;
      let vy = 0;
      if (d > 1 && e.dying === 0) {
        vx = (dx / d) * e.speed;
        vy = (dy / d) * e.speed;
      }
      vx += e.kx;
      vy += e.ky;
      const decay = Math.min(1, dt * 8);
      e.kx -= e.kx * decay;
      e.ky -= e.ky * decay;
      this.move(e, vx * dt, vy * dt);

      // Ataque.
      if (e.dying === 0 && d < 20 && e.hitCd <= 0) {
        e.hitCd = 1.1;
        hurtPlayer(2, e.x, e.y);
      }

      e.sprite.setPosition(e.x, e.y);
      if (e.dying === 0) e.sprite.setAlpha(e.flash > 0 ? 0.35 : 1);
    }

    this.drawBars();
  }

  /** Enemigo bajo un punto del mundo. */
  at(wx: number, wy: number, radius = 16): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = radius;
    for (const e of this.list) {
      if (e.dying > 0) continue;
      const d = Math.hypot(wx - e.x, wy - (e.y - 4));
      if (d <= bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  /** Daña a un enemigo con retroceso; devuelve true si muere. */
  damage(e: Enemy, amount: number, fromX: number, fromY: number): boolean {
    e.hp -= amount;
    e.flash = 0.12;
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    e.kx = (dx / d) * 150;
    e.ky = (dy / d) * 150;
    if (e.hp <= 0) {
      const i = this.list.indexOf(e);
      if (i >= 0) this.remove(i);
      return true;
    }
    return false;
  }

  alive(): number {
    return this.list.filter((e) => e.dying === 0).length;
  }

  clear(): void {
    while (this.list.length) this.remove(this.list.length - 1);
    this.bars.clear();
  }

  /** Crea un enemigo en una posición concreta (también lo usan las pruebas). */
  spawnAt(x: number, y: number, day = 1): Enemy {
    const hp = 3 + Math.floor((day - 1) / 2);
    const sprite = this.scene.add.image(x, y, ENEMY_KEY).setDepth(9).setOrigin(0.5, 0.75);
    const e: Enemy = {
      sprite,
      x,
      y,
      hp,
      maxHp: hp,
      speed: 55 + Math.random() * 25,
      hitCd: 0.6,
      flash: 0,
      kx: 0,
      ky: 0,
      dying: 0,
    };
    this.list.push(e);
    return e;
  }

  private trySpawn(player: { x: number; y: number }, day: number): void {
    for (let attempt = 0; attempt < 12; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = (11 + Math.random() * 5) * TILE;
      const x = player.x + Math.cos(ang) * dist;
      const y = player.y + Math.sin(ang) * dist;
      if (this.world.boxCollides(x, y, HALF, HALF, TILE)) continue;
      this.spawnAt(x, y, day);
      return;
    }
  }

  private move(e: Enemy, dx: number, dy: number): void {
    const w = this.world;
    if (!w.boxCollides(e.x + dx, e.y, HALF, HALF, TILE)) e.x += dx;
    if (!w.boxCollides(e.x, e.y + dy, HALF, HALF, TILE)) e.y += dy;
  }

  private remove(i: number): void {
    this.list[i].sprite.destroy();
    this.list.splice(i, 1);
  }

  private drawBars(): void {
    const g = this.bars;
    g.clear();
    for (const e of this.list) {
      if (e.hp >= e.maxHp || e.dying > 0) continue;
      const w = 20;
      g.fillStyle(0x000000, 0.7);
      g.fillRect(e.x - w / 2, e.y - 24, w, 4);
      g.fillStyle(0xe53935, 1);
      g.fillRect(e.x - w / 2 + 1, e.y - 23, (w - 2) * (e.hp / e.maxHp), 2);
    }
  }
}
