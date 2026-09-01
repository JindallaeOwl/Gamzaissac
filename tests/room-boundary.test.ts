import { describe, expect, it } from 'vitest';
import { ROOM_CENTER_X, ROOM_CENTER_Y, ROOM_RECT } from '../src/config/gameConfig';
import {
  getDoorTriggerRect,
  getDoorwayRect,
  hasCrossedDoorThreshold,
  type Rect,
} from '../src/systems/DoorwayGeometry';
import { clampToRoomBounds, PLAYER_BOUNDS_MARGIN } from '../src/systems/RoomBoundary';
import { DIRECTIONS, type Direction } from '../src/utils/directions';

const PLAYER_BODY_RADIUS = 8;

function outwardPoint(direction: Direction): { x: number; y: number } {
  const doorway = getDoorwayRect(direction);

  switch (direction) {
    case 'north':
      return { x: doorway.x, y: -1000 };
    case 'south':
      return { x: doorway.x, y: 1000 };
    case 'west':
      return { x: -1000, y: doorway.y };
    case 'east':
      return { x: 1000, y: doorway.y };
  }
}

function overlaps(point: { x: number; y: number }, rect: Rect): boolean {
  return (
    point.x + PLAYER_BODY_RADIUS > rect.x - rect.width / 2 &&
    point.x - PLAYER_BODY_RADIUS < rect.x + rect.width / 2 &&
    point.y + PLAYER_BODY_RADIUS > rect.y - rect.height / 2 &&
    point.y - PLAYER_BODY_RADIUS < rect.y + rect.height / 2
  );
}

describe('room boundary', () => {
  for (const direction of DIRECTIONS) {
    it(`only reaches the ${direction} transition trigger through an open doorway`, () => {
      const point = outwardPoint(direction);
      const trigger = getDoorTriggerRect(direction);
      const openBounded = clampToRoomBounds(point, [direction]);

      expect(overlaps(openBounded, trigger)).toBe(true);
      expect(hasCrossedDoorThreshold(direction, openBounded)).toBe(true);
      expect(overlaps(clampToRoomBounds(point, []), trigger)).toBe(false);
    });

    it(`${direction} passage does not allow escaping beside the doorway`, () => {
      const doorway = getDoorwayRect(direction);
      const horizontal = direction === 'north' || direction === 'south';
      const point = outwardPoint(direction);
      const offset = (horizontal ? doorway.width : doorway.height) / 2 + 32;
      const besideDoor = horizontal
        ? { x: point.x + offset, y: point.y }
        : { x: point.x, y: point.y + offset };
      const bounded = clampToRoomBounds(besideDoor, [direction]);

      expect(bounded.x).toBeGreaterThanOrEqual(ROOM_RECT.left + PLAYER_BOUNDS_MARGIN);
      expect(bounded.x).toBeLessThanOrEqual(ROOM_RECT.right - PLAYER_BOUNDS_MARGIN);
      expect(bounded.y).toBeGreaterThanOrEqual(ROOM_RECT.top + PLAYER_BOUNDS_MARGIN);
      expect(bounded.y).toBeLessThanOrEqual(ROOM_RECT.bottom - PLAYER_BOUNDS_MARGIN);
    });

    it(`${direction} remains passable when the body center is slightly off the visual center`, () => {
      const doorway = getDoorwayRect(direction);
      const horizontal = direction === 'north' || direction === 'south';

      for (const offset of [-12, 0, 12]) {
        const outward = outwardPoint(direction);
        const aimed = horizontal
          ? { x: doorway.x + offset, y: outward.y }
          : { x: outward.x, y: doorway.y + offset };
        const bounded = clampToRoomBounds(aimed, [direction]);

        expect(hasCrossedDoorThreshold(direction, bounded)).toBe(true);
      }
    });
  }
});

const STEP_VECTORS: Record<Direction, { x: number; y: number }> = {
  north: { x: 0, y: -4 },
  south: { x: 0, y: 4 },
  east: { x: 4, y: 0 },
  west: { x: -4, y: 0 },
};

/**
 * 방 한가운데에서 문 쪽으로 한 걸음씩 밀며 매 걸음 경계에 가둔다.
 *
 * 한 점을 바깥에 찍어 한 번만 가두는 위 테스트와 달리, 실제 플레이처럼 걸어가는
 * 경로를 따라간다. 투명벽 회귀는 걸어가는 도중 경계가 다시 좁아지며 생겼으므로
 * 이 형태여야 잡힌다.
 */
function walksThroughDoor(direction: Direction, openPassages: readonly Direction[]): boolean {
  const step = STEP_VECTORS[direction];
  let point = { x: ROOM_CENTER_X, y: ROOM_CENTER_Y };

  for (let i = 0; i < 200; i += 1) {
    point = clampToRoomBounds({ x: point.x + step.x, y: point.y + step.y }, openPassages);

    if (hasCrossedDoorThreshold(direction, point)) {
      return true;
    }
  }

  return false;
}

function openPassageSubsets(): Direction[][] {
  const subsets: Direction[][] = [];

  for (let mask = 1; mask < 1 << DIRECTIONS.length; mask += 1) {
    subsets.push(DIRECTIONS.filter((_, index) => mask & (1 << index)));
  }

  return subsets;
}

// 마주보는 문이 함께 열린 방에서 북문·동문이 투명벽처럼 막히던 회귀를 고정한다.
// 원인은 문마다 경계를 다시 계산해 덮어쓴 것이었다 — 북·남 문간은 가로 범위가,
// 동·서 문간은 세로 범위가 같아서 가운데 줄에서는 두 문이 동시에 걸리고, 나중에
// 도는 쪽이 앞 문이 열어 준 통로를 도로 닫았다. 문이 하나만 열린 방은 멀쩡했기
// 때문에 위의 단일 문 테스트로는 드러나지 않았다.
describe('room boundary with several doors open at once', () => {
  for (const openPassages of openPassageSubsets()) {
    it(`lets the player walk out of every open door when [${openPassages.join(', ')}] are open`, () => {
      for (const direction of openPassages) {
        expect({
          direction,
          passable: walksThroughDoor(direction, openPassages),
        }).toEqual({ direction, passable: true });
      }
    });
  }

  it('still blocks directions whose door is closed', () => {
    for (const openPassages of openPassageSubsets()) {
      for (const direction of DIRECTIONS.filter((entry) => !openPassages.includes(entry))) {
        expect({
          direction,
          open: openPassages,
          passable: walksThroughDoor(direction, openPassages),
        }).toEqual({ direction, open: openPassages, passable: false });
      }
    }
  });
});
