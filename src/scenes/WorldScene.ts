import Phaser from 'phaser';
import {
  DEFAULT_SEED,
  HOTBAR_SLOTS,
  PLAYER_HALF_H,
  PLAYER_HALF_W,
  PLAYER_SPEED,
  REACH,
  TILE,
  WORLD_H,
  WORLD_W,
} from '../config';
import { BLOCKS, BlockId, blockTileIndex } from '../game/blocks';
import { DayNight } from '../game/DayNight';
import { ENEMY_KEY, EnemyManager } from '../game/Enemies';
import { Inventory } from '../game/Inventory';
import { ITEMS } from '../game/items';
import { Minimap } from '../game/Minimap';
import { createEnemyTexture, createPlayerTexture, createTileset, TILESET_KEY } from '../game/tileset';
import { Ground, World } from '../game/World';

const PLAYER_KEY = 'player';
const TOTAL_GEMS = 4;
const MAX_HP = 20;
const REVEAL_RADIUS = 10;

export class WorldScene extends Phaser.Scene {
  world!: World;
  inventory!: Inventory;
  clock!: DayNight;
  enemies!: EnemyManager;
  minimap!: Minimap;
  hp = MAX_HP;

  private blockLayer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Phaser.GameObjects.Image;
  px = 0;
  py = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private highlight!: Phaser.GameObjects.Graphics;
  private progress!: Phaser.GameObjects.Graphics;
  private miningTarget: { x: number; y: number } | null = null;
  private miningProgress = 0;
  private placeCooldown = 0;
  private attackCooldown = 0;
  private fullToastCooldown = 0;
  private invuln = 0;
  private sinceHit = 99;
  private regenTimer = 0;
  private wasNight = false;
  private lastTile = { x: -1, y: -1 };
  private won = false;

  constructor() {
    super('World');
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get('seed')) || DEFAULT_SEED;
    this.world = new World(seed);
    this.inventory = new Inventory();
    this.clock = new DayNight();
    const startTime = params.get('time');
    if (startTime !== null && startTime !== '' && !Number.isNaN(Number(startTime))) {
      this.clock.setFraction(Math.max(0, Math.min(0.999, Number(startTime))));
    }
    this.hp = MAX_HP;
    this.invuln = 0;
    this.sinceHit = 99;
    this.won = false;
    this.registry.set('inventory', this.inventory);
    this.registry.set('gems', 0);
    this.registry.set('uiHover', false);
    this.registry.set('hp', this.hp);
    this.registry.set('maxHp', MAX_HP);

