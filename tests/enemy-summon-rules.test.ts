import { describe, expect, it } from 'vitest';
import { WORM_KING_TUNING } from '../src/config/gameConfig';
import { ENEMY_DEFINITIONS, type EnemyId } from '../src/data/enemies';
import {
  findInvalidSummonTargets,
  getAllowedSummonCount,
  getSummonSpawns,
  resolveSummonCount,
  ROOM_SUMMON_CAP,
  shouldExecuteDeferredSummon,
  SummonOwnershipIndex,
  validateSummonTarget,
  type SummonBounds,
} from '../src/systems/EnemySummonRules';

const ROOM: SummonBounds = { left: 32, right: 448, top: 32, bottom: 240 };

/** Stand-in for an enemy: the index only ever reads `active`. */
function minion(active = true): { active: boolean } {
  return { active };
}

describe('deferred summon guard', () => {
  it('summons only while the summoner, room, and run are all still valid', () => {
    expect(
      shouldExecuteDeferredSummon({ summonerActive: true, sameRoom: true, runEnded: false }),
    ).toBe(true);
    expect(
      shouldExecuteDeferredSummon({ summonerActive: false, sameRoom: true, runEnded: false }),
    ).toBe(false);
    expect(
      shouldExecuteDeferredSummon({ summonerActive: true, sameRoom: false, runEnded: false }),
    ).toBe(false);
    expect(
      shouldExecuteDeferredSummon({ summonerActive: true, sameRoom: true, runEnded: true }),
    ).toBe(false);
  });
});

describe('summon spawn placement', () => {
  it('spreads the minions around the summoner inside the room', () => {
    const spawns = getSummonSpawns('splitterling', 3, 240, 136, ROOM, () => 0);

    expect(spawns).toHaveLength(3);
    expect(spawns.every((spawn) => spawn.enemyId === 'splitterling')).toBe(true);
    expect(new Set(spawns.map((spawn) => `${spawn.x},${spawn.y}`)).size).toBe(3);
  });

  it('spawns nothing when the allowed count is zero or negative', () => {
    expect(getSummonSpawns('splitterling', 0, 240, 136, ROOM, () => 0)).toHaveLength(0);
    expect(getSummonSpawns('splitterling', -2, 240, 136, ROOM, () => 0)).toHaveLength(0);
  });

  it('keeps minions inside the walls when the summoner hugs a corner', () => {
    const spawns = getSummonSpawns('splitterling', 4, ROOM.left, ROOM.top, ROOM, () => 0.9);
    const radius = ENEMY_DEFINITIONS.splitterling.bodyRadius;

    for (const spawn of spawns) {
      expect(spawn.x).toBeGreaterThanOrEqual(ROOM.left + radius);
      expect(spawn.y).toBeGreaterThanOrEqual(ROOM.top + radius);
    }
  });
});

describe('summon caps', () => {
  it('never returns more than requested or less than zero', () => {
    expect(getAllowedSummonCount(2, 0, 5)).toBe(2);
    expect(getAllowedSummonCount(4, 4, 5)).toBe(1);
    expect(getAllowedSummonCount(4, 0, 3)).toBe(3);
    expect(getAllowedSummonCount(2, 5, 5)).toBe(0);
    expect(getAllowedSummonCount(2, 6, 5)).toBe(0);
  });

  it('leaves the Worm King untouched by the room-wide cap', () => {
    // Its personal limit of five is above the room cap of four, so applying the
    // room cap in a boss room would silently weaken it.
    expect(WORM_KING_TUNING.maxSummonedAlive).toBeGreaterThan(ROOM_SUMMON_CAP);

    const regularSummon = resolveSummonCount({
      requested: WORM_KING_TUNING.summonCount,
      ownMinionsAlive: 3,
      ownMaxAlive: WORM_KING_TUNING.maxSummonedAlive,
      roomMinionsAlive: 3,
      isBossRoom: true,
    });
    const shed = resolveSummonCount({
      requested: WORM_KING_TUNING.phaseTwoShedCount,
      ownMinionsAlive: 0,
      ownMaxAlive: WORM_KING_TUNING.maxSummonedAlive,
      roomMinionsAlive: 0,
      isBossRoom: true,
    });

    expect(regularSummon).toBe(WORM_KING_TUNING.summonCount);
    expect(shed).toBe(WORM_KING_TUNING.phaseTwoShedCount);
  });

  it('applies the room-wide cap in an ordinary combat room', () => {
    expect(
      resolveSummonCount({
        requested: 2,
        ownMinionsAlive: 0,
        ownMaxAlive: 2,
        roomMinionsAlive: 3,
        isBossRoom: false,
      }),
    ).toBe(1);

    expect(
      resolveSummonCount({
        requested: 2,
        ownMinionsAlive: 0,
        ownMaxAlive: 2,
        roomMinionsAlive: ROOM_SUMMON_CAP,
        isBossRoom: false,
      }),
    ).toBe(0);
  });

  it('does not let one summoner eat the allowance of another', () => {
    // Same room, both at the room total of two, but B has summoned nothing yet.
    const shared = { requested: 2, ownMaxAlive: 2, roomMinionsAlive: 2, isBossRoom: false };

    expect(resolveSummonCount({ ...shared, ownMinionsAlive: 2 })).toBe(0);
    expect(resolveSummonCount({ ...shared, ownMinionsAlive: 0 })).toBe(2);
  });
});

