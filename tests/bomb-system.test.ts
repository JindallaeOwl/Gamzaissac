import { describe, expect, it } from 'vitest';
import { BOMB_TUNING } from '../src/config/gameConfig';
import {
  isWithinBombRadius,
  resolveBombPlantAttempt,
  shouldDetonateBomb,
} from '../src/systems/BombRules';
import { createInitialRunState } from '../src/systems/RunState';

describe('BombSystem rules', () => {
  it('spends one bomb and starts the cooldown when planting succeeds', () => {
    const state = createInitialRunState();
    state.inventory.bombs = 1;

    expect(resolveBombPlantAttempt(state, 1000, 0, false)).toEqual({
      status: 'planted',
      nextBombAt: 1000 + BOMB_TUNING.cooldownMs,
    });
    expect(state.inventory.bombs).toBe(0);
  });

  it('does not spend a bomb during cooldown', () => {
    const state = createInitialRunState();
    state.inventory.bombs = 1;

    expect(resolveBombPlantAttempt(state, 1000, 1500, false)).toEqual({
      status: 'cooldown',
    });
    expect(state.inventory.bombs).toBe(1);
  });

  it('reports when no bombs are available', () => {
    const state = createInitialRunState();
    state.inventory.bombs = 0;

    expect(resolveBombPlantAttempt(state, 1000, 0, false)).toEqual({
      status: 'no-bombs',
    });
  });

  it('includes targets exactly on the blast radius boundary', () => {
    expect(isWithinBombRadius(0, 0, BOMB_TUNING.radius, 0)).toBe(true);
    expect(isWithinBombRadius(0, 0, BOMB_TUNING.radius + 0.01, 0)).toBe(false);
  });

  it('suppresses detonation once the run has ended (planted fuse timers)', () => {
    expect(shouldDetonateBomb(false)).toBe(true);
    expect(shouldDetonateBomb(true)).toBe(false);
  });
});
