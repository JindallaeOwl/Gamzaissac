import { describe, expect, it } from 'vitest';
import { createCavePixels, caveThemeForFloor, lightFalloff } from '../src/systems/CaveArt';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../src/config/gameConfig';

const colorAt = (pixels: Uint8ClampedArray, x: number, y: number) =>
  Array.from(pixels.slice((y * WORLD_WIDTH + x) * 4, (y * WORLD_WIDTH + x) * 4 + 3));

describe('cave visual foundation', () => {
  it('produces opaque stable room art without consuming gameplay randomness', () => {
    const first = createCavePixels(['north', 'east']);
    const second = createCavePixels(['north', 'east']);
    expect(first).toEqual(second);
    expect(first.length).toBe(WORLD_WIDTH * WORLD_HEIGHT * 4);
    expect(first.filter((_, i) => i % 4 === 3).every((alpha) => alpha === 255)).toBe(true);
    expect(createCavePixels(['north', 'east'], 12)).not.toEqual(first);
  });

  it.each(['burrow', 'ruins'] as const)(
    'keeps actual exit openings distinct from solid walls in %s',
    (theme) => {
      const closed = createCavePixels([], 7041, theme);
      const open = createCavePixels(['north', 'east', 'south', 'west'], 7041, theme);
      for (const [x, y] of [
        [240, 24],
        [456, 136],
        [240, 248],
        [24, 136],
      ]) {
        expect(colorAt(open, x, y)).not.toEqual(colorAt(closed, x, y));
      }
      expect(colorAt(open, 2, 2)).toEqual([7, 9, 12]);
    },
  );

  it('keeps the arena subdued and assigns distinct themes to floors one and two', () => {
    const pixels = createCavePixels(['north']);
    for (let y = 80; y < 190; y += 7) {
      for (let x = 130; x < 350; x += 7)
        expect(Math.max(...colorAt(pixels, x, y))).toBeLessThan(65);
    }
    expect(caveThemeForFloor(1)).toBe('burrow');
    expect(caveThemeForFloor(2)).toBe('ruins');
    expect(caveThemeForFloor(3)).toBeNull();
    expect(caveThemeForFloor(0)).toBeNull();
    expect(createCavePixels(['north'], 7041, 'burrow')).not.toEqual(
      createCavePixels(['north'], 7041, 'ruins'),
    );
  });

  it('fades light locally without brightening the entire screen', () => {
    expect(lightFalloff(0, 80)).toBe(1);
    expect(lightFalloff(40, 80)).toBe(0.25);
    expect(lightFalloff(80, 80)).toBe(0);
    expect(lightFalloff(200, 80)).toBe(0);
  });
});
