import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { TitleScene } from './scenes/TitleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  backgroundColor: '#0d1117',
  render: {
    antialias: false,
    antialiasGL: false,
    pixelArt: true,
    roundPixels: true,
    desynchronized: true,
    powerPreference: 'high-performance',
  },
  fps: {
    target: 60,
    min: 30,
    limit: 0,
    deltaHistory: 10,
    smoothStep: true,
  },
  scale: {
    // Keep the whole 480x272 play area visible at every window aspect ratio.
    // FIT may add letterboxing, but never crops the HUD or room edges.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, GameScene, PauseScene, GameOverScene],
};

new Phaser.Game(config);
