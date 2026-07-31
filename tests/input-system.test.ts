import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { emptyControls, type PlayerControls } from '../src/systems/InputRules';
import { InputSystem } from '../src/systems/InputSystem';

// InputSystem은 KeyCodes만 필요하지만 Phaser 전체를 Node에서 불러오면 window를 찾는다.
// 브라우저와 무관한 입력 합성만 검증하도록 이 테스트에서는 키 코드 표만 대신 제공한다.
vi.mock('phaser', () => ({
  default: {
    Input: {
      Keyboard: {
        KeyCodes: {
          W: 1,
          S: 2,
          A: 3,
          D: 4,
          UP: 5,
          DOWN: 6,
          LEFT: 7,
          RIGHT: 8,
        },
      },
    },
  },
}));

function fakeKeyboard(states: readonly boolean[]): Phaser.Input.Keyboard.KeyboardPlugin {
  let index = 0;

  return {
    addKey: () => ({ isDown: states[index++] ?? false }),
  } as unknown as Phaser.Input.Keyboard.KeyboardPlugin;
}

describe('InputSystem', () => {
  it('works as a touch-only input source when the keyboard plugin is unavailable', () => {
    const input = new InputSystem();
    const touch: PlayerControls = {
      ...emptyControls(),
      left: true,
      fireUp: true,
    };

    input.setTouchSource({ getControls: () => touch });

    expect(input.getControls()).toEqual(touch);
  });

  it('ORs current keyboard and touch snapshots on every read', () => {
    // 생성 순서: W, S, A, D, ↑, ↓, ←, →.
    const input = new InputSystem(
      fakeKeyboard([true, false, false, false, false, false, false, true]),
    );
    input.setTouchSource({
      getControls: () => ({
        ...emptyControls(),
        left: true,
        fireDown: true,
      }),
    });

    expect(input.getControls()).toEqual({
      ...emptyControls(),
      up: true,
      left: true,
      fireDown: true,
      fireRight: true,
    });
  });

  it('returns to keyboard-only input after the touch source is detached', () => {
    const input = new InputSystem(
      fakeKeyboard([false, false, false, true, false, false, false, false]),
    );
    input.setTouchSource({
      getControls: () => ({ ...emptyControls(), fireLeft: true }),
    });
    input.setTouchSource(undefined);

    expect(input.getControls()).toEqual({ ...emptyControls(), right: true });
  });
});
