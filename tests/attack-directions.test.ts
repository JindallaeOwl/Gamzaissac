import { describe, expect, it } from 'vitest';
import {
  createRadialDirections,
  createSpreadDirections,
  distanceToSegmentSquared,
} from '../src/utils/attackDirections';

function anglesOf(directions: { x: number; y: number }[]): number[] {
  return directions.map((direction) =>
    Math.round((Math.atan2(direction.y, direction.x) * 180) / Math.PI),
  );
}

describe('attack directions', () => {
  it('keeps a single attack pointed in the original direction', () => {
    expect(createSpreadDirections({ x: 1, y: 0 }, 1, 12)[0]).toMatchObject({ x: 1, y: 0 });
  });

  it('creates four directions symmetrically around the aim direction', () => {
    const directions = createSpreadDirections({ x: 1, y: 0 }, 4, 12);
    const angles = directions.map((direction) =>
      Math.round((Math.atan2(direction.y, direction.x) * 180) / Math.PI),
    );

    expect(angles).toEqual([-18, -6, 6, 18]);
  });

  it('rotates the same fan around vertical aim directions', () => {
    const directions = createSpreadDirections({ x: 0, y: -1 }, 4, 12);
    const angles = directions.map((direction) =>
      Math.round((Math.atan2(direction.y, direction.x) * 180) / Math.PI),
    );

    expect(angles).toEqual([-108, -96, -84, -72]);
  });

  it('spreads a radial burst evenly around the full circle', () => {
    // 준보스 방사탄. 간격이 고르지 않으면 특정 방향에 틈이 생겨 패턴이 깨진다.
    // atan2는 ±π에서 값이 감기므로 인접 간격을 0~2π로 정규화해 비교한다.
    const count = 8;
    const directions = createRadialDirections(count, { x: 1, y: 0 });
    const radians = directions.map((direction) => Math.atan2(direction.y, direction.x));
    const fullCircle = Math.PI * 2;
    const expectedGap = fullCircle / count;

    expect(directions).toHaveLength(count);

    // 마지막 → 첫 방향 간격까지 함께 보므로 원이 닫히는 것도 확인된다.
    for (const [index, angle] of radians.entries()) {
      const previous = radians[(index + count - 1) % count];

      expect((angle - previous + fullCircle) % fullCircle).toBeCloseTo(expectedGap);
    }
  });

  it('puts the first bullet exactly on the aim direction', () => {
    // 조준한 방사탄의 핵심. 부채꼴처럼 조준선을 가운데 두면 짝수 발일 때
    // 조준 방향이 틈의 정중앙이 되어 가만히 선 플레이어를 반드시 비껴간다.
    for (const aim of [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -0.6, y: 0.8 },
    ]) {
      for (const count of [4, 6, 8, 12]) {
        const [first] = createRadialDirections(count, aim);

        expect(first.x, `count=${count}`).toBeCloseTo(aim.x);
        expect(first.y, `count=${count}`).toBeCloseTo(aim.y);
      }
    }
  });

  it('rotates the radial burst with the aim direction', () => {
    // 각도가 고정되면 틈이 외워진다.
    expect(anglesOf(createRadialDirections(4, { x: 1, y: 0 }))).not.toEqual(
      anglesOf(createRadialDirections(4, { x: 0, y: 1 })),
    );
  });

  it('keeps a radial burst usable at degenerate counts', () => {
    expect(createRadialDirections(1, { x: 1, y: 0 })).toHaveLength(1);
    expect(createRadialDirections(0)).toHaveLength(1);
    expect(createRadialDirections(-3)).toHaveLength(1);
  });

  it('measures distance from a target to a beam segment', () => {
    const start = { x: 10, y: 10 };
    const end = { x: 110, y: 10 };

    expect(distanceToSegmentSquared({ x: 60, y: 15 }, start, end)).toBe(25);
    expect(distanceToSegmentSquared({ x: 0, y: 10 }, start, end)).toBe(100);
  });
});
