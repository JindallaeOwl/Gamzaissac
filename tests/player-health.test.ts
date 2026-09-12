import { describe, expect, it } from 'vitest';
import {
  PLAYER_BASE_STATS,
  PLAYER_DAMAGE_PER_HIT,
  PLAYER_HEALTH_UNITS_PER_HEART,
  PLAYER_STARTING_HEARTS,
} from '../src/config/gameConfig';
import { ENEMY_DEFINITIONS } from '../src/data/enemies';
import { getHeartFillUnits, getHeartSlots } from '../src/utils/healthHearts';

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

// 회귀: 씨눈 심기로 최대 체력이 반 칸 줄었는데 화면에서는 "잠깐 다친 것"과 똑같이
// 보이는 문제가 있었다. 하트 그릇을 늘 온전하게 그리고 채움만 반으로 잘랐기 때문이다.
// 그릇 크기(최대 체력)와 채움(현재 체력)이 서로 다른 값으로 나와야 화면에서 구분된다.
describe('하트 그릇과 채움 구분', () => {
  it('최대 체력이 반 칸 줄면 마지막 그릇이 반쪽이 된다', () => {
    // 씨눈 심기 직후: 최대 5, 체력 5 (가득 찬 상태)
    expect(getHeartSlots(5, 5)).toEqual([
      { capacityUnits: 2, fillUnits: 2 },
      { capacityUnits: 2, fillUnits: 2 },
      { capacityUnits: 1, fillUnits: 1 },
    ]);
  });

  it('피해를 입으면 그릇은 온전하고 채움만 반이 된다', () => {
    // 최대 6, 체력 5 (반 칸 피해)
    expect(getHeartSlots(6, 6)[2]).toEqual({ capacityUnits: 2, fillUnits: 2 });
    expect(getHeartSlots(5, 6)[2]).toEqual({ capacityUnits: 2, fillUnits: 1 });
  });

  it('최대 체력이 줄어든 것과 피해를 입은 것이 서로 다르게 나온다', () => {
    // 이 둘이 같아지면 화면에서 구분할 수 없어지고, 원래 버그가 재발한다.
    // 채움만 보면 둘 다 마지막 칸이 반(1)이라 예전에는 구분이 되지 않았다.
    const maxReduced = getHeartSlots(5, 5).at(-1);
    const damaged = getHeartSlots(5, 6).at(-1);

    expect(maxReduced?.fillUnits).toBe(damaged?.fillUnits);
    expect(maxReduced).not.toEqual(damaged);
    expect(maxReduced?.capacityUnits).toBe(1);
    expect(damaged?.capacityUnits).toBe(2);
  });

  it('반쪽 그릇이 비면 채움 0으로 나온다', () => {
    // 최대 5, 체력 4: 마지막 반쪽 그릇이 완전히 빈 상태
    expect(getHeartSlots(4, 5).at(-1)).toEqual({ capacityUnits: 1, fillUnits: 0 });
  });

  it('최대 체력이 늘면 늘어난 칸까지 그릇이 생긴다', () => {
    expect(getHeartSlots(7, 7)).toEqual([
      { capacityUnits: 2, fillUnits: 2 },
      { capacityUnits: 2, fillUnits: 2 },
      { capacityUnits: 2, fillUnits: 2 },
      { capacityUnits: 1, fillUnits: 1 },
    ]);
  });
});
