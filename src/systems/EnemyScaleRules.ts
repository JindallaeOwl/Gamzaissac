// 사수 계열(ShooterEnemy) 공격 예고/평상시 배율 규칙.
// 과거에는 setScale(0.9)/(0.8)이 하드코딩되어 있어, 적 기본 배율이 0.8에서 1로
// 바뀐 뒤 첫 공격 후 0.8로 줄어든 채 고정되는 버그가 있었다. 항상 스폰 시점의
// 기준 배율에 상대적으로 계산해 어떤 크기의 적(확대된 중간보스 포함)에도 맞게 한다.
export const SHOOTER_TELEGRAPH_SCALE_FACTOR = 1.12;

export type ShooterPulsePhase = 'telegraph' | 'idle';

export function shooterPulseScale(baseScale: number, phase: ShooterPulsePhase): number {
  return phase === 'telegraph' ? baseScale * SHOOTER_TELEGRAPH_SCALE_FACTOR : baseScale;
}

// displayScale로 확대된 적의 실제(월드 기준) 몸 반경. 탄환 생성 위치와
// 방 경계 여백처럼 월드 좌표로 계산하는 곳은 원본 bodyRadius 대신 이 값을 쓴다.
export function effectiveBodyRadius(bodyRadius: number, displayScale?: number): number {
  return bodyRadius * (displayScale ?? 1);
}
