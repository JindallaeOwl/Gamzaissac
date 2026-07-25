import { describe, expect, it, vi } from 'vitest';
import { bindCaptureKeydown, shouldConfirmRunEnd } from '../src/utils/runEndInput';
import { resetRunEndOverlayElements, RUN_END_OVERLAY_SELECTORS } from '../src/utils/runEndOverlays';

describe('run-end confirm guard', () => {
  const base = {
    overlayShown: true,
    transitionStarted: false,
    outcome: 'escaped',
    expectedOutcome: 'escaped',
    code: 'Enter',
  } as const;

  it('accepts the first confirm for the matching overlay', () => {
    expect(shouldConfirmRunEnd({ ...base })).toBe(true);
  });

  it('does not process the confirm again after the transition has started', () => {
    expect(shouldConfirmRunEnd({ ...base, transitionStarted: true })).toBe(false);
  });

  it('keeps the game-over and escape listeners independent of each other', () => {
    // 탈출 리스너는 패배 결과에 반응하지 않는다.
    expect(shouldConfirmRunEnd({ ...base, outcome: 'defeated', expectedOutcome: 'escaped' })).toBe(
      false,
    );
    // 게임오버 리스너는 탈출 결과에 반응하지 않는다.
    expect(shouldConfirmRunEnd({ ...base, outcome: 'escaped', expectedOutcome: 'defeated' })).toBe(
      false,
    );
    // 각자 자기 결과에는 반응한다.
    expect(shouldConfirmRunEnd({ ...base, outcome: 'defeated', expectedOutcome: 'defeated' })).toBe(
      true,
    );
  });

  it('ignores overlays that are not shown and non-confirm keys', () => {
    expect(shouldConfirmRunEnd({ ...base, overlayShown: false })).toBe(false);
    expect(shouldConfirmRunEnd({ ...base, code: 'Escape' })).toBe(false);
  });
});

describe('run-end keydown listener lifecycle', () => {
  it('removes exactly the listener it registered, with the same capture flag', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const handler = vi.fn();

    const detach = bindCaptureKeydown({ addEventListener, removeEventListener }, handler);

    expect(addEventListener).toHaveBeenCalledWith('keydown', handler, true);
    expect(removeEventListener).not.toHaveBeenCalled();

    detach();

    expect(removeEventListener).toHaveBeenCalledWith('keydown', handler, true);
    expect(removeEventListener.mock.calls[0][1]).toBe(addEventListener.mock.calls[0][1]);
  });
});

describe('title transition overlay cleanup', () => {
  it('covers both the game-over and escape overlays', () => {
    const overlays = RUN_END_OVERLAY_SELECTORS.map((target) => target.overlay);

    expect(overlays).toContain('#game-over-overlay');
    expect(overlays).toContain('#escape-overlay');
    expect(RUN_END_OVERLAY_SELECTORS.map((target) => target.button)).toEqual([
      '#game-over-restart',
      '#escape-return',
    ]);
  });

  it('hides the overlay and restores the button to a pressable state', () => {
    const removedClasses: string[] = [];
    const overlay = {
      hidden: false,
      classList: { remove: (className: string) => removedClasses.push(className) },
    };
    const button = { disabled: true };

    resetRunEndOverlayElements(overlay, button);

    expect(overlay.hidden).toBe(true);
    expect(removedClasses).toContain('is-leaving');
    expect(button.disabled).toBe(false);
  });

  it('tolerates missing elements', () => {
    expect(() => resetRunEndOverlayElements(null, null)).not.toThrow();
  });
});
