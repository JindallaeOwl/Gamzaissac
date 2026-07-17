import { describe, expect, it } from 'vitest';
import { PASSIVE_ITEMS } from '../src/data/items';
import { ItemSystem } from '../src/systems/ItemSystem';
import { createInitialRunState } from '../src/systems/RunState';

describe('ItemSystem', () => {
  it('applies stat and attack-profile modifiers without mutating the originals', () => {
    const state = createInitialRunState();
    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === 'quad-shot');
    const system = new ItemSystem(() => 0);

    expect(item).toBeDefined();
    const stats = system.applyItem(state.stats, item!);
    const profile = system.applyAttackProfile(state.attackProfile, item!);

    expect(profile.seedCount).toBe(4);
    expect(profile.extraForeheadEyeCount).toBe(2);
    expect(stats.fireRateMultiplier).toBeCloseTo(0.42);
    expect(state.attackProfile.seedCount).toBe(1);
    expect(state.stats.fireRateMultiplier).toBe(1);
  });

  it('selects an unseen item from the regular reward pool', () => {
    const system = new ItemSystem(() => 0);

    expect(system.pickRewardItem(['quad-shot']).id).toBe('mega-seed');
  });

  it('can select the Prism Lance only from the treasure pool', () => {
    const pickLast = () => 0.999999;
    const system = new ItemSystem(pickLast);

    expect(system.pickRewardItem([]).id).not.toBe('prism-lance');
    expect(system.pickTreasureItem([]).id).toBe('prism-lance');
  });

  it('updates the run state when an item is acquired', () => {
    const state = createInitialRunState();
    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === 'quad-shot');
    const system = new ItemSystem(() => 0);

    expect(item).toBeDefined();
    expect(system.acquireItem(state, item!)).toEqual({});
    expect(state.collectedItemIds).toEqual(['quad-shot']);
    expect(state.attackProfile.seedCount).toBe(4);
    expect(state.stats.fireRateMultiplier).toBeCloseTo(0.42);
  });

  it('unlocks an item ability only once', () => {
    const state = createInitialRunState();
    const prismLance = PASSIVE_ITEMS.find((candidate) => candidate.id === 'prism-lance');
    const system = new ItemSystem(() => 0);

    expect(prismLance).toBeDefined();
    expect(system.acquireItem(state, prismLance!)).toEqual({
      newlyUnlockedAbilityId: 'charge-beam',
    });
    expect(system.acquireItem(state, prismLance!)).toEqual({});
    expect(state.unlockedAbilityIds).toEqual(['charge-beam']);
    expect(state.collectedItemIds).toEqual(['prism-lance', 'prism-lance']);
  });
});
