import { describe, expect, it } from 'vitest';
import { findItemByReference, formatItemNumber, PASSIVE_ITEMS } from '../src/data/items';
import { ItemSystem } from '../src/systems/ItemSystem';
import { createInitialRunState } from '../src/systems/RunState';

describe('ItemSystem', () => {
  it('assigns unique shared catalog numbers with three-digit display labels', () => {
    const itemNumbers = PASSIVE_ITEMS.map((item) => item.itemNumber);

    expect(new Set(itemNumbers).size).toBe(PASSIVE_ITEMS.length);
    expect(itemNumbers.every((itemNumber) => Number.isInteger(itemNumber) && itemNumber > 0)).toBe(
      true,
    );
    expect(formatItemNumber(1)).toBe('ID: 001');
    expect(formatItemNumber(13)).toBe('ID: 013');
    expect(findItemByReference('001')?.id).toBe('red-mushroom');
    expect(findItemByReference('13')?.id).toBe('prism-lance');
    expect(findItemByReference('quad-shot')?.itemNumber).toBe(2);
  });

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

  it.each([
    ['quad-shot', 'prism-lance'],
    ['prism-lance', 'quad-shot'],
  ])('keeps the four-way beam synergy when acquired as %s then %s', (firstId, secondId) => {
    const state = createInitialRunState();
    const system = new ItemSystem(() => 0);
    const first = PASSIVE_ITEMS.find((item) => item.id === firstId);
    const second = PASSIVE_ITEMS.find((item) => item.id === secondId);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    system.acquireItem(state, first!);
    system.acquireItem(state, second!);

    expect(state.attackProfile.seedCount).toBe(4);
    expect(state.attackProfile.spreadStepDegrees).toBe(12);
    expect(state.unlockedAbilityIds).toContain('charge-beam');
  });
});
