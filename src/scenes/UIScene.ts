import Phaser from 'phaser';
import { HOTBAR_SLOTS, INV_SLOTS } from '../config';
import { Inventory } from '../game/Inventory';
import { ITEMS, type ItemId } from '../game/items';
import { MINIMAP_KEY } from '../game/Minimap';
import { createLightTexture } from '../game/tileset';
import { TILE } from '../config';
import type { WorldScene } from './WorldScene';

const LIGHT_KEY = 'light';
const NIGHT_COLOR = 0x060a20;
const NIGHT_EDGE_ALPHA = 0.86;

const FONT = 'ui-monospace, Menlo, Consolas, monospace';
const GEM_COLORS = [0xff5a1f, 0x5ec8ff, 0x4caf50, 0x8a8f9a]; // fuego, hielo, bosque, ???

interface SlotRect {
  x: number;
  y: number;
  size: number;
  visible: boolean;
}

export class UIScene extends Phaser.Scene {
  private inventory!: Inventory;
  private invOpen = false;
  private gfx!: Phaser.GameObjects.Graphics;
  private countTexts: Phaser.GameObjects.Text[] = [];
  private keyTexts: Phaser.GameObjects.Text[] = [];
  private nameText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastTween?: Phaser.Tweens.Tween;
  private lastToast = '';
  private lastToastAt = 0;
  private slotRects: SlotRect[] = [];
  private worldScene?: WorldScene;
  private lightImg!: Phaser.GameObjects.Image;
  private nightGfx!: Phaser.GameObjects.Graphics;
  private dynGfx!: Phaser.GameObjects.Graphics;
  private minimapImg!: Phaser.GameObjects.Image;
  private timeText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private mm = { x: 0, y: 0, scale: 1, size: 128 };

  constructor() {
    super('UI');
  }

