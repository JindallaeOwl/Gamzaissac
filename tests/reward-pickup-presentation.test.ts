import { describe, expect, it } from 'vitest';
import { TextureKeys } from '../src/config/assets';
import {
  FIVE_COIN_TINT,
  getRewardPickupPresentation,
  ONE_COIN_TINT,
} from '../src/systems/RewardPickupPresentation';
import type { RewardDrop } from '../src/systems/RewardSystem';

function reward(overrides: Partial<RewardDrop>): RewardDrop {
  return {
    kind: 'coins',
    amount: 1,
    labelKey: 'resources.coins',
    tint: 0xffffff,
    ...overrides,
  };
}

describe('reward pickup presentation', () => {
  it('reuses the HUD heart artwork for room-clear hearts', () => {
    expect(getRewardPickupPresentation(reward({ kind: 'heart' }))).toMatchObject({
      textureKey: TextureKeys.hudHeart,
      scale: 1,
      tint: null,
    });
  });

  it('reuses the 1-bit HUD artwork for bombs and one-coin pickups', () => {
    expect(getRewardPickupPresentation(reward({ kind: 'bombs' }))).toMatchObject({
      textureKey: TextureKeys.hudBomb,
      scale: 1,
      tint: null,
    });
    expect(getRewardPickupPresentation(reward({ kind: 'coins', amount: 1 }))).toMatchObject({
      textureKey: TextureKeys.hudCoin,
      scale: 1,
      tint: ONE_COIN_TINT,
    });
  });

  it('reuses the 1-bit coin artwork with a gray tint for five coins', () => {
    expect(
      getRewardPickupPresentation(reward({ kind: 'coins', amount: 5, appearance: 'five-coin' })),
    ).toMatchObject({
      textureKey: TextureKeys.hudCoin,
      scale: 1,
      tint: FIVE_COIN_TINT,
    });
  });
});
