import { describe, expect, it } from 'vitest';
import {
  opaquePixels,
  selectChipPixels,
  tintPixel,
  fragmentImpulse,
} from '../src/systems/EnemyDamagePixels';

function bodyPixels() {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 3; y < 13; y += 1) {
    for (let x = 3; x < 13; x += 1) {
      data.set([60, 180, 90, 255], (y * 16 + x) * 4);
    }
  }
  return opaquePixels(data, 16);
}

describe('enemy damage pixels', () => {
  it('reads actual body colors and excludes transparent pixels', () => {
    const pixels = bodyPixels();
    expect(pixels).toHaveLength(100);
    expect(pixels.every((p) => p.color === 0x3cb45a)).toBe(true);
  });

  it('chips the side facing the incoming hit', () => {
    const pixels = bodyPixels();
    const left = selectChipPixels(pixels, 16, 16, -20, 8, 12);
    const right = selectChipPixels(pixels, 16, 16, 40, 8, 12);
    const top = selectChipPixels(pixels, 16, 16, 8, -20, 12);
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((p) => p.x <= 5)).toBe(true);
    expect(right.every((p) => p.x >= 10)).toBe(true);
    expect(top.every((p) => p.y <= 5)).toBe(true);
  });

  it('deepens an existing chip while respecting the remaining budget', () => {
    const pixels = bodyPixels();
    const first = selectChipPixels(pixels, 16, 16, -20, 8, 12);
    const remaining = pixels.filter((p) => !first.includes(p));
    const second = selectChipPixels(remaining, 16, 16, -20, 8, 3);
    expect(second).toHaveLength(3);
    expect(second.every((p) => !first.includes(p))).toBe(true);
    expect(selectChipPixels(remaining, 16, 16, -20, 8, 0)).toEqual([]);
    expect(pixels).toHaveLength(100); // Shared source art is never modified.
  });

  it('handles empty frames and centered explosions', () => {
    expect(selectChipPixels([], 16, 16, 8, 8, 10)).toEqual([]);
    const chip = selectChipPixels(bodyPixels(), 16, 16, 8, 8, 10);
    expect(chip.length).toBeGreaterThan(0);
    expect(chip.every((p) => Number.isFinite(p.x + p.y))).toBe(true);
  });

  it('preserves normal colors and applies persistent champion tint', () => {
    expect(tintPixel(0x3cb45a, 0xffffff)).toBe(0x3cb45a);
    expect(tintPixel(0xffffff, 0xffcc66)).toBe(0xffcc66);
    expect(tintPixel(0x808080, 0xff0000)).toBe(0x800000);
  });

  it('pushes strong-hit debris away from the attack with distance-independent force', () => {
    const near = fragmentImpulse({ kind: 'explosion', x: 3, y: -4 });
    const far = fragmentImpulse({ kind: 'explosion', x: 30, y: -40 });
    expect(near).toEqual(far);
    expect(near.x).toBeGreaterThan(0);
    expect(near.y).toBeLessThan(0);
    const beam = fragmentImpulse({ kind: 'beam', x: -1, y: 0 });
    expect(beam.x).toBeLessThan(-100);
    expect(beam.y).toBe(0);
    expect(Math.hypot(near.x, near.y)).toBeGreaterThan(Math.abs(beam.x));
    const centered = fragmentImpulse({ kind: 'explosion', x: 0, y: 0 });
    expect(Number.isFinite(centered.x + centered.y)).toBe(true);
    expect(centered.y).toBeLessThan(0);
  });
});
