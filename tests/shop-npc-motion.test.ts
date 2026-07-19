import { describe, expect, it } from 'vitest';
import {
  clampShopNpcToHome,
  getShopNpcPushVelocity,
  getShopNpcReturnVelocity,
  SHOP_NPC_MAX_DISPLACEMENT,
  SHOP_NPC_PUSH_SPEED,
  SHOP_NPC_RETURN_SPEED,
} from '../src/systems/ShopNpcMotion';

describe('shop NPC motion', () => {
  it('pushes directly away from the player at the heavy push speed', () => {
    expect(getShopNpcPushVelocity(10, 10, 5, 10)).toEqual({
      x: SHOP_NPC_PUSH_SPEED,
      y: 0,
    });
  });

  it('moves directly back toward its home position', () => {
    expect(getShopNpcReturnVelocity(15, 10, 10, 10)).toEqual({
      x: -SHOP_NPC_RETURN_SPEED,
      y: 0,
    });
  });

  it('limits displacement to a very short distance', () => {
    expect(clampShopNpcToHome(20, 10, 10, 10)).toEqual({
      x: 10 + SHOP_NPC_MAX_DISPLACEMENT,
      y: 10,
    });
  });

  it('does not invent a direction for perfectly overlapping positions', () => {
    expect(getShopNpcPushVelocity(10, 10, 10, 10)).toBeNull();
  });
});
