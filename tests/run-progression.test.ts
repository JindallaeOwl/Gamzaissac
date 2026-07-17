import { describe, expect, it } from 'vitest';
import { advanceRunToNextFloor } from '../src/systems/RunProgressionSystem';
import { createInitialRunState } from '../src/systems/RunState';

describe('RunProgressionSystem', () => {
  it('advances the floor and recovers one health', () => {
    const state = createInitialRunState();
    state.stats.health = 2;

    expect(advanceRunToNextFloor(state)).toEqual({
      previousFloor: 1,
      nextFloor: 2,
      healthRecovered: 1,
    });
    expect(state.floor).toBe(2);
    expect(state.stats.health).toBe(3);
  });

  it('does not recover health above maximum health', () => {
    const state = createInitialRunState();

    expect(advanceRunToNextFloor(state).healthRecovered).toBe(0);
    expect(state.stats.health).toBe(state.stats.maxHealth);
  });
});
