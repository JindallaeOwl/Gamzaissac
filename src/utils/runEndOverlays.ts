// 런 종료 오버레이(게임오버·탈출 성공)의 정리 규칙. 타이틀 전환과 Scene 종료가
// 같은 헬퍼를 사용해, 어느 경로로 타이틀에 돌아가든 두 오버레이가 모두
// 숨겨지고 버튼이 다시 눌리는 상태로 복구되게 한다.

export const RUN_END_OVERLAY_SELECTORS = [
  { overlay: '#game-over-overlay', button: '#game-over-restart' },
  { overlay: '#escape-overlay', button: '#escape-return' },
] as const;

export interface RunEndOverlayElement {
  hidden: boolean;
  classList: { remove(className: string): void };
}

export interface RunEndOverlayButton {
  disabled: boolean;
}

export function resetRunEndOverlayElements(
  overlay: RunEndOverlayElement | null,
  button: RunEndOverlayButton | null,
): void {
  if (overlay) {
    overlay.hidden = true;
    overlay.classList.remove('is-leaving');
  }

  if (button) {
    button.disabled = false;
  }
}
