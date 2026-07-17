import { INVENTORY_TUNING, type PlayerStats } from '../config/gameConfig';
import {
  REWARD_DROP_TUNING,
  ROOM_CLEAR_REWARDS,
  type ConsumableType,
  type RewardDefinition,
  type RewardKind,
} from '../data/rewards';
import { clamp } from '../utils/math';
import { randomInt, type RandomSource } from '../utils/random';
import { addConsumable } from './InventorySystem';
import type { InventoryState, RunState } from './RunState';

export interface RewardDrop {
  kind: RewardKind;
  amount: number;
  labelKey: string;
  tint: number;
}

export type ChestResult =
  | { type: 'heal'; amount: number }
  | { type: 'consumable'; consumable: ConsumableType; amount: number };

export type RewardPickupResult =
  | { collected: false; type: 'resource-full'; labelKey: string }
  | { collected: true; type: 'chest'; chestResult: ChestResult }
  | { collected: true; type: 'consumable'; amount: number; labelKey: string };

export class RewardSystem {
  constructor(private readonly random: RandomSource = Math.random) {}

  rollRoomClearReward(stats: PlayerStats): RewardDrop | null {
    const chance = Math.min(
      REWARD_DROP_TUNING.maxRoomClearChance,
      REWARD_DROP_TUNING.baseRoomClearChance + stats.luck * REWARD_DROP_TUNING.luckChanceBonus,
    );

    if (this.random() > chance) {
      return null;
    }

    const reward = pickWeightedReward(ROOM_CLEAR_REWARDS, this.random);

    return {
      kind: reward.kind,
      amount: randomInt(reward.amountMin, reward.amountMax, this.random),
      labelKey: reward.labelKey,
      tint: reward.tint,
    };
  }

  rollChestResult(stats: PlayerStats): ChestResult {
    const healChance = Math.min(
      0.58,
      REWARD_DROP_TUNING.chestHealChance + stats.luck * REWARD_DROP_TUNING.chestLuckBonus,
    );

    if (this.random() < healChance) {
      return { type: 'heal', amount: 1 };
    }

    const consumable = pickWeightedReward(
      ROOM_CLEAR_REWARDS.filter((reward) => reward.kind !== 'chest'),
      this.random,
    ).kind as ConsumableType;

    return {
      type: 'consumable',
      consumable,
      amount: consumable === 'coins' ? randomInt(4, 10, this.random) : randomInt(1, 2, this.random),
    };
  }

  applyPickup(runState: RunState, reward: RewardDrop): RewardPickupResult {
    if (reward.kind === 'chest') {
      const chestResult = this.rollChestResult(runState.stats);

      if (chestResult.type === 'heal') {
        runState.stats.health = clamp(
          runState.stats.health + chestResult.amount,
          0,
          runState.stats.maxHealth,
        );
      } else {
        runState.inventory = addConsumable(
          runState.inventory,
          chestResult.consumable,
          chestResult.amount,
        );
      }

      return { collected: true, type: 'chest', chestResult };
    }

    const consumable = reward.kind;

    if (!this.canTakeConsumable(runState.inventory, consumable)) {
      return { collected: false, type: 'resource-full', labelKey: reward.labelKey };
    }

    runState.inventory = addConsumable(runState.inventory, consumable, reward.amount);
    return {
      collected: true,
      type: 'consumable',
      amount: reward.amount,
      labelKey: reward.labelKey,
    };
  }

  canTakeConsumable(inventory: InventoryState, type: ConsumableType): boolean {
    return inventory[type] < INVENTORY_TUNING.maxConsumable;
  }
}

function pickWeightedReward(rewards: RewardDefinition[], random: RandomSource): RewardDefinition {
  const totalWeight = rewards.reduce((sum, reward) => sum + reward.weight, 0);
  let roll = random() * totalWeight;

  for (const reward of rewards) {
    roll -= reward.weight;

    if (roll <= 0) {
      return reward;
    }
  }

  return rewards[rewards.length - 1];
}
