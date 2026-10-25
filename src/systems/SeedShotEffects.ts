import type Phaser from 'phaser';
import { DEPTH, FEEDBACK_TUNING } from '../config/gameConfig';

const FLASH_MS = FEEDBACK_TUNING.effects.muzzleMs;
const LIFE_MS = 230;
export const MAX_SEED_FLASHES = 24;

interface SeedFlash {
  x: number;
  y: number;
  direction: { x: number; y: number };
  age: number;
  tint: number;
  scale: number;
  variant: number;
}

function tintColor(color: number, tint: number): number {
  const r = Math.round((((color >> 16) & 255) * ((tint >> 16) & 255)) / 255);
  const g = Math.round((((color >> 8) & 255) * ((tint >> 8) & 255)) / 255);
  const b = Math.round(((color & 255) * (tint & 255)) / 255);
  return (r << 16) | (g << 8) | b;
}

/** One shared graphics object, bounded bursts, and no gameplay RNG consumption. */
export class SeedShotEffects {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly flashes: SeedFlash[] = [];
  private serial = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(DEPTH.effect);
  }

  emit(
    x: number,
    y: number,
    direction: { x: number; y: number },
    tint = 0xffffff,
    scale = 1,
  ): void {
    if (this.flashes.length >= MAX_SEED_FLASHES) this.flashes.shift();
    this.flashes.push({
      x,
      y,
      direction: { ...direction },
      tint,
      scale: Math.max(0.75, Math.min(1.5, scale)),
      age: 0,
      variant: this.serial++ % 3,
    });
    this.draw();
  }

  update(deltaMs: number): void {
    const delta = Math.max(0, deltaMs);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].age += delta;
      if (this.flashes[i].age >= LIFE_MS) this.flashes.splice(i, 1);
    }
    this.draw();
  }

  clear(): void {
    this.flashes.length = 0;
    this.graphics.clear();
  }

  private draw(): void {
    const graphics = this.graphics.clear();
    for (const flash of this.flashes) {
      const { x, y, direction: d, age, tint, scale, variant } = flash;
      // Transform integer cells into world space; the effect works in every
      // firing direction without rotating smooth polygons across the pixel grid.
      const pixel = (forward: number, side: number, size: number, color: number, alpha: number) => {
        const width = Math.max(1, Math.round(size * scale));
        graphics.fillStyle(tintColor(color, tint), alpha);
        graphics.fillRect(
          Math.round(x + (d.x * forward - d.y * side) * scale - width / 2),
          Math.round(y + (d.y * forward + d.x * side) * scale - width / 2),
          width,
          width,
        );
      };
      if (age < FLASH_MS) {
        const fade = 1 - age / FLASH_MS;
        const reach = Math.round(3 + Math.sin((age / FLASH_MS) * Math.PI) * 4);
        for (let forward = 0; forward <= reach; forward++) {
          const halfWidth = forward < 3 ? 1 : 0;
          for (let side = -halfWidth; side <= halfWidth; side++) {
            pixel(forward + 1, side, 1, side === 0 ? 0xfff6d5 : 0xb9d46c, fade);
          }
        }
        pixel(2, -3, 1, 0xe2ec9a, fade * 0.8);
        pixel(2, 3, 1, 0xe2ec9a, fade * 0.8);
      }
      const t = age / LIFE_MS;
      const travel = 1 - (1 - t) * (1 - t);
      // Five forward husk/sap flecks open into a short, asymmetric fan.
      for (let i = 0; i < 5; i++) {
        const side = i - 2;
        const distance = 8 + ((i * 7 + variant * 3) % 11);
        pixel(
          2 + travel * distance,
          side * (1 + travel * 2.4) + Math.sin(i * 2 + variant) * travel,
          i % 2 === 0 && t < 0.45 ? 2 : 1,
          [0xe4ecad, 0xa9c95b, 0xffedb8][i % 3],
          (1 - t) * 0.8,
        );
      }
      // A little spent husk behind the muzzle, fading after the bright snap.
      for (let i = 0; i < 3; i++) {
        pixel(
          -1 - travel * (3 + i * 2),
          (i - 1) * (2 + travel * 3),
          1,
          0x91a077,
          Math.sin(t * Math.PI) * 0.35,
        );
      }
    }
  }
}
