import { PLAYER_HEALTH_UNITS_PER_HEART } from '../config/gameConfig';

export type HeartFillUnits = 0 | 1 | 2;
/** 하트 한 칸이 담을 수 있는 양. 최대 체력이 반 칸이면 그릇 자체가 반쪽이다. */
export type HeartCapacityUnits = 1 | 2;

export interface HeartSlot {
  capacityUnits: HeartCapacityUnits;
  fillUnits: HeartFillUnits;
}

/**
 * 하트 칸마다 "그릇 크기(최대 체력)"와 "채워진 양(현재 체력)"을 따로 돌려준다.
 *
 * 둘을 나누는 이유: 씨눈 심기로 최대 체력이 반 칸 줄었을 때와, 피해를 입어 반 칸이 빈
 * 상태는 완전히 다른 의미인데 예전에는 화면상 구분이 되지 않았다. 그릇은 늘 온전하게
 * 그리고 채움만 반으로 잘랐기 때문에, 최대 체력이 깎여도 "잠깐 다친 것"처럼 보였다.
 *
 * - 최대 5 / 체력 5 → 마지막 칸이 { 그릇 반쪽, 가득 } → 최대치가 줄었음이 드러난다
 * - 최대 6 / 체력 5 → 마지막 칸이 { 그릇 온전, 반만 } → 피해를 입었음이 드러난다
 */
export function getHeartSlots(health: number, maxHealth: number): HeartSlot[] {
  const safeMax = Math.max(0, maxHealth);
  const heartCount = Math.ceil(safeMax / PLAYER_HEALTH_UNITS_PER_HEART);
  const currentHealth = Math.max(0, Math.min(health, safeMax));

  return Array.from({ length: heartCount }, (_, index) => {
    const consumed = index * PLAYER_HEALTH_UNITS_PER_HEART;
    const capacityLeft = safeMax - consumed;
    const fillLeft = currentHealth - consumed;

    return {
      capacityUnits: capacityLeft >= PLAYER_HEALTH_UNITS_PER_HEART ? 2 : 1,
      fillUnits: fillLeft >= PLAYER_HEALTH_UNITS_PER_HEART ? 2 : fillLeft >= 1 ? 1 : 0,
    };
  });
}

/** 채워진 양만 필요한 곳을 위한 축약형. */
export function getHeartFillUnits(health: number, maxHealth: number): HeartFillUnits[] {
  return getHeartSlots(health, maxHealth).map((slot) => slot.fillUnits);
}
