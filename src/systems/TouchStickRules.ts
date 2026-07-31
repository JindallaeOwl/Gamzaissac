import { emptyControls, type PlayerControls } from './InputRules';

/** 스틱 중심에서 손가락까지의 벡터(픽셀). */
export interface StickVector {
  x: number;
  y: number;
}

/** 스틱 반경 대비 이 비율 안쪽은 입력 없음으로 본다. 손가락 미세 떨림을 흡수한다. */
export const STICK_DEADZONE_RATIO = 0.28;

/** 사격 스틱이 방향을 바꾸려면 넘어야 하는 여유각(라디안). 45° 경계 떨림을 막는다. */
export const FIRE_DIRECTION_HYSTERESIS = Math.PI / 18;

export type FireDirectionName = 'up' | 'down' | 'left' | 'right';

export interface StickSample {
  vector: StickVector;
  radius: number;
}

export interface TouchCapabilitySignals {
  coarsePointer: boolean;
  maxTouchPoints: number;
  touchEventAvailable: boolean;
}

/** 터치 노트북·태블릿·모바일 중 하나라도 놓치지 않도록 세 신호를 함께 본다. */
export function shouldEnableTouchControls(signals: TouchCapabilitySignals): boolean {
  return signals.coarsePointer || signals.maxTouchPoints > 0 || signals.touchEventAvailable;
}

/** 스틱이 데드존을 벗어났는지. radius는 스틱 받침 반경. */
export function isStickEngaged(vector: StickVector, radius: number): boolean {
  if (radius <= 0) {
    return false;
  }

  return Math.hypot(vector.x, vector.y) >= radius * STICK_DEADZONE_RATIO;
}

/**
 * 이동 스틱 → 8방향 불리언.
 *
 * 기울기 크기는 버린다. 살짝 기울이든 끝까지 밀든 **키보드와 같은 속도**로 움직인다
 * (아날로그 속도를 넣으면 키보드 플레이와 조작감이 갈라진다).
 * 45° 구간을 8등분해 대각선에서는 두 축이 함께 true가 된다 — W+D를 동시에 누른 것과 같다.
 */
export function movementControlsFromStick(
  vector: StickVector,
  radius: number,
): Pick<PlayerControls, 'up' | 'down' | 'left' | 'right'> {
  const controls = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  if (!isStickEngaged(vector, radius)) {
    return controls;
  }

  // 화면 좌표는 아래가 +y라 각도도 그대로 쓴다. 8방향 = 45° 칸으로 반올림.
  const twoPi = Math.PI * 2;
  const angle = (Math.atan2(vector.y, vector.x) + twoPi) % twoPi;
  const octant = Math.round(angle / (Math.PI / 4)) % 8;

  // octant: 0=오른쪽, 1=오른아래, 2=아래, 3=왼아래, 4=왼쪽, 5=왼위, 6=위, 7=오른위
  controls.right = octant === 7 || octant === 0 || octant === 1;
  controls.down = octant === 1 || octant === 2 || octant === 3;
  controls.left = octant === 3 || octant === 4 || octant === 5;
  controls.up = octant === 5 || octant === 6 || octant === 7;

  return controls;
}

/**
 * 사격 스틱 → 4방향 중 하나.
 *
 * 게임의 사격이 4방향이라 대각선은 만들지 않는다. 45° 경계에 손가락을 두면 두 방향이
 * 매 프레임 번갈아 잡혀 총구가 떨리므로, **이미 어떤 방향이면 그 방향에 여유각을 얹어
 * 웬만해선 유지**한다(히스테리시스). previous가 null이면 여유 없이 가장 가까운 방향.
 */
export function fireDirectionFromStick(
  vector: StickVector,
  radius: number,
  previous: FireDirectionName | null,
): FireDirectionName | null {
  if (!isStickEngaged(vector, radius)) {
    return null;
  }

  const angle = Math.atan2(vector.y, vector.x);
  const candidates: readonly { name: FireDirectionName; angle: number }[] = [
    { name: 'right', angle: 0 },
    { name: 'down', angle: Math.PI / 2 },
    { name: 'left', angle: Math.PI },
    { name: 'up', angle: -Math.PI / 2 },
  ];

  const previousCandidate = candidates.find((candidate) => candidate.name === previous);

  if (
    previousCandidate &&
    Math.abs(wrapAngle(angle - previousCandidate.angle)) <= Math.PI / 4 + FIRE_DIRECTION_HYSTERESIS
  ) {
    return previousCandidate.name;
  }

  let best: FireDirectionName = 'right';
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const difference = Math.abs(wrapAngle(angle - candidate.angle));

    if (difference < bestScore) {
      best = candidate.name;
      bestScore = difference;
    }
  }

  return best;
}

/** 사격 방향 이름을 PlayerControls의 사격 필드로 펼친다. */
export function fireControlsFromDirection(
  direction: FireDirectionName | null,
): Pick<PlayerControls, 'fireUp' | 'fireDown' | 'fireLeft' | 'fireRight'> {
  return {
    fireUp: direction === 'up',
    fireDown: direction === 'down',
    fireLeft: direction === 'left',
    fireRight: direction === 'right',
  };
}

/** 두 스틱 상태를 하나의 입력 스냅샷으로 합친다. */
export function controlsFromSticks(params: {
  movement: StickSample | null;
  fire: StickSample | null;
  previousFireDirection: FireDirectionName | null;
}): { controls: PlayerControls; fireDirection: FireDirectionName | null } {
  const movement = params.movement
    ? movementControlsFromStick(params.movement.vector, params.movement.radius)
    : null;
  const fireDirection = params.fire
    ? fireDirectionFromStick(params.fire.vector, params.fire.radius, params.previousFireDirection)
    : null;

  return {
    controls: {
      ...emptyControls(),
      ...(movement ?? {}),
      ...fireControlsFromDirection(fireDirection),
    },
    fireDirection,
  };
}

// 각도를 [-π, π)로 감싼다.
function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  return ((((angle + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}
