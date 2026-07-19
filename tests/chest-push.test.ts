import { describe, expect, it } from 'vitest';
import {
  CHEST_PUSH_SPEED,
  estimateChestSlideDistance,
  getChestPushVelocity,
} from '../src/systems/ChestPushRules';

describe('chest push rules', () => {
  it('normalizes movement input to a consistent short push speed', () => {
    expect(getChestPushVelocity(0, 0)).toBeNull();
    expect(getChestPushVelocity(1, 0)).toEqual({ x: CHEST_PUSH_SPEED, y: 0 });

    const diagonal = getChestPushVelocity(1, 1)!;
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(CHEST_PUSH_SPEED);
  });

  it('stops after sliding only a few gameplay pixels', () => {
    expect(estimateChestSlideDistance()).toBeGreaterThan(5);
    expect(estimateChestSlideDistance()).toBeLessThan(8);
  });
});
