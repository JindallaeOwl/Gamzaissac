import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const stickPng = readFileSync(
  new URL('../public/assets/ui/vryell/touch-stick.png', import.meta.url),
);

describe('mobile touch control assets', () => {
  it('ships only the cropped 16x16 stick tile used by both virtual sticks', () => {
    expect(stickPng.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(stickPng.readUInt32BE(16)).toBe(16);
    expect(stickPng.readUInt32BE(20)).toBe(16);
    expect(index.match(/\/assets\/ui\/vryell\/touch-stick\.png/g)).toHaveLength(2);
  });

  it('contains every DOM control that TouchControls wires', () => {
    for (const id of [
      'touch-controls',
      'touch-movement-stick',
      'touch-movement-knob',
      'touch-fire-stick',
      'touch-fire-knob',
      'touch-bomb',
      'touch-bomb-count',
      'touch-purchase',
      'touch-purchase-label',
      'touch-minimap',
      'touch-pause',
      'touch-rotate-label',
    ]) {
      expect(
        index.match(new RegExp(`id="${id}"`, 'g')),
        `${id} must exist exactly once`,
      ).toHaveLength(1);
    }
  });

  it('disables browser gestures on sticks and supplies a portrait rotation notice', () => {
    expect(styles).toMatch(/\.touch-stick\s*\{[\s\S]*?touch-action:\s*none;/);
    expect(styles).toContain('@media (orientation: portrait)');
    expect(styles).toContain('.touch-orientation-hint');
  });
});
