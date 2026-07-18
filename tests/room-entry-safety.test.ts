import { describe, expect, it } from 'vitest';
import { ROOM_ENTRY_SAFE_RADIUS } from '../src/config/gameConfig';
import { resolveEnemySpawnAwayFromEntry } from '../src/systems/RoomEntrySafety';

function distance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

describe('room entry safety', () => {
  it('keeps enemies that are already safely away from the entrance', () => {
    const spawn = { x: 240, y: 136 };
    expect(resolveEnemySpawnAwayFromEntry(spawn, { x: 240, y: 60 })).toEqual(spawn);
  });

  it.each([
    [
      { x: 240, y: 60 },
      { x: 240, y: 80 },
    ],
    [
      { x: 240, y: 212 },
      { x: 240, y: 192 },
    ],
    [
      { x: 60, y: 136 },
      { x: 80, y: 136 },
    ],
    [
      { x: 420, y: 136 },
      { x: 400, y: 136 },
    ],
  ])('moves a doorway enemy outside the safe radius at every entrance', (entry, spawn) => {
    const resolved = resolveEnemySpawnAwayFromEntry(spawn, entry);
    expect(distance(resolved, entry)).toBeGreaterThanOrEqual(ROOM_ENTRY_SAFE_RADIUS);
  });

  it('uses another safe position when the nearest one is occupied or blocked', () => {
    const entry = { x: 240, y: 60 };
    const occupied = [{ x: 240, y: 132 }];
    const obstacles = [{ x: 200, y: 132 }];
    const resolved = resolveEnemySpawnAwayFromEntry({ x: 240, y: 80 }, entry, occupied, obstacles);

    expect(distance(resolved, entry)).toBeGreaterThanOrEqual(ROOM_ENTRY_SAFE_RADIUS);
    expect(distance(resolved, occupied[0])).toBeGreaterThanOrEqual(36);
    expect(distance(resolved, obstacles[0])).toBeGreaterThanOrEqual(38);
  });
});
