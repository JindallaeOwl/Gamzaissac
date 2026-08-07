import { describe, expect, it } from 'vitest';
import {
  clampResurfacePoint,
  isBurrowInvulnerable,
  type PointBounds,
  type WormKingState,
} from '../src/systems/WormKingRules';

const BOUNDS: PointBounds = { left: 32, right: 448, top: 32, bottom: 240 };

describe('burrow invulnerability rule', () => {
  it('blocks all damage while underground: diving, telegraphing, and emerging', () => {
    // 'emerging'까지 포함해, 완전히 솟아 히트박스가 켜지기 전에는 피해를 받지 않는다.
    expect(isBurrowInvulnerable('burrowHidden')).toBe(true);
    expect(isBurrowInvulnerable('burrowTelegraph')).toBe(true);
    expect(isBurrowInvulnerable('emerging')).toBe(true);
  });

  it('takes normal damage in every other state', () => {
    const vulnerable: WormKingState[] = ['idle', 'chargeWindup', 'charging', 'phaseTransition'];

    for (const state of vulnerable) {
      expect(isBurrowInvulnerable(state), state).toBe(false);
    }
  });
});

describe('resurface point clamping', () => {
  it('leaves a point that is already well inside the room untouched', () => {
    expect(clampResurfacePoint(240, 136, BOUNDS, 25)).toEqual({ x: 240, y: 136 });
  });

  it('pulls a point past the far walls back inside by the margin', () => {
    expect(clampResurfacePoint(1000, 1000, BOUNDS, 25)).toEqual({ x: 423, y: 215 });
  });

  it('pushes a point past the near walls back inside by the margin', () => {
    expect(clampResurfacePoint(-50, -50, BOUNDS, 25)).toEqual({ x: 57, y: 57 });
  });
});
