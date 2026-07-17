import { describe, expect, it } from 'vitest';
import { isWithinCollisionRadius } from '../src/systems/CombatCollisionSystem';

describe('CombatCollisionSystem rules', () => {
  it('includes a hit exactly on the collision radius boundary', () => {
    expect(isWithinCollisionRadius({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
  });

  it('rejects a hit outside the collision radius', () => {
    expect(isWithinCollisionRadius({ x: 0, y: 0 }, { x: 3, y: 4.01 }, 5)).toBe(false);
  });
});
