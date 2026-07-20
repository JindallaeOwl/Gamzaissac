export type ConsumableType = 'keys' | 'bombs' | 'coins';
export type RewardKind = ConsumableType | 'heart' | 'chest';

export interface RewardDefinition {
  kind: RewardKind;
  labelKey: string;
  amountMin: number;
  amountMax: number;
  weight: number;
  tint: number;
}

export interface RewardDropTuning {
  roomClearLuckScale: number;
  roomClearMaxLuck: number;
  roomClearFiveCoinChance: number;
  chestHealChance: number;
  chestLuckBonus: number;
  crateCoinDropChance: number;
  crateFiveCoinChance: number;
}

export const REWARD_DROP_TUNING: RewardDropTuning = {
  roomClearLuckScale: 0.1,
  roomClearMaxLuck: 10,
  roomClearFiveCoinChance: 0.15,
  chestHealChance: 0.22,
  chestLuckBonus: 0.03,
  crateCoinDropChance: 0.2,
  crateFiveCoinChance: 0.15,
};

// Adapted from Rebirth's base room-clear reward ranges. The unsupported
// card/pill/trinket range (0.22~0.30) currently counts as no reward.
export const ROOM_CLEAR_REWARD_THRESHOLDS = {
  nothing: 0.3,
  coins: 0.45,
  heart: 0.6,
  keys: 0.8,
  bombs: 0.95,
} as const;

export const ROOM_CLEAR_REWARDS: RewardDefinition[] = [
  {
    kind: 'coins',
    labelKey: 'resources.coins',
    amountMin: 1,
    amountMax: 1,
    weight: 15,
    tint: 0xffd166,
  },
  {
    kind: 'heart',
    labelKey: 'resources.hearts',
    amountMin: 1,
    amountMax: 1,
    weight: 15,
    tint: 0xff5f74,
  },
  {
    kind: 'keys',
    labelKey: 'resources.keys',
    amountMin: 1,
    amountMax: 1,
    weight: 20,
    tint: 0x8bd3ff,
  },
  {
    kind: 'bombs',
    labelKey: 'resources.bombs',
    amountMin: 1,
    amountMax: 1,
    weight: 15,
    tint: 0xff8f70,
  },
  {
    kind: 'chest',
    labelKey: 'resources.chest',
    amountMin: 1,
    amountMax: 1,
    weight: 5,
    tint: 0xd6a15f,
  },
];
