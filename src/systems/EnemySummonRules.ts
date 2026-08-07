import { ENEMY_DEFINITIONS, type EnemyDefinition, type EnemyId } from '../data/enemies';
import type { RandomSource } from '../utils/random';

/**
 * Rules shared by every enemy that summons help mid-fight.
 *
 * These started out on the Worm King, but summoning is not a boss-only idea, so
 * they live here and take a neutral vocabulary — "summoner" rather than "boss".
 * All of it is plain maths and data so it can be unit tested without a scene.
 */

export interface SummonBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SummonSpawn {
  enemyId: EnemyId;
  x: number;
  y: number;
}

/** Cap on summoned minions alive at once in an ordinary combat room. */
export const ROOM_SUMMON_CAP = 4;

/**
 * Whether a deferred summon should still run.
 *
 * The request is queued from inside the enemy update loop and executed a tick
 * later, by which time the summoner may be dead, the player may have left, or
 * the run may have ended.
 */
export function shouldExecuteDeferredSummon(context: {
  summonerActive: boolean;
  sameRoom: boolean;
  runEnded: boolean;
}): boolean {
  return context.summonerActive && context.sameRoom && !context.runEnded;
}

/**
 * Positions for the minions a summoner calls in: spread in a jittered ring
 * around it and clamped inside the room. `count` is the number left after the
 * caps have been applied, so a non-positive count yields no spawns.
 */
export function getSummonSpawns(
  childId: EnemyId,
  count: number,
  originX: number,
  originY: number,
  bounds: SummonBounds,
  random: RandomSource,
): SummonSpawn[] {
  if (count <= 0) {
    return [];
  }

  const childRadius = ENEMY_DEFINITIONS[childId].bodyRadius;
  const spread = childRadius * 2 + 6;
  const spawns: SummonSpawn[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + random() * Math.PI * 0.5;
    const x = clamp(
      originX + Math.cos(angle) * spread,
      bounds.left + childRadius + 2,
      bounds.right - childRadius - 2,
    );
    const y = clamp(
      originY + Math.sin(angle) * spread,
      bounds.top + childRadius + 2,
      bounds.bottom - childRadius - 2,
    );
    spawns.push({ enemyId: childId, x, y });
  }

  return spawns;
}

/**
 * How many summons may spawn given a cap and how many already count against it.
 * Never negative, never more than requested. Applied twice by the caller: once
 * for the summoner's own limit, once for the room-wide safety limit.
 */
export function getAllowedSummonCount(
  requested: number,
  aliveAdds: number,
  maxAlive: number,
): number {
  return Math.max(0, Math.min(requested, maxAlive - aliveAdds));
}

/**
 * The final number to spawn, after both caps.
 *
 * Boss rooms skip the room-wide cap on purpose: the Worm King is tuned to keep
 * five broodlings alive, and a room cap of four would quietly weaken it.
 */
export function resolveSummonCount(params: {
  requested: number;
  ownMinionsAlive: number;
  ownMaxAlive: number;
  roomMinionsAlive: number;
  isBossRoom: boolean;
  roomCap?: number;
}): number {
  const ownAllowance = getAllowedSummonCount(
    params.requested,
    params.ownMinionsAlive,
    params.ownMaxAlive,
  );

  if (params.isBossRoom) {
    return ownAllowance;
  }

  return getAllowedSummonCount(
    ownAllowance,
    params.roomMinionsAlive,
    params.roomCap ?? ROOM_SUMMON_CAP,
  );
}

/**
 * Who summoned whom, so each summoner is charged only for its own minions.
 *
 * Kept free of Phaser types — anything with an `active` flag works — so the
 * counting can be tested without a scene.
 */
export class SummonOwnershipIndex<T extends { active: boolean }> {
  private readonly minionsByOwner = new Map<T, Set<T>>();
  private readonly ownerOfMinion = new Map<T, T>();

  remember(owner: T, minion: T): void {
    const owned = this.minionsByOwner.get(owner) ?? new Set<T>();

    owned.add(minion);
    this.minionsByOwner.set(owner, owned);
    this.ownerOfMinion.set(minion, owner);
  }

  /**
   * Drops an entity from the index, whichever role it held.
   *
   * A summoner can die while its minions live on. Their reverse entries then
   * point at a dead owner, which is harmless — the forward set is gone, so the
   * lookup finds nothing when they die in turn — and they keep counting toward
   * the room total, which is the point.
   */
  forget(entity: T): void {
    const owner = this.ownerOfMinion.get(entity);

    if (owner) {
      this.minionsByOwner.get(owner)?.delete(entity);
      this.ownerOfMinion.delete(entity);
    }

    this.minionsByOwner.delete(entity);
  }

  countMinionsOf(owner: T): number {
    let alive = 0;

    for (const minion of this.minionsByOwner.get(owner) ?? []) {
      if (minion.active) {
        alive += 1;
      }
    }

    return alive;
  }

  /**
   * Every summoned minion still alive. Counted from the reverse index rather
   * than by summing owners' sets, so minions outlive their summoner's entry.
   */
  countAllMinions(): number {
    let alive = 0;

    for (const minion of this.ownerOfMinion.keys()) {
      if (minion.active) {
        alive += 1;
      }
    }

    return alive;
  }

  clear(): void {
    this.minionsByOwner.clear();
    this.ownerOfMinion.clear();
  }
}

export type InvalidSummonReason = 'summoner' | 'splitParent';

export interface InvalidSummonTarget {
  summonerId: string;
  childId: EnemyId;
  reason: InvalidSummonReason;
}

/**
 * Why a summon target is unusable, or null when it is fine.
 *
 * Summoning another summoner multiplies without bound, and summoning something
 * that splits on death turns one kill into a growing crowd. Both are checked
 * against the definitions rather than assumed.
 */
export function validateSummonTarget(
  childId: EnemyId,
  definitions: Record<EnemyId, EnemyDefinition> = ENEMY_DEFINITIONS,
): InvalidSummonReason | null {
  const child = definitions[childId];

  if (child.summonChildId) {
    return 'summoner';
  }

  if (child.splitChildId) {
    return 'splitParent';
  }

  return null;
}

/**
 * Checks every summon relationship in the game and reports the broken ones.
 *
 * `extraPairs` exists because not every summoner keeps its target in
 * EnemyDefinition — the Worm King reads its own from WORM_KING_TUNING — and a
 * check that silently skipped it would give false confidence.
 */
export function findInvalidSummonTargets(
  definitions: Record<EnemyId, EnemyDefinition> = ENEMY_DEFINITIONS,
  extraPairs: readonly { summonerId: string; childId: EnemyId }[] = [],
): InvalidSummonTarget[] {
  const pairs: { summonerId: string; childId: EnemyId }[] = [];

  for (const definition of Object.values(definitions)) {
    if (definition.summonChildId) {
      pairs.push({ summonerId: definition.id, childId: definition.summonChildId });
    }
  }

  pairs.push(...extraPairs);

  return pairs.flatMap((pair) => {
    const reason = validateSummonTarget(pair.childId, definitions);

    return reason ? [{ ...pair, reason }] : [];
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
