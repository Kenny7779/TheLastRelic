import Phaser from 'phaser';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';

// ?canvas fuerza el renderizador Canvas (respaldo si WebGL falla en algún equipo).
const forceCanvas = new URLSearchParams(window.location.search).has('canvas');

new Phaser.Game({
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#10141c',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  scene: [WorldScene, UIScene],
});
