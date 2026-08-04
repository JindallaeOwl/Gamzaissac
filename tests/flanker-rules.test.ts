import { describe, expect, it } from 'vitest';
import {
  computeEffectiveGoalAngle,
  computeFlankAngleError,
  computeFlankGoalAngle,
  computeFlankTarget,
  computeSlideDirection,
  hasStalledTowardTarget,
  oppositeFlankSide,
  pickFlankSide,
  shouldCommitLunge,
  wrapAngle,
  type FlankBounds,
} from '../src/systems/FlankerRules';

const BOUNDS: FlankBounds = { left: 0, right: 480, top: 0, bottom: 272 };
const RING = 86;
const ARC = (68 * Math.PI) / 180;
const MARGIN = 13;
const ARRIVAL = 16;
const ANGLE_TOLERANCE = (18 * Math.PI) / 180;

function commitCheck(overrides: Partial<Parameters<typeof shouldCommitLunge>[0]> = {}) {
  return {
    distanceToTarget: 4,
    angleError: 0,
    distanceToPlayer: 90,
    arrivalTolerance: ARRIVAL,
    angleTolerance: ANGLE_TOLERANCE,
    lungeRange: 110,
    time: 10_000,
    nextLungeAt: 0,
    ...overrides,
  };
}

/** Walks the enemy onto its target the way the circling state does each frame. */
function arriveAtTarget(
  player: { x: number; y: number },
  goalAngle: number,
): { enemy: { x: number; y: number }; target: { x: number; y: number } } {
  const target = computeFlankTarget(player, goalAngle, RING, BOUNDS, MARGIN);

  return { enemy: { ...target }, target };
}

