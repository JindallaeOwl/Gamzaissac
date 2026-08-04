import { describe, expect, it } from 'vitest';
import {
  getAllowedSummonCount,
  getBossSummonSpawns,
  getReinforcementCount,
  getReinforcementIds,
  getReinforcementPool,
  getSplitChildSpawns,
  type SplitBounds,
} from '../src/systems/EnemyReinforcementRules';

const ROOM: SplitBounds = { left: 32, right: 448, top: 32, bottom: 240 };

describe('reinforcement count', () => {
  it('adds no reinforcements on floor 1', () => {
    expect(getReinforcementCount(1, 'combat')).toBe(0);
  });

  it('adds at least one reinforcement from floor 2, despite the fractional rounding', () => {
    // (2 - 1) * 0.8 = 0.8 -> floor 0; the guard keeps the splitter reachable.
    expect(getReinforcementCount(2, 'combat')).toBe(1);
  });

  it('keeps the original scaling on later floors and caps at four', () => {
    expect(getReinforcementCount(3, 'combat')).toBe(1);
    expect(getReinforcementCount(4, 'combat')).toBe(2);
    expect(getReinforcementCount(6, 'combat')).toBe(4);
    expect(getReinforcementCount(20, 'combat')).toBe(4);
  });

  it('never reinforces non-combat rooms', () => {
    expect(getReinforcementCount(5, 'boss')).toBe(0);
    expect(getReinforcementCount(5, 'shop')).toBe(0);
  });
});

describe('reinforcement pool', () => {
  it('excludes the splitter on floor 1', () => {
    expect(getReinforcementPool(1)).not.toContain('splitter');
  });

  it('includes the splitter from floor 2', () => {
    expect(getReinforcementPool(2)).toContain('splitter');
  });
});

describe('reinforcement line-up', () => {
  // Always picks the last candidate, which is where the capped types sit.
  const alwaysLast = () => 0.999999;

  it('keeps the Flanker out of the first two floors', () => {
    expect(getReinforcementPool(2)).not.toContain('flanker');
    expect(getReinforcementIds(2, 4, alwaysLast)).not.toContain('flanker');
    expect(getReinforcementPool(3)).toContain('flanker');
  });

  it('allows at most two Flankers in one room', () => {
    const picked = getReinforcementIds(3, 4, alwaysLast);

    expect(picked).toHaveLength(4);
    expect(picked.filter((id) => id === 'flanker')).toHaveLength(2);
  });

  it('fills the rest of the room from the uncapped types', () => {
    const picked = getReinforcementIds(6, 4, alwaysLast);

    // The cap must not shorten the line-up: every slot is still filled.
    expect(picked).toHaveLength(4);
    expect(picked.filter((id) => id !== 'flanker').length).toBeGreaterThan(0);
  });

  it('returns nothing when no reinforcements were requested', () => {
    expect(getReinforcementIds(6, 0, alwaysLast)).toEqual([]);
  });
});

describe('split child spawns', () => {
  it('produces two splitterlings when a splitter dies', () => {
    const spawns = getSplitChildSpawns('splitter', 240, 136, ROOM, () => 0);

    expect(spawns).toHaveLength(2);
    expect(spawns.every((spawn) => spawn.enemyId === 'splitterling')).toBe(true);
  });

  it('keeps every child inside the room bounds even near a wall', () => {
    const spawns = getSplitChildSpawns('splitter', ROOM.right, ROOM.top, ROOM, () => 0.99);

    for (const spawn of spawns) {
      expect(spawn.x).toBeGreaterThanOrEqual(ROOM.left);
      expect(spawn.x).toBeLessThanOrEqual(ROOM.right);
      expect(spawn.y).toBeGreaterThanOrEqual(ROOM.top);
      expect(spawn.y).toBeLessThanOrEqual(ROOM.bottom);
    }
  });

  it('does not split a splitterling, preventing an endless chain', () => {
    expect(getSplitChildSpawns('splitterling', 240, 136, ROOM, () => 0)).toHaveLength(0);
  });
});

describe('boss summon spawns', () => {
  it('spawns the requested number of the requested child', () => {
    const spawns = getBossSummonSpawns('splitterling', 3, 240, 136, ROOM, () => 0);

    expect(spawns).toHaveLength(3);
    expect(spawns.every((spawn) => spawn.enemyId === 'splitterling')).toBe(true);
  });

  it('returns nothing when the allowed count is zero or negative', () => {
    expect(getBossSummonSpawns('splitterling', 0, 240, 136, ROOM, () => 0)).toHaveLength(0);
    expect(getBossSummonSpawns('splitterling', -2, 240, 136, ROOM, () => 0)).toHaveLength(0);
  });

  it('keeps every summoned child inside the room bounds even at a corner', () => {
    const spawns = getBossSummonSpawns(
      'splitterling',
      4,
      ROOM.right,
      ROOM.bottom,
      ROOM,
      () => 0.99,
    );

    for (const spawn of spawns) {
      expect(spawn.x).toBeGreaterThanOrEqual(ROOM.left);
      expect(spawn.x).toBeLessThanOrEqual(ROOM.right);
      expect(spawn.y).toBeGreaterThanOrEqual(ROOM.top);
      expect(spawn.y).toBeLessThanOrEqual(ROOM.bottom);
    }
  });
});

describe('allowed summon count', () => {
  it('summons the full request when the room has room to spare', () => {
    expect(getAllowedSummonCount(2, 0, 5)).toBe(2);
  });

  it('only fills up to the alive cap', () => {
    expect(getAllowedSummonCount(4, 4, 5)).toBe(1);
    expect(getAllowedSummonCount(4, 0, 3)).toBe(3);
  });

  it('never returns a negative count once the cap is reached or exceeded', () => {
    expect(getAllowedSummonCount(2, 5, 5)).toBe(0);
    expect(getAllowedSummonCount(2, 6, 5)).toBe(0);
  });
});
