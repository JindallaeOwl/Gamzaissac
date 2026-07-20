import { describe, expect, it } from 'vitest';
import { RewardSystem } from '../src/systems/RewardSystem';
import { createInitialRunState } from '../src/systems/RunState';

describe('RewardSystem', () => {
  it('uses the adapted Rebirth room-clear reward ranges at zero luck', () => {
    const cases = [
      { roll: 0.29, expected: null },
      { roll: 0.3, expected: { kind: 'coins', amount: 1 } },
      { roll: 0.45, expected: { kind: 'heart', amount: 1 } },
      { roll: 0.6, expected: { kind: 'keys', amount: 1 } },
      { roll: 0.8, expected: { kind: 'bombs', amount: 1 } },
      { roll: 0.95, expected: { kind: 'chest', amount: 1 } },
    ] as const;

    for (const testCase of cases) {
      const rolls = [testCase.roll, 0, 0.9];
      const system = new RewardSystem(() => rolls.shift() ?? 0.9);
      const reward = system.rollRoomClearReward(createInitialRunState().stats);

      if (testCase.expected === null) {
        expect(reward).toBeNull();
      } else {
        expect(reward).toMatchObject(testCase.expected);
      }
    }
  });

  it('drops only a yellow one-coin or gray five-coin pickup', () => {
    const oneCoinRolls = [0.3, 0, 0.9];
    const fiveCoinRolls = [0.3, 0, 0.1];

    expect(
      new RewardSystem(() => oneCoinRolls.shift() ?? 0.9).rollRoomClearReward(
        createInitialRunState().stats,
      ),
    ).toMatchObject({ kind: 'coins', amount: 1, appearance: undefined });
    expect(
      new RewardSystem(() => fiveCoinRolls.shift() ?? 0.9).rollRoomClearReward(
        createInitialRunState().stats,
      ),
    ).toMatchObject({ kind: 'coins', amount: 5, appearance: 'five-coin' });
  });

  it('lets positive luck push a low roll toward a better reward', () => {
    const state = createInitialRunState();
    state.stats.luck = 10;
    const rolls = [0.2, 0.8, 0];

    expect(
      new RewardSystem(() => rolls.shift() ?? 0).rollRoomClearReward(state.stats),
    ).toMatchObject({ kind: 'chest', amount: 1 });
  });

  it('can deterministically choose a chest heal', () => {
    const system = new RewardSystem(() => 0);

    expect(system.rollChestResult(createInitialRunState().stats)).toEqual({
      type: 'heal',
      amount: 1,
    });
  });

  it('usually drops one coin when a destroyed crate passes its drop roll', () => {
    const rolls = [0.1, 0.9];
    const system = new RewardSystem(() => rolls.shift() ?? 0);

    expect(system.rollDestroyedCrateCoinDrop()).toEqual({
      kind: 'coins',
      amount: 1,
      labelKey: 'resources.coins',
      tint: 0xffffff,
      appearance: undefined,
    });
  });

  it('can drop the rare black five-coin pickup from a destroyed crate', () => {
    const rolls = [0.1, 0.1];
    const system = new RewardSystem(() => rolls.shift() ?? 0);

    expect(system.rollDestroyedCrateCoinDrop()).toEqual({
      kind: 'coins',
      amount: 5,
      labelKey: 'resources.coins',
      tint: 0xffffff,
      appearance: 'five-coin',
    });
  });

  it('can produce no coin when a destroyed crate misses its drop roll', () => {
    const system = new RewardSystem(() => 0.9);

    expect(system.rollDestroyedCrateCoinDrop()).toBeNull();
  });

  it('adds a consumable pickup to the run inventory', () => {
    const state = createInitialRunState();
    const system = new RewardSystem(() => 0);

    expect(
      system.applyPickup(state, {
        kind: 'coins',
        amount: 4,
        labelKey: 'resources.coins',
        tint: 0,
      }),
    ).toEqual({
      collected: true,
      type: 'consumable',
      amount: 4,
      labelKey: 'resources.coins',
    });
    expect(state.inventory.coins).toBe(4);
  });

  it('leaves a full consumable pickup on the floor', () => {
    const state = createInitialRunState();
    state.inventory.bombs = 99;
    const system = new RewardSystem(() => 0);

    expect(
      system.applyPickup(state, {
        kind: 'bombs',
        amount: 1,
        labelKey: 'resources.bombs',
        tint: 0,
      }),
    ).toEqual({
      collected: false,
      type: 'resource-full',
      labelKey: 'resources.bombs',
    });
    expect(state.inventory.bombs).toBe(99);
  });

  it('heals one heart and leaves the pickup when health is already full', () => {
    const state = createInitialRunState();
    const system = new RewardSystem(() => 0);
    state.stats.health -= 2;
    const heart = {
      kind: 'heart' as const,
      amount: 1,
      labelKey: 'resources.hearts',
      tint: 0,
    };

    expect(system.applyPickup(state, heart)).toEqual({
      collected: true,
      type: 'health',
      amount: 1,
      labelKey: 'resources.hearts',
    });
    expect(state.stats.health).toBe(state.stats.maxHealth);

    state.stats.health = state.stats.maxHealth;
    expect(system.applyPickup(state, heart)).toEqual({
      collected: false,
      type: 'health-full',
      labelKey: 'resources.hearts',
    });
  });

  it('applies a chest heal directly to the run state', () => {
    const state = createInitialRunState();
    state.stats.health = 2;
    const system = new RewardSystem(() => 0);

    expect(
      system.applyPickup(state, {
        kind: 'chest',
        amount: 1,
        labelKey: 'resources.chest',
        tint: 0,
      }),
    ).toEqual({
      collected: true,
      type: 'chest',
      chestResult: { type: 'heal', amount: 1 },
    });
    expect(state.stats.health).toBe(3);
  });
});
