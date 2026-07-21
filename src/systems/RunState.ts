import {
  PLAYER_BASE_ATTACK_PROFILE,
  PLAYER_BASE_STATS,
  type PlayerAttackProfile,
  type PlayerStats,
} from '../config/gameConfig';
import type { ConsumableType } from '../data/rewards';

export type InventoryState = Record<ConsumableType, number>;

export interface RunState {
  adminUsed: boolean;
  floor: number;
  clearedRooms: number;
  score: number;
  collectedItemIds: string[];
  unlockedAbilityIds: string[];
  activatedSynergyIds: string[];
  inventory: InventoryState;
  stats: PlayerStats;
  attackProfile: PlayerAttackProfile;
}

export function createInitialRunState(): RunState {
  return {
    adminUsed: false,
    floor: 1,
    clearedRooms: 0,
    score: 0,
    collectedItemIds: [],
    unlockedAbilityIds: [],
    activatedSynergyIds: [],
    inventory: {
      keys: 1,
      bombs: 1,
      coins: 0,
    },
    stats: { ...PLAYER_BASE_STATS },
    attackProfile: { ...PLAYER_BASE_ATTACK_PROFILE },
  };
}

export function isRunEligibleForRanking(runState: RunState): boolean {
  return !runState.adminUsed;
}
