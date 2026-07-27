import { describe, expect, it } from 'vitest';
import { PixelSprite } from '../src/systems/enemyPixelSprites';
import {
  buildSoilBase,
  buildSoilCracks,
  buildSoilDamp,
  buildSoilPebbles,
  buildSoilRoots,
  buildSoilWallCap,
  buildSoilWallFace,
  buildSoilWallSide,
  FLOOR_TILE_DESIGN_SIZE,
  hashSeed,
  pickFloorDecoration,
  type FloorDecoration,
} from '../src/systems/floorPixelSprites';

const BUILDERS = {
  base: buildSoilBase,
  pebbles: buildSoilPebbles,
  roots: buildSoilRoots,
  cracks: buildSoilCracks,
  damp: buildSoilDamp,
  wallFace: buildSoilWallFace,
  wallSide: buildSoilWallSide,
  wallCap: buildSoilWallCap,
} as const;

// 실제 방 크기(416×208)를 16px 격자로 나눈 칸 수.
const COLUMNS = 26;
const ROWS = 13;

describe('soil floor tiles', () => {
  for (const [name, build] of Object.entries(BUILDERS)) {
    it(`${name} fills every pixel of the tile (no holes)`, () => {
      const sprite = new PixelSprite(FLOOR_TILE_DESIGN_SIZE);
      build(sprite);

      expect(sprite.filledCount()).toBe(FLOOR_TILE_DESIGN_SIZE * FLOOR_TILE_DESIGN_SIZE);
    });

    it(`${name} is deterministic across builds`, () => {
      const first = new PixelSprite(FLOOR_TILE_DESIGN_SIZE);
      const second = new PixelSprite(FLOOR_TILE_DESIGN_SIZE);
      build(first);
      build(second);

      for (let y = 0; y < FLOOR_TILE_DESIGN_SIZE; y += 1) {
        for (let x = 0; x < FLOOR_TILE_DESIGN_SIZE; x += 1) {
          expect(first.get(x, y), `(${x},${y})`).toBe(second.get(x, y));
        }
      }
    });
  }
});

describe('hashSeed', () => {
  it('is deterministic and returns an unsigned 32-bit integer', () => {
    expect(hashSeed('1:room-a')).toBe(hashSeed('1:room-a'));
    expect(hashSeed('1:room-a')).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashSeed('1:room-a'))).toBe(true);
  });

  it('gives different rooms different seeds', () => {
    expect(hashSeed('1:room-a')).not.toBe(hashSeed('1:room-b'));
    expect(hashSeed('1:room-a')).not.toBe(hashSeed('2:room-a'));
  });
});

describe('pickFloorDecoration', () => {
  const seed = hashSeed('3:combat-2');

  it('is deterministic for the same cell and seed', () => {
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        expect(pickFloorDecoration(column, row, COLUMNS, ROWS, seed)).toBe(
          pickFloorDecoration(column, row, COLUMNS, ROWS, seed),
        );
      }
    }
  });

  it('keeps the center cross (door lanes and room middle) free of decorations', () => {
    const centerColumn = (COLUMNS - 1) / 2;
    const centerRow = (ROWS - 1) / 2;

    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        if (Math.abs(column - centerColumn) < 2 || Math.abs(row - centerRow) < 2) {
          expect(
            pickFloorDecoration(column, row, COLUMNS, ROWS, seed),
            `cell (${column},${row})`,
          ).toBeNull();
        }
      }
    }
  });

  it('scatters decorations sparsely, and only valid kinds', () => {
    const kinds: FloorDecoration[] = ['pebbles', 'roots', 'cracks', 'damp'];
    let decorated = 0;
    let cells = 0;

    // 시드 여러 개로 확인해 특정 시드에 우연히 통과하는 것을 막는다.
    for (const roomKey of ['1:a', '2:b', '5:c', '8:boss']) {
      const roomSeed = hashSeed(roomKey);

      for (let row = 0; row < ROWS; row += 1) {
        for (let column = 0; column < COLUMNS; column += 1) {
          const decoration = pickFloorDecoration(column, row, COLUMNS, ROWS, roomSeed);
          cells += 1;

          if (decoration !== null) {
            decorated += 1;
            expect(kinds).toContain(decoration);
          }
        }
      }
    }

    expect(decorated).toBeGreaterThan(0);
    // 장식은 전체 칸의 소수여야 바닥이 어수선하지 않다 (기대율 13% + 여유).
    expect(decorated / cells).toBeLessThan(0.2);
  });
});
