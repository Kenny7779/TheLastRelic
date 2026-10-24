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
import { Inventory } from '../game/Inventory';
import { ITEMS } from '../game/items';
import { createPlayerTexture, createTileset, TILESET_KEY } from '../game/tileset';
import { Ground, World } from '../game/World';

const PLAYER_KEY = 'player';
const TOTAL_GEMS = 4;

export class WorldScene extends Phaser.Scene {
  private world!: World;
  private inventory!: Inventory;
  private blockLayer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Phaser.GameObjects.Image;
  private px = 0;
  private py = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private highlight!: Phaser.GameObjects.Graphics;
  private progress!: Phaser.GameObjects.Graphics;
  private miningTarget: { x: number; y: number } | null = null;
  private miningProgress = 0;
  private placeCooldown = 0;
  private fullToastCooldown = 0;
  private won = false;

  constructor() {
    super('World');
  }

  create(): void {
    const seed = Number(new URLSearchParams(window.location.search).get('seed')) || DEFAULT_SEED;
    this.world = new World(seed);
    this.inventory = new Inventory();
    this.registry.set('inventory', this.inventory);
    this.registry.set('gems', 0);
    this.registry.set('uiHover', false);

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

    // --- Jugador ---
    createPlayerTexture(this, PLAYER_KEY);
    this.px = (this.world.spawn.x + 0.5) * TILE;
    this.py = (this.world.spawn.y + 0.5) * TILE;
    this.player = this.add.image(this.px, this.py, PLAYER_KEY).setDepth(10).setOrigin(0.5, 0.75);

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

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.movePlayer(dt);
    this.handleMouse(dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.fullToastCooldown = Math.max(0, this.fullToastCooldown - dt);
  }

  // ---------------------------------------------------------------- movimiento

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
    const x0 = Math.floor((x - PLAYER_HALF_W) / TILE);
    const x1 = Math.floor((x + PLAYER_HALF_W) / TILE);
    const y0 = Math.floor((y - PLAYER_HALF_H) / TILE);
    const y1 = Math.floor((y + PLAYER_HALF_H) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.world.isSolid(tx, ty)) return true;
      }
    }
    return false;
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

    // Cursor de selección.
    this.highlight.clear();
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

    this.progress.clear();
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

  private breakBlock(x: number, y: number): void {
    const id = this.world.blockAt(x, y);
    const def = BLOCKS[id];
    this.world.setBlock(x, y, BlockId.NONE);
    this.blockLayer.removeTileAt(x, y);
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

    // No colocar bloques sólidos encima del jugador.
    if (BLOCKS[block].solid) {
      const overlapX = this.px + PLAYER_HALF_W > x * TILE && this.px - PLAYER_HALF_W < (x + 1) * TILE;
      const overlapY = this.py + PLAYER_HALF_H > y * TILE && this.py - PLAYER_HALF_H < (y + 1) * TILE;
      if (overlapX && overlapY) return;
    }

    this.world.setBlock(x, y, block);
    this.blockLayer.putTileAt(blockTileIndex(block), x, y);
    this.inventory.removeFromSlot(this.inventory.selected, 1);
  }
}
