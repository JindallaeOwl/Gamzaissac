import { describe, expect, it } from 'vitest';
import { DoorEntryGate } from '../src/systems/DoorEntryGate';

describe('DoorEntryGate', () => {
  it('allows immediate entry through an ordinarily opened door', () => {
    const gate = new DoorEntryGate();

    gate.setOpen(true);

    expect(gate.canEnter()).toBe(true);
  });

  it('waits for the player to exit a newly opened clear door', () => {
    const gate = new DoorEntryGate();

    gate.setOpen(true, true);
    gate.updatePlayerOverlap(true);
    expect(gate.canEnter()).toBe(false);

    gate.updatePlayerOverlap(false);
    expect(gate.canEnter()).toBe(true);
  });

  it('resets its entry state when the door closes', () => {
    const gate = new DoorEntryGate();

    gate.setOpen(true, true);
    gate.setOpen(false);

    expect(gate.canEnter()).toBe(false);
  });
});
