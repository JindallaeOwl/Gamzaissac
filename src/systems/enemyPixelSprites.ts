import type Phaser from 'phaser';

/**
 * Placeholder enemy sprites generated procedurally on a 16x16 grid. Shapes are
 * rasterized with math (discs, diamonds, wedges) so their curves are smooth, and
 * every build mirrors its left half onto the right so the result is always
 * perfectly left-right symmetric. Sprites are drawn at ENEMY_SPRITE_SCALE so one
 * design pixel becomes a crisp NxN block, matching the game's nearest-neighbor
 * rendering. These are intended to be replaced later by hand-drawn 16x16 PNGs.
 */
export const ENEMY_SPRITE_SIZE = 16;
export const ENEMY_SPRITE_SCALE = 2;

interface BodyPalette {
  shade: number;
  base: number;
  light: number;
}

export class PixelSprite {
  readonly size: number;
  private readonly cells: (number | null)[];

  constructor(size: number = ENEMY_SPRITE_SIZE) {
    this.size = size;
    this.cells = new Array(size * size).fill(null);
  }

  set(x: number, y: number, color: number | null): void {
    const ix = Math.round(x);
    const iy = Math.round(y);

    if (ix < 0 || iy < 0 || ix >= this.size || iy >= this.size) {
      return;
    }

    this.cells[iy * this.size + ix] = color;
  }

  get(x: number, y: number): number | null {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) {
      return null;
    }

    return this.cells[y * this.size + x];
  }

  /** Filled disc with top-to-bottom light→base→shade banding for a round look. */
  disc(cx: number, cy: number, r: number, palette: BodyPalette): void {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const dx = x - cx;
        const dy = y - cy;

        if (dx * dx + dy * dy <= r * r) {
          this.set(x, y, this.shadeBand(dy / r, palette));
        }
      }
    }
  }

  /** Filled diamond (rotated square) with the same vertical banding. */
  diamond(cx: number, cy: number, r: number, palette: BodyPalette): void {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (Math.abs(x - cx) + Math.abs(y - cy) <= r) {
          this.set(x, y, this.shadeBand((y - cy) / r, palette));
        }
      }
    }
  }

  /** Downward wedge (arrowhead): wide at the top, a single point at the bottom. */
  wedge(cx: number, topY: number, bottomY: number, topHalf: number, palette: BodyPalette): void {
    for (let y = topY; y <= bottomY; y += 1) {
      const t = (bottomY - y) / (bottomY - topY);
      const half = topHalf * t;

      for (let x = 0; x < this.size; x += 1) {
        if (Math.abs(x - cx) <= half + 0.001) {
          const ny = (y - topY) / (bottomY - topY) - 0.5;
          this.set(x, y, this.shadeBand(ny, palette));
        }
      }
    }
  }

  /** A 2x2 eye with a single highlight pixel at its top-left. */
  eye(x: number, y: number, dark: number, glint: number): void {
    this.set(x, y, dark);
    this.set(x + 1, y, dark);
    this.set(x, y + 1, dark);
    this.set(x + 1, y + 1, dark);
    this.set(x, y, glint);
  }

  /** Draw a 1px outline ring around the current silhouette. */
  outline(color: number): void {
    const filled = this.cells.map((cell) => cell !== null);
    const neighbors = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];

    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (filled[y * this.size + x]) {
          continue;
        }

        const touchesBody = neighbors.some(([ox, oy]) => {
          const nx = x + ox;
          const ny = y + oy;
          return (
            nx >= 0 && nx < this.size && ny >= 0 && ny < this.size && filled[ny * this.size + nx]
          );
        });

        if (touchesBody) {
          this.set(x, y, color);
        }
      }
    }
  }

  /** Copy the left half onto the right half, guaranteeing perfect symmetry. */
  mirror(): void {
    const half = Math.floor(this.size / 2);

    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < half; x += 1) {
        this.cells[y * this.size + (this.size - 1 - x)] = this.cells[y * this.size + x];
      }
    }
  }

  isHorizontallySymmetric(): boolean {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < Math.floor(this.size / 2); x += 1) {
        if (this.get(x, y) !== this.get(this.size - 1 - x, y)) {
          return false;
        }
      }
    }

    return true;
  }

  filledCount(): number {
    return this.cells.reduce<number>((count, cell) => (cell === null ? count : count + 1), 0);
  }

  generateTexture(scene: Phaser.Scene, key: string, scale: number = ENEMY_SPRITE_SCALE): void {
    const graphics = scene.add.graphics();

    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const color = this.get(x, y);

        if (color === null) {
          continue;
        }

        graphics.fillStyle(color, 1);
        graphics.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    graphics.generateTexture(key, this.size * scale, this.size * scale);
    graphics.destroy();
  }

  private shadeBand(ny: number, palette: BodyPalette): number {
    if (ny < -0.4) {
      return palette.light;
    }

    if (ny > 0.45) {
      return palette.shade;
    }

    return palette.base;
  }
}

export type EnemySpriteBuilder = (sprite: PixelSprite) => void;

export const buildChaser: EnemySpriteBuilder = (s) => {
  s.disc(7.5, 7.5, 6.5, { shade: 0xcf3348, base: 0xff5d72, light: 0xffb0bb });
  s.outline(0x3d0f18);
  s.eye(4, 7, 0x1a0a0e, 0xffe3e7);
  s.set(6, 12, 0xf4ede0);
  s.set(6, 13, 0xf4ede0);
  s.mirror();
};

export const buildShooter: EnemySpriteBuilder = (s) => {
  s.diamond(7.5, 8, 7, { shade: 0xcf9a34, base: 0xf7bd4d, light: 0xffe7a3 });
  s.outline(0x3a2a0c);
  s.disc(7.5, 8, 2.6, { shade: 0xff6a2c, base: 0xff7b3d, light: 0xff9a5a });
  s.set(6, 7, 0x201206);
  s.set(7, 7, 0x201206);
  s.set(6, 8, 0x201206);
  s.set(7, 8, 0x201206);
  s.set(6, 7, 0xfff3d0);
  s.mirror();
};

export const buildDasher: EnemySpriteBuilder = (s) => {
  s.wedge(7.5, 2, 15, 6, { shade: 0x7c54d6, base: 0xa97cff, light: 0xe6d8ff });
  s.outline(0x241640);
  s.eye(4, 5, 0x140a24, 0xf3ecff);
  s.mirror();
};

export const buildSplitter: EnemySpriteBuilder = (s) => {
  s.disc(7.5, 7.5, 6.5, { shade: 0x2c9077, base: 0x45c6a0, light: 0x9bedcf });
  s.outline(0x0c3329);

  // Vertical seam down the center that hints at the split.
  for (let y = 2; y <= 13; y += 1) {
    s.set(7, y, 0x0c3329);
  }

  s.eye(4, 7, 0x0a1613, 0xd4f7ea);
  s.mirror();
};

export const buildSplitterling: EnemySpriteBuilder = (s) => {
  s.disc(7.5, 8, 4.5, { shade: 0x39b18f, base: 0x63dcb7, light: 0xc4f5e3 });
  s.outline(0x0c3329);
  s.eye(5, 7, 0x0a1613, 0xdffbf0);
  s.mirror();
};

export function drawEnemyTexture(
  scene: Phaser.Scene,
  key: string,
  build: EnemySpriteBuilder,
  scale: number = ENEMY_SPRITE_SCALE,
): void {
  const sprite = new PixelSprite();
  build(sprite);
  sprite.generateTexture(scene, key, scale);
}
