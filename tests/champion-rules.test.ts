import { describe, expect, it } from 'vitest';
import { CHAMPION_TUNING, rollChampionIndex } from '../src/systems/ChampionRules';

function sequence(values: number[]): () => number {
  let call = 0;
  return () => {
    const value = values[Math.min(call, values.length - 1)];
    call += 1;
    return value;
  };
}

describe('rollChampionIndex', () => {
  it('never promotes below the minimum floor', () => {
    // 1층은 조작을 익히는 층 — 확률이 무조건 성공하는 주사위여도 나오면 안 된다.
    expect(rollChampionIndex(sequence([0, 0]), 5, CHAMPION_TUNING.minFloor - 1)).toBeNull();
  });

  it('never promotes an empty spawn set', () => {
    expect(rollChampionIndex(sequence([0, 0]), 0, 8)).toBeNull();
  });

  it('promotes only when the room roll passes', () => {
    expect(rollChampionIndex(sequence([CHAMPION_TUNING.roomChance, 0]), 5, 5)).toBeNull();
    expect(rollChampionIndex(sequence([CHAMPION_TUNING.roomChance - 0.001, 0]), 5, 5)).toBe(0);
  });

  it('keeps the promoted index inside the spawn list', () => {
    expect(rollChampionIndex(sequence([0, 0.999999]), 4, 5)).toBe(3);
    expect(rollChampionIndex(sequence([0, 0]), 4, 5)).toBe(0);
  });
});
