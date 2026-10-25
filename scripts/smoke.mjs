// Test de humo: abre la build en Chromium y comprueba las mecánicas básicas.
// Uso: node scripts/smoke.mjs <boot|move|mine|place|gem>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const step = process.argv[2];
const URL = process.env.GAME_URL || 'http://localhost:4173/';
const T = 32;

mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

let failed = false;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '::notice::PASS' : '::error::FAIL'} ${name} ${extra}`);
  if (!ok) failed = true;
};

await page.goto(URL + (process.env.GAME_QS || ''));
await page.waitForFunction(() => window.__relic && window.__relic.world && window.__relic.scene.isActive('UI'), null, { timeout: 20000 });
await page.waitForTimeout(600);

// Convierte una celda del mundo en coordenadas de pantalla.
const screenOf = (tx, ty) =>
  page.evaluate(
    ([tx, ty, T]) => {
      const cam = window.__relic.cameras.main;
      return { x: (tx * T + T / 2 - cam.worldView.x) * cam.zoom, y: (ty * T + T / 2 - cam.worldView.y) * cam.zoom };
    },
    [tx, ty, T],
  );
const teleport = async (tx, ty) => {
  await page.evaluate(([tx, ty, T]) => {
    const s = window.__relic;
    s.px = (tx + 0.5) * T;
    s.py = (ty + 0.5) * T;
    s.cameras.main.centerOn(s.px, s.py);
  }, [tx, ty, T]);
  await page.waitForTimeout(500);
};

const info = await page.evaluate(() => {
  const s = window.__relic;
  return { spawn: s.world.spawn, gem: s.world.gem, gemBlock: s.world.blockAt(s.world.gem.x, s.world.gem.y), canvas: !!document.querySelector('canvas') };
});

if (step === 'boot') {
  check('hay canvas', info.canvas);
  check('la gema existe en el mapa', info.gemBlock === 6, `gem=${JSON.stringify(info.gem)}`);
  const wall = await page.evaluate(() => {
    const s = window.__relic;
    const g = s.world.gem;
    return s.world.blockAt(g.x + 3, g.y) === 5 && s.world.blockAt(g.x, g.y - 3) === 5;
  });
  check('la ruina está cerrada con muros', wall);
  check('inventario de 20 slots', (await page.evaluate(() => window.__relic.inventory.slots.length)) === 20);
}

if (step === 'move') {
  const x0 = await page.evaluate(() => window.__relic.px);
  await page.keyboard.down('d');
  await page.waitForTimeout(500);
  await page.keyboard.up('d');
  const x1 = await page.evaluate(() => window.__relic.px);
  check('el jugador se mueve con D', x1 > x0 + 20, `x0=${x0.toFixed(0)} x1=${x1.toFixed(0)}`);
}

if (step === 'mine') {
  // Busca un bloque rompible cerca del spawn con una celda libre al lado.
  const target = await page.evaluate(() => {
    const w = window.__relic.world;
    for (let r = 3; r < 20; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = w.spawn.x + dx;
          const y = w.spawn.y + dy;
          if (!w.inBounds(x, y) || ![1, 2, 3].includes(w.blockAt(x, y))) continue;
          const nbrs = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
          const free = nbrs.find(([nx, ny]) => w.inBounds(nx, ny) && !w.isSolid(nx, ny));
          if (free) return { x, y, free };
        }
      }
    }
    return null;
  });
  check('hay un bloque rompible cerca', !!target);
  if (target) {
    await teleport(target.free[0], target.free[1]);
    const p = await screenOf(target.x, target.y);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.waitForTimeout(2200);
    await page.mouse.up();
    const res = await page.evaluate(([x, y]) => {
      const s = window.__relic;
      return { block: s.world.blockAt(x, y), items: s.inventory.slots.filter(Boolean).length };
    }, [target.x, target.y]);
    check('el bloque se rompe', res.block === 0, JSON.stringify(res));
    check('el objeto llega al inventario', res.items > 0, JSON.stringify(res));
  }
}

if (step === 'place') {
  await page.evaluate(() => {
    const s = window.__relic;
    s.inventory.add('stone', 5);
    s.inventory.select(0);
  });
  const { x, y } = info.spawn;
  await teleport(x, y);
  const p = await screenOf(x + 2, y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(200);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(200);
  await page.mouse.up({ button: 'right' });
  const res = await page.evaluate(([x, y]) => {
    const s = window.__relic;
    return { block: s.world.blockAt(x, y), left: s.inventory.slots[0] && s.inventory.slots[0].count };
  }, [x + 2, y]);
  check('se coloca un muro de piedra', res.block === 5, JSON.stringify(res));
  check('se descuenta del inventario', res.left === 4, JSON.stringify(res));
}

if (step === 'gem') {
  await page.evaluate(() => {
    const s = window.__relic;
    s.breakBlock(s.world.gem.x, s.world.gem.y);
  });
  const res = await page.evaluate(() => {
    const s = window.__relic;
    return { gems: s.registry.get('gems'), hasItem: s.inventory.slots.some((st) => st && st.id === 'fire_gem') };
  });
  check('se consigue la Gema de Fuego', res.gems === 1 && res.hasItem, JSON.stringify(res));
}

if (step === 'clock') {
  const r = await page.evaluate(() => {
    const c = window.__relic.clock;
    const at = (f) => {
      c.setFraction(f);
      return { dark: c.darkness, night: c.isNight };
    };
    const noon = at(0.5);
    const midnight = at(0.0);
    const evening = at(0.95);
    c.setFraction(0.3);
    const day0 = c.day;
    c.skipToDusk();
    const dusk = { frac: c.fraction, dark: c.darkness };
    return { noon, midnight, evening, dusk, day0, clock: c.clockText };
  });
  check('mediodía es de día', r.noon.dark === 0 && !r.noon.night, JSON.stringify(r.noon));
  check('medianoche es de noche', r.midnight.dark === 1 && r.midnight.night, JSON.stringify(r.midnight));
  check('19:00-23:00 es noche', r.evening.night, JSON.stringify(r.evening));
  check('el atardecer es una transición', r.dusk.dark > 0 && r.dusk.dark < 0.55, JSON.stringify(r.dusk));
}

if (step === 'minimap') {
  const r = await page.evaluate(() => {
    const s = window.__relic;
    const ex = s.world.explored.reduce((a, b) => a + b, 0);
    const far = s.world.explored[0];
    const gem = s.world.gem;
    return { ex, far, gemKnown: s.world.explored[gem.y * s.world.w + gem.x], tex: s.textures.exists('minimap') };
  });
  check('existe la textura del minimapa', r.tex);
  check('hay tiles explorados alrededor del jugador', r.ex > 100 && r.ex < 1000, `explorados=${r.ex}`);
  check('la niebla oculta el resto del mapa', r.far === 0 && r.gemKnown === 0, JSON.stringify(r));
  // Explorar al caminar descubre más.
  const before = r.ex;
  await teleport(info.spawn.x + 6, info.spawn.y);
  const after = await page.evaluate(() => window.__relic.world.explored.reduce((a, b) => a + b, 0));
  check('caminar descubre más mapa', after > before, `${before} -> ${after}`);
}

if (step === 'enemies') {
  await page.evaluate(() => window.__relic.clock.setFraction(0.95)); // noche
  await page.waitForFunction(() => window.__relic.enemies.alive() > 0, null, { timeout: 12000 }).catch(() => {});
  const r = await page.evaluate(() => {
    const s = window.__relic;
    const night = s.clock.isNight;
    const dists = s.enemies.list.map((e) => Math.hypot(e.x - s.px, e.y - s.py) / 32);
    return { night, count: s.enemies.alive(), minDist: Math.min(...dists) };
  });
  check('de noche aparecen enemigos', r.count > 0, JSON.stringify(r));
  check('aparecen lejos del jugador (>=9 tiles)', r.minDist >= 9, JSON.stringify(r));
  await page.waitForTimeout(4000);
  const later = await page.evaluate(() => {
    const s = window.__relic;
    const dists = s.enemies.list.map((e) => Math.hypot(e.x - s.px, e.y - s.py) / 32);
    return { minDist: Math.min(...dists) };
  });
  check('los enemigos se acercan al jugador', later.minDist < r.minDist - 0.5, JSON.stringify({ antes: r.minDist, despues: later.minDist }));
}

if (step === 'combat') {
  await page.evaluate(() => {
    window.__relic.clock.setFraction(0.95);
    window.__relic.enemies.spawningEnabled = false;
  });
  // Un enemigo pegado al jugador le hace daño.
  await page.evaluate(() => {
    const s = window.__relic;
    s.enemies.clear();
    s.enemies.spawnAt(s.px + 10, s.py, 1);
  });
  await page.waitForTimeout(1500);
  const hp = await page.evaluate(() => window.__relic.hp);
  check('un enemigo cercano hiere al jugador', hp < 20, `hp=${hp}`);

  // El jugador lo mata a clics.
  await page.evaluate(() => {
    const s = window.__relic;
    s.enemies.clear();
    s.enemies.spawnAt(s.px + 48, s.py, 1);
    s.enemies.list[0].speed = 0;
  });
  await page.waitForTimeout(300);
  const enemyScreen = () =>
    page.evaluate(() => {
      const s = window.__relic;
      const e = s.enemies.list[0];
      if (!e) return null;
      const cam = s.cameras.main;
      return { x: (e.x - cam.worldView.x) * cam.zoom, y: (e.y - 4 - cam.worldView.y) * cam.zoom };
    });
  const pos = await enemyScreen();
  await page.mouse.move(pos.x, pos.y);
  await page.mouse.down();
  // Como un jugador: el cursor sigue al enemigo mientras se mantiene el click.
  for (let i = 0; i < 24; i++) {
    const q = await enemyScreen();
    if (!q) break;
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(90);
  }
  await page.mouse.up();
  const left = await page.evaluate(() => window.__relic.enemies.alive());
  check('el jugador mata al enemigo con click', left === 0, `vivos=${left}`);

  // Morir devuelve al campamento con la vida llena.
  await page.evaluate(() => {
    const s = window.__relic;
    s.px += 200;
    s.hurtPlayer(100, s.px - 5, s.py);
  });
  const res = await page.evaluate(() => {
    const s = window.__relic;
    return { hp: s.hp, atSpawn: Math.floor(s.px / 32) === s.world.spawn.x };
  });
  check('al morir reapareces en el campamento con vida llena', res.hp === 20 && res.atSpawn, JSON.stringify(res));
}

if (step === 'dawn') {
  await page.evaluate(() => {
    const s = window.__relic;
    s.enemies.clear();
    for (let i = 0; i < 4; i++) s.enemies.spawnAt(s.px + 300 + i * 20, s.py, 1);
    s.clock.setFraction(0.5); // mediodía
  });
  await page.waitForFunction(() => window.__relic.enemies.list.length === 0, null, { timeout: 14000 }).catch(() => {});
  const n = await page.evaluate(() => window.__relic.enemies.list.length);
  check('al amanecer los enemigos desaparecen', n === 0, `quedan=${n}`);
}

const shot = await page.screenshot({ path: `test-results/${step}.png` });

if (step === 'render') {
  // Analiza los píxeles de la captura: no debe ser (casi) todo negro.
  const p2 = await browser.newPage();
  const stats = await p2.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    let lum = 0;
    let bright = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      lum += l;
      if (l > 40) bright++;
      colors.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    }
    // Centro de la pantalla (donde debería verse el mapa).
    const cx = Math.floor(c.width / 2);
    const cy = Math.floor(c.height / 2);
    const mid = ctx.getImageData(cx - 40, cy - 40, 80, 80).data;
    let midLum = 0;
    for (let i = 0; i < mid.length; i += 4) midLum += 0.299 * mid[i] + 0.587 * mid[i + 1] + 0.114 * mid[i + 2];
    const cor = ctx.getImageData(10, c.height - 90, 80, 80).data;
    let corLum = 0;
    for (let i = 0; i < cor.length; i += 4) corLum += 0.299 * cor[i] + 0.587 * cor[i + 1] + 0.114 * cor[i + 2];
    return { mean: lum / n, brightFrac: bright / n, colors: colors.size, centerMean: midLum / (mid.length / 4), cornerMean: corLum / (cor.length / 4) };
  }, shot.toString('base64'));
  const rend = await page.evaluate(() => ({
    type: window.__relic.game.config.renderType,
    gl: !!window.__relic.game.renderer.gl,
    canvasW: document.querySelector('canvas').width,
    canvasH: document.querySelector('canvas').height,
  }));
  console.log('::notice::render stats ' + JSON.stringify({ ...stats, ...rend }));
  check('el mapa se dibuja (centro no negro)', stats.centerMean > 30 && stats.colors > 25, JSON.stringify(stats));
  if (process.env.EXPECT_NIGHT) {
    check('de noche el borde está oscuro y hay luz alrededor del jugador', stats.cornerMean < stats.centerMean * 0.6, JSON.stringify(stats));
  }
}

check('sin errores en consola', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.exit(failed ? 1 : 0);
