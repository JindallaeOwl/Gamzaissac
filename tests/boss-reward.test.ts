import { describe, expect, it } from 'vitest';
import { BOSS_REWARD_ITEM_IDS } from '../src/data/bossRewards';
import { PASSIVE_ITEMS } from '../src/data/items';
import { BossRewardSystem, type BossRewardRoomState } from '../src/systems/BossRewardSystem';
import { isStatOnlyBossReward, ItemSystem } from '../src/systems/ItemSystem';

describe('boss rewards', () => {
  it('does not create a reward while the boss reward pool is empty', () => {
    const room: BossRewardRoomState = { bossRewardClaimed: false };
    const system = new BossRewardSystem(new ItemSystem(() => 0, []));

    expect(system.resolveReward(room, [])).toBeNull();
    expect(room.bossRewardItemId).toBeUndefined();
  });

  it('stores the selected item so revisiting the room restores the same reward', () => {
    const room: BossRewardRoomState = { bossRewardClaimed: false };
    const system = new BossRewardSystem(new ItemSystem(() => 0, ['pulse-relay']));

    expect(system.resolveReward(room, [])?.id).toBe('pulse-relay');
    expect(room.bossRewardItemId).toBe('pulse-relay');
    expect(system.resolveReward(room, ['pulse-relay'])?.id).toBe('pulse-relay');
  });

  it('does not restore a boss reward after it has been collected', () => {
    const room: BossRewardRoomState = {
      bossRewardClaimed: true,
      bossRewardItemId: 'pulse-relay',
    };
    const system = new BossRewardSystem(new ItemSystem(() => 0, ['pulse-relay']));

    expect(system.resolveReward(room, [])).toBeNull();
  });

  it('contains the Red Mushroom and only stat-up items in the configured boss pool', () => {
    const pool = PASSIVE_ITEMS.filter((item) => BOSS_REWARD_ITEM_IDS.includes(item.id));

    expect(pool.map((item) => item.id)).toContain('red-mushroom');
    expect(pool).toHaveLength(BOSS_REWARD_ITEM_IDS.length);
    expect(pool.every(isStatOnlyBossReward)).toBe(true);
  });

  it('rejects attack-changing passives even if their IDs are configured by mistake', () => {
    const system = new ItemSystem(() => 0, ['mega-seed', 'prism-lance', 'pulse-relay']);

    expect(system.pickBossRewardItem([])?.id).toBe('pulse-relay');
  });

  it('applies one full heart of maximum health and healing from the Red Mushroom', () => {
    const redMushroom = PASSIVE_ITEMS.find((item) => item.id === 'red-mushroom');
    const itemSystem = new ItemSystem(() => 0);

    expect(redMushroom).toBeDefined();
    const stats = itemSystem.applyItem(
      {
        health: 6,
        maxHealth: 6,
        moveSpeed: 0,
        damage: 0,
        range: 0,
        fireRate: 0,
        luck: 0,
        projectileSpeed: 0,
        damageMultiplier: 1,
        fireRateMultiplier: 1,
        projectileSpeedMultiplier: 1,
      },
      redMushroom!,
    );

    expect(stats.maxHealth).toBe(8);
    expect(stats.health).toBe(8);
  });
});
