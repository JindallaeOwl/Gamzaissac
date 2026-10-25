import { describe, expect, it } from 'vitest';
import { MAX_DEBRIS, MAX_GROUND_DEBRIS, PixelDebris } from '../src/systems/PixelDebris';
import { DungeonManager } from '../src/systems/DungeonManager';

const bounds = { left: 0, right: 200, top: 0, bottom: 100 };
function createDebris(): PixelDebris {
  return new PixelDebris(bounds, () => 0.5);
}

describe('pixel debris physics', () => {
  it('keeps bomb shell fragments after the flash and preserves a subset on room return', () => {
    const debris = createDebris();
    const room: typeof debris.ground = [];
    debris.enterRoom(room);
    debris.emitBomb(100, 50);
    expect(new Set(debris.pieces.map((p) => p.color)).size).toBe(3);
    for (let i = 0; i < 240; i++) debris.update(1000 / 60);
    expect(debris.pieces.length).toBeGreaterThan(0);
    expect(debris.pieces.every((p) => p.z === 0 && p.vz === 0)).toBe(true);
    for (let i = 0; i < 300; i++) debris.update(1000 / 60);
    expect(debris.pieces).toHaveLength(0);
    expect(room).toHaveLength(9);
    debris.enterRoom([]);
    expect(debris.ground).toHaveLength(0);
    debris.enterRoom(room);
    expect(debris.ground).toHaveLength(9);
  });

  it('falls, bounces with less energy, then rests on the floor', () => {
    const debris = createDebris();
    debris.emit(100, 50, 0xffffff, 1);
    const p = debris.pieces[0];
    const initialSpeed = p.vz;
    let sawBounce = false;
    for (let i = 0; i < 180; i += 1) {
      debris.update(1000 / 120);
      expect(p.z).toBeGreaterThanOrEqual(0);
      if (p.bounces === 1 && p.vz > 0) {
        sawBounce = true;
        expect(p.vz).toBeLessThan(initialSpeed);
      }
    }
    expect(sawBounce).toBe(true);
    expect(p.bounces).toBe(2);
    expect(p.z).toBe(0);
    expect(p.vz).toBe(0);
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
  });

  it('reflects at room walls without escaping', () => {
    const debris = createDebris();
    debris.emit(1, 50, 0xffffff, 1);
    debris.update(1000 / 60);
    expect(debris.pieces[0].vx).toBeGreaterThan(0);
    expect(debris.pieces[0].x).toBeGreaterThanOrEqual(1);
  });

  it('produces the same motion at 30 and 120 fps', () => {
    const slow = createDebris();
    const fast = createDebris();
    slow.emit(100, 50, 0xffffff, 1);
    fast.emit(100, 50, 0xffffff, 1);
    for (let i = 0; i < 30; i += 1) slow.update(1000 / 30);
    for (let i = 0; i < 120; i += 1) fast.update(1000 / 120);
    expect(slow.pieces).toEqual(fast.pieces);
  });

  it('caps debris during heavy combat, expires it, and clears it for room changes', () => {
    const debris = createDebris();
    for (let i = 0; i < 100; i += 1) debris.emit(100, 50, 0xffffff, 15);
    expect(debris.pieces).toHaveLength(MAX_DEBRIS);
    for (let i = 0; i < 150; i += 1) debris.update(1000 / 60);
    expect(debris.pieces).toHaveLength(0);
    debris.emit(100, 50, 0xffffff, 10);
    debris.clear();
    debris.update(1000 / 60);
    expect(debris.pieces).toHaveLength(0);
  });

  it('ignores invalid time and limits background-tab catch-up', () => {
    const debris = createDebris();
    debris.emit(100, 50, 0xffffff, 1);
    debris.update(Number.NaN);
    debris.update(-100);
    expect(debris.pieces[0].age).toBe(0);
    debris.update(60000);
    expect(debris.pieces[0].age).toBeCloseTo(0.1);
  });

  it('keeps a small subset after motion ends and caps settled debris', () => {
    const debris = createDebris();
    debris.emit(100, 50, 0x52b878, 30, 1, true);
    for (let i = 0; i < 180; i += 1) debris.update(1000 / 60);
    expect(debris.pieces).toHaveLength(0);
    expect(debris.ground).toHaveLength(10);
    expect(debris.ground.every((p) => p.size <= 2 && p.color === 0x52b878)).toBe(true);
    for (let i = 0; i < 100; i += 1) debris.emit(100, 50, 0xaa6633, 42, 1, true);
    for (let i = 0; i < 180; i += 1) debris.update(1000 / 60);
    expect(debris.ground).toHaveLength(MAX_GROUND_DEBRIS);
  });

  it('restores room debris, saves airborne pieces on exit, and isolates floors', () => {
    const dungeon = new DungeonManager(() => 0);
    dungeon.generateFloor(1);
    const first = dungeon.getCurrentRoom();
    const second = dungeon.getRooms().find((room) => room.id !== first.id)!;
    first.groundDebris = [];
    second.groundDebris = [];
    first.obstacleScars = [[{ x: 0.1, y: 0.5 }]];
    const debris = createDebris();
    debris.enterRoom(first.groundDebris);
    debris.emit(100, 50, 0x112233, 9, 1, true);
    dungeon.moveToRoom(second.id);
    debris.enterRoom(second.groundDebris);
    expect(first.groundDebris).toHaveLength(3);
    expect(debris.pieces).toHaveLength(0);
    expect(debris.ground).toHaveLength(0);
    dungeon.moveToRoom(first.id);
    const restored = dungeon.getCurrentRoom();
    debris.enterRoom(restored.groundDebris!);
    expect(debris.ground).toHaveLength(3);
    expect(restored.obstacleScars).toEqual([[{ x: 0.1, y: 0.5 }]]);
    dungeon.generateFloor(2);
    const next = dungeon.getCurrentRoom();
    next.groundDebris ??= [];
    debris.enterRoom(next.groundDebris);
    expect(debris.ground).toHaveLength(0);
    expect(next.obstacleScars).toBeUndefined();
  });
});
