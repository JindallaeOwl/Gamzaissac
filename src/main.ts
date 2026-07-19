import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { TitleScene } from './scenes/TitleScene';
import { TitleTransitionScene } from './scenes/TitleTransitionScene';
import { getRenderScale } from './systems/GameSettings';

const initialRenderScale = getRenderScale();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH * initialRenderScale,
  height: GAME_HEIGHT * initialRenderScale,
  backgroundColor: '#0d1117',
  render: {
    antialias: false,
    antialiasGL: false,
    pixelArt: true,
    roundPixels: true,
    // The HUD uses a second camera. Present only completed frames so the
    // browser cannot display the world-camera pass before the HUD pass.
    desynchronized: false,
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
  scene: [BootScene, TitleScene, GameScene, PauseScene, GameOverScene, TitleTransitionScene],
};

new Phaser.Game(config);
