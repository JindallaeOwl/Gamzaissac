import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TextureKeys } from '../src/config/assets';
import { MINIBOSS_TUNING, PLAYER_DAMAGE_PER_HIT } from '../src/config/gameConfig';
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

function message(tree: TranslationTree, key: string): unknown {
  const messages = tree.messages;
  const leaf = key.replace('messages.', '');
  return typeof messages === 'object' ? (messages as Record<string, unknown>)[leaf] : undefined;
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

  // 2026-08-17: 넷이 일반 적 AI를 그대로 쓰던 것을 각자 서명 패턴이 있는 전용
  // 클래스로 바꿨다. 아래는 그 패턴이 데이터 쪽에서 빠지지 않았는지 지킨다 —
  // 패턴이 살아있는지는 플레이로만 확인할 수 있지만, 필요한 값이 없으면
  // (예: 탄을 쏘는데 bulletDamage가 없으면) 조용히 약해지므로 여기서 잡는다.
  it('gives every miniboss a phase-two awakening in both languages', () => {
    for (const id of MINIBOSS_IDS) {
      const definition = ENEMY_DEFINITIONS[id];

      expect(definition.phaseTwoMessageKey, id).toBe(`messages.${id}PhaseTwo`);
      expect(definition.bossPhaseTwoBarColor, id).toBe(MINIBOSS_TUNING[id].phaseTwoTint);
      expect(message(ko, definition.phaseTwoMessageKey!), id).toBeTypeOf('string');
      expect(message(en, definition.phaseTwoMessageKey!), id).toBeTypeOf('string');
    }
  });

  it('names the phase-two flag identically where it is defined and read', () => {
    // 준보스는 BaseEnemy의 isInPhaseTwo()로 각성을 알리고 BossHud가 그것을 읽는다.
    // 이름이 한쪽만 바뀌면 위에서 지정한 bossPhaseTwoBarColor가 조용히 안 쓰이게
    // 된다(검수에서 실제로 잡힌 결함). 이름 일치만 지키는 검사이며, HUD가 그 값으로
    // 무엇을 하는지는 플레이로 확인한다 — Phaser 없이 인스턴스를 만들 수 없어서다.
    const baseEnemy = readFileSync(
      new URL('../src/entities/enemies/BaseEnemy.ts', import.meta.url),
      'utf8',
    );
    const bossHud = readFileSync(new URL('../src/ui/BossHud.ts', import.meta.url), 'utf8');

    expect(baseEnemy).toContain('isInPhaseTwo');
    expect(baseEnemy).toContain('phaseTwoLatched');
    expect(bossHud).toContain('isInPhaseTwo');
    expect(bossHud).toContain('getBossBarColor');
  });

  it('gives the two shooting minibosses a bullet damage value', () => {
    // 뿌리 옹이는 방사형 뿌리탄, 가시넝쿨 뭉치는 돌진 후 가시를 쏜다.
    for (const id of ['rootGnarl', 'thornTangle'] as const) {
      expect(ENEMY_DEFINITIONS[id].bulletDamage, id).toBeGreaterThan(0);
    }
  });

  it('gives the two summoning minibosses a valid, non-multiplying target', () => {
    // 소환 대상이 다시 소환·분열하면 끝없이 늘어난다. EnemySummonRules가 같은
    // 규칙을 전체 데이터에 대해 검사하고, 여기서는 대상 지정 자체를 고정한다.
    expect(ENEMY_DEFINITIONS.wriggleMass.summonChildId).toBe('splitterling');
    expect(ENEMY_DEFINITIONS.flyQueen.summonChildId).toBe('chaser');

    for (const id of ['wriggleMass', 'flyQueen'] as const) {
      const childId = ENEMY_DEFINITIONS[id].summonChildId!;

      expect(ENEMY_DEFINITIONS[childId].summonChildId, childId).toBeUndefined();
      expect(ENEMY_DEFINITIONS[childId].splitChildId, childId).toBeUndefined();
    }
  });

  it('keeps every miniboss pattern cooldown faster in phase two', () => {
    // 각성이 "더 위험해진다"로 읽히려면 주기가 짧아지고 탄이 늘어야 한다.
    expect(MINIBOSS_TUNING.rootGnarl.phaseTwoActionCooldownMs).toBeLessThan(
      MINIBOSS_TUNING.rootGnarl.actionCooldownMs,
    );
    expect(MINIBOSS_TUNING.rootGnarl.phaseTwoBulletCount).toBeGreaterThan(
      MINIBOSS_TUNING.rootGnarl.bulletCount,
    );
    expect(MINIBOSS_TUNING.wriggleMass.phaseTwoChargeCooldownMs).toBeLessThan(
      MINIBOSS_TUNING.wriggleMass.chargeCooldownMs,
    );
    expect(MINIBOSS_TUNING.flyQueen.phaseTwoSummonCooldownMs).toBeLessThan(
      MINIBOSS_TUNING.flyQueen.summonCooldownMs,
    );
    expect(MINIBOSS_TUNING.flyQueen.phaseTwoFanCount).toBeGreaterThan(
      MINIBOSS_TUNING.flyQueen.fanCount,
    );
    expect(MINIBOSS_TUNING.thornTangle.phaseTwoDashCooldownMs).toBeLessThan(
      ENEMY_DEFINITIONS.thornTangle.dashCooldownMs!,
    );
    expect(MINIBOSS_TUNING.thornTangle.phaseTwoThornCount).toBeGreaterThan(
      MINIBOSS_TUNING.thornTangle.thornCount,
    );
    expect(MINIBOSS_TUNING.rootGnarl.phaseTwoLandingShockBulletCount).toBeGreaterThan(
      MINIBOSS_TUNING.rootGnarl.landingShockBulletCount,
    );
  });

  it('keeps the Root Gnarl leap dodgeable, honest, and bounded', () => {
    const tuning = MINIBOSS_TUNING.rootGnarl;

    // 착지점 예고가 너무 짧으면 "예고를 보고 피한다"가 성립하지 않는다.
    expect(tuning.leapTelegraphMs).toBeGreaterThan(300);
    // 벽·장애물에 걸려 목표에 닿지 못해도 반드시 착지해야 한다(영구 도약 방지).
    expect(tuning.leapMaxDurationMs).toBeGreaterThan(0);
    expect(tuning.leapArrivalTolerance).toBeGreaterThan(0);
    // 도약이 방사탄보다 먼 거리에서만 나와야 두 패턴이 서로를 대체하지 않는다.
    expect(tuning.leapMinDistance).toBeGreaterThan(0);
    // 도약 속도가 추격 속도보다 느리면 "덮친다"로 읽히지 않는다.
    expect(tuning.leapSpeed).toBeGreaterThan(ENEMY_DEFINITIONS.rootGnarl.speed);

    // 표식은 반드시 도달 가능한 자리여야 한다. 최대 도약 거리가 속도 × 최대
    // 시간을 넘으면 매번 중간에 떨어져 예고가 거짓이 된다(검수에서 잡힌 결함).
    const reachableDistance = (tuning.leapSpeed * tuning.leapMaxDurationMs) / 1000;

    expect(tuning.leapMaxDistance).toBeLessThan(reachableDistance);
    // 최소 발동 거리보다는 멀리 뛸 수 있어야 도약이 거리를 좁히는 의미가 있다.
    expect(tuning.leapMaxDistance).toBeGreaterThan(tuning.leapMinDistance);
  });

  it('keeps the Wriggle Mass charge able to reach its gate distance', () => {
    const tuning = MINIBOSS_TUNING.wriggleMass;
    // 돌진 이동 거리가 발동 사거리보다 훨씬 짧으면 어떤 움직이는 플레이어도
    // 맞히지 못해 패턴이 그냥 쉬는 시간이 된다(검수에서 잡힌 결함: 57px/무제한).
    const chargeDistance = (tuning.chargeSpeed * tuning.chargeDurationMs) / 1000;

    expect(chargeDistance).toBeGreaterThan(tuning.chargeMaxDistance * 0.8);
  });

  it('leaves a readable gap between Thorn Tangle dashes in phase two', () => {
    const tuning = MINIBOSS_TUNING.thornTangle;
    // 한 주기에는 예고 260ms + 돌진 300ms가 고정으로 들어간다. 쿨다운에서 그것을
    // 뺀 값이 실제로 숨 돌릴 틈이고, 이것이 너무 좁으면 반격할 자리가 없다.
    const dashCycleMs = 260 + (ENEMY_DEFINITIONS.thornTangle.dashDurationMs ?? 0);

    expect(tuning.phaseTwoDashCooldownMs - dashCycleMs).toBeGreaterThanOrEqual(120);
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
