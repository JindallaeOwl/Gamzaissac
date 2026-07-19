import { PASSIVE_ITEMS, type PassiveItemDefinition } from '../data/items';
import type { ItemSystem } from './ItemSystem';

export interface BossRewardRoomState {
  bossRewardClaimed: boolean;
  bossRewardItemId?: string;
}

export class BossRewardSystem {
  constructor(private readonly itemSystem: ItemSystem) {}

  resolveReward(
    room: BossRewardRoomState,
    collectedItemIds: readonly string[],
  ): PassiveItemDefinition | null {
    if (room.bossRewardClaimed) {
      return null;
    }

    if (room.bossRewardItemId) {
      return PASSIVE_ITEMS.find((item) => item.id === room.bossRewardItemId) ?? null;
    }

    const reward = this.itemSystem.pickBossRewardItem(collectedItemIds);

    if (reward) {
      room.bossRewardItemId = reward.id;
    }

    return reward;
  }
}
