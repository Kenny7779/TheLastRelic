import Phaser from 'phaser';
import { TILE } from '../config';
import { mulberry32 } from './World';

export const TILESET_KEY = 'tileset';
/** 4 de terreno + 7 de bloques. */
const TILE_COUNT = 11;

/** Dibuja todos los tiles por código (sin assets externos) en una sola textura. */
export function createTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists(TILESET_KEY)) return;

  const canvas = document.createElement('canvas');
  canvas.width = TILE * TILE_COUNT;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const rand = mulberry32(7);

  const rect = (i: number, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * TILE + x, y, w, h);
  };
  const poly = (i: number, pts: number[][], fill: string, stroke?: string) => {
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(i * TILE + x, y) : ctx.moveTo(i * TILE + x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  const circle = (i: number, cx: number, cy: number, r: number, color: string) => {
    ctx.beginPath();
    ctx.arc(i * TILE + cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const speckle = (i: number, colors: string[], n: number, w = 2, h = 2) => {
    for (let k = 0; k < n; k++) {
      rect(i, Math.floor(rand() * (TILE - w)), Math.floor(rand() * (TILE - h)), w, h, colors[k % colors.length]);
    }
  };

  // --- Terreno ---
  rect(0, 0, 0, TILE, TILE, '#2b6cb0'); // 0 agua
  speckle(0, ['#3b82c4', '#2a65a8'], 10, 6, 2);

  rect(1, 0, 0, TILE, TILE, '#d9c27a'); // 1 arena
  speckle(1, ['#c9b05f', '#e8d79a'], 16);

  rect(2, 0, 0, TILE, TILE, '#4c9a3f'); // 2 pasto
  speckle(2, ['#5fb04f', '#3f8535'], 20, 2, 3);

  rect(3, 0, 0, TILE, TILE, '#7b7f86'); // 3 suelo rocoso
  speckle(3, ['#6a6e75', '#8d9198'], 18);

  // --- Bloques (fondo transparente) ---
  // 4 árbol (BlockId.TREE = 1)
  rect(4, 13, 18, 6, 12, '#6b4423');
  circle(4, 16, 13, 12, '#2f7d32');
  circle(4, 13, 10, 7, '#3f9a42');
  circle(4, 20, 16, 4, '#276a2a');

  // 5 roca
  poly(5, [[5, 27], [7, 13], [16, 6], [25, 10], [28, 27]], '#8a8d94', '#55585e');
  poly(5, [[9, 14], [16, 9], [20, 12], [12, 17]], '#a5a8af');

  // 6 mineral
  poly(6, [[5, 27], [7, 13], [16, 6], [25, 10], [28, 27]], '#8a8d94', '#55585e');
  rect(6, 11, 13, 4, 4, '#f2b134');
  rect(6, 19, 18, 4, 4, '#f2b134');
  rect(6, 10, 21, 3, 3, '#ffd36b');

  // 7 pared de madera
  rect(7, 1, 1, 30, 30, '#a9743c');
  for (let y = 8; y < TILE; y += 8) rect(7, 1, y, 30, 2, '#7d5228');
  ctx.strokeStyle = '#5a3a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(7 * TILE + 1, 1, 30, 30);

  // 8 muro de piedra
  rect(8, 1, 1, 30, 30, '#9aa0a8');
  for (let y = 9; y < TILE; y += 10) rect(8, 1, y, 30, 2, '#6c7178');
  rect(8, 10, 1, 2, 8, '#6c7178');
  rect(8, 22, 11, 2, 8, '#6c7178');
  rect(8, 10, 21, 2, 10, '#6c7178');
  ctx.strokeStyle = '#4b4f55';
  ctx.lineWidth = 2;
  ctx.strokeRect(8 * TILE + 1, 1, 30, 30);

  // 9 gema de fuego sobre pedestal
  circle(9, 16, 14, 14, 'rgba(255,122,42,0.28)');
  rect(9, 8, 23, 16, 7, '#5e5a66');
  rect(9, 6, 28, 20, 3, '#47434e');
  poly(9, [[16, 3], [25, 13], [16, 25], [7, 13]], '#ff5a1f', '#a62b00');
  poly(9, [[16, 5], [21, 12], [16, 14], [11, 12]], '#ffb74d');

  // 10 puente
  rect(10, 0, 0, TILE, TILE, '#8a5a2b');
  for (let y = 0; y < TILE; y += 8) rect(10, 0, y, TILE, 2, '#5a3a1a');
  rect(10, 0, 0, 3, TILE, '#6b4423');
  rect(10, TILE - 3, 0, 3, TILE, '#6b4423');

  scene.textures.addCanvas(TILESET_KEY, canvas);
}

/** Textura del jugador (24x30). */
export function createPlayerTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, 24, 30)!;
  const ctx = tex.getContext();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(12, 26, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a5a2b'; // mochila
  ctx.fillRect(3, 12, 18, 12);
  ctx.fillStyle = '#2f5fa8'; // cuerpo
  ctx.fillRect(5, 12, 14, 12);
  ctx.fillStyle = '#244a85';
  ctx.fillRect(5, 20, 14, 4);
  ctx.fillStyle = '#e0b48a'; // cabeza
  ctx.fillRect(6, 3, 12, 10);
  ctx.fillStyle = '#4a2f1a'; // pelo
  ctx.fillRect(6, 3, 12, 4);
  ctx.fillStyle = '#1b1b1b'; // ojos
  ctx.fillRect(9, 9, 2, 2);
  ctx.fillRect(14, 9, 2, 2);
  tex.refresh();
}

/** Textura del enemigo (24x24): criatura de sombra con ojos rojos. */
export function createEnemyTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, 24, 24)!;
  const ctx = tex.getContext();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(12, 20, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2250';
  ctx.beginPath();
  ctx.moveTo(3, 20);
  ctx.lineTo(3, 11);
  ctx.quadraticCurveTo(12, -3, 21, 11);
  ctx.lineTo(21, 20);
  ctx.lineTo(17, 17);
  ctx.lineTo(12, 20);
  ctx.lineTo(7, 17);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5b3a7a';
  ctx.fillRect(7, 6, 4, 2);
  ctx.fillStyle = '#ff2a2a'; // ojos
  ctx.fillRect(7, 11, 3, 3);
  ctx.fillRect(14, 11, 3, 3);
  tex.refresh();
}

/** Textura de la "viñeta" nocturna: transparente al centro, oscura en los bordes. */
export function createLightTexture(scene: Phaser.Scene, key: string, size = 512): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, size, size)!;
  const ctx = tex.getContext();
  const half = size / 2;
  const g = ctx.createRadialGradient(half, half, half * 0.3, half, half, half);
  g.addColorStop(0, 'rgba(6,10,32,0)');
  g.addColorStop(0.55, 'rgba(6,10,32,0.45)');
  g.addColorStop(1, 'rgba(6,10,32,0.86)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}
