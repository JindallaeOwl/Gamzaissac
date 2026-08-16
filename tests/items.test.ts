import { describe, expect, it } from 'vitest';
import { PLAYER_HEALTH_UNITS_PER_HEART } from '../src/config/gameConfig';
import { BOSS_REWARD_ITEM_IDS } from '../src/data/bossRewards';
import {
  findItemByReference,
  formatItemNumber,
  ITEM_DROP_TABLES,
  ITEM_SYNERGIES,
  PASSIVE_ITEMS,
  type ItemDropSource,
  type ItemRarity,
  type PassiveItemDefinition,
} from '../src/data/items';
import { ko } from '../src/i18n/ko';
import type { TranslationTree } from '../src/i18n/types';
import { isItemAtStackLimit, isStatOnlyBossReward, ItemSystem } from '../src/systems/ItemSystem';
import { getEffectiveDamage, getEffectiveFireRate } from '../src/systems/PlayerStatSystem';
import { createInitialRunState } from '../src/systems/RunState';

const RARITY_ORDER: readonly ItemRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

function itemById(id: string) {
  const item = PASSIVE_ITEMS.find((candidate) => candidate.id === id);

  if (!item) {
    throw new Error(`Unknown item: ${id}`);
  }

  return item;
}

function expectedPoolForSource(
  source: ItemDropSource,
  collectedItemIds: readonly string[] = [],
): PassiveItemDefinition[] {
  const bossRewardIds = new Set(BOSS_REWARD_ITEM_IDS);

  return PASSIVE_ITEMS.filter(
    (item) =>
      item.dropSources.includes(source) &&
      !isItemAtStackLimit(item, collectedItemIds) &&
      (source !== 'boss' || (bossRewardIds.has(item.id) && isStatOnlyBossReward(item))),
  );
}

function pickForSource(
  system: ItemSystem,
  source: ItemDropSource,
  collectedItemIds: readonly string[],
): PassiveItemDefinition | null {
  return source === 'boss'
    ? system.pickBossRewardItem(collectedItemIds)
    : system.pickItemForSource(source, collectedItemIds);
}

/**
 * Targets every eligible item with the midpoint of its rarity band and its
 * index slot. Unlike a fixed random sweep, this still covers a 1% rarity or a
 * pool with more than 40 entries.
 */
function reachableItemIds(
  source: ItemDropSource,
  collectedItemIds: readonly string[] = [],
): Set<string> {
  const pool = expectedPoolForSource(source, collectedItemIds);
  const weights = ITEM_DROP_TABLES[source].rarityWeights;
  const availableRarities = RARITY_ORDER.filter(
    (rarity) => weights[rarity] > 0 && pool.some((item) => item.rarity === rarity),
  );
  const totalWeight = availableRarities.reduce((sum, rarity) => sum + weights[rarity], 0);
  const targets =
    totalWeight > 0 ? pool.filter((item) => availableRarities.includes(item.rarity)) : pool;
  const ids = new Set<string>();

  for (const target of targets) {
    const sameRarity = pool.filter((item) => item.rarity === target.rarity);
    const targetIndex = sameRarity.findIndex((item) => item.id === target.id);
    const indexRoll = (targetIndex + 0.5) / sameRarity.length;
    const rarityIndex = availableRarities.indexOf(target.rarity);
    const weightBeforeTarget = availableRarities
      .slice(0, rarityIndex)
      .reduce((sum, rarity) => sum + weights[rarity], 0);
    const rolls =
      totalWeight > 0
        ? [(weightBeforeTarget + weights[target.rarity] / 2) / totalWeight, indexRoll]
        : [(pool.indexOf(target) + 0.5) / pool.length];
    let call = 0;
    const system = new ItemSystem(() => rolls[Math.min(call++, rolls.length - 1)]);
    const picked = pickForSource(system, source, collectedItemIds);

    if (!picked) {
      throw new Error(`${source} did not return the targeted item ${target.id}`);
    }

    expect(picked.id, `${source} should reach ${target.id}`).toBe(target.id);
    ids.add(picked.id);
  }

  return ids;
}

