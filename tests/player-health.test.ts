import { describe, expect, it } from 'vitest';
import {
  PLAYER_BASE_STATS,
  PLAYER_DAMAGE_PER_HIT,
  PLAYER_HEALTH_UNITS_PER_HEART,
  PLAYER_STARTING_HEARTS,
} from '../src/config/gameConfig';
import { ENEMY_DEFINITIONS } from '../src/data/enemies';
import { getHeartFillUnits } from '../src/utils/healthHearts';

describe('player heart health', () => {
  it('starts with three full hearts made of two units each', () => {
    expect(PLAYER_BASE_STATS.maxHealth).toBe(
      PLAYER_STARTING_HEARTS * PLAYER_HEALTH_UNITS_PER_HEART,
    );
    expect(getHeartFillUnits(PLAYER_BASE_STATS.health, PLAYER_BASE_STATS.maxHealth)).toEqual([
      2, 2, 2,
    ]);
  });

  it('loses one half-heart unit per standard enemy hit', () => {
    expect(PLAYER_DAMAGE_PER_HIT).toBe(1);
    expect(getHeartFillUnits(5, 6)).toEqual([2, 2, 1]);

    // 접촉 피해는 정확한 수치로 검증한다: rootGnarl만 의도적으로 두 배(하트 1칸),
    // 그 외 모든 적은 반 칸. 탄환 피해는 전부 반 칸 유지.
    for (const enemy of Object.values(ENEMY_DEFINITIONS)) {
      const expectedContactDamage =
        enemy.id === 'rootGnarl' ? PLAYER_DAMAGE_PER_HIT * 2 : PLAYER_DAMAGE_PER_HIT;
      expect(enemy.contactDamage).toBe(expectedContactDamage);

      if (enemy.bulletDamage !== undefined) {
        expect(enemy.bulletDamage).toBe(PLAYER_DAMAGE_PER_HIT);
      }
    }
  });

  it('adds another heart when maximum health increases by two units', () => {
    expect(getHeartFillUnits(6, 8)).toEqual([2, 2, 2, 0]);
    expect(getHeartFillUnits(7, 8)).toEqual([2, 2, 2, 1]);
  });
});
