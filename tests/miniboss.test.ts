import { describe, expect, it } from 'vitest';
import { TextureKeys } from '../src/config/assets';
import { PLAYER_DAMAGE_PER_HIT } from '../src/config/gameConfig';
import { ENEMY_DEFINITIONS, type EnemyId } from '../src/data/enemies';
import { getReinforcementPool } from '../src/systems/EnemyReinforcementRules';
import {
  effectiveBodyRadius,
  SHOOTER_TELEGRAPH_SCALE_FACTOR,
  shooterPulseScale,
} from '../src/systems/EnemyScaleRules';
import { ko } from '../src/i18n/ko';
import { en } from '../src/i18n/en';
import type { TranslationTree } from '../src/i18n/types';

function bossName(tree: TranslationTree, id: string): unknown {
  const bosses = tree.bosses;
  return typeof bosses === 'object' ? (bosses as Record<string, unknown>)[id] : undefined;
}

const MINIBOSS_IDS = ['rootGnarl', 'wriggleMass', 'flyQueen', 'thornTangle'] as const;

// v1.0 정책: 중간보스는 기존 일반 적 텍스처를 임시 재사용한다 (전용 도트는 추후).
const EXPECTED_TEXTURES: Record<(typeof MINIBOSS_IDS)[number], string> = {
  rootGnarl: TextureKeys.enemyChaser,
  wriggleMass: TextureKeys.enemySplitter,
  flyQueen: TextureKeys.enemyShooter,
  thornTangle: TextureKeys.enemyDasher,
};

describe('miniboss definitions', () => {
  for (const id of MINIBOSS_IDS) {
    const definition = ENEMY_DEFINITIONS[id];

    it(`${id} is a boss-kind enemy enlarged from a reused texture`, () => {
      expect(definition).toBeDefined();
      expect(definition.kind).toBe('boss');
      expect(definition.displayScale ?? 1).toBeGreaterThan(1);
      expect(definition.textureKey).toBe(EXPECTED_TEXTURES[id]);
    });

    it(`${id} has localized display names in both languages`, () => {
      expect(definition.displayNameKey).toBe(`bosses.${id}`);
      expect(bossName(ko, id)).toBeTypeOf('string');
      expect(bossName(en, id)).toBeTypeOf('string');
    });
  }

  it('gives rootGnarl exactly double contact damage', () => {
    expect(ENEMY_DEFINITIONS.rootGnarl.contactDamage).toBe(PLAYER_DAMAGE_PER_HIT * 2);
  });

  it('splits wriggleMass into four non-splitting spores', () => {
    const definition = ENEMY_DEFINITIONS.wriggleMass;

    expect(definition.splitChildId).toBe('splitterling');
    expect(definition.splitChildCount).toBe(4);
    expect(ENEMY_DEFINITIONS.splitterling.splitChildId).toBeUndefined();
  });

  it('keeps minibosses out of the combat reinforcement pool', () => {
    for (const floor of [1, 2, 5, 8]) {
      const pool = getReinforcementPool(floor) as EnemyId[];

      for (const id of MINIBOSS_IDS) {
        expect(pool).not.toContain(id);
      }
    }
  });
});

describe('shooter pulse scale', () => {
  it('returns to the exact base scale after firing (regression: shrink-lock bug)', () => {
    expect(shooterPulseScale(1, 'idle')).toBe(1);
    expect(shooterPulseScale(1.5, 'idle')).toBe(1.5);
  });

  it('enlarges relative to the base scale during the telegraph', () => {
    expect(shooterPulseScale(1, 'telegraph')).toBeCloseTo(SHOOTER_TELEGRAPH_SCALE_FACTOR);
    expect(shooterPulseScale(1.5, 'telegraph')).toBeCloseTo(1.5 * SHOOTER_TELEGRAPH_SCALE_FACTOR);
    expect(shooterPulseScale(1.5, 'telegraph')).toBeGreaterThan(1.5);
  });
});

describe('effective body radius', () => {
  it('keeps the plain radius when no display scale is set', () => {
    expect(effectiveBodyRadius(11)).toBe(11);
    expect(effectiveBodyRadius(11, undefined)).toBe(11);
    expect(effectiveBodyRadius(11, 1)).toBe(11);
  });

  it('scales the radius by the display scale', () => {
    expect(effectiveBodyRadius(12, 1.5)).toBe(18);
    expect(effectiveBodyRadius(11, 1.7)).toBeCloseTo(18.7);
  });
});
