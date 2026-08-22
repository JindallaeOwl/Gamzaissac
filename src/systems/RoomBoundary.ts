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

/** 열린 문간에서만 플레이어 몸 중심이 벽 띠 안으로 들어갈 수 있게 한다. */
export function clampToRoomBounds(
  point: Point,
  openPassages: readonly Direction[],
  margin = PLAYER_BOUNDS_MARGIN,
): Point {
  const room = shrink(ROOM_INTERIOR, margin, margin);
  let x = clamp(point.x, room.minX, room.maxX);
  let y = clamp(point.y, room.minY, room.maxY);

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

      y = clamp(point.y, Math.min(room.minY, passage.minY), Math.max(room.maxY, passage.maxY));
      if (y < room.minY || y > room.maxY) {
        x = clamp(point.x, passage.minX, passage.maxX);
      }
    } else {
      if (point.y < passage.minY || point.y > passage.maxY) {
        continue;
      }

      x = clamp(point.x, Math.min(room.minX, passage.minX), Math.max(room.maxX, passage.maxX));
      if (x < room.minX || x > room.maxX) {
        y = clamp(point.y, passage.minY, passage.maxY);
      }
    }
  }

  return { x, y };
}
