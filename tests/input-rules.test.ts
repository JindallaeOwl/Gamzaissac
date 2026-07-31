import { describe, expect, it } from 'vitest';
import {
  emptyControls,
  movementAxes,
  selectFireDirection,
  snapshotFromKeys,
  type PlayerControls,
} from '../src/systems/InputRules';

function controls(overrides: Partial<PlayerControls>): PlayerControls {
  return { ...emptyControls(), ...overrides };
}

describe('snapshotFromKeys', () => {
  const keys = (downs: Partial<Record<keyof PlayerControls, boolean>>) => {
    const make = (name: keyof PlayerControls) => ({ isDown: downs[name] ?? false });
    return {
      up: make('up'),
      down: make('down'),
      left: make('left'),
      right: make('right'),
      fireUp: make('fireUp'),
      fireDown: make('fireDown'),
      fireLeft: make('fireLeft'),
      fireRight: make('fireRight'),
    };
  };

  it('turns fully released keys into an all-false snapshot', () => {
    expect(snapshotFromKeys(keys({}))).toEqual(emptyControls());
  });

  it('maps each pressed key to its own field without crosstalk', () => {
    expect(snapshotFromKeys(keys({ up: true, fireLeft: true }))).toEqual(
      controls({ up: true, fireLeft: true }),
    );
  });

  it('carries simultaneous presses through unchanged', () => {
    const snapshot = snapshotFromKeys(
      keys({ up: true, down: true, left: true, right: true, fireUp: true, fireRight: true }),
    );

    expect(snapshot).toEqual(
      controls({ up: true, down: true, left: true, right: true, fireUp: true, fireRight: true }),
    );
  });
});

describe('movementAxes', () => {
  it('is zero with no input', () => {
    expect(movementAxes(emptyControls())).toEqual({ x: 0, y: 0 });
  });

  it('maps single directions to unit axes', () => {
    expect(movementAxes(controls({ up: true }))).toEqual({ x: 0, y: -1 });
    expect(movementAxes(controls({ down: true }))).toEqual({ x: 0, y: 1 });
    expect(movementAxes(controls({ left: true }))).toEqual({ x: -1, y: 0 });
    expect(movementAxes(controls({ right: true }))).toEqual({ x: 1, y: 0 });
  });

  it('cancels opposite keys to a zero axis', () => {
    expect(movementAxes(controls({ left: true, right: true }))).toEqual({ x: 0, y: 0 });
    expect(movementAxes(controls({ up: true, down: true }))).toEqual({ x: 0, y: 0 });
  });

  it('keeps both axes for diagonals', () => {
    expect(movementAxes(controls({ up: true, right: true }))).toEqual({ x: 1, y: -1 });
    expect(movementAxes(controls({ down: true, left: true }))).toEqual({ x: -1, y: 1 });
  });
});

describe('selectFireDirection', () => {
  it('returns null when no fire input is held', () => {
    expect(selectFireDirection(emptyControls())).toBeNull();
    // 이동키는 사격에 영향을 주지 않는다.
    expect(selectFireDirection(controls({ up: true, left: true }))).toBeNull();
  });

  it('maps each fire key to its cardinal direction', () => {
    expect(selectFireDirection(controls({ fireUp: true }))).toEqual({ x: 0, y: -1 });
    expect(selectFireDirection(controls({ fireDown: true }))).toEqual({ x: 0, y: 1 });
    expect(selectFireDirection(controls({ fireLeft: true }))).toEqual({ x: -1, y: 0 });
    expect(selectFireDirection(controls({ fireRight: true }))).toEqual({ x: 1, y: 0 });
  });

  it('resolves simultaneous presses by the up → down → left → right priority', () => {
    expect(
      selectFireDirection(
        controls({ fireUp: true, fireDown: true, fireLeft: true, fireRight: true }),
      ),
    ).toEqual({ x: 0, y: -1 });
    expect(
      selectFireDirection(controls({ fireDown: true, fireLeft: true, fireRight: true })),
    ).toEqual({ x: 0, y: 1 });
    expect(selectFireDirection(controls({ fireLeft: true, fireRight: true }))).toEqual({
      x: -1,
      y: 0,
    });
  });
});
