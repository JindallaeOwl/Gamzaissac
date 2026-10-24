import type { RenderQuality } from './GameSettings';

export interface SurfaceLight {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
  priority?: number;
}

export const LIGHTING_BUDGETS = {
  low: { lights: 0, bloomHz: 0, bloomScale: 4 },
  balanced: { lights: 6, bloomHz: 15, bloomScale: 4 },
  high: { lights: 10, bloomHz: 30, bloomScale: 4 },
} as const;

/** Estimate relief from smoothed material detail; never regenerate during animation. */
export function createCaveNormalMap(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const elevations = new Float32Array(width * height);
  for (let i = 0; i < elevations.length; i++) {
    elevations[i] = (pixels[i * 4] * 0.3 + pixels[i * 4 + 1] * 0.5 + pixels[i * 4 + 2] * 0.2) / 20;
  }
  const sample = (x: number, y: number): number =>
    elevations[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
  const normals = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      // Sobel derivatives suppress isolated grain. Green points upward in Light2D.
      const nx =
        (sample(x - 1, y - 1) +
          2 * sample(x - 1, y) +
          sample(x - 1, y + 1) -
          sample(x + 1, y - 1) -
          2 * sample(x + 1, y) -
          sample(x + 1, y + 1)) *
        0.32;
      const ny =
        (sample(x - 1, y + 1) +
          2 * sample(x, y + 1) +
          sample(x + 1, y + 1) -
          sample(x - 1, y - 1) -
          2 * sample(x, y - 1) -
          sample(x + 1, y - 1)) *
        0.32;
      const length = Math.hypot(nx, ny, 1);
      const i = (y * width + x) * 4;
      normals[i] = ((nx / length) * 0.5 + 0.5) * 255;
      normals[i + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      normals[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      normals[i + 3] = 255;
    }
  return normals;
}

/** Cull first and retain only a bounded set; combat flashes outrank ambient lights. */
export function selectSurfaceLights(
  candidates: readonly SurfaceLight[],
  quality: RenderQuality,
  width: number,
  height: number,
): SurfaceLight[] {
  return candidates
    .filter(
      (p) =>
        p.intensity > 0.01 &&
        p.x + p.radius > 0 &&
        p.y + p.radius > 0 &&
        p.x - p.radius < width &&
        p.y - p.radius < height,
    )
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.intensity - a.intensity)
    .slice(0, LIGHTING_BUDGETS[quality].lights);
}

export interface CachedCaveArt {
  pixels: Uint8ClampedArray;
  normals: Uint8ClampedArray;
}

/** Six CPU images at most (~6 MiB); only the current room is uploaded to the GPU. */
export class CaveArtCache {
  private readonly entries = new Map<string, CachedCaveArt>();
  get size(): number {
    return this.entries.size;
  }
  get(key: string, build: () => CachedCaveArt): CachedCaveArt {
    const value = this.entries.get(key) ?? build();
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > 6) this.entries.delete(this.entries.keys().next().value!);
    return value;
  }
  clear(): void {
    this.entries.clear();
  }
}

/** Emission-only bloom at quarter resolution, with reusable separable blur buffers. */
export class CaveBloomBuffer {
  readonly source: Float32Array;
  private readonly scratch: Float32Array;
  readonly rgba: Uint8ClampedArray;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.source = new Float32Array(width * height * 3);
    this.scratch = new Float32Array(this.source.length);
    this.rgba = new Uint8ClampedArray(width * height * 4);
  }
  clear(): void {
    this.source.fill(0);
  }
  emit(x: number, y: number, color: number, strength: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || strength <= 0) return;
    const i = (y * this.width + x) * 3;
    this.source[i] += ((color >>> 16) & 255) * strength;
    this.source[i + 1] += ((color >>> 8) & 255) * strength;
    this.source[i + 2] += (color & 255) * strength;
  }
  blur(): Uint8ClampedArray {
    const weights = [1, 4, 6, 4, 1];
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const i = (y * this.width + x) * 3;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let k = -2; k <= 2; k++) {
            const px = Math.max(0, Math.min(this.width - 1, x + k));
            sum += this.source[(y * this.width + px) * 3 + c] * weights[k + 2];
          }
          this.scratch[i + c] = sum / 16;
        }
      }
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const i = (y * this.width + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let k = -2; k <= 2; k++) {
            const py = Math.max(0, Math.min(this.height - 1, y + k));
            sum += this.scratch[(py * this.width + x) * 3 + c] * weights[k + 2];
          }
          this.rgba[i + c] = Math.min(150, sum / 16);
        }
        this.rgba[i + 3] = 255;
      }
    return this.rgba;
  }
}
