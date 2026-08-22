import { ROOM_CENTER_X, ROOM_CENTER_Y, ROOM_RECT, WALL_THICKNESS } from '../config/gameConfig';
import type { Direction } from '../utils/directions';

/** 문 스프라이트와 벽의 빈자리가 공유하는 원래 통로 폭. */
export const DOORWAY_SPAN = 48;
/** 통로 바깥쪽 끝에서 방 전환을 감지하는 판정 깊이. */
export const DOOR_TRIGGER_DEPTH = 10;
/** 플레이어 몸 중심이 벽 안으로 이 거리 이상 들어가야 다음 방으로 전환한다. */
export const DOOR_PASSAGE_DEPTH = WALL_THICKNESS / 2;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function isHorizontalWall(direction: Direction): boolean {
  return direction === 'north' || direction === 'south';
}

function innerEdge(direction: Direction): number {
  switch (direction) {
    case 'north':
      return ROOM_RECT.top;
    case 'south':
      return ROOM_RECT.bottom;
    case 'west':
      return ROOM_RECT.left;
    case 'east':
      return ROOM_RECT.right;
  }
}

function outerEdge(direction: Direction): number {
  switch (direction) {
    case 'north':
      return ROOM_RECT.top - WALL_THICKNESS;
    case 'south':
      return ROOM_RECT.bottom + WALL_THICKNESS;
    case 'west':
      return ROOM_RECT.left - WALL_THICKNESS;
    case 'east':
      return ROOM_RECT.right + WALL_THICKNESS;
  }
}

/** 벽 두께 안에 파인 문간 전체 영역. */
export function getDoorwayRect(direction: Direction): Rect {
  const center = (innerEdge(direction) + outerEdge(direction)) / 2;

  return isHorizontalWall(direction)
    ? { x: ROOM_CENTER_X, y: center, width: DOORWAY_SPAN, height: WALL_THICKNESS }
    : { x: center, y: ROOM_CENTER_Y, width: WALL_THICKNESS, height: DOORWAY_SPAN };
}

export function getDoorCenter(direction: Direction): { x: number; y: number } {
  const doorway = getDoorwayRect(direction);
  return { x: doorway.x, y: doorway.y };
}

/** 문간 양옆의 벽 조각. 두 조각과 문간을 합치면 기존 벽 전체와 정확히 같다. */
export function getWallSegments(direction: Direction): [Rect, Rect] {
  const doorway = getDoorwayRect(direction);

  if (isHorizontalWall(direction)) {
    const width = (ROOM_RECT.width - doorway.width) / 2;
    return [
      { x: ROOM_RECT.left + width / 2, y: doorway.y, width, height: WALL_THICKNESS },
      { x: ROOM_RECT.right - width / 2, y: doorway.y, width, height: WALL_THICKNESS },
    ];
  }

  const height = (ROOM_RECT.height - doorway.height) / 2;
  return [
    { x: doorway.x, y: ROOM_RECT.top + height / 2, width: WALL_THICKNESS, height },
    { x: doorway.x, y: ROOM_RECT.bottom - height / 2, width: WALL_THICKNESS, height },
  ];
}

/** 방 전환을 위한 문간 바깥쪽 판정 영역. */
export function getDoorTriggerRect(direction: Direction): Rect {
  const doorway = getDoorwayRect(direction);
  const outer = outerEdge(direction);
  const towardRoom = innerEdge(direction) > outer ? 1 : -1;
  const innerTriggerEdge = outer + towardRoom * DOOR_TRIGGER_DEPTH;
  const near = Math.min(outer, innerTriggerEdge);
  const far = Math.max(outer, innerTriggerEdge);

  return isHorizontalWall(direction)
    ? { x: doorway.x, y: (near + far) / 2, width: doorway.width, height: far - near }
    : { x: (near + far) / 2, y: doorway.y, width: far - near, height: doorway.height };
}

/** 플레이어 몸 중심이 문간을 충분히 통과했는지 네 방향에서 같은 깊이로 판정한다. */
export function hasCrossedDoorThreshold(
  direction: Direction,
  point: { x: number; y: number },
): boolean {
  switch (direction) {
    case 'north':
      return point.y <= ROOM_RECT.top - DOOR_PASSAGE_DEPTH;
    case 'south':
      return point.y >= ROOM_RECT.bottom + DOOR_PASSAGE_DEPTH;
    case 'west':
      return point.x <= ROOM_RECT.left - DOOR_PASSAGE_DEPTH;
    case 'east':
      return point.x >= ROOM_RECT.right + DOOR_PASSAGE_DEPTH;
  }
}

/** 열린 문으로 들어갈 때만 허용되는, 방 안쪽까지 조금 이어진 이동 통로. */
export function getDoorwayCorridor(direction: Direction, overlapIntoRoom: number): Rect {
  const doorway = getDoorwayRect(direction);
  const outer = outerEdge(direction);
  const towardRoom = innerEdge(direction) > outer ? 1 : -1;
  const roomSide = innerEdge(direction) + towardRoom * overlapIntoRoom;
  const near = Math.min(outer, roomSide);
  const far = Math.max(outer, roomSide);

  return isHorizontalWall(direction)
    ? { x: doorway.x, y: (near + far) / 2, width: doorway.width, height: far - near }
    : { x: (near + far) / 2, y: doorway.y, width: far - near, height: doorway.height };
}
