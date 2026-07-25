import { ENEMY_DEFINITIONS, type EnemyId } from '../data/enemies';
import type { RoomType } from '../data/rooms';
import type { RandomSource } from '../utils/random';

const BASE_REINFORCEMENT_POOL: readonly EnemyId[] = ['chaser', 'shooter', 'dasher'];
const MAX_REINFORCEMENTS = 4;

/**
 * Number of extra enemies added to a combat room on top of its template spawn
 * set. Reinforcements begin on floor 2. Note that `(floor - 1) * 0.8` floors to
 * 0 on floor 2, so without the `Math.max(1, ...)` guard the first reinforcement
 * (and therefore the splitter) would not appear until floor 3.
 */
export function getReinforcementCount(floor: number, roomType: RoomType): number {
  if (roomType !== 'combat' || floor < 2) {
    return 0;
  }

  return Math.max(1, Math.min(MAX_REINFORCEMENTS, Math.floor((floor - 1) * 0.8)));
}

/** Enemy types eligible as reinforcements. The splitter joins from floor 2. */
export function getReinforcementPool(floor: number): EnemyId[] {
  return floor >= 2 ? [...BASE_REINFORCEMENT_POOL, 'splitter'] : [...BASE_REINFORCEMENT_POOL];
}

export interface SplitBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SplitChildSpawn {
  enemyId: EnemyId;
  x: number;
  y: number;
}

/**
 * Positions for the children a defeated enemy splits into. Returns an empty list
 * for enemies that do not split (e.g. the splitterling), which prevents an
 * endless split chain. Children are spread around the parent and clamped inside
 * the room bounds.
 */
export function getSplitChildSpawns(
  parentId: EnemyId,
  parentX: number,
  parentY: number,
  bounds: SplitBounds,
  random: RandomSource,
): SplitChildSpawn[] {
  const definition = ENEMY_DEFINITIONS[parentId];
  const childId = definition.splitChildId;

  if (!childId) {
    return [];
  }

  const childCount = definition.splitChildCount ?? 2;
  const childRadius = ENEMY_DEFINITIONS[childId].bodyRadius;
  const spread = definition.bodyRadius + childRadius;
  const spawns: SplitChildSpawn[] = [];

  for (let i = 0; i < childCount; i += 1) {
    const angle = (Math.PI * 2 * i) / childCount + random() * Math.PI * 0.5;
    const x = clamp(
      parentX + Math.cos(angle) * spread,
      bounds.left + childRadius + 2,
      bounds.right - childRadius - 2,
    );
    const y = clamp(
      parentY + Math.sin(angle) * spread,
      bounds.top + childRadius + 2,
      bounds.bottom - childRadius - 2,
    );
    spawns.push({ enemyId: childId, x, y });
  }

  return spawns;
}

/**
 * Positions for enemies a boss summons mid-fight (e.g. the Worm King's
 * broodlings). Like {@link getSplitChildSpawns} the children are spread in a
 * jittered ring around the boss and clamped inside the room. `count` is the
 * number actually requested after any alive-cap has been applied by the caller,
 * so a non-positive count yields no spawns.
 */
export function getBossSummonSpawns(
  childId: EnemyId,
  count: number,
  originX: number,
  originY: number,
  bounds: SplitBounds,
  random: RandomSource,
): SplitChildSpawn[] {
  if (count <= 0) {
    return [];
  }

  const childRadius = ENEMY_DEFINITIONS[childId].bodyRadius;
  const spread = childRadius * 2 + 6;
  const spawns: SplitChildSpawn[] = [];

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
 * How many summons may actually spawn given a per-boss cap and the number of
 * adds already alive. Never negative, never more than requested. Keeping this a
 * pure function lets the alive-cap be unit tested without a live scene.
 */
export function getAllowedSummonCount(
  requested: number,
  aliveAdds: number,
  maxAlive: number,
): number {
  return Math.max(0, Math.min(requested, maxAlive - aliveAdds));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
