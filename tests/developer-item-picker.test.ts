import { describe, expect, it } from 'vitest';
import {
  isItemPickerToggleInput,
  moveItemPickerSelection,
} from '../src/ui/DeveloperItemPickerRules';

describe('isItemPickerToggleInput', () => {
  it('accepts F2 only after authentication and ignores held keys', () => {
    expect(isItemPickerToggleInput(true, 'F2', false)).toBe(true);
    expect(isItemPickerToggleInput(false, 'F2', false)).toBe(false);
    expect(isItemPickerToggleInput(true, 'F2', true)).toBe(false);
    expect(isItemPickerToggleInput(true, 'F3', false)).toBe(false);
  });
});

describe('moveItemPickerSelection', () => {
  it('moves horizontally and wraps across the item list', () => {
    expect(moveItemPickerSelection(0, 'left', 6, 3)).toBe(5);
    expect(moveItemPickerSelection(5, 'right', 6, 3)).toBe(0);
    expect(moveItemPickerSelection(2, 'right', 6, 3)).toBe(3);
  });

  it('moves vertically by the visible column count', () => {
    expect(moveItemPickerSelection(1, 'down', 8, 3)).toBe(4);
    expect(moveItemPickerSelection(4, 'up', 8, 3)).toBe(1);
    expect(moveItemPickerSelection(6, 'down', 8, 3)).toBe(6);
  });

  it('handles empty lists and invalid starting indexes safely', () => {
    expect(moveItemPickerSelection(3, 'right', 0, 3)).toBe(0);
    expect(moveItemPickerSelection(99, 'left', 5, 2)).toBe(3);
  });
});
