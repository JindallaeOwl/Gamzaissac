import { ROOM_RECT } from '../config/gameConfig';
import { getDoorwayCorridor, type Rect } from './DoorwayGeometry';
import type { Direction } from '../utils/directions';

export const PLAYER_BOUNDS_MARGIN = 12;
const DOORWAY_CROSS_CLEARANCE = 8;
// 진행 방향은 물리 몸이 전환 기준선을 확실히 넘을 수 있도록 작은 여유만 남긴다.
const DOORWAY_DEPTH_CLEARANCE = 4;

export interface Point {
  x: number;
  y: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function shrink(rect: Rect, marginX: number, marginY: number): Bounds {
  return {
    minX: rect.x - Math.max(0, rect.width / 2 - marginX),
    maxX: rect.x + Math.max(0, rect.width / 2 - marginX),
    minY: rect.y - Math.max(0, rect.height / 2 - marginY),
    maxY: rect.y + Math.max(0, rect.height / 2 - marginY),
  };
}

const ROOM_INTERIOR: Rect = {
  x: (ROOM_RECT.left + ROOM_RECT.right) / 2,
  y: (ROOM_RECT.top + ROOM_RECT.bottom) / 2,
  width: ROOM_RECT.width,
  height: ROOM_RECT.height,
};

function isHorizontalPassage(direction: Direction): boolean {
  return direction === 'north' || direction === 'south';
}

/**
 * 열린 문간에서만 플레이어 몸 중심이 벽 띠 안으로 들어갈 수 있게 한다.
 *
 * 열린 문마다 경계를 **누적해서 넓힌 뒤 마지막에 한 번만 가둔다.** 문 하나를 볼
 * 때마다 x·y를 다시 계산해 덮어쓰면, 앞 문이 열어 준 통로를 뒤 문이 도로 닫는다 —
 * 북·남 문간은 가로 범위가, 동·서 문간은 세로 범위가 서로 같아서 가운데 줄에 서면
 * 두 문이 동시에 걸리고, 나중에 도는 쪽(DIRECTIONS 순서상 남·서)이 항상 이겼다.
 * 그래서 마주보는 문이 함께 열린 방에서 북문과 동문이 투명벽처럼 막혔다.
 */
export function clampToRoomBounds(
  point: Point,
  openPassages: readonly Direction[],
  margin = PLAYER_BOUNDS_MARGIN,
): Point {
  const room = shrink(ROOM_INTERIOR, margin, margin);
  const bounds: Bounds = { ...room };
  // 지금 위치가 실제로 걸쳐 있는 문간들. 벽 띠 안으로 들어갔을 때 통로 폭으로
  // 좁히는 데 쓴다.
  const enteredPassages: { horizontal: boolean; passage: Bounds }[] = [];

  for (const direction of openPassages) {
    const horizontal = isHorizontalPassage(direction);
    const corridor = getDoorwayCorridor(direction, margin * 2);
    const passage = shrink(
      corridor,
      horizontal ? DOORWAY_CROSS_CLEARANCE : DOORWAY_DEPTH_CLEARANCE,
      horizontal ? DOORWAY_DEPTH_CLEARANCE : DOORWAY_CROSS_CLEARANCE,
    );

    if (horizontal) {
      if (point.x < passage.minX || point.x > passage.maxX) {
        continue;
      }

      // 북쪽 문간은 방 위, 남쪽 문간은 방 아래에 있으므로 각자 자기 방향으로만 넓힌다.
      bounds.minY = Math.min(bounds.minY, passage.minY);
      bounds.maxY = Math.max(bounds.maxY, passage.maxY);
    } else {
      if (point.y < passage.minY || point.y > passage.maxY) {
        continue;
      }

      bounds.minX = Math.min(bounds.minX, passage.minX);
      bounds.maxX = Math.max(bounds.maxX, passage.maxX);
    }

    enteredPassages.push({ horizontal, passage });
  }

  let x = clamp(point.x, bounds.minX, bounds.maxX);
  let y = clamp(point.y, bounds.minY, bounds.maxY);

  for (const { horizontal, passage } of enteredPassages) {
    if (horizontal) {
      if (y < room.minY || y > room.maxY) {
        x = clamp(x, passage.minX, passage.maxX);
      }
    } else if (x < room.minX || x > room.maxX) {
      y = clamp(y, passage.minY, passage.maxY);
    }
  }

  return { x, y };
}
