import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config/gameConfig';

// The camera zoom maps each 480x272 gameplay pixel to RENDER_SCALE physical
// pixels. Re-centering keeps the logical pixel-art canvas aligned after zoom.
export function applyRenderScale(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(RENDER_SCALE);
  scene.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}

export interface FitViewport {
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  letterboxX: number;
  letterboxY: number;
}

export function calculateFitViewport(displayWidth: number, displayHeight: number): FitViewport {
  const scale = Math.min(displayWidth / GAME_WIDTH, displayHeight / GAME_HEIGHT);
  const renderedWidth = GAME_WIDTH * scale;
  const renderedHeight = GAME_HEIGHT * scale;

  return {
    scale,
    renderedWidth,
    renderedHeight,
    letterboxX: Math.max(0, (displayWidth - renderedWidth) / 2),
    letterboxY: Math.max(0, (displayHeight - renderedHeight) / 2),
  };
}
