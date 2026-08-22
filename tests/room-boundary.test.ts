import { describe, expect, it } from 'vitest';
import { ROOM_RECT } from '../src/config/gameConfig';
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
