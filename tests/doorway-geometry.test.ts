import { describe, expect, it } from 'vitest';
import { ROOM_RECT, WALL_THICKNESS } from '../src/config/gameConfig';
import {
  DOOR_PASSAGE_DEPTH,
  DOORWAY_SPAN,
  getDoorCenter,
  getDoorTriggerRect,
  getDoorwayRect,
  getWallSegments,
  hasCrossedDoorThreshold,
  type Rect,
} from '../src/systems/DoorwayGeometry';
import { DIRECTIONS, type Direction } from '../src/utils/directions';

function alongWall(direction: Direction, rect: Rect): [number, number] {
  const center = direction === 'north' || direction === 'south' ? rect.x : rect.y;
  const length = direction === 'north' || direction === 'south' ? rect.width : rect.height;
  return [center - length / 2, center + length / 2];
}

function acrossWall(direction: Direction, rect: Rect): [number, number] {
  const center = direction === 'north' || direction === 'south' ? rect.y : rect.x;
  const length = direction === 'north' || direction === 'south' ? rect.height : rect.width;
  return [center - length / 2, center + length / 2];
}

describe('doorway geometry', () => {
  it('keeps the doorway at the original 48px art width', () => {
    expect(DOORWAY_SPAN).toBe(48);
  });

  for (const direction of DIRECTIONS) {
    it(`${direction} wall is fully covered by two segments and its doorway`, () => {
      const doorway = getDoorwayRect(direction);
      const spans = [...getWallSegments(direction), doorway]
        .map((rect) => alongWall(direction, rect))
        .sort((left, right) => left[0] - right[0]);
      const horizontal = direction === 'north' || direction === 'south';

      expect(spans[0][0]).toBe(horizontal ? ROOM_RECT.left : ROOM_RECT.top);
      expect(spans[0][1]).toBe(spans[1][0]);
      expect(spans[1][1]).toBe(spans[2][0]);
      expect(spans[2][1]).toBe(horizontal ? ROOM_RECT.right : ROOM_RECT.bottom);
      expect(spans[1][1] - spans[1][0]).toBe(DOORWAY_SPAN);
    });

    it(`${direction} door sits inside the wall and transitions at its outer edge`, () => {
      const doorway = getDoorwayRect(direction);
      const trigger = getDoorTriggerRect(direction);

      expect(getDoorCenter(direction)).toEqual({ x: doorway.x, y: doorway.y });
      expect(acrossWall(direction, doorway)[1] - acrossWall(direction, doorway)[0]).toBe(
        WALL_THICKNESS,
      );

      const [doorNear, doorFar] = acrossWall(direction, doorway);
      const [triggerNear, triggerFar] = acrossWall(direction, trigger);
      expect(triggerNear).toBeGreaterThanOrEqual(doorNear);
      expect(triggerFar).toBeLessThanOrEqual(doorFar);
    });

    it(`${direction} requires the body center to pass halfway through the wall`, () => {
      const doorway = getDoorwayRect(direction);
      const horizontal = direction === 'north' || direction === 'south';
      const sign = direction === 'north' || direction === 'west' ? -1 : 1;
      const innerEdge = horizontal
        ? direction === 'north'
          ? ROOM_RECT.top
          : ROOM_RECT.bottom
        : direction === 'west'
          ? ROOM_RECT.left
          : ROOM_RECT.right;
      const beforeDepth = DOOR_PASSAGE_DEPTH - 1;
      const afterDepth = DOOR_PASSAGE_DEPTH;
      const before = horizontal
        ? { x: doorway.x, y: innerEdge + sign * beforeDepth }
        : { x: innerEdge + sign * beforeDepth, y: doorway.y };
      const after = horizontal
        ? { x: doorway.x, y: innerEdge + sign * afterDepth }
        : { x: innerEdge + sign * afterDepth, y: doorway.y };

      expect(hasCrossedDoorThreshold(direction, before)).toBe(false);
      expect(hasCrossedDoorThreshold(direction, after)).toBe(true);
    });
  }
});