  create(): void {
    this.inventory = this.registry.get('inventory') as Inventory;
    this.worldScene = this.scene.get('World') as WorldScene;

    // Oscuridad nocturna: va primero para quedar por debajo del resto de la interfaz.
    createLightTexture(this, LIGHT_KEY);
    this.lightImg = this.add.image(0, 0, LIGHT_KEY).setVisible(false);
    this.nightGfx = this.add.graphics();

    // Minimapa.
    this.minimapImg = this.add.image(0, 0, MINIMAP_KEY).setOrigin(0, 0);
    this.dynGfx = this.add.graphics();
    this.timeText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0);
    this.hpText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0.5);

    this.gfx = this.add.graphics();

    for (let i = 0; i < INV_SLOTS; i++) {
      this.countTexts.push(
        this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 1),
      );
    }
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      this.keyTexts.push(
        this.add.text(0, 0, String((i + 1) % 10), { fontFamily: FONT, fontSize: '10px', color: '#9fb0c8' }).setOrigin(0, 0),
      );
    }
    this.nameText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1);
    this.titleText = this.add.text(16, 12, 'The Last Relic · demo', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 });
    this.helpText = this.add.text(
      16,
      62,
      ['WASD / flechas: moverse', 'Click izq. (mantener): romper', 'Click der.: colocar (madera sobre agua = puente)', '1-0 / rueda: elegir slot', 'E: abrir inventario (20 slots)', 'Click izq. sobre un enemigo: atacar', 'N: saltar al atardecer'].join('\n'),
      { fontFamily: FONT, fontSize: '11px', color: '#cfd8e6', stroke: '#000000', strokeThickness: 2, lineSpacing: 3 },
    );
    this.toastText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: '#ffe9b0', stroke: '#000000', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5, 0)
      .setAlpha(0);

    // Eventos.
    const unsub = this.inventory.subscribe(() => this.redraw());
    const onToast = (msg: string) => this.showToast(msg);
    this.game.events.on('toast', onToast);
    this.registry.events.on('changedata-gems', this.redraw, this);
    this.scale.on('resize', this.redraw, this);
    this.input.keyboard!.on('keydown-E', () => {
      this.invOpen = !this.invOpen;
      this.redraw();
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const i = this.slotAt(p.x, p.y);
      if (i >= 0) this.inventory.select(i);
    });
    this.events.once('shutdown', () => {
      unsub();
      this.game.events.off('toast', onToast);
      this.registry.events.off('changedata-gems', this.redraw, this);
      this.scale.off('resize', this.redraw, this);
    });

    this.redraw();
    this.showToast('Busca las 4 Gemas. Hay una ruina cerrada con la Gema de Fuego.');
  }

  update(): void {
    const p = this.input.activePointer;
    this.registry.set('uiHover', this.slotAt(p.x, p.y) >= 0 || this.overMinimap(p.x, p.y));
    const w = this.worldScene;
    if (!w || !w.clock || !w.enemies) return;
    this.drawNight(w);
    this.drawHud(w);
  }

  private overMinimap(px: number, py: number): boolean {
    const m = this.mm;
    return px >= m.x && px <= m.x + m.size && py >= m.y && py <= m.y + m.size;
  }

  /** Oscuridad de la noche con un círculo de luz alrededor del jugador. */
  private drawNight(w: WorldScene): void {
    const dark = w.clock.darkness;
    const g = this.nightGfx;
    g.clear();
    if (dark < 0.01) {
      this.lightImg.setVisible(false);
      return;
    }
    const W = this.scale.width;
    const H = this.scale.height;
    const pos = w.playerScreen();
    const size = 16 * TILE * w.cameras.main.zoom; // diámetro de la viñeta
    const half = size / 2;
    const left = pos.x - half;
    const top = pos.y - half;
    const right = pos.x + half;
    const bottom = pos.y + half;
    this.lightImg.setVisible(true).setPosition(pos.x, pos.y).setDisplaySize(size, size).setAlpha(dark);
    g.fillStyle(NIGHT_COLOR, NIGHT_EDGE_ALPHA * dark);
    if (top > 0) g.fillRect(0, 0, W, Math.min(H, top));
    if (bottom < H) g.fillRect(0, Math.max(0, bottom), W, H - Math.max(0, bottom));
    const y0 = Math.max(0, top);
    const y1 = Math.min(H, bottom);
    if (left > 0) g.fillRect(0, y0, Math.min(W, left), y1 - y0);
    if (right < W) g.fillRect(Math.max(0, right), y0, W - Math.max(0, right), y1 - y0);
  }

  /** Marcadores del minimapa, reloj y barra de vida. */
  private drawHud(w: WorldScene): void {
    const g = this.dynGfx;
    g.clear();
    const m = this.mm;
    const s = m.scale;

    // Enemigos cercanos.
    const pt = w.playerTile;
    g.fillStyle(0xff3b3b, 1);
    for (const e of w.enemies.list) {
      if (e.dying > 0) continue;
      const ex = Math.floor(e.x / TILE);
      const ey = Math.floor(e.y / TILE);
      if (Math.hypot(ex - pt.x, ey - pt.y) > 18) continue;
      g.fillRect(m.x + ex * s - 1, m.y + ey * s - 1, 3, 3);
    }
    // Jugador.
    g.fillStyle(0x000000, 1);
    g.fillRect(m.x + pt.x * s - 3, m.y + pt.y * s - 3, 6, 6);
    g.fillStyle(0xffffff, 1);
    g.fillRect(m.x + pt.x * s - 2, m.y + pt.y * s - 2, 4, 4);

    // Reloj: icono de sol o luna + texto.
    const night = w.clock.isNight;
    const cy = m.y + m.size + 16;
    const cx = m.x + m.size / 2;
    this.timeText.setPosition(cx + 10, m.y + m.size + 8).setText(`Día ${w.clock.day}  ${w.clock.clockText}`);
    this.timeText.setColor(night ? '#9fb8ff' : '#fff1b8');
    const iconX = cx - this.timeText.width / 2 - 6;
    if (night) {
      g.fillStyle(0xcfd8ff, 1);
      g.fillCircle(iconX, cy, 6);
      g.fillStyle(0x10141c, 1);
      g.fillCircle(iconX + 3, cy - 2, 5);
    } else {
      g.fillStyle(0xffd54a, 1);
      g.fillCircle(iconX, cy, 6);
    }

    // Barra de vida.
    const hp = w.hp;
    const maxHp = (this.registry.get('maxHp') as number) ?? 20;
    const by = m.y + m.size + 32;
    g.fillStyle(0x000000, 0.7);
    g.fillRect(m.x, by, m.size, 14);
    g.fillStyle(hp / maxHp > 0.3 ? 0xe53935 : 0xff8a00, 1);
    g.fillRect(m.x + 2, by + 2, (m.size - 4) * (hp / maxHp), 10);
    g.lineStyle(2, 0x4a566b, 1);
    g.strokeRect(m.x, by, m.size, 14);
    this.hpText.setPosition(cx, by + 7).setText(`♥ ${hp}/${maxHp}`);
  }

  // ------------------------------------------------------------------- layout

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const gap = 4;
    const size = Math.max(28, Math.min(44, Math.floor((w - 16 - gap * (HOTBAR_SLOTS - 1)) / HOTBAR_SLOTS)));
    const rowW = HOTBAR_SLOTS * size + (HOTBAR_SLOTS - 1) * gap;
    const x0 = Math.round((w - rowW) / 2);
    const y0 = h - 16 - size;
    this.slotRects = [];
    for (let i = 0; i < INV_SLOTS; i++) {
      const row = Math.floor(i / HOTBAR_SLOTS);
      const col = i % HOTBAR_SLOTS;
      this.slotRects.push({
        x: x0 + col * (size + gap),
        y: y0 - row * (size + gap),
        size,
        visible: row === 0 || this.invOpen,
      });
    }
  }

  private slotAt(px: number, py: number): number {
    for (let i = 0; i < this.slotRects.length; i++) {
      const r = this.slotRects[i];
      if (r.visible && px >= r.x && px <= r.x + r.size && py >= r.y && py <= r.y + r.size) return i;
    }
    return -1;
  }

  // -------------------------------------------------------------------- dibujo

  private redraw(): void {
    this.layout();
    const g = this.gfx;
    g.clear();

    // Gemas (arriba a la izquierda).
    const gems = (this.registry.get('gems') as number) ?? 0;
    for (let i = 0; i < 4; i++) {
      const cx = 24 + i * 28;
      const cy = 46;
      const have = i < gems;
      g.fillStyle(have ? GEM_COLORS[i] : 0x1b2230, 1);
      g.lineStyle(2, have ? 0xffffff : GEM_COLORS[i], have ? 0.9 : 0.55);
      const pts = [new Phaser.Math.Vector2(cx, cy - 11), new Phaser.Math.Vector2(cx + 9, cy), new Phaser.Math.Vector2(cx, cy + 11), new Phaser.Math.Vector2(cx - 9, cy)];
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    }

    // Slots.
    let selectedRect: SlotRect | null = null;
    for (let i = 0; i < INV_SLOTS; i++) {
      const r = this.slotRects[i];
      const count = this.countTexts[i];
      const keyText = this.keyTexts[i];
      if (!r.visible) {
        count.setVisible(false);
        keyText?.setVisible(false);
        continue;
      }
      const sel = i === this.inventory.selected;
      g.fillStyle(0x151b27, 0.88);
      g.fillRect(r.x, r.y, r.size, r.size);
      g.lineStyle(sel ? 3 : 2, sel ? 0xffd54a : 0x4a566b, 1);
      g.strokeRect(r.x, r.y, r.size, r.size);
      if (sel) selectedRect = r;

      const stack = this.inventory.slots[i];
      if (stack) {
        this.drawIcon(g, stack.id, r.x + r.size / 2, r.y + r.size / 2, r.size * 0.62);
      }
      if (stack && stack.count > 1) {
        count.setText(String(stack.count)).setPosition(r.x + r.size - 3, r.y + r.size - 2).setVisible(true);
      } else {
        count.setVisible(false);
      }
      if (keyText) keyText.setPosition(r.x + 3, r.y + 2).setVisible(true);
    }

    // Nombre del objeto seleccionado.
    const topY = this.slotRects[this.invOpen ? INV_SLOTS - 1 : HOTBAR_SLOTS - 1].y;
    const sel = this.inventory.selectedStack;
    this.nameText
      .setText(sel ? ITEMS[sel.id].name : '')
      .setPosition(this.scale.width / 2, topY - 8)
      .setVisible(!!sel && !!selectedRect);

    // Minimapa arriba a la derecha.
    const mmScale = this.scale.width >= 700 ? 1.25 : 1;
    const mmSize = 128 * mmScale;
    this.mm = { x: this.scale.width - 12 - mmSize, y: 12, scale: mmScale, size: mmSize };
    this.minimapImg.setPosition(this.mm.x, this.mm.y).setScale(mmScale);
    g.lineStyle(2, 0x4a566b, 1);
    g.strokeRect(this.mm.x - 1, this.mm.y - 1, mmSize + 2, mmSize + 2);

    this.toastText.setPosition(this.scale.width / 2, 16);
    this.toastText.setWordWrapWidth(Math.min(560, this.scale.width - 32));
    this.helpText.setVisible(this.scale.width >= 520);
  }

  private drawIcon(g: Phaser.GameObjects.Graphics, id: ItemId, cx: number, cy: number, s: number): void {
    const hs = s / 2;
    if (id === 'wood') {
      g.fillStyle(0x8a5a2b, 1);
      g.fillRect(cx - hs, cy - hs * 0.55, s, s * 0.4);
      g.fillRect(cx - hs, cy + hs * 0.05, s, s * 0.4);
      g.fillStyle(0xd9a566, 1);
      g.fillCircle(cx - hs, cy - hs * 0.35, s * 0.2);
      g.fillCircle(cx - hs, cy + hs * 0.25, s * 0.2);
    } else if (id === 'stone') {
      g.fillStyle(0x9aa0a8, 1);
      g.fillPoints(
        [new Phaser.Math.Vector2(cx - hs, cy + hs * 0.7), new Phaser.Math.Vector2(cx - hs * 0.7, cy - hs * 0.3), new Phaser.Math.Vector2(cx, cy - hs * 0.8), new Phaser.Math.Vector2(cx + hs * 0.8, cy - hs * 0.2), new Phaser.Math.Vector2(cx + hs, cy + hs * 0.7)],
        true,
      );
    } else if (id === 'ore') {
      g.fillStyle(0x8a8d94, 1);
      g.fillPoints(
        [new Phaser.Math.Vector2(cx - hs, cy + hs * 0.7), new Phaser.Math.Vector2(cx - hs * 0.7, cy - hs * 0.3), new Phaser.Math.Vector2(cx, cy - hs * 0.8), new Phaser.Math.Vector2(cx + hs * 0.8, cy - hs * 0.2), new Phaser.Math.Vector2(cx + hs, cy + hs * 0.7)],
        true,
      );
      g.fillStyle(0xf2b134, 1);
      g.fillRect(cx - hs * 0.4, cy - hs * 0.2, s * 0.22, s * 0.22);
      g.fillRect(cx + hs * 0.1, cy + hs * 0.2, s * 0.22, s * 0.22);
    } else {
      g.fillStyle(0xff5a1f, 1);
      g.lineStyle(2, 0xffe0b0, 1);
      const pts = [new Phaser.Math.Vector2(cx, cy - hs), new Phaser.Math.Vector2(cx + hs * 0.75, cy - hs * 0.1), new Phaser.Math.Vector2(cx, cy + hs), new Phaser.Math.Vector2(cx - hs * 0.75, cy - hs * 0.1)];
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    }
  }

  private showToast(msg: string): void {
    const now = this.time.now;
    if (msg === this.lastToast && now - this.lastToastAt < 1000) return;
    this.lastToast = msg;
    this.lastToastAt = now;
    this.toastTween?.stop();
    this.toastText.setText(msg).setAlpha(1);
    this.toastTween = this.tweens.add({ targets: this.toastText, alpha: 0, delay: 3200, duration: 700 });
  }
}
