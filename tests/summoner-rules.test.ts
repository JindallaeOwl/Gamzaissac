import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../src/data/enemies';
import { ROOM_SUMMON_CAP, validateSummonTarget } from '../src/systems/EnemySummonRules';
import {
  getNextTelegraphAt,
  KEEP_AWAY_APPROACH_MARGIN,
  KEEP_AWAY_RETREAT_MARGIN,
  resolveKeepAwayMove,
} from '../src/systems/SummonerRules';

const KEEP_AWAY = 150;

describe('summoner spacing', () => {
  it('backs off when the player closes in and follows when they run', () => {
    expect(resolveKeepAwayMove(KEEP_AWAY - KEEP_AWAY_RETREAT_MARGIN - 1, KEEP_AWAY)).toBe(
      'retreat',
    );
    expect(resolveKeepAwayMove(KEEP_AWAY + KEEP_AWAY_APPROACH_MARGIN + 1, KEEP_AWAY)).toBe(
      'approach',
    );
  });

  it('holds a dead band so it cannot flip between the two every frame', () => {
    expect(resolveKeepAwayMove(KEEP_AWAY, KEEP_AWAY)).toBe('strafe');
    expect(resolveKeepAwayMove(KEEP_AWAY - KEEP_AWAY_RETREAT_MARGIN, KEEP_AWAY)).toBe('strafe');
    expect(resolveKeepAwayMove(KEEP_AWAY + KEEP_AWAY_APPROACH_MARGIN, KEEP_AWAY)).toBe('strafe');
  });
});

describe('summon cadence', () => {
  const summoner = ENEMY_DEFINITIONS.summoner;
  const cooldown = summoner.summonCooldownMs!;
  const telegraph = summoner.summonTelegraphMs!;

  it('lands one summon exactly a cooldown after the last', () => {
    const emitAt = 10_000;
    const nextTelegraphAt = getNextTelegraphAt(emitAt, cooldown, telegraph);

    // The telegraph runs before the summon, so it has to be paid for out of the
    // cooldown rather than added on top of it.
    expect(nextTelegraphAt + telegraph).toBe(emitAt + cooldown);
    expect(nextTelegraphAt).toBe(emitAt + cooldown - telegraph);
  });

  it('starts the next telegraph at once when it is longer than the cooldown', () => {
    const emitAt = 500;

    expect(getNextTelegraphAt(emitAt, 200, 900)).toBe(emitAt);
    expect(getNextTelegraphAt(emitAt, 900, 900)).toBe(emitAt);
  });

  it('leaves room for the recovery inside the cooldown', () => {
    // Recovery is part of the gap between summons, not extra time on top.
    expect(telegraph + summoner.summonRecoveryMs!).toBeLessThan(cooldown);
  });
});

describe('summoner data', () => {
  const summoner = ENEMY_DEFINITIONS.summoner;

  it('summons something that cannot multiply on its own', () => {
    expect(summoner.summonChildId).toBe('splitterling');
    expect(validateSummonTarget(summoner.summonChildId!)).toBeNull();
  });

  it('keeps its personal cap within the room-wide cap', () => {
    // Two summoners at their personal cap must not exceed what the room allows.
    expect(summoner.summonMaxAlive!).toBeLessThanOrEqual(ROOM_SUMMON_CAP);
    expect(summoner.summonCount!).toBeLessThanOrEqual(summoner.summonMaxAlive!);
  });

  it('stands further back than the shooter', () => {
    expect(summoner.keepAwayDistance!).toBeGreaterThan(ENEMY_DEFINITIONS.shooter.keepAwayDistance!);
  });
});
