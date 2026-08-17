import { describe, expect, it } from 'vitest';
import { clampPointInsideBounds } from '../src/utils/math';
import { clampResurfacePoint } from '../src/systems/WormKingRules';

const BOUNDS = { left: 32, right: 448, top: 32, bottom: 240 };

describe('clampPointInsideBounds', () => {
  it('leaves a point that is already inside alone', () => {
    expect(clampPointInsideBounds(200, 120, BOUNDS, 12)).toEqual({ x: 200, y: 120 });
  });

  it('pulls a point outside the wall back in by the margin', () => {
    // 벽에 붙은 플레이어를 노려도 착지점·재등장 지점이 벽 밖으로 나가지 않는다.
    expect(clampPointInsideBounds(0, 0, BOUNDS, 12)).toEqual({ x: 44, y: 44 });
    expect(clampPointInsideBounds(999, 999, BOUNDS, 12)).toEqual({ x: 436, y: 228 });
  });

  it('still backs the Worm King resurface rule (same maths, one home)', () => {
    // 지렁이 왕의 규칙은 이 공용 함수에 위임한다 — 두 곳이 갈라지지 않게 고정한다.
    expect(clampResurfacePoint(0, 999, BOUNDS, 12)).toEqual(
      clampPointInsideBounds(0, 999, BOUNDS, 12),
    );
  });
});
