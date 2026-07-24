import { describe, expect, it } from 'vitest';
import { TextureKeys } from '../src/config/assets';
import { TOTAL_FLOORS } from '../src/data/stages';
import {
  floorExitKindForFloor,
  floorExitTextureKey,
  restoredFloorExitKind,
} from '../src/systems/FloorExitRules';

describe('floor exit rules', () => {
  it('uses the normal upward tunnel on every floor before the last', () => {
    for (let floor = 1; floor < TOTAL_FLOORS; floor += 1) {
      expect(floorExitKindForFloor(floor), `floor ${floor}`).toBe('next-floor');
    }
  });

  it('uses the escape exit only on the final floor', () => {
    expect(floorExitKindForFloor(TOTAL_FLOORS)).toBe('escape');
  });

  it('rejects floors outside the stage range', () => {
    for (const invalid of [0, TOTAL_FLOORS + 1, 1.5]) {
      expect(() => floorExitKindForFloor(invalid), `floor ${invalid}`).toThrow();
    }
  });

  it('maps each exit kind to its own texture', () => {
    expect(floorExitTextureKey('next-floor')).toBe(TextureKeys.floorExit);
    expect(floorExitTextureKey('escape')).toBe(TextureKeys.floorExitEscape);
    expect(TextureKeys.floorExit).not.toBe(TextureKeys.floorExitEscape);
  });
});

describe('floor exit restoration on room re-entry', () => {
  it('restores the escape exit in the cleared final boss room', () => {
    expect(restoredFloorExitKind(TOTAL_FLOORS, 'boss', true)).toBe('escape');
  });

  it('restores the normal exit in a cleared boss room before the last floor', () => {
    expect(restoredFloorExitKind(TOTAL_FLOORS - 1, 'boss', true)).toBe('next-floor');
  });

  it('does not restore an exit in an uncleared boss room', () => {
    expect(restoredFloorExitKind(TOTAL_FLOORS, 'boss', false)).toBeUndefined();
  });

  it('does not restore an exit in cleared non-boss rooms', () => {
    expect(restoredFloorExitKind(TOTAL_FLOORS, 'combat', true)).toBeUndefined();
    expect(restoredFloorExitKind(TOTAL_FLOORS, 'start', true)).toBeUndefined();
  });
});
