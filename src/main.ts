import Phaser from 'phaser';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';

// Por defecto usa Canvas 2D (funciona en cualquier equipo, sin depender de la GPU).
// Añade ?webgl a la URL para probar el renderizador WebGL.
const useWebGL = new URLSearchParams(window.location.search).has('webgl');

new Phaser.Game({
  type: useWebGL ? Phaser.AUTO : Phaser.CANVAS,
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
