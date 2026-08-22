import { PLAYER_HEALTH_UNITS_PER_HEART, ROOM_RECT } from '../config/gameConfig';
import { TOTAL_FLOORS } from '../data/stages';
import type { RandomSource } from '../utils/random';

/**
 * 시작방 텃밭 규칙.
 *
 * 감자는 씨감자로 번식한다 — 주인공이 제 몸에서 눈을 떼어 흙에 묻고, 그 대가로
 * 최대 체력 반 칸을 잃는다. 심은 것은 **다음 층 시작방**에서 자라 있다.
 *
 * 악마방식 거래와 다른 점은 보상이 늦다는 것이다. "얼마나 강해지나"가 아니라
 * "다음 층까지 이 몸으로 버틸 수 있나"를 묻게 되고, 그래서 망설임의 결이 다르다.
 * 낮은 확률로 꽝(동전 한 닢)이 나오는 것도 그 도박성을 위해 남겨 둔다.
 */

/** 심는 값: 최대 체력 반 칸. */
export const SEED_PLANT_COST_UNITS = PLAYER_HEALTH_UNITS_PER_HEART / 2;

/** 심어도 아이템이 되지 못하고 동전 한 닢으로 끝날 확률. */
export const SEED_DUD_CHANCE = 0.2;

/** 꽝일 때 손에 쥐는 동전 수. */
export const SEED_DUD_COIN_AMOUNT = 1;

/**
 * 텃밭 자리: 시작방 왼쪽 위 구석.
 *
 * 방 한가운데를 비워 두는 편이 낫다 — 층에 들어서면 플레이어가 중앙에 서므로,
 * 가운데에 두면 밟고 선 채로 시작하고 문으로 나가는 길과도 겹친다.
 */
export const SEED_PLOT_POSITION = {
  x: ROOM_RECT.left + 64,
  y: ROOM_RECT.top + 56,
} as const;

/** 텃밭 상호작용 반경. */
export const SEED_PLOT_INTERACTION_RADIUS = 30;

export type SeedPlantRefusal =
  'not-start-room' | 'already-planted' | 'final-floor' | 'not-enough-health';

export interface SeedPlantContext {
  isStartRoom: boolean;
  floor: number;
  /** 이미 심어 둔 씨눈이 있는가(수확 전) */
  hasPlantedSeed: boolean;
  maxHealth: number;
}

/**
 * 심을 수 있으면 null, 아니면 거절 사유.
 *
 * 최종 층에서는 막는다 — 수확할 다음 층이 없어 체력만 버리는 함정이 된다.
 * 최대 체력은 반 칸을 내고도 최소 반 칸이 남아야 한다(0이 되면 즉사한다).
 */
export function getSeedPlantRefusal(context: SeedPlantContext): SeedPlantRefusal | null {
  if (!context.isStartRoom) {
    return 'not-start-room';
  }

  if (context.hasPlantedSeed) {
    return 'already-planted';
  }

  if (context.floor >= TOTAL_FLOORS) {
    return 'final-floor';
  }

  if (context.maxHealth - SEED_PLANT_COST_UNITS < SEED_PLANT_COST_UNITS) {
    return 'not-enough-health';
  }

  return null;
}

export type SeedHarvest = 'item' | 'dud';

export function rollSeedHarvest(random: RandomSource): SeedHarvest {
  return random() < SEED_DUD_CHANCE ? 'dud' : 'item';
}

/** 심어 둔 씨눈을 수확할 층인가. 심은 층보다 위로 올라왔을 때만 자라 있다. */
export function isSeedReadyToHarvest(plantedOnFloor: number | undefined, floor: number): boolean {
  return plantedOnFloor !== undefined && floor > plantedOnFloor;
}
