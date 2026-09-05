import type { RunOutcome } from '../systems/RunState';

// 런 종료 화면(게임오버·탈출 성공) 공통 확인 입력. 키 코드만 검사하는 순수 함수이며,
// 어느 화면이 반응할지는 각 오버레이의 리스너가 RunState.outcome과 전환 상태로 판단한다.
const RUN_END_CONFIRM_CODES = new Set(['Enter', 'NumpadEnter', 'Space']);

export function isRunEndConfirmCode(code: string): boolean {
  return RUN_END_CONFIRM_CODES.has(code);
}

/**
 * 결과 화면에서 Space를 다시 눌러야 하는가.
 *
 * Space는 게임 중 액티브 아이템 발동에 쓰인다. 연타하며 싸우다 죽으면 그 연타가
 * 그대로 "타이틀로 돌아가기"로 먹혀 결과 화면이 스킵된다. Enter는 게임 중 쓰이지
 * 않으므로 즉시 반응해도 안전하다.
 */
export function requiresFreshPress(code: string): boolean {
  return code === 'Space';
}

/**
 * 결과 화면이 뜬 뒤 Space를 한 번 뗐는지 지켜보는 걸쇠.
 *
 * 문 통과의 `DoorEntryGate`와 같은 방식이다 — 열린 직후의 입력을 그대로 먹지 않고,
 * 손을 뗐다가 다시 누른 것만 의사 표시로 친다.
 */
export class RunEndConfirmGate {
  private freshPressReady = false;

  /** 결과 화면이 열릴 때. */
  open(): void {
    this.freshPressReady = false;
  }

  /** 확인 키에서 손을 뗐을 때. */
  noteKeyUp(code: string): void {
    if (requiresFreshPress(code)) {
      this.freshPressReady = true;
    }
  }

  /** 이 키가 지금 확인 입력으로 성립하는가. */
  accepts(code: string): boolean {
    if (!isRunEndConfirmCode(code)) {
      return false;
    }

    return requiresFreshPress(code) ? this.freshPressReady : true;
  }
}

export interface RunEndConfirmContext {
  overlayShown: boolean;
  transitionStarted: boolean;
  outcome: RunOutcome;
  expectedOutcome: RunOutcome;
  code: string;
}

// 게임오버·탈출 오버레이의 확인 입력 공통 판정. 두 리스너가 같은 규칙을 쓰되
// expectedOutcome이 달라 서로 독립적으로 동작한다: 자기 화면이 떠 있고,
// 전환이 시작되지 않았고, 런 결과가 자기 것일 때만 반응한다.
export function shouldConfirmRunEnd(context: RunEndConfirmContext): boolean {
  return (
    context.overlayShown &&
    !context.transitionStarted &&
    context.outcome === context.expectedOutcome &&
    isRunEndConfirmCode(context.code)
  );
}

export interface KeyupListenerTarget {
  addEventListener(type: 'keyup', listener: (event: KeyboardEvent) => void, capture: boolean): void;
  removeEventListener(
    type: 'keyup',
    listener: (event: KeyboardEvent) => void,
    capture: boolean,
  ): void;
}

export interface KeydownListenerTarget {
  addEventListener(
    type: 'keydown',
    listener: (event: KeyboardEvent) => void,
    capture: boolean,
  ): void;
  removeEventListener(
    type: 'keydown',
    listener: (event: KeyboardEvent) => void,
    capture: boolean,
  ): void;
}

// capture 단계 keydown 리스너를 등록하고, 등록했던 것과 동일한 리스너·capture 플래그로
// 해제하는 함수를 돌려준다. 등록/해제가 반드시 쌍을 이루게 하는 장치다.
export function bindCaptureKeydown(
  target: KeydownListenerTarget,
  handler: (event: KeyboardEvent) => void,
): () => void {
  target.addEventListener('keydown', handler, true);
  return () => target.removeEventListener('keydown', handler, true);
}

/** keyup 쪽 짝. 결과 화면의 Space 걸쇠를 푸는 데 쓴다. */
export function bindCaptureKeyup(
  target: KeyupListenerTarget,
  handler: (event: KeyboardEvent) => void,
): () => void {
  target.addEventListener('keyup', handler, true);
  return () => target.removeEventListener('keyup', handler, true);
}

/**
 * 결과 화면에서 눌린 키를 어떻게 다룰 것인가.
 *
 * - `confirm`: 타이틀로 돌아간다
 * - `suppress`: 확인 키이지만 아직 받지 않는다. **브라우저 기본 동작까지 반드시
 *   취소해야 한다** — 결과 화면의 버튼이 포커스를 갖고 있어서, 그냥 무시하면
 *   브라우저가 Space로 그 버튼을 눌러 걸쇠가 통째로 무의미해진다
 * - `ignore`: 상관없는 키. 손대지 않는다
 */
export type RunEndKeyAction = 'confirm' | 'suppress' | 'ignore';

export function resolveRunEndKeyAction(
  context: RunEndConfirmContext,
  gateAccepts: boolean,
): RunEndKeyAction {
  if (!shouldConfirmRunEnd(context)) {
    return 'ignore';
  }

  return gateAccepts ? 'confirm' : 'suppress';
}
