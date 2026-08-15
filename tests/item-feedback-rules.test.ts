import { describe, expect, it } from 'vitest';
import { PLAYER_BASE_STATS, SEED_SCALE_LIMITS } from '../src/config/gameConfig';
import { ITEM_CATEGORY_COLORS } from '../src/data/items';
import {
  getSeedDisplayScale,
  SEED_DAMAGE_FACTOR_MAX,
  SEED_DAMAGE_FACTOR_MIN,
  SEED_DISPLAY_SCALE_MAX,
} from '../src/systems/ItemFeedbackRules';
import { getEffectiveDamage } from '../src/systems/PlayerStatSystem';

describe('seed display scale', () => {
  it('leaves a fresh run looking exactly like before', () => {
    // 기본 공격력에서 배율이 정확히 1이어야, 아이템을 먹기 전에는 아무것도
    // 달라 보이지 않는다. 호출자가 넘기는 실제 유효 공격력 경로로 확인한다.
    expect(getSeedDisplayScale(1, getEffectiveDamage(PLAYER_BASE_STATS))).toBe(1);
  });

  it('grows the seed as damage rises, monotonically', () => {
    // 전부 상한(factor 2 = 유효 공격력 4) 아래의 값들 — 상한 위 평탄 구간은
    // 아래 cap 테스트가 따로 검증한다.
    const scales = [1, 1.5, 2, 3, 3.9].map((damage) => getSeedDisplayScale(1, damage));

    for (let i = 1; i < scales.length; i += 1) {
      expect(scales[i]).toBeGreaterThan(scales[i - 1]);
    }
  });

  it('never draws the seed smaller than its item-authored scale', () => {
    // 하한 factor는 1로 고정 — 이 게임의 판정은 예전부터 그림보다 후해서,
    // 그림을 더 줄이면 "빗나가 보이는데 맞는" 괴리가 커진다. 공격력이 기본보다
    // 낮아도 그림은 아이템이 정한 크기 그대로다.
    expect(SEED_DAMAGE_FACTOR_MIN).toBe(1);
    expect(getSeedDisplayScale(1, 0.85)).toBe(1);
    expect(getSeedDisplayScale(1, 0.1)).toBe(1);
    expect(getSeedDisplayScale(SEED_SCALE_LIMITS.min, 0.1)).toBe(SEED_SCALE_LIMITS.min);
    expect(getSeedDisplayScale(SEED_SCALE_LIMITS.max, 0.1)).toBe(SEED_SCALE_LIMITS.max);
  });

  it('caps the damage factor so stacked damage cannot grow forever', () => {
    expect(getSeedDisplayScale(1, 100)).toBe(SEED_DAMAGE_FACTOR_MAX);
  });

  it('keeps a mega-seed build visibly bigger than a plain damage build', () => {
    const plainAtCap = getSeedDisplayScale(1, 100);
    const megaAtCap = getSeedDisplayScale(1.65, 100);

    // 표시 상한이 저장 상한에서 파생돼(×1.25) 항상 그보다 높아야 이 구분이
    // 살아남고, 저장 상한을 올려도 표시 상한이 뒤처지지 않는다.
    expect(SEED_DISPLAY_SCALE_MAX).toBeGreaterThan(SEED_SCALE_LIMITS.max);
    expect(megaAtCap).toBeGreaterThan(plainAtCap);
    expect(megaAtCap).toBe(SEED_DISPLAY_SCALE_MAX);
  });
});

describe('item category colors', () => {
  it('defines a distinct color for every category', () => {
    const colors = Object.values(ITEM_CATEGORY_COLORS);

    expect(colors).toHaveLength(4);
    expect(new Set(colors).size).toBe(colors.length);

    for (const color of colors) {
      expect(color).toBeTypeOf('number');
    }
  });
});
