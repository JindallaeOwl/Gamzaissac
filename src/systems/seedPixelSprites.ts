import type Phaser from 'phaser';
import { TextureKeys } from '../config/assets';

export const SEED_FRAME_WIDTH = 12;
export const SEED_FRAME_HEIGHT = 10;
export const SEED_FRAME_MS = 55;

// A pointed hull facing right. The seam rolls through the light while the
// silhouette and frame origin stay fixed, including on large/red item builds.
export const SEED_FRAMES = [
  [
    '............',
    '............',
    '....ooo.....',
    '..oohhhhoo..',
    '.osllbbbhho.',
    '.osmbbbhho..',
    '..ossmmoo...',
    '....ooo.....',
    '............',
    '............',
  ],
  [
    '............',
    '............',
    '....ooo.....',
    '..oobblloo..',
    '.osmhhhbhho.',
    '.osllbbhho..',
    '..osbmmoo...',
    '....ooo.....',
    '............',
    '............',
  ],
  [
    '............',
    '............',
    '....ooo.....',
    '..oombbloo..',
    '.osbbmlbhho.',
    '.oslhhhhho..',
    '..osllmoo...',
    '....ooo.....',
    '............',
    '............',
  ],
  [
    '............',
    '............',
    '....ooo.....',
    '..oollbboo..',
    '.oslhhhbhho.',
    '.osmbblhho..',
    '..ossbmoo...',
    '....ooo.....',
    '............',
    '............',
  ],
] as const;

export const SEED_PALETTE: Readonly<Record<string, number>> = {
  o: 0x293c26,
  s: 0x526c37,
  m: 0x829443,
  b: 0xb5c667,
  l: 0xe0e89c,
  h: 0xfff4cc,
};

export function seedFlightFrame(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / SEED_FRAME_MS) % SEED_FRAMES.length;
}

export const SEED_DROP_BOUNCE_MS = 85;
export const SEED_DROP_FADE_MS = 100;

export function seedDropFallMs(speed: number): number {
  // Carry the incoming velocity into the arc, but keep even fast seeds' extra
  // visual travel within 28px. The damage body has already expired.
  return Math.min(190, 56000 / Math.max(1, speed));
}

export function seedDropPose(
  elapsedMs: number,
  velocity: { x: number; y: number },
  fallMs: number,
): { x: number; y: number; groundY: number; alpha: number; squash: number; progress: number } {
  const t = Math.max(0, Math.min(1, elapsedMs / fallMs));
  // Forward drag starts with the original velocity and reaches zero at impact.
  // Screen-down gravity starts at zero, so the path curves without a sudden kink.
  const travel = (fallMs / 1000) * (t - t * t * 0.5);
  const bounce = Math.max(0, Math.min(1, (elapsedMs - fallMs) / SEED_DROP_BOUNCE_MS));
  const groundY = velocity.y * travel + 12;
  const hop = elapsedMs >= fallMs ? 4 * 1.5 * bounce * (1 - bounce) : 0;
  return {
    x: velocity.x * travel,
    y: velocity.y * travel + 12 * t * t - hop,
    groundY,
    alpha: Math.max(
      0,
      1 - Math.max(0, elapsedMs - fallMs - SEED_DROP_BOUNCE_MS) / SEED_DROP_FADE_MS,
    ),
    squash: elapsedMs >= fallMs ? 0.82 + 0.18 * Math.min(1, bounce * 4) : 1,
    progress: t,
  };
}

export function createSeedTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.playerSeed)) return;
  const texture = scene.textures.createCanvas(
    TextureKeys.playerSeed,
    SEED_FRAME_WIDTH * SEED_FRAMES.length,
    SEED_FRAME_HEIGHT,
  )!;
  const context = texture.context;
  SEED_FRAMES.forEach((rows, frame) => {
    rows.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (pixel === '.') return;
        context.fillStyle = `#${SEED_PALETTE[pixel].toString(16).padStart(6, '0')}`;
        context.fillRect(frame * SEED_FRAME_WIDTH + x, y, 1, 1);
      });
    });
    texture.add(frame, 0, frame * SEED_FRAME_WIDTH, 0, SEED_FRAME_WIDTH, SEED_FRAME_HEIGHT);
  });
  texture.refresh();
}
