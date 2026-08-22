import { describe, expect, it } from 'vitest';
import { PLAYER_HEALTH_UNITS_PER_HEART } from '../src/config/gameConfig';
import { TOTAL_FLOORS } from '../src/data/stages';
import {
  getSeedPlantRefusal,
  isSeedReadyToHarvest,
  rollSeedHarvest,
  SEED_DUD_CHANCE,
  SEED_PLANT_COST_UNITS,
  type SeedPlantContext,
} from '../src/systems/SeedPlotRules';

const HEALTHY: SeedPlantContext = {
  isStartRoom: true,
  floor: 1,
  hasPlantedSeed: false,
  maxHealth: PLAYER_HEALTH_UNITS_PER_HEART * 3,
};

describe('getSeedPlantRefusal', () => {
  it('allows planting in the start room with health to spare', () => {
    expect(getSeedPlantRefusal(HEALTHY)).toBeNull();
  });

  it('costs exactly half a heart', () => {
    expect(SEED_PLANT_COST_UNITS).toBe(PLAYER_HEALTH_UNITS_PER_HEART / 2);
  });

  it('only works in the start room', () => {
    expect(getSeedPlantRefusal({ ...HEALTHY, isStartRoom: false })).toBe('not-start-room');
  });

  it('allows one seed at a time', () => {
    // 층당 한 번으로 묶는 장치다. 제한이 없으면 "체력 다 갈아넣기"가 최적해가 되어
    // 망설임 자체가 사라진다.
    expect(getSeedPlantRefusal({ ...HEALTHY, hasPlantedSeed: true })).toBe('already-planted');
  });

  it('refuses on the final floor where nothing could be harvested', () => {
    expect(getSeedPlantRefusal({ ...HEALTHY, floor: TOTAL_FLOORS })).toBe('final-floor');
  });

  it('refuses when the cost would leave nothing behind', () => {
    // 반 칸만 남은 몸에서 반 칸을 더 떼면 최대 체력이 0이 되어 즉사한다.
    expect(getSeedPlantRefusal({ ...HEALTHY, maxHealth: SEED_PLANT_COST_UNITS })).toBe(
      'not-enough-health',
    );
    expect(getSeedPlantRefusal({ ...HEALTHY, maxHealth: SEED_PLANT_COST_UNITS * 2 })).toBeNull();
  });
});

describe('rollSeedHarvest', () => {
  it('gives an item on a good roll and a dud on a bad one', () => {
    expect(rollSeedHarvest(() => SEED_DUD_CHANCE)).toBe('item');
    expect(rollSeedHarvest(() => SEED_DUD_CHANCE - 0.001)).toBe('dud');
  });

  it('keeps the dud a minority outcome', () => {
    // 꽝이 흔해지면 도박이 아니라 벌칙이 된다.
    expect(SEED_DUD_CHANCE).toBeGreaterThan(0);
    expect(SEED_DUD_CHANCE).toBeLessThan(0.5);
  });
});

describe('isSeedReadyToHarvest', () => {
  it('waits until the player has climbed above the floor it was planted on', () => {
    expect(isSeedReadyToHarvest(undefined, 3)).toBe(false);
    expect(isSeedReadyToHarvest(3, 3)).toBe(false);
    expect(isSeedReadyToHarvest(3, 4)).toBe(true);
  });
});
