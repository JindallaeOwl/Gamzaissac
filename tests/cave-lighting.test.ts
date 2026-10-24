import { describe, expect, it, vi } from 'vitest';
import {
  CaveArtCache,
  CaveBloomBuffer,
  createCaveNormalMap,
  selectSurfaceLights,
} from '../src/systems/CaveLighting';

describe('bounded cave lighting', () => {
  it('keeps flat pixels facing forward and slopes responding to opposite light directions', () => {
    const pixels = new Uint8ClampedArray(9 * 9 * 4).fill(255);
    let normals = createCaveNormalMap(pixels, 9, 9);
    expect(Array.from(normals.slice(0, 4))).toEqual([128, 128, 255, 255]);
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 9; x++) {
        const i = (y * 9 + x) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = x < 4 ? 20 : 80;
      }
    normals = createCaveNormalMap(pixels, 9, 9);
    const i = (4 * 9 + 3) * 4;
    expect(normals[i]).toBeLessThan(128);
    expect(normals[i + 1]).toBe(128);
    expect(normals[i + 2]).toBeGreaterThan(128);
    const nx = (normals[i] / 255) * 2 - 1;
    const nz = (normals[i + 2] / 255) * 2 - 1;
    expect(-nx + nz).toBeGreaterThan(nx + nz);
  });

  it('culls offscreen lights, prioritizes combat and respects quality budgets', () => {
    const lights = Array.from({ length: 100 }, (_, i) => ({
      x: 100,
      y: 100,
      radius: 40,
      color: 0xffffff,
      intensity: 1,
      priority: i === 99 ? 3 : 0,
    }));
    lights.push({ x: -500, y: 0, radius: 10, color: 0xffffff, intensity: 99, priority: 9 });
    expect(selectSurfaceLights(lights, 'low', 480, 272)).toHaveLength(0);
    expect(selectSurfaceLights(lights, 'balanced', 480, 272)).toHaveLength(6);
    const high = selectSurfaceLights(lights, 'high', 480, 272);
    expect(high).toHaveLength(10);
    expect(high[0]).toBe(lights[99]);
    expect(high.every((p) => p.x >= 0)).toBe(true);
  });

  it('reuses recent room maps, evicts oldest entries and clears on shutdown', () => {
    const cache = new CaveArtCache();
    const build = vi.fn(() => ({
      pixels: new Uint8ClampedArray(4),
      normals: new Uint8ClampedArray(4),
    }));
    const first = cache.get('0', build);
    expect(cache.get('0', build)).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
    for (let i = 1; i <= 6; i++) cache.get(`${i}`, build);
    expect(cache.size).toBe(6);
    expect(cache.get('0', build)).not.toBe(first);
    expect(cache.size).toBe(6);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('spreads only emissive color locally and clears old room glow', () => {
    const bloom = new CaveBloomBuffer(16, 16);
    bloom.emit(8, 8, 0xff8000, 5);
    const output = bloom.blur();
    expect(output[(8 * 16 + 8) * 4]).toBeGreaterThan(0);
    expect(output[(8 * 16 + 7) * 4]).toBeGreaterThan(0);
    expect(output[(8 * 16 + 8) * 4 + 2]).toBe(0);
    expect(output[0]).toBe(0);
    bloom.clear();
    expect(
      bloom
        .blur()
        .filter((_, i) => i % 4 !== 3)
        .every((v) => v === 0),
    ).toBe(true);
  });
});
