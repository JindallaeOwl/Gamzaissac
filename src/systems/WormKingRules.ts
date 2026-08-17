// 늙은 지렁이 왕(WormKingBoss)의 판정 규칙 중 장면(Scene)에 의존하지 않는 순수 로직.
// 보스 클래스는 이 규칙을 호출만 하고, 규칙은 여기서 단위 테스트한다.

export type WormKingState =
  | 'idle'
  | 'chargeWindup'
  | 'charging'
  | 'burrowHidden'
  | 'burrowTelegraph'
  | 'emerging'
  | 'phaseTransition';

import { clampPointInsideBounds, type PointBounds } from '../utils/math';

export type { PointBounds };

/**
 * 땅속에 있는 동안(파고들기·재등장 예고·솟아오르는 중)에는 어떤 피해도 받지 않는다.
 * 탄·빔은 물리 바디를 꺼서 막지만, 위치로 판정하는 폭탄까지 막으려면 피해 진입점에서
 * 이 규칙을 쓴다. 'emerging'을 포함해, 완전히 솟아 히트박스가 켜지기 전까지 무적을
 * 유지함으로써 "보이는 프레임 = 판정" 이 어긋나지 않게 한다.
 */
export function isBurrowInvulnerable(state: WormKingState): boolean {
  return state === 'burrowHidden' || state === 'burrowTelegraph' || state === 'emerging';
}

/**
 * 땅굴에서 재등장할 지점을 방 경계 안(여백 margin)으로 clamp한다. 플레이어가
 * 벽에 붙어 있어도 보스가 벽 밖으로 솟지 않게 한다.
 */
export function clampResurfacePoint(
  x: number,
  y: number,
  bounds: PointBounds,
  margin: number,
): { x: number; y: number } {
  return clampPointInsideBounds(x, y, bounds, margin);
}
