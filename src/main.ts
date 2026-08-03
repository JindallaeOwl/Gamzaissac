import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
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
  scene: [BootScene, TitleScene, GameScene, PauseScene, TitleTransitionScene],
};

const game = new Phaser.Game(config);

/* iOS는 기기를 돌린 직후 잠깐 회전 전 화면 크기를 보고한다. 그 순간 Phaser가
   캔버스를 맞추면 회전 뒤에도 옛 비율이 남아 화면이 어긋난다. 회전과 가시 영역
   변화가 끝난 뒤 한 번 더 재계산해 실제 보이는 영역에 다시 맞춘다. */
function refreshScaleAfterViewportChange(): void {
  window.requestAnimationFrame(() => {
    game.scale.refresh();
  });
  window.setTimeout(() => {
    game.scale.refresh();
  }, 250);
}

window.addEventListener('orientationchange', refreshScaleAfterViewportChange);
window.visualViewport?.addEventListener('resize', refreshScaleAfterViewportChange);
