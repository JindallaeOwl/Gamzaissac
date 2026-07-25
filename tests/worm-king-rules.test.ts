import { describe, expect, it } from 'vitest';
import {
  clampResurfacePoint,
  isBurrowInvulnerable,
  shouldExecuteDeferredSummon,
  type PointBounds,
  type WormKingState,
} from '../src/systems/WormKingRules';

const BOUNDS: PointBounds = { left: 32, right: 448, top: 32, bottom: 240 };

describe('burrow invulnerability rule', () => {
  it('blocks all damage while diving or telegraphing the resurface', () => {
    expect(isBurrowInvulnerable('burrowHidden')).toBe(true);
    expect(isBurrowInvulnerable('burrowTelegraph')).toBe(true);
  });

  it('takes normal damage in every other state', () => {
    const vulnerable: WormKingState[] = ['idle', 'chargeWindup', 'charging', 'phaseTransition'];

    for (const state of vulnerable) {
      expect(isBurrowInvulnerable(state), state).toBe(false);
    }
  });
});

describe('deferred summon execution condition', () => {
  it('summons only when the boss is alive, still in the room, and the run is ongoing', () => {
    expect(shouldExecuteDeferredSummon({ bossActive: true, sameRoom: true, runEnded: false })).toBe(
      true,
    );
  });

  it('skips the summon if the boss died before the callback ran', () => {
    expect(
      shouldExecuteDeferredSummon({ bossActive: false, sameRoom: true, runEnded: false }),
    ).toBe(false);
  });

  it('skips the summon if the player already left the room', () => {
    expect(
      shouldExecuteDeferredSummon({ bossActive: true, sameRoom: false, runEnded: false }),
    ).toBe(false);
  });

  it('skips the summon after the run ended (game over or escape)', () => {
    expect(shouldExecuteDeferredSummon({ bossActive: true, sameRoom: true, runEnded: true })).toBe(
      false,
    );
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
