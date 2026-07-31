import { describe, expect, it } from 'vitest';
import {
  formatRunElapsedTime,
  MINIMAP_HOLD_THRESHOLD_MS,
  MinimapExpansionController,
} from '../src/systems/MinimapExpansionController';

describe('minimap expansion input', () => {
  it('toggles the pinned map with quick Tab presses', () => {
    const controller = new MinimapExpansionController();

    controller.press(100);
    expect(controller.expanded).toBe(true);
    controller.release(100 + MINIMAP_HOLD_THRESHOLD_MS - 1);
    expect(controller.pinnedExpanded).toBe(true);
    expect(controller.expanded).toBe(true);

    controller.press(500);
    controller.release(520);
    expect(controller.pinnedExpanded).toBe(false);
    expect(controller.expanded).toBe(false);
  });

  it('expands only while a long Tab hold is active', () => {
    const controller = new MinimapExpansionController();

    controller.press(100);
    expect(controller.expanded).toBe(true);
    controller.release(100 + MINIMAP_HOLD_THRESHOLD_MS);
    expect(controller.pinnedExpanded).toBe(false);
    expect(controller.expanded).toBe(false);
  });

  it('restores the pinned state when an active hold is cancelled', () => {
    const controller = new MinimapExpansionController();

    controller.press(100);
    controller.release(110);
    controller.press(200);
    controller.cancelHold();

    expect(controller.pinnedExpanded).toBe(true);
    expect(controller.expanded).toBe(true);
  });

  it('toggles the pinned state directly for a touch button without changing hold state', () => {
    const controller = new MinimapExpansionController();

    controller.press(100);
    controller.togglePinned();
    expect(controller.pinnedExpanded).toBe(true);
    expect(controller.expanded).toBe(true);

    controller.cancelHold();
    controller.togglePinned();
    expect(controller.pinnedExpanded).toBe(false);
    expect(controller.expanded).toBe(false);
  });

  it('formats elapsed run time as hours, minutes, and seconds', () => {
    expect(formatRunElapsedTime(0)).toBe('00:00:00');
    expect(formatRunElapsedTime(3_723_000)).toBe('01:02:03');
  });
});
