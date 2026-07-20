import {
  INVENTORY_TUNING,
  PLAYER_HEALTH_UNITS_PER_HEART,
  type PlayerStats,
} from '../config/gameConfig';
import {
  REWARD_DROP_TUNING,
  ROOM_CLEAR_REWARD_THRESHOLDS,
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
  appearance?: 'five-coin';
}

export type ChestResult =
  | { type: 'heal'; amount: number }
  | { type: 'consumable'; consumable: ConsumableType; amount: number };

export type RewardPickupResult =
  | { collected: false; type: 'resource-full' | 'health-full'; labelKey: string }
  | { collected: true; type: 'chest'; chestResult: ChestResult }
  | { collected: true; type: 'health'; amount: number; labelKey: string }
  | { collected: true; type: 'consumable'; amount: number; labelKey: string };

export class RewardSystem {
  constructor(private readonly random: RandomSource = Math.random) {}

  rollRoomClearReward(stats: PlayerStats): RewardDrop | null {
    const luck = clamp(stats.luck, 0, REWARD_DROP_TUNING.roomClearMaxLuck);
    const roll = this.random() + this.random() * luck * REWARD_DROP_TUNING.roomClearLuckScale;

    if (roll < ROOM_CLEAR_REWARD_THRESHOLDS.nothing) {
      return null;
    }

    const kind: RewardKind =
      roll < ROOM_CLEAR_REWARD_THRESHOLDS.coins
        ? 'coins'
        : roll < ROOM_CLEAR_REWARD_THRESHOLDS.heart
          ? 'heart'
          : roll < ROOM_CLEAR_REWARD_THRESHOLDS.keys
            ? 'keys'
            : roll < ROOM_CLEAR_REWARD_THRESHOLDS.bombs
              ? 'bombs'
              : 'chest';
    const reward = ROOM_CLEAR_REWARDS.find((candidate) => candidate.kind === kind);

    if (!reward) {
      return null;
    }

    if (kind === 'coins') {
      const isFiveCoin = this.random() < REWARD_DROP_TUNING.roomClearFiveCoinChance;

      return {
        kind,
        amount: isFiveCoin ? 5 : 1,
        labelKey: reward.labelKey,
        tint: reward.tint,
        appearance: isFiveCoin ? 'five-coin' : undefined,
      };
    }

    return {
      kind,
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
      ROOM_CLEAR_REWARDS.filter((reward) => reward.kind !== 'chest' && reward.kind !== 'heart'),
      this.random,
    ).kind as ConsumableType;

    return {
      type: 'consumable',
      consumable,
      amount: consumable === 'coins' ? randomInt(4, 10, this.random) : randomInt(1, 2, this.random),
    };
  }

  rollDestroyedCrateCoinDrop(): RewardDrop | null {
    if (this.random() >= REWARD_DROP_TUNING.crateCoinDropChance) {
      return null;
    }

    const isFiveCoin = this.random() < REWARD_DROP_TUNING.crateFiveCoinChance;

    return {
      kind: 'coins',
      amount: isFiveCoin ? 5 : 1,
      labelKey: 'resources.coins',
      tint: 0xffffff,
      appearance: isFiveCoin ? 'five-coin' : undefined,
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

    if (reward.kind === 'heart') {
      if (runState.stats.health >= runState.stats.maxHealth) {
        return { collected: false, type: 'health-full', labelKey: reward.labelKey };
      }

      runState.stats.health = clamp(
        runState.stats.health + reward.amount * PLAYER_HEALTH_UNITS_PER_HEART,
        0,
        runState.stats.maxHealth,
      );
      return {
        collected: true,
        type: 'health',
        amount: reward.amount,
        labelKey: reward.labelKey,
      };
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
