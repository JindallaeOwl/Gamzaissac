import {
  GAME_CENTER_X,
  GAME_CENTER_Y,
  ROOM_ENTRY_SAFE_RADIUS,
  ROOM_RECT,
} from '../config/gameConfig';

export interface RoomPoint {
  x: number;
  y: number;
}

const ENEMY_EDGE_MARGIN = 24;
const ENEMY_SEPARATION = 36;
const OBSTACLE_CLEARANCE = 38;

export function resolveEnemySpawnAwayFromEntry(
  desired: RoomPoint,
  entry: RoomPoint | undefined,
  occupied: readonly RoomPoint[] = [],
  obstacles: readonly RoomPoint[] = [],
): RoomPoint {
  if (!entry || distanceSquared(desired, entry) >= ROOM_ENTRY_SAFE_RADIUS ** 2) {
    return desired;
  }

  const direction = normalizedDirection(entry, desired);
  const base = {
    x: entry.x + direction.x * ROOM_ENTRY_SAFE_RADIUS,
    y: entry.y + direction.y * ROOM_ENTRY_SAFE_RADIUS,
  };
  const perpendicular = { x: -direction.y, y: direction.x };
  const candidates: RoomPoint[] = [
    base,
    offsetPoint(base, perpendicular, 40),
    offsetPoint(base, perpendicular, -40),
    offsetPoint(base, perpendicular, 80),
    offsetPoint(base, perpendicular, -80),
  ];

  for (const y of [80, 96, 136, 176, 192]) {
    for (const x of [112, 152, 200, 240, 280, 328, 368]) {
      candidates.push({ x, y });
    }
  }

  const validCandidates = candidates
    .map(clampToRoom)
    .filter((candidate) => isSafeCandidate(candidate, entry, occupied, obstacles))
    .sort((left, right) => distanceSquared(left, desired) - distanceSquared(right, desired));

  return validCandidates[0] ?? clampToRoom(base);
}

function isSafeCandidate(
  candidate: RoomPoint,
  entry: RoomPoint,
  occupied: readonly RoomPoint[],
  obstacles: readonly RoomPoint[],
): boolean {
  return (
    distanceSquared(candidate, entry) >= ROOM_ENTRY_SAFE_RADIUS ** 2 &&
    occupied.every((position) => distanceSquared(candidate, position) >= ENEMY_SEPARATION ** 2) &&
    obstacles.every((position) => distanceSquared(candidate, position) >= OBSTACLE_CLEARANCE ** 2)
  );
}

function normalizedDirection(from: RoomPoint, to: RoomPoint): RoomPoint {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  let length = Math.hypot(dx, dy);

  if (length === 0) {
    dx = GAME_CENTER_X - from.x;
    dy = GAME_CENTER_Y - from.y;
    length = Math.hypot(dx, dy) || 1;
  }

  return { x: dx / length, y: dy / length };
}

function offsetPoint(point: RoomPoint, direction: RoomPoint, distance: number): RoomPoint {
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance,
  };
}

function clampToRoom(point: RoomPoint): RoomPoint {
  return {
    x: Math.round(
      Math.min(
        ROOM_RECT.right - ENEMY_EDGE_MARGIN,
        Math.max(ROOM_RECT.left + ENEMY_EDGE_MARGIN, point.x),
      ),
    ),
    y: Math.round(
      Math.min(
        ROOM_RECT.bottom - ENEMY_EDGE_MARGIN,
        Math.max(ROOM_RECT.top + ENEMY_EDGE_MARGIN, point.y),
      ),
    ),
  };
}

function distanceSquared(left: RoomPoint, right: RoomPoint): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}
