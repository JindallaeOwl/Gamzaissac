import { describe, expect, it } from 'vitest';
import { DungeonManager } from '../src/systems/DungeonManager';
import { RoomNavigationSystem } from '../src/systems/RoomNavigationSystem';
import { createInitialRunState } from '../src/systems/RunState';
import type { Direction } from '../src/utils/directions';

describe('RoomNavigationSystem', () => {
  it('spends a key and unlocks a treasure room before moving into it', () => {
    const dungeon = new DungeonManager(() => 0);
    dungeon.generateFloor(1);
    const treasureDirection = moveNextToRoomType(dungeon, 'treasure');
    const state = createInitialRunState();
    const navigation = new RoomNavigationSystem(dungeon);

    const result = navigation.tryMove(state, treasureDirection);

    expect(result.status).toBe('moved');
    expect(result.status === 'moved' && result.treasureUnlocked).toBe(true);
    expect(dungeon.getCurrentRoom().type).toBe('treasure');
    expect(dungeon.getCurrentRoom().treasureUnlocked).toBe(true);
    expect(state.inventory.keys).toBe(0);
  });

  it('does not move into a locked treasure room without a key', () => {
    const dungeon = new DungeonManager(() => 0);
    dungeon.generateFloor(1);
    const treasureDirection = moveNextToRoomType(dungeon, 'treasure');
    const roomBefore = dungeon.getCurrentRoom();
    const state = createInitialRunState();
    state.inventory.keys = 0;
    const navigation = new RoomNavigationSystem(dungeon);

    expect(navigation.tryMove(state, treasureDirection)).toEqual({ status: 'key-needed' });
    expect(dungeon.getCurrentRoom().id).toBe(roomBefore.id);
  });
});

function moveNextToRoomType(dungeon: DungeonManager, targetType: 'treasure'): Direction {
  const path = findPathToRoomType(dungeon, targetType);

  for (const direction of path.slice(0, -1)) {
    dungeon.move(direction);
  }

  return path.at(-1)!;
}

function findPathToRoomType(dungeon: DungeonManager, targetType: 'treasure'): Direction[] {
  const start = dungeon.getCurrentRoom();
  const visited = new Set([start.id]);
  const pending: Array<{ roomId: string; path: Direction[] }> = [{ roomId: start.id, path: [] }];
  const rooms = new Map(dungeon.getRooms().map((room) => [room.id, room]));

  while (pending.length > 0) {
    const current = pending.shift()!;
    const room = rooms.get(current.roomId)!;

    if (room.type === targetType) {
      return current.path;
    }

    for (const direction of room.exits) {
      const neighbor = dungeon.getNeighbor(room, direction);

      if (!neighbor || visited.has(neighbor.id)) {
        continue;
      }

      visited.add(neighbor.id);
      pending.push({ roomId: neighbor.id, path: [...current.path, direction] });
    }
  }

  throw new Error(`No ${targetType} room found.`);
}
