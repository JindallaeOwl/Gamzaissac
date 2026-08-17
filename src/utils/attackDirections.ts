export interface AttackDirection {
  x: number;
  y: number;
}

export function createSpreadDirections(
  centerDirection: AttackDirection,
  count: number,
  spreadStepDegrees: number,
): AttackDirection[] {
  const shotCount = Math.max(1, Math.floor(count));
  const centerIndex = (shotCount - 1) / 2;
  const centerAngle = Math.atan2(centerDirection.y, centerDirection.x);

  return Array.from({ length: shotCount }, (_, index) => {
    const angleOffset = degreesToRadians((index - centerIndex) * spreadStepDegrees);
    const angle = centerAngle + angleOffset;

    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
}

/**
 * 원을 균등하게 나눈 방향들. 준보스의 방사형 탄막(뿌리탄·가시 방사)에 쓴다.
 *
 * 첫 발이 `aimDirection`에 정확히 놓이고 나머지가 360/n도씩 돌아간다. 부채꼴
 * (createSpreadDirections)처럼 조준선을 가운데 두면 짝수 발일 때 조준 방향이
 * 틈의 정중앙이 되어, 가만히 선 플레이어를 반드시 비껴간다 — 조준한 방사탄으로는
 * 쓸 수 없다. 기준각이 조준을 따라 돌기 때문에 각도가 고정되어 외워지지도 않는다.
 */
export function createRadialDirections(
  count: number,
  aimDirection: AttackDirection = { x: 1, y: 0 },
): AttackDirection[] {
  const shotCount = Math.max(1, Math.floor(count));
  const baseAngle = Math.atan2(aimDirection.y, aimDirection.x);
  const step = (Math.PI * 2) / shotCount;

  return Array.from({ length: shotCount }, (_, index) => {
    const angle = baseAngle + step * index;

    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
}

export function distanceToSegmentSquared(
  point: AttackDirection,
  start: AttackDirection,
  end: AttackDirection,
): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared === 0) {
    return squaredDistance(point, start);
  }

  const projection =
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared;
  const clampedProjection = Math.max(0, Math.min(1, projection));
  const closest = {
    x: start.x + segmentX * clampedProjection,
    y: start.y + segmentY * clampedProjection,
  };

  return squaredDistance(point, closest);
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function squaredDistance(first: AttackDirection, second: AttackDirection): number {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return dx * dx + dy * dy;
}
