import { describe, expect, it } from 'vitest';
import { DungeonManager } from '../src/systems/DungeonManager';

describe('DungeonManager', () => {
  it('generates a connected first floor with its required room types', () => {
    const dungeon = new DungeonManager(() => 0);
    dungeon.generateFloor(1);

    const rooms = dungeon.getRooms();
    const start = dungeon.getCurrentRoom();

    expect(start.type).toBe('start');
    expect(start.exits.length).toBeGreaterThanOrEqual(2);
    expect(rooms.filter((room) => room.type === 'combat')).toHaveLength(3);
    expect(rooms.filter((room) => room.type === 'boss')).toHaveLength(1);
    expect(rooms.some((room) => room.type === 'shop')).toBe(true);
    expect(rooms.some((room) => room.type === 'treasure')).toBe(true);
    expect(
      rooms
        .filter((room) => room.type === 'shop' || room.type === 'treasure')
        .every((room) => room.specialRoomUnlocked),
    ).toBe(true);
    expect(getReachableRoomIds(dungeon)).toEqual(new Set(rooms.map((room) => room.id)));
  });

  it('locks shop and treasure rooms starting on the second floor', () => {
    const dungeon = new DungeonManager(() => 0);
    dungeon.generateFloor(2);

    const specialRooms = dungeon
      .getRooms()
      .filter((room) => room.type === 'shop' || room.type === 'treasure');

    expect(specialRooms).toHaveLength(2);
    expect(specialRooms.every((room) => !room.specialRoomUnlocked)).toBe(true);
  });

  it('alternates boss templates by floor', () => {
    const dungeon = new DungeonManager(() => 0);

    dungeon.generateFloor(1);
    expect(dungeon.getRooms().find((room) => room.type === 'boss')?.templateId).toBe(
      'error-sanctum',
    );

    dungeon.generateFloor(2);
    expect(dungeon.getRooms().find((room) => room.type === 'boss')?.templateId).toBe('root-cellar');
  });

  it('can directly select a generated room for developer navigation', () => {
    const dungeon = new DungeonManager(() => 0);
    dungeon.generateFloor(1);
    const bossRoom = dungeon.getRooms().find((room) => room.type === 'boss')!;

    expect(dungeon.moveToRoom(bossRoom.id)).toBe(bossRoom);
    expect(dungeon.getCurrentRoom()).toBe(bossRoom);
    expect(bossRoom.discovered).toBe(true);
    expect(dungeon.moveToRoom('missing-room')).toBeNull();
  });

  it('keeps an opened chest position in its source room', () => {
    const dungeon = new DungeonManager(() => 0);
    dungeon.generateFloor(1);
    const room = dungeon.getCurrentRoom();
    room.pendingReward = {
      reward: { kind: 'chest', amount: 1, labelKey: 'resources.chest', tint: 0xd6a15f },
      x: 240,
      y: 136,
    };

    dungeon.updatePendingChest(room.id, 252, 142, true);

    expect(room.pendingReward).toMatchObject({ x: 252, y: 142, opened: true });
  });

  it('keeps a pushed heart position in its source room', () => {
    const dungeon = new DungeonManager(() => 0);
    dungeon.generateFloor(1);
    const room = dungeon.getCurrentRoom();
    room.pendingReward = {
      reward: { kind: 'heart', amount: 1, labelKey: 'resources.hearts', tint: 0xff5f74 },
      x: 240,
      y: 136,
    };

    dungeon.updatePendingRewardPosition(room.id, 247, 139);

    expect(room.pendingReward).toMatchObject({ x: 247, y: 139 });
  });
});

function getReachableRoomIds(dungeon: DungeonManager): Set<string> {
  const rooms = dungeon.getRooms();
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const visited = new Set<string>();
  const pending = [dungeon.getCurrentRoom().id];

  while (pending.length > 0) {
    const id = pending.pop()!;

    if (visited.has(id)) {
      continue;
    }

    visited.add(id);
    const room = byId.get(id)!;

    for (const direction of room.exits) {
      const delta =
        direction === 'north'
          ? [0, -1]
          : direction === 'south'
            ? [0, 1]
            : direction === 'east'
              ? [1, 0]
              : [-1, 0];
      const neighborId = `${room.coord.x + delta[0]},${room.coord.y + delta[1]}`;

      if (!visited.has(neighborId)) {
        pending.push(neighborId);
      }
    }
  }

  return visited;
}
