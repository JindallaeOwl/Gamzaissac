import { INVENTORY_TUNING, type PlayerStats } from '../config/gameConfig';
import {
  REWARD_DROP_TUNING,
  ROOM_CLEAR_REWARDS,
  type ConsumableType,
  type RewardDefinition,
  type RewardKind,
} from '../data/rewards';
import type { InventoryState } from './RunState';
import { randomInt } from '../utils/random';

export interface RewardDrop {
  kind: RewardKind;
  amount: number;
  labelKey: string;
  tint: number;
}

export type ChestResult =
  | { type: 'heal'; amount: number }
  | { type: 'consumable'; consumable: ConsumableType; amount: number };

export class RewardSystem {
  rollRoomClearReward(stats: PlayerStats): RewardDrop | null {
    const chance = Math.min(
      REWARD_DROP_TUNING.maxRoomClearChance,
      REWARD_DROP_TUNING.baseRoomClearChance + stats.luck * REWARD_DROP_TUNING.luckChanceBonus,
    );

    if (Math.random() > chance) {
      return null;
    }

    const reward = pickWeightedReward(ROOM_CLEAR_REWARDS);

    return {
      kind: reward.kind,
      amount: randomInt(reward.amountMin, reward.amountMax),
      labelKey: reward.labelKey,
      tint: reward.tint,
    };
  }

  rollChestResult(stats: PlayerStats): ChestResult {
    const healChance = Math.min(
      0.58,
      REWARD_DROP_TUNING.chestHealChance + stats.luck * REWARD_DROP_TUNING.chestLuckBonus,
    );

    if (Math.random() < healChance) {
      return { type: 'heal', amount: 1 };
    }

    const consumable = pickWeightedReward(
      ROOM_CLEAR_REWARDS.filter((reward) => reward.kind !== 'chest'),
    ).kind as ConsumableType;

    return {
      type: 'consumable',
      consumable,
      amount: consumable === 'coins' ? randomInt(4, 10) : randomInt(1, 2),
    };
  }

  canTakeConsumable(inventory: InventoryState, type: ConsumableType): boolean {
    return inventory[type] < INVENTORY_TUNING.maxConsumable;
  }
}

function pickWeightedReward(rewards: RewardDefinition[]): RewardDefinition {
  const totalWeight = rewards.reduce((sum, reward) => sum + reward.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const reward of rewards) {
    roll -= reward.weight;

    if (roll <= 0) {
      return reward;
    }
  }

  return rewards[rewards.length - 1];
}
