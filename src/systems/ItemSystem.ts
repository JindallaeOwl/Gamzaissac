import type { PlayerAttackProfile, PlayerStats } from '../config/gameConfig';
import { BOSS_REWARD_ITEM_IDS } from '../data/bossRewards';
import {
  ITEM_DROP_TABLES,
  ITEM_SYNERGIES,
  PASSIVE_ITEMS,
  type AttackProfileModifier,
  type ItemDropSource,
  type ItemRarity,
  type PassiveItemDefinition,
  type StatModifier,
} from '../data/items';
import { clamp } from '../utils/math';
import { randomOf, type RandomSource } from '../utils/random';
import type { RunState } from './RunState';

export interface ItemAcquisitionResult {
  acquired: boolean;
  stackCount: number;
  newlyUnlockedAbilityId?: NonNullable<PassiveItemDefinition['abilityId']>;
  newlyActivatedSynergyIds: string[];
}

const RARITY_ORDER: readonly ItemRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export class ItemSystem {
  constructor(
    private readonly random: RandomSource = Math.random,
    private readonly bossRewardItemIds: readonly string[] = BOSS_REWARD_ITEM_IDS,
  ) {}

  pickRewardItem(collectedItemIds: readonly string[]): PassiveItemDefinition | null {
    return this.pickItemForSource('combat', collectedItemIds);
  }

  rollCombatRewardItem(
    collectedItemIds: readonly string[],
    luck: number,
  ): PassiveItemDefinition | null {
    const dropChance = Math.min(
      0.35,
      ITEM_DROP_TABLES.combat.dropChance + clamp(luck, 0, 10) * 0.01,
    );

    if (this.random() >= dropChance) {
      return null;
    }

    return this.pickRewardItem(collectedItemIds);
  }

  pickTreasureItem(collectedItemIds: readonly string[]): PassiveItemDefinition | null {
    return this.pickItemForSource('treasure', collectedItemIds);
  }

  pickShopItem(collectedItemIds: readonly string[]): PassiveItemDefinition | null {
    return this.pickItemForSource('shop', collectedItemIds);
  }

  pickBossRewardItem(collectedItemIds: readonly string[]): PassiveItemDefinition | null {
    const bossRewardIds = new Set(this.bossRewardItemIds);
    const pool = PASSIVE_ITEMS.filter(
      (item) =>
        bossRewardIds.has(item.id) &&
        item.dropSources.includes('boss') &&
        isStatOnlyBossReward(item) &&
        !isItemAtStackLimit(item, collectedItemIds),
    );

    return this.pickWeightedByRarity(pool, 'boss');
  }

  pickItemForSource(
    source: ItemDropSource,
    collectedItemIds: readonly string[],
  ): PassiveItemDefinition | null {
    const pool = PASSIVE_ITEMS.filter(
      (item) =>
        item.dropSources.includes(source) && !isItemAtStackLimit(item, collectedItemIds),
    );
    return this.pickWeightedByRarity(pool, source);
  }

  canAcquireItem(runState: RunState, item: PassiveItemDefinition): boolean {
    return !isItemAtStackLimit(item, runState.collectedItemIds);
  }

  acquireItem(runState: RunState, item: PassiveItemDefinition): ItemAcquisitionResult {
    const currentStackCount = getItemStackCount(item.id, runState.collectedItemIds);

    if (currentStackCount >= item.maxStacks) {
      return {
        acquired: false,
        stackCount: currentStackCount,
        newlyActivatedSynergyIds: [],
      };
    }

    runState.stats = applyStatModifiers(runState.stats, item.modifiers);
    runState.attackProfile = applyAttackModifiers(runState.attackProfile, item.attackModifiers);
    runState.collectedItemIds.push(item.id);

    const result: ItemAcquisitionResult = {
      acquired: true,
      stackCount: currentStackCount + 1,
      newlyActivatedSynergyIds: [],
    };

    if (item.abilityId && !runState.unlockedAbilityIds.includes(item.abilityId)) {
      runState.unlockedAbilityIds.push(item.abilityId);
      result.newlyUnlockedAbilityId = item.abilityId;
    }

    for (const synergy of ITEM_SYNERGIES) {
      if (
        runState.activatedSynergyIds.includes(synergy.id) ||
        !synergy.requiredItemIds.every((itemId) => runState.collectedItemIds.includes(itemId))
      ) {
        continue;
      }

      runState.stats = applyStatModifiers(runState.stats, synergy.modifiers);
      runState.attackProfile = applyAttackModifiers(
        runState.attackProfile,
        synergy.attackModifiers,
      );
      runState.activatedSynergyIds.push(synergy.id);
      result.newlyActivatedSynergyIds.push(synergy.id);
    }

    return result;
  }

  applyItem(stats: PlayerStats, item: PassiveItemDefinition): PlayerStats {
    return applyStatModifiers(stats, item.modifiers);
  }

  applyAttackProfile(
    profile: PlayerAttackProfile,
    item: PassiveItemDefinition,
  ): PlayerAttackProfile {
    return applyAttackModifiers(profile, item.attackModifiers);
  }

  private pickWeightedByRarity(
    pool: readonly PassiveItemDefinition[],
    source: ItemDropSource,
  ): PassiveItemDefinition | null {
    if (pool.length === 0) {
      return null;
    }

    const weights = ITEM_DROP_TABLES[source].rarityWeights;
    const availableRarities = RARITY_ORDER.filter(
      (rarity) => weights[rarity] > 0 && pool.some((item) => item.rarity === rarity),
    );
    const totalWeight = availableRarities.reduce((sum, rarity) => sum + weights[rarity], 0);

    if (totalWeight <= 0) {
      return randomOf(pool, this.random);
    }

    let rarityRoll = this.random() * totalWeight;
    let selectedRarity = availableRarities[availableRarities.length - 1];

    for (const rarity of availableRarities) {
      rarityRoll -= weights[rarity];
      if (rarityRoll <= 0) {
        selectedRarity = rarity;
        break;
      }
    }

    return randomOf(
      pool.filter((item) => item.rarity === selectedRarity),
      this.random,
    );
  }
}

