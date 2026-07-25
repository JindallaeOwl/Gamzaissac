import { describe, expect, it } from 'vitest';
import { BOSS_ROOM_TEMPLATES, bossRoomTemplateId, getRoomTemplate } from '../src/data/rooms';
import { STAGES } from '../src/data/stages';
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

  it('selects each floor boss from the stage data (1-8)', () => {
    const dungeon = new DungeonManager(() => 0);
    // 순환 검증을 피하기 위해 층별 기대 보스를 리터럴로 명시한다.
    const expected: [number, string][] = [
      [1, 'boss-rootGnarl'],
      [2, 'boss-rootKernel'],
      [3, 'boss-wriggleMass'],
      [4, 'boss-wormKing'],
      [5, 'boss-flyQueen'],
      [6, 'boss-faultWarden'],
      [7, 'boss-thornTangle'],
      [8, 'boss-rootKernel'],
    ];

    for (const [floor, templateId] of expected) {
      dungeon.generateFloor(floor);
      expect(
        dungeon.getRooms().find((room) => room.type === 'boss')?.templateId,
        `floor ${floor}`,
      ).toBe(templateId);
    }
  });

  it('rejects floors outside the stage range', () => {
    const dungeon = new DungeonManager(() => 0);

    for (const invalid of [0, 9, -1, 1.5]) {
      expect(() => dungeon.generateFloor(invalid), `floor ${invalid}`).toThrow();
    }
  });

  it('derives one valid boss room template per unique stage boss', () => {
    const uniqueBossIds = [...new Set(STAGES.flatMap((stage) => stage.bossIds))];
    const templateIds = BOSS_ROOM_TEMPLATES.map((template) => template.id);

    expect(new Set(templateIds).size).toBe(templateIds.length);
    expect(templateIds).toHaveLength(uniqueBossIds.length);

    for (const bossId of uniqueBossIds) {
      const template = BOSS_ROOM_TEMPLATES.find(
        (candidate) => candidate.id === bossRoomTemplateId(bossId),
      );

      expect(template, bossId).toBeDefined();
      expect(template?.roomType).toBe('boss');
      expect(template?.spawnSets.flat().map((spawn) => spawn.enemyId)).toEqual([bossId]);
      expect(() => getRoomTemplate(bossRoomTemplateId(bossId))).not.toThrow();
    }
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

  it('keeps one-coin and five-coin crate drops in their source room until collected', () => {
    const dungeon = new DungeonManager(() => 0);
    dungeon.generateFloor(1);
    const room = dungeon.getCurrentRoom();
    const oneCoin = dungeon.addDroppedReward(
      room.id,
      { kind: 'coins', amount: 1, labelKey: 'resources.coins', tint: 0xffd84a },
      220,
      130,
    )!;
    const fiveCoins = dungeon.addDroppedReward(
      room.id,
      {
        kind: 'coins',
        amount: 5,
        labelKey: 'resources.coins',
        tint: 0xffd84a,
        appearance: 'five-coin',
      },
      260,
      140,
    )!;

    expect(room.droppedRewards).toEqual([oneCoin, fiveCoins]);

    dungeon.updateDroppedReward(room.id, fiveCoins.id, 265, 145);
    expect(fiveCoins).toMatchObject({ x: 265, y: 145 });

    dungeon.clearDroppedReward(room.id, oneCoin.id);

    expect(room.droppedRewards).toEqual([fiveCoins]);
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
