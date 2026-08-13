import { ENEMY_DEFINITIONS, type EnemyId } from '../data/enemies';
import type { RoomType } from '../data/rooms';
import { randomOf, type RandomSource } from '../utils/random';

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

/**
 * Floor a reinforcement type first appears on, and how many of it one room may
 * hold. Behaviour-heavy enemies are capped so a single room cannot turn into a
 * pack of them; the basic three stay uncapped.
 */
const REINFORCEMENT_ENTRIES: readonly {
  id: EnemyId;
  fromFloor: number;
  maxPerRoom?: number;
}[] = [
  { id: 'chaser', fromFloor: 1 },
  { id: 'shooter', fromFloor: 1 },
  { id: 'dasher', fromFloor: 1 },
  { id: 'splitter', fromFloor: 2 },
  { id: 'flanker', fromFloor: 3, maxPerRoom: 2 },
  { id: 'summoner', fromFloor: 5, maxPerRoom: 1 },
];

/** 이 적이 등장할 수 있는 가장 이른 층. 목록에 없는 적은 1층부터로 본다.
    방 템플릿의 minFloor 검증(테스트)이 이 값을 기준으로 삼는다. */
export function getEnemyEarliestFloor(enemyId: EnemyId): number {
  return REINFORCEMENT_ENTRIES.find((entry) => entry.id === enemyId)?.fromFloor ?? 1;
}

/** 방당 최대 마리 수. 상한이 없는 적은 Infinity. */
export function getEnemyMaxPerRoom(enemyId: EnemyId): number {
  return (
    REINFORCEMENT_ENTRIES.find((entry) => entry.id === enemyId)?.maxPerRoom ??
    Number.POSITIVE_INFINITY
  );
}

/** Enemy types eligible as reinforcements on a floor, ignoring per-room caps. */
export function getReinforcementPool(floor: number): EnemyId[] {
  return REINFORCEMENT_ENTRIES.filter((entry) => floor >= entry.fromFloor).map((entry) => entry.id);
}

/**
 * The actual reinforcement line-up for one room.
 *
 * Picking `count` times from {@link getReinforcementPool} would let the same
 * type come up repeatedly, so a capped type is dropped from this room's
 * candidates once it hits its limit. The basic three have no cap and keep the
 * pool from ever emptying.
 */
export function getReinforcementIds(
  floor: number,
  count: number,
  random: RandomSource,
  // 방 템플릿이 이미 고정 배치한 적들. 방당 상한은 배치 출처와 무관하게 방 전체
  // 기준이므로, 템플릿의 소환사 1을 모르면 증원이 둘째를 뽑아 상한이 깨진다.
  alreadyPresent: readonly EnemyId[] = [],
): EnemyId[] {
  const candidates = REINFORCEMENT_ENTRIES.filter((entry) => floor >= entry.fromFloor);
  const remaining = new Map<EnemyId, number>(
    candidates.map((entry) => {
      const used = alreadyPresent.filter((id) => id === entry.id).length;

      return [entry.id, (entry.maxPerRoom ?? Number.POSITIVE_INFINITY) - used];
    }),
  );
  const picked: EnemyId[] = [];

  for (let i = 0; i < count; i += 1) {
    const available = candidates.filter((entry) => (remaining.get(entry.id) ?? 0) > 0);

    if (available.length === 0) {
      break;
    }

    const chosen = randomOf(available, random);

    picked.push(chosen.id);
    remaining.set(chosen.id, (remaining.get(chosen.id) ?? 0) - 1);
  }

  return picked;
}

/**
 * Where a developer-console spawn lands: out at roughly flanking distance from
 * the player, on whichever side has room, and always inside the walls. Placing
 * it on top of the player would skip the approach that is usually the thing
 * being tested.
 */
export function getDeveloperSpawnPoint(
  playerX: number,
  playerY: number,
  bodyRadius: number,
  bounds: SplitBounds,
  offset = 90,
): { x: number; y: number } {
  const margin = bodyRadius + 2;
  const right = playerX + offset;
  const preferred = right <= bounds.right - margin ? right : playerX - offset;

  return {
    x: clamp(preferred, bounds.left + margin, bounds.right - margin),
    y: clamp(playerY, bounds.top + margin, bounds.bottom - margin),
  };
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
