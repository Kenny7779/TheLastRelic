import Phaser from 'phaser';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';

new Phaser.Game({
  type: Phaser.AUTO,
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