describe('ItemSystem', () => {
  it('assigns unique shared catalog numbers with three-digit display labels', () => {
    const itemNumbers = PASSIVE_ITEMS.map((item) => item.itemNumber);

    expect(new Set(itemNumbers).size).toBe(PASSIVE_ITEMS.length);
    expect(itemNumbers.every((itemNumber) => Number.isInteger(itemNumber) && itemNumber > 0)).toBe(
      true,
    );
    expect(formatItemNumber(1)).toBe('ID: 001');
    expect(formatItemNumber(25)).toBe('ID: 025');
    expect(findItemByReference('001')?.id).toBe('red-mushroom');
    expect(findItemByReference('13')?.id).toBe('prism-lance');
    expect(findItemByReference('quad-shot')?.itemNumber).toBe(2);
  });

  it('applies stat and attack-profile modifiers without mutating the originals', () => {
    const state = createInitialRunState();
    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === 'quad-shot');
    const system = new ItemSystem(() => 0);

    expect(item).toBeDefined();
    const stats = system.applyItem(state.stats, item!);
    const profile = system.applyAttackProfile(state.attackProfile, item!);

    expect(profile.seedCount).toBe(4);
    expect(profile.extraForeheadEyeCount).toBe(2);
    expect(stats.fireRateMultiplier).toBeCloseTo(0.42);
    expect(state.attackProfile.seedCount).toBe(1);
    expect(state.stats.fireRateMultiplier).toBe(1);
  });

  it('only offers items whose drop sources include the pool being rolled', () => {
    for (const id of reachableItemIds('combat')) {
      expect(itemById(id).dropSources, id).toContain('combat');
    }

    for (const id of reachableItemIds('treasure')) {
      expect(itemById(id).dropSources, id).toContain('treasure');
    }

    for (const id of reachableItemIds('shop')) {
      expect(itemById(id).dropSources, id).toContain('shop');
    }
  });

  it('drops an item out of the pool once it reaches its stack limit', () => {
    const stackable = PASSIVE_ITEMS.find(
      (item) => item.maxStacks > 1 && item.dropSources.includes('combat'),
    )!;
    const maxedOut = Array.from({ length: stackable.maxStacks }, () => stackable.id);

    expect(reachableItemIds('combat')).toContain(stackable.id);
    expect(reachableItemIds('combat', maxedOut)).not.toContain(stackable.id);
  });

  it('can select the Prism Lance only from the treasure pool', () => {
    // Asserted against the definition rather than a pool ordering, so adding
    // items never silently changes what this test is checking.
    expect(itemById('prism-lance').dropSources).toEqual(['treasure']);
    expect(reachableItemIds('treasure')).toContain('prism-lance');
    expect(reachableItemIds('combat')).not.toContain('prism-lance');
  });

  it('updates the run state when an item is acquired', () => {
    const state = createInitialRunState();
    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === 'quad-shot');
    const system = new ItemSystem(() => 0);

    expect(item).toBeDefined();
    expect(system.acquireItem(state, item!)).toEqual({
      acquired: true,
      stackCount: 1,
      newlyActivatedSynergies: [],
    });
    expect(state.collectedItemIds).toEqual(['quad-shot']);
    expect(state.attackProfile.seedCount).toBe(4);
    expect(state.stats.fireRateMultiplier).toBeCloseTo(0.42);
  });

  it('unlocks an item ability only once', () => {
    const state = createInitialRunState();
    const prismLance = PASSIVE_ITEMS.find((candidate) => candidate.id === 'prism-lance');
    const system = new ItemSystem(() => 0);

    expect(prismLance).toBeDefined();
    expect(system.acquireItem(state, prismLance!)).toEqual({
      acquired: true,
      stackCount: 1,
      newlyUnlockedAbilityId: 'charge-beam',
      newlyActivatedSynergies: [],
    });
    expect(system.acquireItem(state, prismLance!)).toEqual({
      acquired: false,
      stackCount: 1,
      newlyActivatedSynergies: [],
    });
    expect(state.unlockedAbilityIds).toEqual(['charge-beam']);
    expect(state.collectedItemIds).toEqual(['prism-lance']);
  });

  it.each([
    ['quad-shot', 'prism-lance'],
    ['prism-lance', 'quad-shot'],
  ])('keeps the four-way beam synergy when acquired as %s then %s', (firstId, secondId) => {
    const state = createInitialRunState();
    const system = new ItemSystem(() => 0);
    const first = PASSIVE_ITEMS.find((item) => item.id === firstId);
    const second = PASSIVE_ITEMS.find((item) => item.id === secondId);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    system.acquireItem(state, first!);
    system.acquireItem(state, second!);

    expect(state.attackProfile.seedCount).toBe(4);
    expect(state.attackProfile.spreadStepDegrees).toBe(12);
    expect(state.unlockedAbilityIds).toContain('charge-beam');
    // 프리즘 배열 시너지의 실효과 — 획득 순서와 무관하게 차징 배율이 줄어든다.
    expect(state.attackProfile.beamChargeMsMultiplier).toBeCloseTo(0.7);
  });

  it('defines rarity, category, source pools, and stack limits for all 36 passives', () => {
    expect(PASSIVE_ITEMS).toHaveLength(36);
    expect(
      PASSIVE_ITEMS.every(
        (item) =>
          item.dropSources.length > 0 &&
          item.maxStacks >= 1 &&
          ['common', 'uncommon', 'rare', 'legendary'].includes(item.rarity) &&
          ['offense', 'defense', 'utility', 'resource'].includes(item.category),
      ),
    ).toBe(true);
  });

  it('allows stackable items up to their cap and rejects another copy', () => {
    const state = createInitialRunState();
    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === 'pulse-relay')!;
    const system = new ItemSystem(() => 0);

    for (let stack = 1; stack <= item.maxStacks; stack += 1) {
      expect(system.acquireItem(state, item)).toMatchObject({ acquired: true, stackCount: stack });
    }

    expect(system.acquireItem(state, item)).toMatchObject({
      acquired: false,
      stackCount: item.maxStacks,
    });
    expect(state.stats.fireRate).toBeCloseTo(2.8 + 0.55 * item.maxStacks);
  });

  it('activates a two-item synergy exactly once', () => {
    const state = createInitialRunState();
    const system = new ItemSystem(() => 0);
    const glassFern = PASSIVE_ITEMS.find((item) => item.id === 'glass-fern')!;
    const longEcho = PASSIVE_ITEMS.find((item) => item.id === 'long-echo')!;

    system.acquireItem(state, glassFern);
    const activation = system.acquireItem(state, longEcho);

    expect(activation.newlyActivatedSynergies.map((synergy) => synergy.id)).toEqual([
      'glass-horizon',
    ]);
    expect(state.activatedSynergyIds).toEqual(['glass-horizon']);
    expect(state.stats.damage).toBeCloseTo(2);
    expect(state.stats.range).toBe(380);

    const nextStack = system.acquireItem(state, glassFern);
    expect(nextStack.newlyActivatedSynergies).toEqual([]);
    expect(state.activatedSynergyIds).toEqual(['glass-horizon']);
  });

  it('uses separate room pools and luck-sensitive combat drop chances', () => {
    const alwaysLow = new ItemSystem(() => 0);
    const alwaysHigh = new ItemSystem(() => 0.999999);

    expect(alwaysLow.pickItemForSource('shop', [])?.dropSources).toContain('shop');
    expect(alwaysHigh.pickItemForSource('treasure', [])?.rarity).toBe('legendary');
    expect(alwaysLow.rollCombatRewardItem([], 0)).not.toBeNull();
    expect(alwaysHigh.rollCombatRewardItem([], 10)).toBeNull();
  });
});

