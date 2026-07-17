import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config/gameConfig';

// The camera zoom maps each 480x272 gameplay pixel to RENDER_SCALE physical
// pixels. Re-centering keeps the logical pixel-art canvas aligned after zoom.
export function applyRenderScale(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(RENDER_SCALE);
  scene.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}

export interface CoverViewport {
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  cropX: number;
  cropY: number;
}

export function calculateCoverViewport(displayWidth: number, displayHeight: number): CoverViewport {
  const scale = Math.max(displayWidth / GAME_WIDTH, displayHeight / GAME_HEIGHT);
  const renderedWidth = GAME_WIDTH * scale;
  const renderedHeight = GAME_HEIGHT * scale;

  return {
    scale,
    renderedWidth,
    renderedHeight,
    cropX: Math.max(0, (renderedWidth - displayWidth) / 2),
    cropY: Math.max(0, (renderedHeight - displayHeight) / 2),
  };
}
