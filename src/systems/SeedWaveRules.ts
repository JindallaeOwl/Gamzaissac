/**
 * 물결 씨앗의 조향 규칙.
 *
 * 탄의 속도 크기는 유지한 채 진행 각도만 시간에 따라 좌우로 흔든다. 방향 벡터가
 * 아니라 "발사 각에 더할 오프셋(라디안)"을 돌려주는 이유: 탄이 발사 각 하나만
 * 저장하고 매 프레임 덧셈으로 새 각을 얻게 해, 벡터에서 각도를 되구하는
 * atan2 왕복(프레임당 비용·정밀도 손실)을 없애기 위해서다.
 * 순수 함수라 진폭 범위와 왕복 주기를 단위 테스트로 고정할 수 있다.
 */

/** 좌→우→좌로 한 번 왕복하는 데 걸리는 시간 */
export const WAVE_CYCLE_MS = 480;

/**
 * 발사 후 경과 시간에 따른 조향 각 오프셋(라디안).
 *
 * `waveSign`은 부채꼴에서 이웃한 씨앗이 서로 반대 위상으로 흔들리게 하는 부호다.
 * 모든 씨앗이 같은 방향으로 함께 휘면 부채꼴 전체가 한 덩어리로 흔들려 물결로
 * 읽히지 않는다 — 엇갈려야 각 씨앗의 궤적이 따로 보인다.
 */
export function getWaveAngleOffset(
  elapsedMs: number,
  waveDegrees: number,
  waveSign: 1 | -1,
): number {
  if (waveDegrees <= 0) {
    return 0;
  }

  const phase = (elapsedMs / WAVE_CYCLE_MS) * Math.PI * 2;
  return ((waveDegrees * Math.PI) / 180) * Math.sin(phase) * waveSign;
}

/** 부채꼴 안 씨앗 순서에 따른 물결 위상 부호. 짝수 번째와 홀수 번째가 엇갈린다. */
export function getWaveSign(seedIndex: number): 1 | -1 {
  return seedIndex % 2 === 0 ? 1 : -1;
}
