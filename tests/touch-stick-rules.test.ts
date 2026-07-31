import { describe, expect, it } from 'vitest';
import { emptyControls } from '../src/systems/InputRules';
import {
  controlsFromSticks,
  FIRE_DIRECTION_HYSTERESIS,
  fireControlsFromDirection,
  fireDirectionFromStick,
  isStickEngaged,
  movementControlsFromStick,
  shouldEnableTouchControls,
  STICK_DEADZONE_RATIO,
  type StickVector,
} from '../src/systems/TouchStickRules';

function polar(degrees: number, length = 100): StickVector {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: Math.cos(radians) * length,
    y: Math.sin(radians) * length,
  };
}

describe('touch capability detection', () => {
  it('accepts coarse pointers, touch points, or the touch event API independently', () => {
    expect(
      shouldEnableTouchControls({
        coarsePointer: true,
        maxTouchPoints: 0,
        touchEventAvailable: false,
      }),
    ).toBe(true);
    expect(
      shouldEnableTouchControls({
        coarsePointer: false,
        maxTouchPoints: 2,
        touchEventAvailable: false,
      }),
    ).toBe(true);
    expect(
      shouldEnableTouchControls({
        coarsePointer: false,
        maxTouchPoints: 0,
        touchEventAvailable: true,
      }),
    ).toBe(true);
  });

  it('stays hidden on a fine-pointer device with no touch signal', () => {
    expect(
      shouldEnableTouchControls({
        coarsePointer: false,
        maxTouchPoints: 0,
        touchEventAvailable: false,
      }),
    ).toBe(false);
  });
});

describe('stick deadzone', () => {
  it('ignores motion below the radius-relative deadzone and accepts its boundary', () => {
    expect(isStickEngaged({ x: 100 * STICK_DEADZONE_RATIO - 0.01, y: 0 }, 100)).toBe(false);
    expect(isStickEngaged({ x: 100 * STICK_DEADZONE_RATIO, y: 0 }, 100)).toBe(true);
  });

  it('rejects zero or negative stick radii', () => {
    expect(isStickEngaged({ x: 100, y: 0 }, 0)).toBe(false);
    expect(isStickEngaged({ x: 100, y: 0 }, -10)).toBe(false);
  });
});

describe('movementControlsFromStick', () => {
  it('maps the eight screen-space octants to keyboard-equivalent booleans', () => {
    const radius = 100;

    expect(movementControlsFromStick(polar(0), radius)).toEqual({
      up: false,
      down: false,
      left: false,
      right: true,
    });
    expect(movementControlsFromStick(polar(45), radius)).toEqual({
      up: false,
      down: true,
      left: false,
      right: true,
    });
    expect(movementControlsFromStick(polar(90), radius)).toEqual({
      up: false,
      down: true,
      left: false,
      right: false,
    });
    expect(movementControlsFromStick(polar(135), radius)).toEqual({
      up: false,
      down: true,
      left: true,
      right: false,
    });
    expect(movementControlsFromStick(polar(180), radius)).toEqual({
      up: false,
      down: false,
      left: true,
      right: false,
    });
    expect(movementControlsFromStick(polar(225), radius)).toEqual({
      up: true,
      down: false,
      left: true,
      right: false,
    });
    expect(movementControlsFromStick(polar(270), radius)).toEqual({
      up: true,
      down: false,
      left: false,
      right: false,
    });
    expect(movementControlsFromStick(polar(315), radius)).toEqual({
      up: true,
      down: false,
      left: false,
      right: true,
    });
  });

  it('uses digital speed once outside the deadzone regardless of tilt magnitude', () => {
    expect(movementControlsFromStick(polar(45, 30), 100)).toEqual(
      movementControlsFromStick(polar(45, 100), 100),
    );
  });
});

describe('fireDirectionFromStick', () => {
  it('maps the four cardinal screen directions and returns null inside the deadzone', () => {
    expect(fireDirectionFromStick(polar(0), 100, null)).toBe('right');
    expect(fireDirectionFromStick(polar(90), 100, null)).toBe('down');
    expect(fireDirectionFromStick(polar(180), 100, null)).toBe('left');
    expect(fireDirectionFromStick(polar(270), 100, null)).toBe('up');
    expect(fireDirectionFromStick({ x: 5, y: 5 }, 100, 'right')).toBeNull();
  });

  it('keeps the previous direction briefly past a 45 degree boundary, then switches', () => {
    expect(FIRE_DIRECTION_HYSTERESIS).toBeCloseTo(Math.PI / 18);
    expect(fireDirectionFromStick(polar(50), 100, null)).toBe('down');
    expect(fireDirectionFromStick(polar(50), 100, 'right')).toBe('right');
    expect(fireDirectionFromStick(polar(56), 100, 'right')).toBe('down');
  });

  it('applies hysteresis correctly across the wrapped up-to-right boundary', () => {
    expect(fireDirectionFromStick(polar(320), 100, null)).toBe('right');
    expect(fireDirectionFromStick(polar(320), 100, 'up')).toBe('up');
    expect(fireDirectionFromStick(polar(326), 100, 'up')).toBe('right');
  });
});

describe('touch controls composition', () => {
  it('combines movement and fire samples that have independent radii', () => {
    const result = controlsFromSticks({
      movement: { vector: polar(315, 50), radius: 100 },
      fire: { vector: polar(180, 25), radius: 50 },
      previousFireDirection: null,
    });

    expect(result.controls).toEqual({
      ...emptyControls(),
      up: true,
      right: true,
      fireLeft: true,
    });
    expect(result.fireDirection).toBe('left');
  });

  it('clears released sticks and exposes a keyboard-shaped fire snapshot', () => {
    expect(
      controlsFromSticks({
        movement: null,
        fire: null,
        previousFireDirection: 'right',
      }),
    ).toEqual({ controls: emptyControls(), fireDirection: null });
    expect(fireControlsFromDirection('up')).toEqual({
      fireUp: true,
      fireDown: false,
      fireLeft: false,
      fireRight: false,
    });
  });
});
