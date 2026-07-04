import { PASSIVE_ITEMS, type PassiveItemDefinition } from '../data/items';
import type { PlayerStats } from '../config/gameConfig';
import { clamp } from '../utils/math';
import { randomOf } from '../utils/random';

export class ItemSystem {
  pickRewardItem(collectedItemIds: readonly string[]): PassiveItemDefinition {
    return this.pickItem(collectedItemIds, { includeTreasureOnly: false });
  }

  pickTreasureItem(collectedItemIds: readonly string[]): PassiveItemDefinition {
    return this.pickItem(collectedItemIds, { includeTreasureOnly: false });
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

    const healAmount = modifiers.heal ?? 0;
    updated.health = clamp(updated.health + healAmount, 0, updated.maxHealth);

    return updated;
  }

  private pickItem(
    collectedItemIds: readonly string[],
    options: { includeTreasureOnly: boolean },
  ): PassiveItemDefinition {
    const pool = PASSIVE_ITEMS.filter((item) => options.includeTreasureOnly || !item.treasureOnly);
    const unseenItems = pool.filter((item) => !collectedItemIds.includes(item.id));
    return randomOf(unseenItems.length > 0 ? unseenItems : pool);
  }
}
