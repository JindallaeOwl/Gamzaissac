import { describe, expect, it } from 'vitest';
import { ALLY_TUNING, ROOM_RECT } from '../src/config/gameConfig';
import { findActiveItem } from '../src/data/activeItems';
import {
  allyDistance,
  canAllyFire,
  canDamageAlly,
  canSummonAllies,
  clampAllyToRoom,
  getAllyDamage,
  getAllyEngageVelocity,
  getAllyFollowTarget,
  getAllyFollowVelocity,
  getAllyFollowMotion,
  smoothAllyVelocity,
  getAllySpawnPositions,
  resolveAllyMode,
  selectAllyTarget,
} from '../src/systems/AllyRules';

const origin = { x: 0, y: 0 };
const enemy = (x: number, y = 0, active = true) => ({ x, y, active });
const margin = ALLY_TUNING.bodyRadius + ALLY_TUNING.roomPadding;

describe('gentle ally roaming and inertia', () => {
  const player = { x: 240, y: 136 };
  const motion = (point: { x: number; y: number }, time: number, side: -1 | 1 = -1) =>
    getAllyFollowMotion(point, player, side, time, ROOM_RECT, margin, ALLY_TUNING);

  it('rests at a destination, then moves around the player on the next interval', () => {
    const point = { x: 218, y: 136 };
    expect(motion(point, 0)).toEqual({ x: 0, y: 0 });
    expect(motion(point, 1499)).toEqual({ x: 0, y: 0 });
    const moving = motion(point, 1500);
    expect(moving.x).toBeGreaterThan(0);
    expect(moving.y).toBeLessThan(0);
    expect(Math.hypot(moving.x, moving.y)).toBeCloseTo(38);
  });
  it('changes the two allies destinations at different times', () => {
    expect(motion({ x: 262, y: 136 }, 800, 1)).toEqual({ x: 0, y: 0 });
    expect(motion({ x: 262, y: 136 }, 900, 1).y).toBeGreaterThan(0);
    expect(motion({ x: 218, y: 136 }, 900)).toEqual({ x: 0, y: 0 });
  });
  it('catches up at full speed when far away instead of continuing to wander', () => {
    expect(motion({ x: 100, y: 136 }, 9000)).toEqual({ x: 110, y: 0 });
    expect(motion({ x: 380, y: 136 }, 9000, 1)).toEqual({ x: -110, y: 0 });
  });
  it('does not steer out of the room at a corner over many wander intervals', () => {
    for (const [x, y] of [
      [40, 40],
      [440, 40],
      [40, 232],
      [440, 232],
    ]) {
      for (let time = 0; time < 20000; time += 500) {
        for (const side of [-1, 1] as const) {
          const v = getAllyFollowMotion(
            { x, y },
            { x, y },
            side,
            time,
            ROOM_RECT,
            margin,
            ALLY_TUNING,
          );
          expect(v.x * (x === 40 ? 1 : -1)).toBeGreaterThanOrEqual(0);
          expect(v.y * (y === 40 ? 1 : -1)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
  it('slows down near the destination and stops within the existing stop radius', () => {
    expect(getAllyFollowVelocity(origin, { x: 10, y: 0 }, 38, 6, 20)).toEqual({ x: 19, y: 0 });
    expect(getAllyFollowVelocity(origin, { x: 6, y: 0 }, 38, 6, 20)).toEqual({ x: 0, y: 0 });
  });
  it('accelerates and reverses gently, with a short deceleration tail', () => {
    const start = smoothAllyVelocity(origin, { x: 110, y: 0 }, 16, 90);
    expect(start.x).toBeGreaterThan(0);
    expect(start.x).toBeLessThan(25);
    const reverse = smoothAllyVelocity({ x: 110, y: 0 }, { x: -110, y: 0 }, 16, 90);
    expect(reverse.x).toBeGreaterThan(0);
    expect(reverse.x).toBeLessThan(110);
    const stop = smoothAllyVelocity({ x: 110, y: 0 }, origin, 270, 90);
    expect(stop.x).toBeGreaterThan(0);
    expect(stop.x).toBeLessThan(6);
  });
  it('has the same response at different frame rates', () => {
    const target = { x: -80, y: 50 };
    let velocity = { x: 110, y: -20 };
    const once = smoothAllyVelocity(velocity, target, 100, 90);
    for (let i = 0; i < 10; i += 1) velocity = smoothAllyVelocity(velocity, target, 10, 90);
    expect(velocity.x).toBeCloseTo(once.x);
    expect(velocity.y).toBeCloseTo(once.y);
  });
  it('handles zero elapsed time and disabled smoothing', () => {
    expect(smoothAllyVelocity(origin, { x: 110, y: 0 }, 0, 90)).toEqual(origin);
    expect(smoothAllyVelocity(origin, { x: 110, y: 0 }, -10, 90)).toEqual(origin);
    expect(smoothAllyVelocity(origin, { x: 110, y: 0 }, 16, 0)).toEqual({ x: 110, y: 0 });
  });
});

describe('ally mode hysteresis', () => {
  it.each([
    ['follow', 139, 'engage'],
    ['follow', 140, 'engage'],
    ['follow', 141, 'follow'],
    ['follow', 164, 'follow'],
    ['engage', 140, 'engage'],
    ['engage', 141, 'engage'],
    ['engage', 164, 'engage'],
    ['engage', 164.01, 'follow'],
    ['engage', null, 'follow'],
    ['follow', null, 'follow'],
  ] as const)('%s at distance %s becomes %s', (mode, distance, expected) => {
    expect(resolveAllyMode(mode, distance, 140, 24)).toBe(expected);
  });
});

describe('ally target retention', () => {
  it('keeps a current target at the release boundary even with a closer enemy', () => {
    const current = enemy(164);
    expect(selectAllyTarget(origin, current, [enemy(10), current], 140, 24)).toBe(current);
  });
  it.each(['inactive', 'far', 'removed'] as const)(
    'reselects the nearest when current is %s',
    (reason) => {
      const current = enemy(reason === 'far' ? 165 : 80, 0, reason !== 'inactive');
      const nearest = enemy(30, 40);
      const candidates = [enemy(130), nearest, enemy(1, 0, false)];
      if (reason !== 'removed') candidates.push(current);
      expect(selectAllyTarget(origin, current, candidates, 140, 24)).toBe(nearest);
    },
  );
  it('acquires at detection boundary but never acquires in the hysteresis band', () => {
    const boundary = enemy(140);
    expect(selectAllyTarget(origin, null, [boundary], 140, 24)).toBe(boundary);
    expect(selectAllyTarget(origin, null, [enemy(141)], 140, 24)).toBeNull();
  });
  it('ignores inactive enemies and returns null without an eligible target', () => {
    expect(selectAllyTarget(origin, null, [enemy(1, 0, false), enemy(165)], 140, 24)).toBeNull();
    expect(selectAllyTarget(origin, null, [], 140, 24)).toBeNull();
  });
});

describe('ally engage movement', () => {
  it.each([
    [55, -110, 0],
    [56, 0, 110],
    [76, 0, 110],
    [96, 0, 110],
    [97, 110, 0],
  ])('moves correctly at distance %s', (distance, x, y) => {
    const actual = getAllyEngageVelocity(origin, enemy(distance), 110, 56, 96, 1);
    expect(actual.x).toBeCloseTo(x);
    expect(actual.y).toBeCloseTo(y);
  });
  it('orbits in opposite directions at equal speed', () => {
    const first = getAllyEngageVelocity(origin, enemy(60, 60), 110, 56, 96, -1);
    const second = getAllyEngageVelocity(origin, enemy(60, 60), 110, 56, 96, 1);
    expect(first.x).toBeCloseTo(-second.x);
    expect(first.y).toBeCloseTo(-second.y);
    expect(Math.hypot(first.x, first.y)).toBeCloseTo(110);
    expect(first.x * 60 + first.y * 60).toBeCloseTo(0);
  });
  it('retreats along a diagonal without exceeding move speed', () => {
    const velocity = getAllyEngageVelocity(origin, enemy(3, 4), 110, 56, 96, 1);
    expect(velocity).toEqual({ x: -66, y: -88 });
  });
  it('separates overlapping allies from an enemy in opposite directions', () => {
    expect(getAllyEngageVelocity(origin, origin, 110, 56, 96, -1).x).toBe(110);
    expect(getAllyEngageVelocity(origin, origin, 110, 56, 96, 1).x).toBe(-110);
  });
});

describe('ally following and room bounds', () => {
  it.each([0, 5.9, 6])('stops at distance %s', (distance) => {
    expect(getAllyFollowVelocity(origin, { x: distance, y: 0 }, 110, 6)).toEqual({ x: 0, y: 0 });
  });
  it('moves toward the offset after leaving the stop radius', () => {
    expect(getAllyFollowVelocity(origin, { x: 6.1, y: 0 }, 110, 6)).toEqual({ x: 110, y: 0 });
    expect(getAllyFollowVelocity(origin, { x: 30, y: 40 }, 110, 6)).toEqual({ x: 66, y: 88 });
  });
  it('uses fixed left and right offsets away from walls', () => {
    expect(getAllyFollowTarget({ x: 240, y: 136 }, -1, ROOM_RECT, margin, 22)).toEqual({
      x: 218,
      y: 136,
    });
    expect(getAllyFollowTarget({ x: 240, y: 136 }, 1, ROOM_RECT, margin, 22)).toEqual({
      x: 262,
      y: 136,
    });
  });
  const edges = [
    [32, 32],
    [448, 32],
    [32, 240],
    [448, 240],
    [32, 136],
    [448, 136],
    [240, 32],
    [240, 240],
    [0, 0],
    [480, 272],
  ];
  it.each(edges)('keeps distinct spawn and follow positions inside the room at (%s,%s)', (x, y) => {
    const player = { x, y };
    const positions = getAllySpawnPositions(player, ROOM_RECT, margin, 22);
    expect(positions).toHaveLength(2);
    expect(allyDistance(positions[0], positions[1])).toBeGreaterThan(ALLY_TUNING.bodyRadius * 2);
    for (const [index, position] of positions.entries()) {
      expect(position.x).toBeGreaterThanOrEqual(40);
      expect(position.x).toBeLessThanOrEqual(440);
      expect(position.y).toBeGreaterThanOrEqual(40);
      expect(position.y).toBeLessThanOrEqual(232);
      expect(getAllyFollowTarget(player, index === 0 ? -1 : 1, ROOM_RECT, margin, 22)).toEqual(
        position,
      );
    }
  });
  it('clamps a moving ally independently on both axes', () => {
    expect(clampAllyToRoom({ x: 0, y: 300 }, ROOM_RECT, margin)).toEqual({ x: 40, y: 232 });
    expect(clampAllyToRoom({ x: 480, y: 0 }, ROOM_RECT, margin)).toEqual({ x: 440, y: 40 });
    expect(clampAllyToRoom({ x: 100, y: 100 }, ROOM_RECT, margin)).toEqual({ x: 100, y: 100 });
  });
});

describe('ally fire and damage rules', () => {
  it.each([
    [699, 120, false],
    [700, 120, true],
    [701, 120.01, false],
    [699, 121, false],
    [701, 119, true],
  ] as const)('at time %s and distance %s firing is %s', (time, distance, expected) => {
    expect(canAllyFire(time, 700, distance, 120)).toBe(expected);
  });
  it.each([
    [4, 2],
    [1, 0.5],
    [0.6, 0.3],
    [0.2, 0.3],
    [0, 0.3],
    [-5, 0.3],
  ])('scales effective damage %s to %s', (damage, expected) => {
    expect(getAllyDamage(damage, 0.5, 0.3)).toBeCloseTo(expected);
  });
  it('uses the multiplier and floor supplied by the caller', () => {
    expect(getAllyDamage(4, 0.25, 0.8)).toBe(1);
    expect(getAllyDamage(0, 0.25, 0.8)).toBe(0.8);
  });
  it('uses each ally invulnerability deadline and rejects nonpositive damage', () => {
    expect(canDamageAlly(499, 500, 1)).toBe(false);
    expect(canDamageAlly(500, 500, 1)).toBe(true);
    expect(canDamageAlly(500, 0, 1)).toBe(true);
    expect(canDamageAlly(500, 0, 0)).toBe(false);
    expect(canDamageAlly(500, 0, -1)).toBe(false);
  });
});

describe('ally summoning availability', () => {
  it.each([
    [0, false],
    [1, true],
    [3, true],
  ] as const)('allows %s active enemies: %s', (count, expected) => {
    expect(canSummonAllies(count)).toBe(expected);
  });
  it('drops from treasure and shop only, costing four charges', () => {
    expect(findActiveItem('seedling-allies')).toMatchObject({
      kind: 'summon',
      chargeCost: 4,
      dropSources: ['treasure', 'shop'],
    });
  });
});
