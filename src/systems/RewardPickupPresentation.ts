import { TextureKeys } from '../config/assets';
import type { RewardDrop } from './RewardSystem';

export interface RewardPickupPresentation {
  textureKey: string;
  scale: number;
  bodyRadius: number;
  tint: number | null;
}

export const ONE_COIN_TINT = 0xffd166;
export const FIVE_COIN_TINT = 0xa8adb7;

export function getRewardPickupPresentation(reward: RewardDrop): RewardPickupPresentation {
  if (reward.kind === 'heart') {
    return {
      textureKey: TextureKeys.hudHeart,
      scale: 1,
      bodyRadius: 8,
      tint: null,
    };
  }

  if (reward.kind === 'keys') {
    return {
      textureKey: TextureKeys.keyPickup,
      scale: 0.5,
      bodyRadius: 10,
      tint: reward.tint,
    };
  }

  if (reward.kind === 'bombs') {
    return {
      textureKey: TextureKeys.hudBomb,
      scale: 1,
      bodyRadius: 8,
      tint: null,
    };
  }

  if (reward.kind === 'coins' && reward.appearance !== 'five-coin') {
    return {
      textureKey: TextureKeys.hudCoin,
      scale: 1,
      bodyRadius: 8,
      tint: ONE_COIN_TINT,
    };
  }

  if (reward.kind === 'coins') {
    return {
      textureKey: TextureKeys.hudCoin,
      scale: 1,
      bodyRadius: 8,
      tint: FIVE_COIN_TINT,
    };
  }

  return {
    textureKey: TextureKeys.chestPickup,
    scale: 0.7,
    bodyRadius: 13,
    tint: null,
  };
}