    // --- Mapa ---
    createTileset(this);
    const map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: WORLD_W, height: WORLD_H });
    const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE, 0, 0)!;
    const groundLayer = map.createBlankLayer('ground', tileset)!;
    this.blockLayer = map.createBlankLayer('blocks', tileset)!;
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        groundLayer.putTileAt(this.world.groundAt(x, y), x, y);
        const b = this.world.blockAt(x, y);
        if (b !== BlockId.NONE) this.blockLayer.putTileAt(blockTileIndex(b), x, y);
      }
    }
    this.blockLayer.setDepth(5);

    // --- Jugador, enemigos y minimapa ---
    createPlayerTexture(this, PLAYER_KEY);
    createEnemyTexture(this, ENEMY_KEY);
    this.px = (this.world.spawn.x + 0.5) * TILE;
    this.py = (this.world.spawn.y + 0.5) * TILE;
    this.player = this.add.image(this.px, this.py, PLAYER_KEY).setDepth(10).setOrigin(0.5, 0.75);
    this.enemies = new EnemyManager(this, this.world);
    this.minimap = new Minimap(this, this.world);
    this.minimap.reveal(this.world.spawn.x, this.world.spawn.y, REVEAL_RADIUS);
    this.lastTile = { x: this.world.spawn.x, y: this.world.spawn.y };
    this.wasNight = this.clock.isNight;

    // --- Cámara ---
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W * TILE, WORLD_H * TILE);
    cam.startFollow(this.player, true, 0.15, 0.15);
    this.updateZoom();
    this.scale.on('resize', () => this.updateZoom());

    // --- Entrada ---
    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        const n = e.key === '0' ? 9 : Number(e.key) - 1;
        this.inventory.select(n);
      } else if (e.key === 'n' || e.key === 'N') {
        this.clock.skipToDusk();
      }
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const cur = this.inventory.selected >= HOTBAR_SLOTS ? 0 : this.inventory.selected;
      const next = (cur + (dy > 0 ? 1 : -1) + HOTBAR_SLOTS) % HOTBAR_SLOTS;
      this.inventory.select(next);
    });

    this.highlight = this.add.graphics().setDepth(20);
    this.progress = this.add.graphics().setDepth(21);

    // Depuración desde la consola del navegador.
    (window as unknown as { __relic?: WorldScene }).__relic = this;

    this.scene.launch('UI');
  }

  private updateZoom(): void {
    const { width, height } = this.scale;
    const zoom = Math.max(1, Math.min(3, Math.round(Math.min(width, height) / 340)));
    this.cameras.main.setZoom(zoom);
  }

  // ------------------------------------------------------------ API para la UI

  get playerTile(): { x: number; y: number } {
    return { x: Math.floor(this.px / TILE), y: Math.floor(this.py / TILE) };
  }

  /** Posición del jugador en píxeles de pantalla. */
  playerScreen(): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (this.px - cam.worldView.x) * cam.zoom, y: (this.py - cam.worldView.y) * cam.zoom };
  }

  // ------------------------------------------------------------------- bucle

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;

    this.clock.update(dt);
    const night = this.clock.isNight;
    if (night !== this.wasNight) {
      this.wasNight = night;
      this.game.events.emit(
        'toast',
        night ? 'Cae la noche… aparecen criaturas. Refúgiate tras muros o pelea (click en ellas).' : 'Amanece. Las criaturas se desvanecen.',
      );
    }

    this.movePlayer(dt);
    this.handleMouse(dt);
    this.enemies.update(dt, { x: this.px, y: this.py }, this.clock, (d, fx, fy) => this.hurtPlayer(d, fx, fy));

    // Exploración del minimapa.
    const t = this.playerTile;
    if (t.x !== this.lastTile.x || t.y !== this.lastTile.y) {
      this.lastTile = t;
      this.minimap.reveal(t.x, t.y, REVEAL_RADIUS);
    }
    this.minimap.update(dt);

    // Temporizadores del jugador.
    this.invuln = Math.max(0, this.invuln - dt);
    this.sinceHit += dt;
    this.player.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0 ? 0.4 : 1);
    if (this.hp < MAX_HP && this.sinceHit > 6) {
      this.regenTimer += dt;
      if (this.regenTimer >= 2) {
        this.regenTimer = 0;
        this.setHp(this.hp + 1);
      }
    }
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.fullToastCooldown = Math.max(0, this.fullToastCooldown - dt);
  }

  // ------------------------------------------------------------------- salud

  private setHp(v: number): void {
    this.hp = Math.max(0, Math.min(MAX_HP, v));
    this.registry.set('hp', this.hp);
  }

  hurtPlayer(damage: number, fromX: number, fromY: number): void {
    if (this.invuln > 0) return;
    this.setHp(this.hp - damage);
    this.invuln = 0.9;
    this.sinceHit = 0;
    this.regenTimer = 0;
    this.cameras.main.shake(140, 0.004);

    // Retroceso.
    const dx = this.px - fromX;
    const dy = this.py - fromY;
    const d = Math.hypot(dx, dy) || 1;
    const kx = (dx / d) * 14;
    const ky = (dy / d) * 14;
    if (!this.collides(this.px + kx, this.py)) this.px += kx;
    if (!this.collides(this.px, this.py + ky)) this.py += ky;

    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.enemies.clear();
    this.px = (this.world.spawn.x + 0.5) * TILE;
    this.py = (this.world.spawn.y + 0.5) * TILE;
    this.setHp(MAX_HP);
    this.invuln = 2.5;
    this.cameras.main.flash(400, 200, 30, 30);
    this.game.events.emit('toast', 'Has caído. Reapareces en el campamento.');
  }

  // ------------------------------------------------------------- movimiento

  private movePlayer(dt: number): void {
    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (vx && vy) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    const nx = this.px + vx * PLAYER_SPEED * dt;
    if (!this.collides(nx, this.py)) this.px = nx;
    const ny = this.py + vy * PLAYER_SPEED * dt;
    if (!this.collides(this.px, ny)) this.py = ny;
    this.player.setPosition(this.px, this.py);
  }

  private collides(x: number, y: number): boolean {
    return this.world.boxCollides(x, y, PLAYER_HALF_W, PLAYER_HALF_H, TILE);
  }

  // ------------------------------------------------------------------- ratón

  private handleMouse(dt: number): void {
    const cam = this.cameras.main;
    const p = this.input.activePointer;
    const wp = cam.getWorldPoint(p.x, p.y);
    const tx = Math.floor(wp.x / TILE);
    const ty = Math.floor(wp.y / TILE);
    const inside = this.world.inBounds(tx, ty);
    const overUI = this.registry.get('uiHover') === true;
    const dist = Math.hypot((tx + 0.5) * TILE - this.px, (ty + 0.5) * TILE - this.py);
    const inReach = inside && dist <= REACH * TILE;

    this.highlight.clear();
    this.progress.clear();

    // Combate: un enemigo bajo el cursor tiene prioridad sobre romper bloques.
    const foe = overUI ? undefined : this.enemies.at(wp.x, wp.y, 18);
    if (foe) {
      const foeInReach = Math.hypot(foe.x - this.px, foe.y - this.py) <= REACH * TILE;
      this.highlight.lineStyle(2, foeInReach ? 0xff5252 : 0x888888, 0.95);
      this.highlight.strokeCircle(foe.x, foe.y - 4, 13);
      this.miningTarget = null;
      this.miningProgress = 0;
      if (p.leftButtonDown() && foeInReach && this.attackCooldown <= 0) {
        this.attackCooldown = 0.35;
        this.enemies.damage(foe, 1, this.px, this.py);
      }
      return;
    }

    // Cursor de selección.
    if (inside && !overUI) {
      this.highlight.lineStyle(2, inReach ? 0xffffff : 0xff5252, inReach ? 0.9 : 0.6);
      this.highlight.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
    }

    // Romper (mantener click izquierdo).
    const block = inside ? this.world.blockAt(tx, ty) : BlockId.NONE;
    const canBreak = p.leftButtonDown() && inReach && !overUI && block !== BlockId.NONE;
    if (canBreak) {
      if (!this.miningTarget || this.miningTarget.x !== tx || this.miningTarget.y !== ty) {
        this.miningTarget = { x: tx, y: ty };
        this.miningProgress = 0;
      }
      const def = BLOCKS[block];
      if (def.drop && !this.inventory.canAdd(def.drop, def.dropCount ?? 1)) {
        if (this.fullToastCooldown <= 0) {
          this.game.events.emit('toast', 'Inventario lleno');
          this.fullToastCooldown = 1.5;
        }
        this.miningProgress = 0;
      } else {
        this.miningProgress += dt / def.hardness;
        if (this.miningProgress >= 1) {
          this.breakBlock(tx, ty);
          this.miningTarget = null;
          this.miningProgress = 0;
        }
      }
    } else {
      this.miningTarget = null;
      this.miningProgress = 0;
    }

    if (this.miningTarget && this.miningProgress > 0) {
      const bx = this.miningTarget.x * TILE;
      const by = this.miningTarget.y * TILE;
      this.progress.fillStyle(0x000000, 0.6);
      this.progress.fillRect(bx + 2, by + TILE - 8, TILE - 4, 6);
      this.progress.fillStyle(0xffd54a, 1);
      this.progress.fillRect(bx + 3, by + TILE - 7, (TILE - 6) * Math.min(1, this.miningProgress), 4);
    }

    // Colocar (click derecho).
    if (p.rightButtonDown() && inReach && !overUI && this.placeCooldown <= 0) {
      this.placeBlock(tx, ty);
      this.placeCooldown = 0.18;
    }
  }

  breakBlock(x: number, y: number): void {
    const id = this.world.blockAt(x, y);
    const def = BLOCKS[id];
    this.world.setBlock(x, y, BlockId.NONE);
    this.blockLayer.removeTileAt(x, y);
    this.minimap.paintTile(x, y);
    if (def.drop) this.inventory.add(def.drop, def.dropCount ?? 1);

    if (id === BlockId.GEM) {
      const gems = ((this.registry.get('gems') as number) ?? 0) + 1;
      this.registry.set('gems', gems);
      this.game.events.emit('toast', `¡Gema de Fuego conseguida! (${gems}/${TOTAL_GEMS})`);
      if (!this.won) {
        this.won = true;
        this.cameras.main.flash(500, 255, 140, 60);
      }
    }
  }

  private placeBlock(x: number, y: number): void {
    const stack = this.inventory.selectedStack;
    if (!stack) return;
    const item = ITEMS[stack.id];
    if (item.place === undefined) return;
    if (this.world.blockAt(x, y) !== BlockId.NONE) return;

    const onWater = this.world.groundAt(x, y) === Ground.WATER;
    let block: number = item.place;
    if (onWater) {
      if (!item.bridge) return;
      block = BlockId.BRIDGE;
    }

    // No colocar bloques sólidos encima del jugador ni de un enemigo.
    if (BLOCKS[block].solid) {
      const overlaps = (cx: number, cy: number, hw: number, hh: number) =>
        cx + hw > x * TILE && cx - hw < (x + 1) * TILE && cy + hh > y * TILE && cy - hh < (y + 1) * TILE;
      if (overlaps(this.px, this.py, PLAYER_HALF_W, PLAYER_HALF_H)) return;
      if (this.enemies.list.some((e) => overlaps(e.x, e.y, 8, 8))) return;
    }

    this.world.setBlock(x, y, block);
    this.blockLayer.putTileAt(blockTileIndex(block), x, y);
    this.minimap.paintTile(x, y);
    this.inventory.removeFromSlot(this.inventory.selected, 1);
  }
}