describe('summon ownership index', () => {
  it('counts each summoner only for the minions it made', () => {
    const index = new SummonOwnershipIndex();
    const summonerA = minion();
    const summonerB = minion();
    const first = minion();
    const second = minion();

    index.remember(summonerA, first);
    index.remember(summonerA, second);

    expect(index.countMinionsOf(summonerA)).toBe(2);
    expect(index.countMinionsOf(summonerB)).toBe(0);
    expect(index.countAllMinions()).toBe(2);
  });

  it('stops counting a minion once it is gone', () => {
    const index = new SummonOwnershipIndex();
    const summoner = minion();
    const dead = minion();

    index.remember(summoner, dead);
    dead.active = false;

    expect(index.countMinionsOf(summoner)).toBe(0);
    expect(index.countAllMinions()).toBe(0);

    index.forget(dead);
    expect(index.countAllMinions()).toBe(0);
  });

  it('keeps orphaned minions against the room total after their summoner dies', () => {
    const index = new SummonOwnershipIndex();
    const summonerA = minion();
    const summonerB = minion();

    index.remember(summonerA, minion());
    index.remember(summonerA, minion());

    // A dies; its two minions are still on the floor.
    index.forget(summonerA);

    expect(index.countMinionsOf(summonerA)).toBe(0);
    expect(index.countAllMinions()).toBe(2);

    // B may still summon, but only up to the room total of four.
    expect(
      resolveSummonCount({
        requested: 4,
        ownMinionsAlive: index.countMinionsOf(summonerB),
        ownMaxAlive: 4,
        roomMinionsAlive: index.countAllMinions(),
        isBossRoom: false,
      }),
    ).toBe(2);
  });

  it('empties on a room change', () => {
    const index = new SummonOwnershipIndex();
    const summoner = minion();

    index.remember(summoner, minion());
    index.clear();

    expect(index.countAllMinions()).toBe(0);
    expect(index.countMinionsOf(summoner)).toBe(0);
  });
});

describe('summon target validation', () => {
  it('rejects targets that would multiply without bound', () => {
    // Splitters turn one kill into more enemies, so summoning them compounds.
    expect(validateSummonTarget('splitter')).toBe('splitParent');
    expect(validateSummonTarget('wriggleMass')).toBe('splitParent');
    expect(validateSummonTarget('splitterling')).toBeNull();
    expect(validateSummonTarget('chaser')).toBeNull();
  });

  it('accepts the Worm King broodling, checked against its real tuning', () => {
    // The Worm King keeps its target in WORM_KING_TUNING rather than in the
    // enemy definition, so it has to be passed in explicitly to be checked.
    const childId = WORM_KING_TUNING.summonChildId as EnemyId;

    expect(childId).toBe('splitterling');
    expect(ENEMY_DEFINITIONS[childId].summonChildId).toBeUndefined();
    expect(ENEMY_DEFINITIONS[childId].splitChildId).toBeUndefined();
    expect(validateSummonTarget(childId)).toBeNull();
  });

  it('finds no broken summon relationship in the shipped data', () => {
    expect(
      findInvalidSummonTargets(ENEMY_DEFINITIONS, [
        { summonerId: 'wormKing', childId: WORM_KING_TUNING.summonChildId as EnemyId },
      ]),
    ).toEqual([]);
  });

  it('reports a broken relationship when one is introduced', () => {
    expect(
      findInvalidSummonTargets(ENEMY_DEFINITIONS, [
        { summonerId: 'wormKing', childId: 'splitter' },
      ]),
    ).toEqual([{ summonerId: 'wormKing', childId: 'splitter', reason: 'splitParent' }]);
  });
});