export function getItemStackCount(
  itemId: string,
  collectedItemIds: readonly string[],
): number {
  return collectedItemIds.filter((collectedId) => collectedId === itemId).length;
}

export function isItemAtStackLimit(
  item: PassiveItemDefinition,
  collectedItemIds: readonly string[],
): boolean {
  return getItemStackCount(item.id, collectedItemIds) >= item.maxStacks;
}

export function isStatOnlyBossReward(item: PassiveItemDefinition): boolean {
  return !item.attackModifiers && !item.abilityId;
}

function applyStatModifiers(stats: PlayerStats, modifiers: StatModifier): PlayerStats {
  const updated: PlayerStats = { ...stats };

  updated.maxHealth = Math.max(1, updated.maxHealth + (modifiers.maxHealth ?? 0));
  updated.moveSpeed = Math.max(40, updated.moveSpeed + (modifiers.moveSpeed ?? 0));
  updated.damage = Math.max(0.1, updated.damage + (modifiers.damage ?? 0));
  updated.range = Math.max(40, updated.range + (modifiers.range ?? 0));
  updated.fireRate = Math.max(0.2, updated.fireRate + (modifiers.fireRate ?? 0));
  updated.luck = Math.max(0, updated.luck + (modifiers.luck ?? 0));
  updated.projectileSpeed = Math.max(
    40,
    updated.projectileSpeed + (modifiers.projectileSpeed ?? 0),
  );
  updated.damageMultiplier *= modifiers.damageMultiplier ?? 1;
  updated.fireRateMultiplier *= modifiers.fireRateMultiplier ?? 1;
  updated.projectileSpeedMultiplier *= modifiers.projectileSpeedMultiplier ?? 1;

  const healAmount = modifiers.heal ?? 0;
  updated.health = clamp(updated.health + healAmount, 0, updated.maxHealth);
  return updated;
}

function applyAttackModifiers(
  profile: PlayerAttackProfile,
  modifiers?: AttackProfileModifier,
): PlayerAttackProfile {
  if (!modifiers) {
    return { ...profile };
  }

  return {
    seedCount: clamp(profile.seedCount + (modifiers.seedCountAdd ?? 0), 1, 12),
    spreadStepDegrees: modifiers.spreadStepDegrees ?? profile.spreadStepDegrees,
    overflowPenetration: profile.overflowPenetration || (modifiers.overflowPenetration ?? false),
    seedScale: clamp(profile.seedScale * (modifiers.seedScaleMultiplier ?? 1), 0.6, 2.4),
    forceRedSeeds: profile.forceRedSeeds || (modifiers.forceRedSeeds ?? false),
    extraForeheadEyeCount: clamp(
      profile.extraForeheadEyeCount + (modifiers.extraForeheadEyeCountAdd ?? 0),
      0,
      6,
    ),
    hasToothpickCosmetic:
      profile.hasToothpickCosmetic || (modifiers.hasToothpickCosmetic ?? false),
  };
}
