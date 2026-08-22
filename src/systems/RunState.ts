import {
  PLAYER_BASE_ATTACK_PROFILE,
  PLAYER_BASE_STATS,
  type PlayerAttackProfile,
  type PlayerStats,
} from '../config/gameConfig';
import type { ConsumableType } from '../data/rewards';

export type InventoryState = Record<ConsumableType, number>;

// 런 종료 여부의 유일한 논리 기준. Scene의 표시용 상태(gameOverStarted 등)는
// 오버레이·전환의 중복 실행만 막고, 패배/탈출 판정은 항상 이 값에서 읽는다.
export type RunOutcome = 'playing' | 'defeated' | 'escaped';

export interface RunState {
  adminUsed: boolean;
  outcome: RunOutcome;
  floor: number;
  clearedRooms: number;
  score: number;
  collectedItemIds: string[];
  unlockedAbilityIds: string[];
  activatedSynergyIds: string[];
  inventory: InventoryState;
  // 시작방 텃밭에 묻어 둔 씨눈을 심은 층. 다음 층 시작방에서 수확한다.
  seedPlantedOnFloor?: number;
  stats: PlayerStats;
  attackProfile: PlayerAttackProfile;
}

export function createInitialRunState(): RunState {
  return {
    adminUsed: false,
    outcome: 'playing',
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

// 패배·탈출을 공통으로 확인하는 게임 동작 차단 기준.
export function isRunEnded(runState: RunState): boolean {
  return runState.outcome !== 'playing';
}
