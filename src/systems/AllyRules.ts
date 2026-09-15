export interface AllyPoint {
  x: number;
  y: number;
}

export interface AllyBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface AllyTarget extends AllyPoint {
  active: boolean;
}

export type AllyMode = 'follow' | 'engage';
export type AllySide = -1 | 1;

export function allyDistance(first: AllyPoint, second: AllyPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function resolveAllyMode(
  current: AllyMode,
  targetDistance: number | null,
  detectionRange: number,
  disengageMargin: number,
): AllyMode {
  if (targetDistance === null) return 'follow';
  const limit = detectionRange + (current === 'engage' ? disengageMargin : 0);
  return targetDistance <= limit ? 'engage' : 'follow';
}

export function selectAllyTarget<T extends AllyTarget>(
  ally: AllyPoint,
  current: T | null,
  candidates: readonly T[],
  detectionRange: number,
  disengageMargin: number,
): T | null {
  // 잡은 목표를 유지해야 더 가까운 적이 스칠 때마다 이동과 조준이 흔들리지 않는다.
  if (
    current?.active &&
    candidates.includes(current) &&
    resolveAllyMode('engage', allyDistance(ally, current), detectionRange, disengageMargin) ===
      'engage'
  )
    return current;

  let nearest: T | null = null;
  let nearestDistance = detectionRange;
  for (const candidate of candidates) {
    if (!candidate.active) continue;
    const distance = allyDistance(ally, candidate);
    if (distance <= nearestDistance && (nearest === null || distance < nearestDistance)) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function getAllyEngageVelocity(
  ally: AllyPoint,
  target: AllyPoint,
  speed: number,
  minDistance: number,
  maxDistance: number,
  orbitSign: AllySide,
): AllyPoint {
  const distance = allyDistance(ally, target);
  // 완전히 겹친 경우에도 후퇴 방향이 있어야 적 몸 안에서 멈추지 않는다.
  const x = distance === 0 ? orbitSign : (target.x - ally.x) / distance;
  const y = distance === 0 ? 0 : (target.y - ally.y) / distance;
  if (distance < minDistance) return { x: -x * speed, y: -y * speed };
  if (distance > maxDistance) return { x: x * speed, y: y * speed };
  return { x: -y * speed * orbitSign, y: x * speed * orbitSign };
}

export function clampAllyToRoom(point: AllyPoint, bounds: AllyBounds, margin: number): AllyPoint {
  return {
    x: Math.max(bounds.left + margin, Math.min(bounds.right - margin, point.x)),
    y: Math.max(bounds.top + margin, Math.min(bounds.bottom - margin, point.y)),
  };
}

export function getAllySpawnPositions(
  player: AllyPoint,
  bounds: AllyBounds,
  margin: number,
  offset: number,
): [AllyPoint, AllyPoint] {
  // 양쪽을 따로 물리면 모서리에서 같은 점이 된다. 두 자리의 중심을 함께 옮긴다.
  const center = clampAllyToRoom(
    player,
    {
      ...bounds,
      left: bounds.left + offset,
      right: bounds.right - offset,
    },
    margin,
  );
  return [
    { x: center.x - offset, y: center.y },
    { x: center.x + offset, y: center.y },
  ];
}

export function getAllyFollowTarget(
  player: AllyPoint,
  side: AllySide,
  bounds: AllyBounds,
  margin: number,
  offset: number,
): AllyPoint {
  return getAllySpawnPositions(player, bounds, margin, offset)[side === -1 ? 0 : 1];
}

export function getAllyFollowVelocity(
  ally: AllyPoint,
  target: AllyPoint,
  speed: number,
  stopDistance: number,
  slowDistance = 0,
): AllyPoint {
  const distance = allyDistance(ally, target);
  if (distance <= stopDistance) return { x: 0, y: 0 };
  const arrivalSpeed = speed * (slowDistance > 0 ? Math.min(1, distance / slowDistance) : 1);
  return {
    x: ((target.x - ally.x) / distance) * arrivalSpeed,
    y: ((target.y - ally.y) / distance) * arrivalSpeed,
  };
}

export function getAllyFollowMotion(
  ally: AllyPoint,
  player: AllyPoint,
  side: AllySide,
  time: number,
  bounds: AllyBounds,
  margin: number,
  tuning: {
    followOffset: number;
    wanderIntervalMs: number;
    wanderPhaseMs: number;
    catchUpDistance: number;
    wanderSpeed: number;
    moveSpeed: number;
    followStopDistance: number;
    followSlowDistance: number;
  },
): AllyPoint {
  const catchingUp = allyDistance(ally, player) > tuning.catchUpDistance;
  // 목표를 잠시 유지해야 도착 후 쉴 수 있다. 서로 다른 시각에 다음 자리로 옮긴다.
  const step = Math.floor(
    (time + (side === 1 ? tuning.wanderPhaseMs : 0)) / tuning.wanderIntervalMs,
  );
  const angle = step * (Math.PI * (3 - Math.sqrt(5))) + (side === -1 ? Math.PI : 0);
  const destination = catchingUp
    ? getAllyFollowTarget(player, side, bounds, margin, tuning.followOffset)
    : clampAllyToRoom(
        {
          x: player.x + Math.cos(angle) * tuning.followOffset,
          y: player.y + Math.sin(angle) * tuning.followOffset,
        },
        bounds,
        margin,
      );
  return getAllyFollowVelocity(
    ally,
    destination,
    catchingUp ? tuning.moveSpeed : tuning.wanderSpeed,
    tuning.followStopDistance,
    tuning.followSlowDistance,
  );
}

export function smoothAllyVelocity(
  current: AllyPoint,
  desired: AllyPoint,
  deltaMs: number,
  responseMs: number,
): AllyPoint {
  // 프레임마다 일정 비율로 섞으면 저사양에서 관성이 달라지므로 경과 시간을 쓴다.
  const blend = responseMs <= 0 ? 1 : 1 - Math.exp(-Math.max(0, deltaMs) / responseMs);
  return {
    x: current.x + (desired.x - current.x) * blend,
    y: current.y + (desired.y - current.y) * blend,
  };
}

export function canAllyFire(
  time: number,
  nextFireAt: number,
  distance: number,
  range: number,
): boolean {
  return time >= nextFireAt && distance <= range;
}

export function getAllyDamage(effectiveDamage: number, multiplier: number, floor: number): number {
  return Math.max(floor, Math.max(0, effectiveDamage) * multiplier);
}

export function canSummonAllies(activeEnemyCount: number): boolean {
  return activeEnemyCount > 0;
}

export function canDamageAlly(time: number, invulnerableUntil: number, amount: number): boolean {
  return time >= invulnerableUntil && amount > 0;
}
