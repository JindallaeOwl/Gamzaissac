import { describe, expect, it } from 'vitest';
import { TOTAL_FLOORS } from '../src/data/stages';
import { advanceRunToNextFloor, resolveFloorExit } from '../src/systems/RunProgressionSystem';
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

describe('resolveFloorExit', () => {
  it('advances through every floor before the last one', () => {
    const state = createInitialRunState();
    state.stats.health = 1;

    for (let floor = 1; floor < TOTAL_FLOORS; floor += 1) {
      state.floor = floor;
      const outcome = resolveFloorExit(state);

      expect(outcome.kind, `floor ${floor}`).toBe('advance');
      expect(state.floor).toBe(floor + 1);
      expect(state.outcome).toBe('playing');
    }
  });

  it('clears the run on the final floor and marks the state as escaped', () => {
    const state = createInitialRunState();
    state.floor = TOTAL_FLOORS;

    const outcome = resolveFloorExit(state);

    expect(outcome.kind).toBe('run-clear');
    expect(state.outcome).toBe('escaped');
    expect(state.floor).toBe(TOTAL_FLOORS);
  });

  it('ignores repeated calls after the run is cleared', () => {
    const state = createInitialRunState();
    state.floor = TOTAL_FLOORS;
    resolveFloorExit(state);

    const healthBefore = state.stats.health;
    const repeated = resolveFloorExit(state);

    expect(repeated.kind).toBe('ignored');
    expect(state.outcome).toBe('escaped');
    expect(state.floor).toBe(TOTAL_FLOORS);
    expect(state.stats.health).toBe(healthBefore);
  });

  it('cannot escape after a defeat', () => {
    const state = createInitialRunState();
    state.floor = TOTAL_FLOORS;
    state.outcome = 'defeated';

    const outcome = resolveFloorExit(state);

    expect(outcome.kind).toBe('ignored');
    expect(state.outcome).toBe('defeated');
    expect(state.floor).toBe(TOTAL_FLOORS);
  });

  it('throws on out-of-range floors while playing, without touching the state', () => {
    for (const invalid of [0, 9, 1.5]) {
      const state = createInitialRunState();
      state.floor = invalid;

      expect(() => resolveFloorExit(state), `floor ${invalid}`).toThrow();
      expect(state.outcome, `floor ${invalid}`).toBe('playing');
      expect(state.floor, `floor ${invalid}`).toBe(invalid);
    }
  });

  it('still ignores ended runs even when the floor value is invalid', () => {
    const state = createInitialRunState();
    state.floor = 99;
    state.outcome = 'escaped';

    expect(resolveFloorExit(state).kind).toBe('ignored');
  });
});
