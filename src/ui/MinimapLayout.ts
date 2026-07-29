export interface MinimapCellLayout {
  size: number;
  gap: number;
}

export interface MinimapViewport {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const EXPANDED_MAP_PADDING = 8;
const EXPANDED_GAP_RATIO = 0.25;
const MAX_EXPANDED_CELL_SIZE = 18;
const MIN_EXPANDED_GAP = 3;

// 간격을 고정값으로 두었을 때 count칸이 available 안에 들어가는 최대 칸 크기.
function fitCellSizeWithFixedGap(count: number, available: number, gap: number): number {
  return (available - (count - 1) * gap) / count;
}

/**
 * 확장 미니맵(Tab)의 칸 크기·간격. 방이 많을수록 칸을 줄여 패널 안에 전부 담는다.
 *
 * 간격에는 최소값(MIN_EXPANDED_GAP)이 있어서, 비례식만으로 구한 칸 크기는 실제
 * 렌더 크기를 과소평가할 수 있다(칸은 작아졌는데 간격은 안 줄어들기 때문). 그래서
 * 간격을 확정한 뒤 그 간격 기준으로 칸 크기를 한 번 더 조인다 — 이 보정이 없으면
 * 세로로 긴 맵(8행)에서 확장 미니맵도 패널 밖으로 넘쳤다.
 */
export function calculateExpandedMinimapCellLayout(
  columns: number,
  rows: number,
  panelWidth: number,
  panelHeight: number,
): MinimapCellLayout {
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);
  const availableWidth = Math.max(1, panelWidth - EXPANDED_MAP_PADDING * 2);
  const availableHeight = Math.max(1, panelHeight - EXPANDED_MAP_PADDING * 2);
  const widthFactor = 1 + (safeColumns - 1) * (1 + EXPANDED_GAP_RATIO);
  const heightFactor = 1 + (safeRows - 1) * (1 + EXPANDED_GAP_RATIO);
  const proportionalSize = Math.min(
    MAX_EXPANDED_CELL_SIZE,
    availableWidth / widthFactor,
    availableHeight / heightFactor,
  );
  const gap = Math.max(MIN_EXPANDED_GAP, proportionalSize * EXPANDED_GAP_RATIO);
  const size = Math.max(
    1,
    Math.min(
      proportionalSize,
      fitCellSizeWithFixedGap(safeColumns, availableWidth, gap),
      fitCellSizeWithFixedGap(safeRows, availableHeight, gap),
    ),
  );

  return { size, gap };
}

/**
 * 주어진 칸 크기·간격으로 패널에 그릴 수 있는 칸 수.
 * 첫 칸은 간격 없이 들어가므로 (패널 - 칸) / (칸 + 간격) + 1 이다.
 */
export function calculateMinimapCapacity(panelSize: number, cellSize: number, gap: number): number {
  if (cellSize <= 0 || panelSize < cellSize) {
    return 1;
  }

  return Math.max(1, Math.floor((panelSize - cellSize) / (cellSize + gap)) + 1);
}

// 한 축에서 표시할 범위. 지도가 통째로 들어가면 지도 전체를, 아니면 focus를 가운데
// 두되 지도 밖으로는 밀려나지 않게 고정한 창을 돌려준다(카메라 경계 고정과 같은 규칙).
function resolveAxisWindow(
  mapMin: number,
  mapMax: number,
  focus: number,
  capacity: number,
): { min: number; max: number } {
  const span = mapMax - mapMin + 1;

  if (span <= capacity) {
    return { min: mapMin, max: mapMax };
  }

  const half = Math.floor((capacity - 1) / 2);
  const min = Math.min(Math.max(focus - half, mapMin), mapMax - capacity + 1);

  return { min, max: min + capacity - 1 };
}

/**
 * 미니맵에 실제로 그릴 좌표 범위.
 *
 * 방이 패널에 다 들어가면 지금까지처럼 지도 전체를 보여 주고(대부분의 층이 여기 해당),
 * 넘칠 때만 현재 방을 중심으로 한 창을 보여 준다. 창은 지도 가장자리를 넘지 않으므로
 * 맵 끝에서 빈 공간이 생기지 않는다.
 */
export function calculateMinimapViewport(params: {
  mapMinX: number;
  mapMaxX: number;
  mapMinY: number;
  mapMaxY: number;
  focusX: number;
  focusY: number;
  columnCapacity: number;
  rowCapacity: number;
}): MinimapViewport {
  const horizontal = resolveAxisWindow(
    params.mapMinX,
    params.mapMaxX,
    params.focusX,
    Math.max(1, params.columnCapacity),
  );
  const vertical = resolveAxisWindow(
    params.mapMinY,
    params.mapMaxY,
    params.focusY,
    Math.max(1, params.rowCapacity),
  );

  return {
    minX: horizontal.min,
    maxX: horizontal.max,
    minY: vertical.min,
    maxY: vertical.max,
  };
}
