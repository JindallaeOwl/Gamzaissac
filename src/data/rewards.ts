export type ConsumableType = 'keys' | 'bombs' | 'coins';
export type RewardKind = ConsumableType | 'chest';

export interface RewardDefinition {
  kind: RewardKind;
  labelKey: string;
  amountMin: number;
  amountMax: number;
  weight: number;
  tint: number;
}

export interface RewardDropTuning {
  baseRoomClearChance: number;
  luckChanceBonus: number;
  maxRoomClearChance: number;
  chestHealChance: number;
  chestLuckBonus: number;
}

export const REWARD_DROP_TUNING: RewardDropTuning = {
  baseRoomClearChance: 0.38,
  luckChanceBonus: 0.025,
  maxRoomClearChance: 0.72,
  chestHealChance: 0.22,
  chestLuckBonus: 0.03,
};

export const ROOM_CLEAR_REWARDS: RewardDefinition[] = [
  {
    kind: 'coins',
    labelKey: 'resources.coins',
    amountMin: 2,
    amountMax: 6,
    weight: 48,
    tint: 0xffd166,
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
    amountMax: 2,
    weight: 20,
    tint: 0xff8f70,
  },
  {
    kind: 'chest',
    labelKey: 'resources.chest',
    amountMin: 1,
    amountMax: 1,
    weight: 12,
    tint: 0xd6a15f,
  },
];