function resolveTranslation(tree: TranslationTree, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object') {
      return (node as Record<string, unknown>)[key];
    }

    return undefined;
  }, tree);
}

describe('stacking behavior items', () => {
  it('mirrors the whole seed fan backward with the Back Pocket Seed', () => {
    const system = new ItemSystem(() => 0);
    const state = createInitialRunState();
    const backPocketSeed = itemById('back-pocket-seed');
    const baseDamage = state.stats.damage;

    system.acquireItem(state, backPocketSeed);
    expect(state.attackProfile.rearFire).toBe(true);
    expect(state.stats.damage).toBeCloseTo(baseDamage - 0.1);

    // 거울 규칙이라 셀 것이 없다 — 두 번째 획득은 거부된다.
    expect(system.acquireItem(state, backPocketSeed).acquired).toBe(false);

    // 쿼드샷을 이어 먹으면 앞이 4갈래가 되고 뒤는 그 거울이다. 발사 수는
    // seedCount 하나만 늘면 되므로 rearFire는 그대로 true다.
    system.acquireItem(state, itemById('quad-shot'));
    expect(state.attackProfile.seedCount).toBe(4);
    expect(state.attackProfile.rearFire).toBe(true);
  });

  it('bends seed paths with the Wavy Seed without touching stats', () => {
    const system = new ItemSystem(() => 0);
    const state = createInitialRunState();
    const statsBefore = { ...state.stats };

    system.acquireItem(state, itemById('wavy-seed'));

    expect(state.attackProfile.waveDegrees).toBe(35);
    // 첫 순수 거동 아이템 — 스탯은 하나도 건드리지 않는다.
    expect(state.stats).toEqual(statsBefore);
  });

  it('turns firing into three-shot bursts with the Burst Pod', () => {
    const system = new ItemSystem(() => 0);
    const state = createInitialRunState();
    const baseFireRate = state.stats.fireRate;

    system.acquireItem(state, itemById('burst-pod'));

    expect(state.attackProfile.burstCount).toBe(3);
    expect(state.stats.fireRate).toBeCloseTo(baseFireRate - 0.2);
  });

  it('every attack modifier actually changes the profile when applied', () => {
    // attackModifiers를 선언했는데 적용해도 프로필이 그대로면(빈 객체 등)
    // "이름뿐인 거동 아이템"이다. 병합 함수에 새 키를 잊은 경우도 여기서 잡힌다.
    const system = new ItemSystem(() => 0);

    for (const item of PASSIVE_ITEMS) {
      if (!item.attackModifiers) {
        continue;
      }

      const before = createInitialRunState().attackProfile;
      const after = system.applyAttackProfile(before, item);

      expect(after, `${item.id}의 attackModifiers가 프로필을 바꾸지 않는다`).not.toEqual(before);
    }
  });

  it('keeps behavior items out of the stat-only boss reward pool', () => {
    // 보스방 보상은 순수 능력치형만 허용한다. 거동 아이템이 attackModifiers를
    // 갖는 한 자동으로 걸러지는데, 실수로 attackModifiers 없이 만들면 이 검사가
    // 잡아 준다.
    for (const id of ['back-pocket-seed', 'wavy-seed', 'burst-pod']) {
      expect(isStatOnlyBossReward(itemById(id)), id).toBe(false);
    }
  });
});

