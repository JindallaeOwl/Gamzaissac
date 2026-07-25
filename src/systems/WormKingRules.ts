// 늙은 지렁이 왕(WormKingBoss)의 판정 규칙 중 장면(Scene)에 의존하지 않는 순수 로직.
// 보스 클래스는 이 규칙을 호출만 하고, 규칙은 여기서 단위 테스트한다.

export type WormKingState =
  'idle' | 'chargeWindup' | 'charging' | 'burrowHidden' | 'burrowTelegraph' | 'phaseTransition';

export interface PointBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * 잠수(잠수 중·재등장 예고) 상태에서는 어떤 피해도 받지 않는다. 탄은 물리 바디를
 * 꺼서 막지만, 위치로 판정하는 폭탄까지 막으려면 피해 진입점에서 이 규칙을 쓴다.
 */
export function isBurrowInvulnerable(state: WormKingState): boolean {
  return state === 'burrowHidden' || state === 'burrowTelegraph';
}

/**
 * 지연 실행되는 소환 콜백의 실행 조건. 보스가 살아 있고, 소환을 요청한 방에서
 * 아직 벗어나지 않았으며, 런이 끝나지 않았을(게임오버·탈출) 때만 소환한다.
 */
export function shouldExecuteDeferredSummon(context: {
  bossActive: boolean;
  sameRoom: boolean;
  runEnded: boolean;
}): boolean {
  return context.bossActive && context.sameRoom && !context.runEnded;
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
  return {
    x: clamp(x, bounds.left + margin, bounds.right - margin),
    y: clamp(y, bounds.top + margin, bounds.bottom - margin),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
