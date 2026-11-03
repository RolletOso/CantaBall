import Phaser from 'phaser';
import './style.css';
import { CantaBallScene } from './scenes/CantaBallScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#176b43',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 900,
    height: 600,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      enableSleeping: true,
      debug: false,
    },
  },
  scene: [CantaBallScene],
});

window.addEventListener('beforeunload', () => game.destroy(true));