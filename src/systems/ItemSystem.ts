import { PASSIVE_ITEMS, type PassiveItemDefinition } from '../data/items';
import type { PlayerAttackProfile, PlayerStats } from '../config/gameConfig';
import { clamp } from '../utils/math';
import { randomOf, type RandomSource } from '../utils/random';
import type { RunState } from './RunState';

export interface ItemAcquisitionResult {
  newlyUnlockedAbilityId?: NonNullable<PassiveItemDefinition['abilityId']>;
}

export class ItemSystem {
  constructor(private readonly random: RandomSource = Math.random) {}

  pickRewardItem(collectedItemIds: readonly string[]): PassiveItemDefinition {
    return this.pickItem(collectedItemIds, { includeTreasureOnly: false });
  }

  pickTreasureItem(collectedItemIds: readonly string[]): PassiveItemDefinition {
    return this.pickItem(collectedItemIds, { includeTreasureOnly: true });
  }

  acquireItem(runState: RunState, item: PassiveItemDefinition): ItemAcquisitionResult {
    runState.stats = this.applyItem(runState.stats, item);
    runState.attackProfile = this.applyAttackProfile(runState.attackProfile, item);
    runState.collectedItemIds.push(item.id);

    if (item.abilityId && !runState.unlockedAbilityIds.includes(item.abilityId)) {
      runState.unlockedAbilityIds.push(item.abilityId);
      return { newlyUnlockedAbilityId: item.abilityId };
    }

    return {};
  }

  applyItem(stats: PlayerStats, item: PassiveItemDefinition): PlayerStats {
    const updated: PlayerStats = { ...stats };
    const modifiers = item.modifiers;

    updated.maxHealth += modifiers.maxHealth ?? 0;
    updated.moveSpeed += modifiers.moveSpeed ?? 0;
    updated.damage += modifiers.damage ?? 0;
    updated.range += modifiers.range ?? 0;
    updated.fireRate += modifiers.fireRate ?? 0;
    updated.luck += modifiers.luck ?? 0;
    updated.projectileSpeed += modifiers.projectileSpeed ?? 0;
    updated.damageMultiplier *= modifiers.damageMultiplier ?? 1;
    updated.fireRateMultiplier *= modifiers.fireRateMultiplier ?? 1;
    updated.projectileSpeedMultiplier *= modifiers.projectileSpeedMultiplier ?? 1;

    const healAmount = modifiers.heal ?? 0;
    updated.health = clamp(updated.health + healAmount, 0, updated.maxHealth);

    return updated;
  }

  applyAttackProfile(
    profile: PlayerAttackProfile,
    item: PassiveItemDefinition,
  ): PlayerAttackProfile {
    const modifiers = item.attackModifiers;

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

  private pickItem(
    collectedItemIds: readonly string[],
    options: { includeTreasureOnly: boolean },
  ): PassiveItemDefinition {
    const pool = PASSIVE_ITEMS.filter((item) => options.includeTreasureOnly || !item.treasureOnly);
    const unseenItems = pool.filter((item) => !collectedItemIds.includes(item.id));
    return randomOf(unseenItems.length > 0 ? unseenItems : pool, this.random);
  }
}
