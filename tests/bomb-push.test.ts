import { describe, expect, it } from 'vitest';
import { DungeonManager } from '../src/systems/DungeonManager';
import {
  BOMB_BODY_PUSH_SPEED,
  BOMB_PUSH_ARM_DISTANCE,
  BOMB_PUSH_DRAG,
  BOMB_SEED_PUSH_SPEED,
  estimateBombSlideDistance,
  getBombPushVelocity,
} from '../src/systems/BombPushRules';
import { CHEST_PUSH_DRAG } from '../src/systems/ChestPushRules';

describe('getBombPushVelocity', () => {
  it('pushes along the given direction at the given speed', () => {
    expect(getBombPushVelocity(1, 0, BOMB_BODY_PUSH_SPEED)).toEqual({
      x: BOMB_BODY_PUSH_SPEED,
      y: 0,
    });
    expect(getBombPushVelocity(0, -1, BOMB_SEED_PUSH_SPEED)).toEqual({
      x: 0,
      y: -BOMB_SEED_PUSH_SPEED,
    });
  });

  it('keeps diagonal pushes the same speed as straight ones', () => {
    // 정규화하지 않으면 대각선으로 밀 때만 1.4배 빨라진다.
    const diagonal = getBombPushVelocity(1, 1, BOMB_BODY_PUSH_SPEED)!;

    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(BOMB_BODY_PUSH_SPEED);
  });

  it('refuses to push when there is no direction', () => {
    // 플레이어와 폭탄이 정확히 겹치면 밀 방향을 정할 수 없다.
    expect(getBombPushVelocity(0, 0, BOMB_BODY_PUSH_SPEED)).toBeNull();
  });
});

describe('bomb slide feel', () => {
  it('slides further than a chest but stays within a readable distance', () => {
    // "얼음처럼 관성이 조금 남지만 스케이트는 아니다"를 숫자로 고정한다. 상자보다
    // 미끄럽고(감속이 낮고), 한 번 밀어 흘러가는 거리는 방 폭(416px)의 일부여야
    // 조준이 가능하다.
    const bodySlide = estimateBombSlideDistance(BOMB_BODY_PUSH_SPEED);
    const seedSlide = estimateBombSlideDistance(BOMB_SEED_PUSH_SPEED);

    expect(BOMB_PUSH_DRAG).toBeLessThan(CHEST_PUSH_DRAG);
    expect(bodySlide).toBeGreaterThan(12);
    expect(bodySlide).toBeLessThan(40);
    // 씨앗은 몸보다 세게 굴리지만 방을 가로지르지는 않는다.
    expect(seedSlide).toBeGreaterThan(bodySlide);
    expect(seedSlide).toBeLessThan(80);
  });

  it('arms the push only after the player has stepped clear of the bomb', () => {
    // 폭탄은 발밑에 생긴다. 이격 거리가 플레이어·폭탄 반지름 합보다 커야 심는
    // 순간 밀려나거나 자기 씨앗이 발밑에서 사라지는 일이 없다.
    expect(BOMB_PUSH_ARM_DISTANCE).toBeGreaterThan(18);
  });
});

describe('planted bombs surviving a room exit', () => {
  function startRoom(dungeon: DungeonManager) {
    dungeon.generateFloor(1);
    return dungeon.getCurrentRoom();
  }

  it('keeps a planted bomb in the room it was planted in', () => {
    const dungeon = new DungeonManager();
    const room = startRoom(dungeon);

    const planted = dungeon.addPlantedBomb(room.id, 120, 80);

    expect(planted).not.toBeNull();
    expect(room.plantedBombs).toEqual([{ id: planted!.id, x: 120, y: 80 }]);
  });

  it('remembers where the bomb was pushed to', () => {
    const dungeon = new DungeonManager();
    const room = startRoom(dungeon);
    const planted = dungeon.addPlantedBomb(room.id, 120, 80)!;

    dungeon.updatePlantedBomb(room.id, planted.id, 168, 92);

    expect(room.plantedBombs[0]).toMatchObject({ x: 168, y: 92 });
  });

  it('drops the bomb from the room once it detonates', () => {
    // 이걸 빠뜨리면 방에 들어올 때마다 같은 폭탄이 되살아나 무한히 늘어난다.
    const dungeon = new DungeonManager();
    const room = startRoom(dungeon);
    const first = dungeon.addPlantedBomb(room.id, 100, 100)!;
    const second = dungeon.addPlantedBomb(room.id, 200, 100)!;

    dungeon.clearPlantedBomb(room.id, first.id);

    expect(room.plantedBombs.map((bomb) => bomb.id)).toEqual([second.id]);
  });

  it('starts every floor with no leftover bombs and fresh ids', () => {
    const dungeon = new DungeonManager();
    const room = startRoom(dungeon);
    const planted = dungeon.addPlantedBomb(room.id, 100, 100)!;

    dungeon.generateFloor(2);
    const nextFloorRoom = dungeon.getCurrentRoom();

    expect(nextFloorRoom.plantedBombs).toEqual([]);
    expect(dungeon.addPlantedBomb(nextFloorRoom.id, 100, 100)!.id).toBe(planted.id);
  });

  it('ignores unknown rooms instead of throwing', () => {
    const dungeon = new DungeonManager();
    startRoom(dungeon);

    expect(dungeon.addPlantedBomb('99,99', 10, 10)).toBeNull();
    expect(() => dungeon.clearPlantedBomb('99,99', 1)).not.toThrow();
    expect(() => dungeon.updatePlantedBomb('99,99', 1, 10, 10)).not.toThrow();
  });
});
