// 녹슨 쇠스랑의 농부(PitchforkFarmerBoss)의 판정 규칙 중 장면에 의존하지 않는 순수 로직.
// 보스 클래스는 이 규칙을 호출만 하고, 규칙은 여기서 단위 테스트한다.

export type FarmerPattern =
  'trident' | 'rake' | 'seed' | 'stomp' | 'curtain' | 'swing' | 'boomerang';

/**
 * 회전 낫 부메랑이 보스로부터 떨어진 거리. 진행도(progress 0~1)에 따라 0 → range → 0으로,
 * sin 곡선을 그리며 나갔다가 돌아온다(p=0.5에서 최대). progress는 0~1로 클램프한다.
 */
export function boomerangDistance(progress: number, range: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return range * Math.sin(Math.PI * t);
}

// 점 (px,py)와 선분 (ax,ay)-(bx,by) 사이의 최단 거리.
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

/**
 * 쇠스랑 휘두르기 명중 판정. 날은 보스(origin)에서 bladeAngle 방향으로 reach까지 뻗은
 * 선분이며, 플레이어가 그 선분에서 halfWidth 이내일 때 베인다. 부채꼴이 아니라 선분
 * 기준이라 사거리 끝에서 옆으로 벌어지지 않고 "보이는 날 = 판정"이 성립한다.
 */
export function isWithinMeleeBlade(
  playerX: number,
  playerY: number,
  originX: number,
  originY: number,
  bladeAngle: number,
  reach: number,
  halfWidth: number,
): boolean {
  const endX = originX + Math.cos(bladeAngle) * reach;
  const endY = originY + Math.sin(bladeAngle) * reach;
  return distanceToSegment(playerX, playerY, originX, originY, endX, endY) <= halfWidth;
}

export interface FarmerPatternCandidate {
  pattern: FarmerPattern;
  readyAt: number;
}

/**
 * 갈퀴 휘두르기의 현재 발사 각도. 조준 방향(baseAngle)을 중심으로 진행도(progress
 * 0~1)에 따라 -arc/2 → +arc/2로 훑는다. progress는 0~1로 클램프한다.
 */
export function rakeSweepAngle(baseAngle: number, progress: number, arcRad: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return baseAngle - arcRad / 2 + arcRad * t;
}

/**
 * 깨진 링의 안전 틈이 시작되는 인덱스. 플레이어 방향(angleToPlayer)에 틈이 오도록
 * 링을 ringCount등분한 인덱스로 환산한다. 항상 0~ringCount-1 범위다.
 */
export function brokenRingSafeIndex(angleToPlayer: number, ringCount: number): number {
  const twoPi = Math.PI * 2;
  const normalized = ((angleToPlayer % twoPi) + twoPi) % twoPi;
  return Math.round((normalized / twoPi) * ringCount) % ringCount;
}

/**
 * 링에서 index가 안전 틈(safeStart부터 gap개)에 속하는지. 링을 감싸며(모듈러) 판정한다.
 */
export function isInBrokenRingGap(
  index: number,
  safeStart: number,
  gap: number,
  ringCount: number,
): boolean {
  const offset = (((index - safeStart) % ringCount) + ringCount) % ringCount;
  return offset < gap;
}

/**
 * 다음에 시작할 패턴 선택. 쿨다운이 찬(readyAt ≤ time) 후보 중, 직전과 같은 패턴은
 * 되도록 피하고, 가장 오래 기다린(readyAt이 작은) 것을 고른다. 준비된 게 없으면 null.
 */
export function selectFarmerPattern(
  candidates: readonly FarmerPatternCandidate[],
  time: number,
  lastPattern: FarmerPattern | null,
): FarmerPattern | null {
  const ready = candidates.filter((candidate) => candidate.readyAt <= time);

  if (ready.length === 0) {
    return null;
  }

  const notLast = ready.filter((candidate) => candidate.pattern !== lastPattern);
  const pool = notLast.length > 0 ? notLast : ready;

  return pool.reduce((best, candidate) => (candidate.readyAt < best.readyAt ? candidate : best))
    .pattern;
}
