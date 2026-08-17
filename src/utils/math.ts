export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface PointBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * 점을 경계 안(여백 margin)으로 끌어당긴다. 플레이어가 벽에 붙어 있어도 그 자리를
 * 노리는 것(지렁이 왕의 재등장 지점, 뿌리 옹이의 도약 착지점)이 벽 밖으로
 * 나가지 않게 한다.
 */
export function clampPointInsideBounds(
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

export function normalizeVector(x: number, y: number): { x: number; y: number } {
  if (x === 0 && y === 0) {
    return { x: 0, y: 0 };
  }

  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}
