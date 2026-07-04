import { PLAYER_BASE_STATS, type PlayerStats } from '../config/gameConfig';
import type { ConsumableType } from '../data/rewards';

export type InventoryState = Record<ConsumableType, number>;

export interface RunState {
  floor: number;
  clearedRooms: number;
  score: number;
  collectedItemIds: string[];
  unlockedAbilityIds: string[];
  inventory: InventoryState;
  stats: PlayerStats;
}

export function createInitialRunState(): RunState {
  return {
    floor: 1,
    clearedRooms: 0,
    score: 0,
    collectedItemIds: [],
    unlockedAbilityIds: [],
    inventory: {
      keys: 1,
      bombs: 0,
      coins: 0,
    },
    stats: { ...PLAYER_BASE_STATS },
  };
}
