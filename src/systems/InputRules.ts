import type { AttackDirection } from '../utils/attackDirections';

/**
 * 플레이어 이동·사격 입력의 프레임 스냅샷.
 *
 * 값이 불리언이라 입력원이 무엇이든(키보드, 추후 터치·게임패드) 같은 형태로
 * 전달된다. Player는 "지금 위 입력이 있는가"만 보고, 그 값이 어느 장치에서
 * 왔는지는 모른다. 기존에는 이 자리에 Phaser Key 객체가 직접 들어 있어
 * 키보드 외의 입력을 끼워 넣을 수 없었다.
 */
export interface PlayerControls {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fireUp: boolean;
  fireDown: boolean;
  fireLeft: boolean;
  fireRight: boolean;
}

/** 아무 입력도 없는 스냅샷. */
export function emptyControls(): PlayerControls {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    fireUp: false,
    fireDown: false,
    fireLeft: false,
    fireRight: false,
  };
}

/** isDown 형태의 키 8개를 불리언 스냅샷으로 변환한다. InputSystem이 사용한다. */
export function snapshotFromKeys(
  keys: Record<keyof PlayerControls, { isDown: boolean }>,
): PlayerControls {
  return {
    up: keys.up.isDown,
    down: keys.down.isDown,
    left: keys.left.isDown,
    right: keys.right.isDown,
    fireUp: keys.fireUp.isDown,
    fireDown: keys.fireDown.isDown,
    fireLeft: keys.fireLeft.isDown,
    fireRight: keys.fireRight.isDown,
  };
}

/**
 * 이동 입력을 축 값(-1·0·1)으로 계산한다. 기존 Player·GameScene에 있던
 * `Number(right.isDown) - Number(left.isDown)` 식과 결과가 동일하다
 * (반대 방향 동시 입력 = 0, 대각선 = 두 축 모두 ±1).
 */
export function movementAxes(controls: PlayerControls): { x: number; y: number } {
  return {
    x: Number(controls.right) - Number(controls.left),
    y: Number(controls.down) - Number(controls.up),
  };
}

/**
 * 사격 방향 선택. 여러 키가 동시에 눌리면 위 → 아래 → 왼쪽 → 오른쪽 순서로
 * 먼저 걸리는 것이 이긴다 — 기존 Player.getFireDirection의 if 순서 그대로다.
 * 아무 사격 입력이 없으면 null이며, 빔 차징은 이 null 전환으로 "키를 뗐다"를
 * 감지하므로 이 규칙이 곧 발사 타이밍이다.
 */
export function selectFireDirection(controls: PlayerControls): AttackDirection | null {
  if (controls.fireUp) {
    return { x: 0, y: -1 };
  }

  if (controls.fireDown) {
    return { x: 0, y: 1 };
  }

  if (controls.fireLeft) {
    return { x: -1, y: 0 };
  }

  if (controls.fireRight) {
    return { x: 1, y: 0 };
  }

  return null;
}
