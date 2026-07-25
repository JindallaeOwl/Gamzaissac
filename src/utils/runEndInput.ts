import type { RunOutcome } from '../systems/RunState';

// 런 종료 화면(게임오버·탈출 성공) 공통 확인 입력. 키 코드만 검사하는 순수 함수이며,
// 어느 화면이 반응할지는 각 오버레이의 리스너가 RunState.outcome과 전환 상태로 판단한다.
const RUN_END_CONFIRM_CODES = new Set(['Enter', 'NumpadEnter', 'Space']);

export function isRunEndConfirmCode(code: string): boolean {
  return RUN_END_CONFIRM_CODES.has(code);
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
