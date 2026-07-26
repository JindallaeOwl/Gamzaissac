import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS, type EnemyId } from '../src/data/enemies';
import {
  FLOORS_PER_STAGE,
  getStageProgress,
  resolveRoomAccentColor,
  STAGES,
  stageFloorRoman,
  TOTAL_FLOORS,
} from '../src/data/stages';

describe('stage definitions', () => {
  it('builds four stages of two floors each (eight floors total)', () => {
    expect(STAGES).toHaveLength(4);
    expect(FLOORS_PER_STAGE).toBe(2);
    expect(TOTAL_FLOORS).toBe(8);
  });

  it('uses unique stage ids', () => {
    const ids = STAGES.map((stage) => stage.id);
    expect(new Set(ids).size).toBe(STAGES.length);
  });

  it('only references bosses that exist and are boss-kind', () => {
    for (const stage of STAGES) {
      for (const bossId of stage.bossIds) {
        const definition = ENEMY_DEFINITIONS[bossId];
        expect(definition, `${stage.id}: ${bossId}`).toBeDefined();
        expect(definition.kind, `${stage.id}: ${bossId}`).toBe('boss');
      }
    }
  });
});

describe('getStageProgress', () => {
  it('maps every floor 1-8 to the intended stage, floor and boss', () => {
    // 예상 보스를 STAGES에서 다시 읽으면 데이터가 틀려도 통과하는 순환 검증이
    // 되므로, 층별 기대값을 리터럴로 직접 명시한다.
    const expected: [number, number, 1 | 2, EnemyId][] = [
      [1, 1, 1, 'rootGnarl'],
      [2, 1, 2, 'rootKernel'],
      [3, 2, 1, 'wriggleMass'],
      [4, 2, 2, 'wormKing'],
      [5, 3, 1, 'flyQueen'],
      [6, 3, 2, 'faultWarden'],
      [7, 4, 1, 'thornTangle'],
      [8, 4, 2, 'pitchforkFarmer'],
    ];

    for (const [floor, stageNumber, floorInStage, bossId] of expected) {
      const progress = getStageProgress(floor);

      expect(progress.stageNumber, `floor ${floor}`).toBe(stageNumber);
      expect(progress.floorInStage, `floor ${floor}`).toBe(floorInStage);
      expect(progress.stage).toBe(STAGES[stageNumber - 1]);
      expect(progress.bossId, `floor ${floor}`).toBe(bossId);
    }
  });

  it('marks only the last floor as final', () => {
    for (let floor = 1; floor <= TOTAL_FLOORS; floor += 1) {
      expect(getStageProgress(floor).isFinalFloor).toBe(floor === TOTAL_FLOORS);
    }
  });

  it('throws on floors outside 1-8 instead of returning a wrong value', () => {
    for (const invalid of [0, 9, -1, 99]) {
      expect(() => getStageProgress(invalid), `floor ${invalid}`).toThrow();
    }
  });

  it('throws on non-integer input', () => {
    for (const invalid of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => getStageProgress(invalid), `floor ${invalid}`).toThrow();
    }
  });
});

describe('stage presentation rules', () => {
  it('formats floor-in-stage as roman numerals', () => {
    expect(stageFloorRoman(1)).toBe('I');
    expect(stageFloorRoman(2)).toBe('II');
  });

  it('applies the stage accent to combat and start rooms only', () => {
    const templateAccent = 0x111111;
    const stageAccent = 0x222222;

    expect(resolveRoomAccentColor('combat', templateAccent, stageAccent)).toBe(stageAccent);
    expect(resolveRoomAccentColor('start', templateAccent, stageAccent)).toBe(stageAccent);
    expect(resolveRoomAccentColor('shop', templateAccent, stageAccent)).toBe(templateAccent);
    expect(resolveRoomAccentColor('treasure', templateAccent, stageAccent)).toBe(templateAccent);
    expect(resolveRoomAccentColor('boss', templateAccent, stageAccent)).toBe(templateAccent);
  });
});
