import { chance, randomInt, type RandomSource } from '../utils/random';

/**
 * 챔피언(강화 개체) 규칙. 전투방에 가끔 금색으로 빛나는 크고 단단한 적이 하나
 * 섞여 나오고, 잡으면 죽은 자리에 보물 상자를 떨군다. 같은 방 구성이라도
 * "저놈부터 잡을까, 마지막으로 미룰까"라는 판단이 생기게 하는 것이 목적이다.
 */
export const CHAMPION_TUNING = {
  /** 전투방 하나가 챔피언을 품을 확률 */
  roomChance: 0.22,
  /** 챔피언이 나오기 시작하는 층. 1층은 조작을 익히는 층이라 제외 */
  minFloor: 2,
  /** 체력 배율 */
  healthMultiplier: 2.2,
  /** 점수 배율 */
  scoreMultiplier: 3,
  /** 표시 크기 배율. Arcade 바디가 스프라이트 배율을 따라가므로 판정도 함께
      커진다 — 단단한 개체가 더 맞기 쉬운 것은 의도된 공정함이다 */
  displayScaleMultiplier: 1.22,
  /** 금색 */
  tint: 0xffd75e,
} as const;

/**
 * 이번 전투방에서 챔피언으로 승격할 스폰 순번. 승격이 없으면 null.
 * 방 단위로 한 번만 굴려 방당 챔피언이 최대 1마리가 되게 한다.
 */
export function rollChampionIndex(
  random: RandomSource,
  spawnCount: number,
  floor: number,
): number | null {
  if (spawnCount <= 0 || floor < CHAMPION_TUNING.minFloor) {
    return null;
  }

  if (!chance(CHAMPION_TUNING.roomChance, random)) {
    return null;
  }

  return randomInt(0, spawnCount - 1, random);
}
