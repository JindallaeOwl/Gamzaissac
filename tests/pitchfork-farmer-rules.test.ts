import { describe, expect, it } from 'vitest';
import {
  boomerangDistance,
  brokenRingSafeIndex,
  isInBrokenRingGap,
  isWithinMeleeBlade,
  rakeSweepAngle,
  selectFarmerPattern,
  type FarmerPatternCandidate,
} from '../src/systems/PitchforkFarmerRules';

describe('rake sweep angle', () => {
  it('sweeps from base-arc/2 to base+arc/2 across the progress', () => {
    expect(rakeSweepAngle(1, 0, 2)).toBeCloseTo(0);
    expect(rakeSweepAngle(1, 0.5, 2)).toBeCloseTo(1);
    expect(rakeSweepAngle(1, 1, 2)).toBeCloseTo(2);
  });

  it('clamps progress outside 0..1 to the sweep ends', () => {
    expect(rakeSweepAngle(1, -3, 2)).toBeCloseTo(0);
    expect(rakeSweepAngle(1, 4, 2)).toBeCloseTo(2);
  });
});

describe('boomerang distance', () => {
  it('goes out to the max range at the midpoint and returns by the end', () => {
    expect(boomerangDistance(0, 150)).toBeCloseTo(0);
    expect(boomerangDistance(0.5, 150)).toBeCloseTo(150);
    expect(boomerangDistance(1, 150)).toBeCloseTo(0);
  });

  it('is symmetric between the outbound and return halves', () => {
    expect(boomerangDistance(0.25, 150)).toBeCloseTo(boomerangDistance(0.75, 150));
  });

  it('clamps progress outside 0..1 to the boss position', () => {
    expect(boomerangDistance(-2, 150)).toBeCloseTo(0);
    expect(boomerangDistance(3, 150)).toBeCloseTo(0);
  });
});

describe('broken ring safe index', () => {
  it('maps the player angle to a ring index and wraps at a full turn', () => {
    expect(brokenRingSafeIndex(0, 12)).toBe(0);
    expect(brokenRingSafeIndex(Math.PI, 12)).toBe(6);
    expect(brokenRingSafeIndex(Math.PI * 2, 12)).toBe(0);
  });

  it('always returns an in-range index, even for negative angles', () => {
    for (const angle of [-Math.PI, -0.1, 0, 1.7, 6.5, 100]) {
      const index = brokenRingSafeIndex(angle, 12);
      expect(index, `angle ${angle}`).toBeGreaterThanOrEqual(0);
      expect(index, `angle ${angle}`).toBeLessThan(12);
    }
  });
});

describe('broken ring gap membership', () => {
  it('treats the gap as `gap` consecutive indices from the safe start', () => {
    expect(isInBrokenRingGap(3, 3, 2, 12)).toBe(true);
    expect(isInBrokenRingGap(4, 3, 2, 12)).toBe(true);
    expect(isInBrokenRingGap(5, 3, 2, 12)).toBe(false);
  });

  it('wraps the gap around the end of the ring', () => {
    expect(isInBrokenRingGap(11, 11, 2, 12)).toBe(true);
    expect(isInBrokenRingGap(0, 11, 2, 12)).toBe(true);
    expect(isInBrokenRingGap(1, 11, 2, 12)).toBe(false);
  });
});

describe('melee blade hit test', () => {
  const OX = 0;
  const OY = 0;
  const REACH = 62;
  const HALF = 7;

  it('hits a player on or near the blade line within reach', () => {
    expect(isWithinMeleeBlade(30, 0, OX, OY, 0, REACH, HALF)).toBe(true);
    expect(isWithinMeleeBlade(30, 5, OX, OY, 0, REACH, HALF)).toBe(true);
  });

  it('misses a player farther from the line than the blade half-width', () => {
    expect(isWithinMeleeBlade(30, 10, OX, OY, 0, REACH, HALF)).toBe(false);
  });

  it('does not flare out at the far end (regression: wedge hit sideways players)', () => {
    // 옛 부채꼴 판정은 사거리 끝에서 옆으로 벌어져 12px 떨어진 플레이어도 맞혔다.
    expect(isWithinMeleeBlade(60, 12, OX, OY, 0, REACH, HALF)).toBe(false);
  });

  it('misses a player beyond the blade tip or behind the boss', () => {
    expect(isWithinMeleeBlade(80, 0, OX, OY, 0, REACH, HALF)).toBe(false);
    expect(isWithinMeleeBlade(-20, 0, OX, OY, 0, REACH, HALF)).toBe(false);
  });

  it('follows the blade angle', () => {
    expect(isWithinMeleeBlade(0, 30, OX, OY, Math.PI / 2, REACH, HALF)).toBe(true);
  });
});

describe('farmer pattern selection', () => {
  const candidates = (
    entries: [FarmerPatternCandidate['pattern'], number][],
  ): FarmerPatternCandidate[] => entries.map(([pattern, readyAt]) => ({ pattern, readyAt }));

  it('returns null when no pattern is off cooldown yet', () => {
    expect(selectFarmerPattern(candidates([['trident', 300]]), 200, null)).toBeNull();
  });

  it('picks the most overdue ready pattern', () => {
    const pick = selectFarmerPattern(
      candidates([
        ['trident', 100],
        ['rake', 50],
      ]),
      200,
      null,
    );
    expect(pick).toBe('rake');
  });

  it('avoids repeating the last pattern when another is ready', () => {
    const pick = selectFarmerPattern(
      candidates([
        ['trident', 100],
        ['rake', 50],
      ]),
      200,
      'rake',
    );
    expect(pick).toBe('trident');
  });

  it('still fires the last pattern if it is the only ready one', () => {
    const pick = selectFarmerPattern(
      candidates([
        ['trident', 100],
        ['rake', 300],
      ]),
      200,
      'trident',
    );
    expect(pick).toBe('trident');
  });
});