describe('FlankerRules', () => {
  it('folds angles back into -PI..PI', () => {
    // PI and -PI are the same bearing, so only the magnitude is pinned here.
    expect(Math.abs(wrapAngle(Math.PI * 3))).toBeCloseTo(Math.PI, 5);
    expect(Math.abs(wrapAngle(-Math.PI * 3))).toBeCloseTo(Math.PI, 5);
    expect(wrapAngle(Math.PI * 2 + 0.4)).toBeCloseTo(0.4, 5);
    expect(wrapAngle(0.4)).toBeCloseTo(0.4, 5);
  });

  it('sends the two sides to opposite sides of the player', () => {
    const player = { x: 240, y: 136 };
    const enemy = { x: 240, y: 40 };

    const left = computeFlankTarget(
      player,
      computeFlankGoalAngle(enemy, player, -1, ARC),
      RING,
      BOUNDS,
      MARGIN,
    );
    const right = computeFlankTarget(
      player,
      computeFlankGoalAngle(enemy, player, 1, ARC),
      RING,
      BOUNDS,
      MARGIN,
    );

    // The enemy is straight above the player, so one goal sits left of the
    // player and the other right of it.
    expect(Math.sign(left.x - player.x)).toBe(-Math.sign(right.x - player.x));
    expect(left.x).not.toBeCloseTo(right.x, 1);
  });

  it('keeps the goal angle fixed while the enemy travels', () => {
    const player = { x: 240, y: 136 };
    const start = { x: 240, y: 40 };
    const goalAngle = computeFlankGoalAngle(start, player, 1, ARC);

    // The state machine holds this angle, so the target only follows the player.
    const first = computeFlankTarget(player, goalAngle, RING, BOUNDS, MARGIN);
    const afterMoving = computeFlankTarget(player, goalAngle, RING, BOUNDS, MARGIN);

    expect(afterMoving).toEqual(first);

    // Recomputing from a moved enemy would push the goal ahead of it — the
    // permanent-circling failure this design exists to prevent.
    const moved = { x: 300, y: 70 };
    const recomputed = computeFlankGoalAngle(moved, player, 1, ARC);

    expect(Math.abs(wrapAngle(recomputed - goalAngle))).toBeGreaterThan(0.1);
  });

  it('measures the angle error across the -PI/PI seam', () => {
    const player = { x: 240, y: 136 };
    // Just below and just above the seam: the true gap is small, not ~2*PI.
    const enemy = { x: player.x - 100, y: player.y - 4 };
    const error = computeFlankAngleError(enemy, player, -Math.PI + 0.04);

    expect(Math.abs(error)).toBeLessThan(0.15);
  });

  it('pulls the ring target inside the room when the player hugs a wall', () => {
    const player = { x: 240, y: BOUNDS.top + 6 };

    for (const side of [-1, 1] as const) {
      const goalAngle = computeFlankGoalAngle({ x: 240, y: 200 }, player, side, ARC);
      const target = computeFlankTarget(player, goalAngle, RING, BOUNDS, MARGIN);

      expect(target.y).toBeGreaterThanOrEqual(BOUNDS.top + MARGIN);
      expect(target.y).toBeLessThanOrEqual(BOUNDS.bottom - MARGIN);
      expect(target.x).toBeGreaterThanOrEqual(BOUNDS.left + MARGIN);
      expect(target.x).toBeLessThanOrEqual(BOUNDS.right - MARGIN);
    }
  });

  it('lets the Flanker lunge after reaching a clamped target against a wall', () => {
    // Player pinned to the left wall with the enemy below: the ring point for
    // this side lands well outside the room, so it really is clamped.
    const player = { x: BOUNDS.left + 4, y: 136 };
    const goalAngle = computeFlankGoalAngle({ x: BOUNDS.left + 4, y: 230 }, player, 1, ARC);
    const raw = {
      x: player.x + Math.cos(goalAngle) * RING,
      y: player.y + Math.sin(goalAngle) * RING,
    };
    const { enemy, target } = arriveAtTarget(player, goalAngle);

    expect(raw.x).toBeLessThan(BOUNDS.left + MARGIN);
    expect(target.x).not.toBeCloseTo(raw.x, 1);

    const distanceToPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);

    // Judged against the held angle the arrival looks wrong and the Flanker
    // would circle forever in the very corner the player is trapped in.
    expect(
      shouldCommitLunge(
        commitCheck({
          distanceToTarget: 0,
          angleError: computeFlankAngleError(enemy, player, goalAngle),
          distanceToPlayer,
        }),
      ),
    ).toBe(false);

    // Judged against the angle of the clamped target it lunges as intended.
    expect(
      shouldCommitLunge(
        commitCheck({
          distanceToTarget: 0,
          angleError: computeFlankAngleError(
            enemy,
            player,
            computeEffectiveGoalAngle(player, target),
          ),
          distanceToPlayer,
        }),
      ),
    ).toBe(true);
  });

  it('lets the Flanker lunge after reaching a clamped target in a corner', () => {
    const player = { x: BOUNDS.left + 5, y: BOUNDS.top + 5 };

    for (const side of [-1, 1] as const) {
      const goalAngle = computeFlankGoalAngle({ x: 300, y: 200 }, player, side, ARC);
      const { enemy, target } = arriveAtTarget(player, goalAngle);
      const effective = computeEffectiveGoalAngle(player, target);

      expect(
        shouldCommitLunge(
          commitCheck({
            distanceToTarget: 0,
            angleError: computeFlankAngleError(enemy, player, effective),
            distanceToPlayer: Math.hypot(enemy.x - player.x, enemy.y - player.y),
          }),
        ),
        `side ${side}`,
      ).toBe(true);
    }
  });

  it('agrees with the held angle out in the open', () => {
    const player = { x: 240, y: 136 };
    const goalAngle = computeFlankGoalAngle({ x: 240, y: 40 }, player, 1, ARC);
    const target = computeFlankTarget(player, goalAngle, RING, BOUNDS, MARGIN);

    expect(wrapAngle(computeEffectiveGoalAngle(player, target) - goalAngle)).toBeCloseTo(0, 5);
  });

  it('swings into open floor rather than into the nearer wall', () => {
    // Enemy below the player, player near the left wall: going clockwise aims at
    // the wall, counter-clockwise aims at open floor.
    const player = { x: BOUNDS.left + 20, y: 136 };
    const enemy = { x: player.x, y: 230 };
    const alwaysLeft = () => 0;

    const side = pickFlankSide(enemy, player, RING, ARC, BOUNDS, MARGIN, alwaysLeft);
    const target = computeFlankTarget(
      player,
      computeFlankGoalAngle(enemy, player, side, ARC),
      RING,
      BOUNDS,
      MARGIN,
    );
    const raw = {
      x: player.x + Math.cos(computeFlankGoalAngle(enemy, player, side, ARC)) * RING,
      y: player.y + Math.sin(computeFlankGoalAngle(enemy, player, side, ARC)) * RING,
    };

    expect(Math.hypot(raw.x - target.x, raw.y - target.y)).toBeLessThan(RING / 2);
  });

  it('reflects the arc width when choosing a side', () => {
    // Player against the left wall with the enemy straight above.
    const player = { x: BOUNDS.left + 24, y: 136 };
    const enemy = { x: player.x, y: 40 };
    const alwaysLeft = () => 0;

    // A near-zero arc keeps both ring points just above the player, equally
    // reachable, so the tie falls to the random source.
    const narrow = pickFlankSide(enemy, player, RING, 0.05, BOUNDS, MARGIN, alwaysLeft);

    // A wide arc throws one ring point through the left wall, so the other side
    // wins outright. Ignoring arcRadians would make both calls identical.
    const wide = pickFlankSide(
      enemy,
      player,
      RING,
      (150 * Math.PI) / 180,
      BOUNDS,
      MARGIN,
      alwaysLeft,
    );

    expect(narrow).toBe(-1);
    expect(wide).toBe(1);
  });

  it('refuses the lunge unless all four gates open', () => {
    expect(shouldCommitLunge(commitCheck())).toBe(true);
    expect(shouldCommitLunge(commitCheck({ distanceToTarget: ARRIVAL + 1 }))).toBe(false);
    expect(shouldCommitLunge(commitCheck({ angleError: ANGLE_TOLERANCE + 0.01 }))).toBe(false);
    expect(shouldCommitLunge(commitCheck({ angleError: -ANGLE_TOLERANCE - 0.01 }))).toBe(false);
    expect(shouldCommitLunge(commitCheck({ distanceToPlayer: 111 }))).toBe(false);
    expect(shouldCommitLunge(commitCheck({ nextLungeAt: 10_001 }))).toBe(false);
  });

  it('flips to the other side', () => {
    expect(oppositeFlankSide(1)).toBe(-1);
    expect(oppositeFlankSide(-1)).toBe(1);
  });

  it('calls a stall only after a full window without progress', () => {
    const base = {
      checkpointDistance: 100,
      checkpointAt: 1_000,
      windowMs: 400,
      minProgress: 6,
    };

    // Window not elapsed yet, however little ground was covered.
    expect(hasStalledTowardTarget({ ...base, distanceToTarget: 100, time: 1_300 })).toBe(false);
    // Window elapsed and barely any closer: blocked.
    expect(hasStalledTowardTarget({ ...base, distanceToTarget: 96, time: 1_400 })).toBe(true);
    // Window elapsed but making ground: still travelling.
    expect(hasStalledTowardTarget({ ...base, distanceToTarget: 70, time: 1_400 })).toBe(false);
    // Pushed backwards by the collision counts as blocked too.
    expect(hasStalledTowardTarget({ ...base, distanceToTarget: 108, time: 1_400 })).toBe(true);
  });

  it('slides perpendicular to the blocked axis, toward the goal', () => {
    const clear = { left: false, right: false, up: false, down: false };

    expect(computeSlideDirection({ ...clear, left: true }, { x: -40, y: 30 })).toEqual({
      x: 0,
      y: 1,
    });
    expect(computeSlideDirection({ ...clear, right: true }, { x: 40, y: -30 })).toEqual({
      x: 0,
      y: -1,
    });
    expect(computeSlideDirection({ ...clear, up: true }, { x: 25, y: -40 })).toEqual({
      x: 1,
      y: 0,
    });
    expect(computeSlideDirection({ ...clear, down: true }, { x: -25, y: 40 })).toEqual({
      x: -1,
      y: 0,
    });
  });

  it('offers no slide when nothing blocks or a corner blocks both axes', () => {
    const clear = { left: false, right: false, up: false, down: false };

    expect(computeSlideDirection(clear, { x: 10, y: 10 })).toBeNull();
    expect(
      computeSlideDirection({ ...clear, left: true, down: true }, { x: 10, y: 10 }),
    ).toBeNull();
  });
});
