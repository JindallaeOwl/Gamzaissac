import type { RunState } from './RunState';

export interface FloorAdvanceResult {
  previousFloor: number;
  nextFloor: number;
  healthRecovered: number;
}

export function advanceRunToNextFloor(runState: RunState): FloorAdvanceResult {
  const previousFloor = runState.floor;
  const healthBefore = runState.stats.health;

  runState.floor += 1;
  runState.stats.health = Math.min(runState.stats.maxHealth, runState.stats.health + 1);

  return {
    previousFloor,
    nextFloor: runState.floor,
    healthRecovered: runState.stats.health - healthBefore,
  };
}