describe('item synergies', () => {
  it('gives every synergy a resolvable name and effect description', () => {
    // 발동 알림이 이름·설명을 그대로 화면에 올린다. 키가 깨지면 알림에
    // 'synergies.…' 같은 원시 키 문자열이 노출되므로 여기서 미리 잡는다.
    // ko만 검사한다 — ko/en 키 집합 일치와 빈 문자열 금지는 i18n-parity가 전담한다.
    for (const synergy of ITEM_SYNERGIES) {
      for (const key of [synergy.nameKey, synergy.descriptionKey]) {
        expect(resolveTranslation(ko, key), `${synergy.id}: ${key}`).toBeTypeOf('string');
      }
    }
  });
});

describe('hand-pixeled item batch', () => {
  it('spends a whole heart on the Thin Rind and never drops max health below half', () => {
    const system = new ItemSystem(() => 0);
    const state = createInitialRunState();
    const thinRind = itemById('thin-rind');

    // Two health units are one heart, matching what the description promises.
    const afterOne = system.applyItem(state.stats, thinRind);

    expect(state.stats.maxHealth - afterOne.maxHealth).toBe(PLAYER_HEALTH_UNITS_PER_HEART);
    expect(afterOne.moveSpeed).toBeGreaterThan(state.stats.moveSpeed);
    expect(afterOne.fireRate).toBeGreaterThan(state.stats.fireRate);

    // Applying it far past the starting hearts must floor rather than kill.
    let stats = state.stats;

    for (let round = 0; round < 6; round += 1) {
      stats = system.applyItem(stats, thinRind);
      expect(stats.maxHealth).toBeGreaterThanOrEqual(1);
      expect(stats.health).toBeGreaterThan(0);
      expect(stats.health).toBeLessThanOrEqual(stats.maxHealth);
    }

    expect(stats.maxHealth).toBe(1);
  });

  it('restores a full heart with the Silver Dew without passing the cap', () => {
    const system = new ItemSystem(() => 0);
    const state = createInitialRunState();
    const silverDew = itemById('silver-dew');

    state.stats = { ...state.stats, health: 1 };
    const healed = system.applyItem(state.stats, silverDew);

    expect(healed.health - 1).toBe(PLAYER_HEALTH_UNITS_PER_HEART);
    expect(healed.luck).toBeCloseTo(state.stats.luck + 1.5);

    const alreadyFull = system.applyItem(
      { ...state.stats, health: state.stats.maxHealth },
      silverDew,
    );

    expect(alreadyFull.health).toBe(alreadyFull.maxHealth);
  });

  it('splits one extra Twin Seed projectile and stays unique', () => {
    const system = new ItemSystem(() => 0);
    const state = createInitialRunState();
    const twinSeed = itemById('twin-seed');
    const baseDamage = state.stats.damage;

    expect(system.acquireItem(state, twinSeed).acquired).toBe(true);
    expect(state.attackProfile.seedCount).toBe(2);
    expect(state.stats.damage).toBeCloseTo(baseDamage - 0.15);

    // A second copy must be refused: stacking would push this common item past
    // the rare Quad Shot on single-target damage.
    expect(system.acquireItem(state, twinSeed).acquired).toBe(false);
    expect(state.attackProfile.seedCount).toBe(2);
    expect(state.stats.damage).toBeCloseTo(baseDamage - 0.15);
  });

  it('keeps the common Twin Seed within 5% of the rare Quad Shot on sustained damage', () => {
    const system = new ItemSystem(() => 0);
    const twinSeedRun = createInitialRunState();
    const quadShotRun = createInitialRunState();
    const maxTwinToQuadDamageRatio = 1.05;

    system.acquireItem(twinSeedRun, itemById('twin-seed'));
    system.acquireItem(quadShotRun, itemById('quad-shot'));

    const sustained = (run: ReturnType<typeof createInitialRunState>): number =>
      run.attackProfile.seedCount * getEffectiveDamage(run.stats) * getEffectiveFireRate(run.stats);

    expect(sustained(twinSeedRun)).toBeLessThanOrEqual(
      sustained(quadShotRun) * maxTwinToQuadDamageRatio,
    );
  });

  it('grants overflow carry-through on the Bore Awl at the cost of fire rate', () => {
    const system = new ItemSystem(() => 0);
    const state = createInitialRunState();
    const boreAwl = itemById('bore-awl');

    expect(state.attackProfile.overflowPenetration).toBe(false);

    const profile = system.applyAttackProfile(state.attackProfile, boreAwl);
    const stats = system.applyItem(state.stats, boreAwl);

    expect(profile.overflowPenetration).toBe(true);
    expect(stats.fireRate).toBeCloseTo(state.stats.fireRate - 0.15);
    expect(stats.projectileSpeed).toBe(state.stats.projectileSpeed + 25);
  });

  it('lists the two new stat-only items as reachable boss rewards', () => {
    for (const id of ['spike-rind', 'deep-root']) {
      const item = itemById(id);

      expect(item.dropSources, id).toContain('boss');
      expect(BOSS_REWARD_ITEM_IDS, id).toContain(id);
      // Boss rooms reject attack-changing passives, so these must stay stat-only.
      expect(isStatOnlyBossReward(item), id).toBe(true);
    }

    const reachable = reachableItemIds('boss');

    expect(reachable).toContain('spike-rind');
    expect(reachable).toContain('deep-root');
  });
});
