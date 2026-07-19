import { describe, expect, it } from 'vitest';
import {
  DEVELOPER_CONSOLE_HELP,
  parseDeveloperCommand,
} from '../src/systems/DeveloperConsoleCommands';
import { createInitialRunState, isRunEligibleForRanking } from '../src/systems/RunState';

describe('developer console commands', () => {
  it('parses the supported commands', () => {
    expect(parseDeveloperCommand('help')).toEqual({ ok: true, command: { type: 'help' } });
    expect(parseDeveloperCommand('god')).toEqual({ ok: true, command: { type: 'god' } });
    expect(parseDeveloperCommand('heal')).toEqual({ ok: true, command: { type: 'heal' } });
    expect(parseDeveloperCommand('coin 20')).toEqual({
      ok: true,
      command: { type: 'add-resource', resource: 'coins', amount: 20 },
    });
    expect(parseDeveloperCommand('key 5')).toEqual({
      ok: true,
      command: { type: 'add-resource', resource: 'keys', amount: 5 },
    });
    expect(parseDeveloperCommand('bomb 5')).toEqual({
      ok: true,
      command: { type: 'add-resource', resource: 'bombs', amount: 5 },
    });
    expect(parseDeveloperCommand('kill')).toEqual({ ok: true, command: { type: 'kill' } });
    expect(parseDeveloperCommand('boss')).toEqual({ ok: true, command: { type: 'boss' } });
    expect(parseDeveloperCommand('shop')).toEqual({ ok: true, command: { type: 'shop' } });
    expect(parseDeveloperCommand('treasure')).toEqual({
      ok: true,
      command: { type: 'treasure' },
    });
    expect(parseDeveloperCommand('spawn PRISM-LANCE')).toEqual({
      ok: true,
      command: { type: 'spawn', itemId: 'prism-lance' },
    });
    expect(parseDeveloperCommand('spawn CHEST')).toEqual({
      ok: true,
      command: { type: 'spawn', itemId: 'chest' },
    });
    expect(parseDeveloperCommand('sale')).toEqual({ ok: true, command: { type: 'sale' } });
    expect(parseDeveloperCommand('floor 2')).toEqual({
      ok: true,
      command: { type: 'floor', floor: 2 },
    });
    expect(parseDeveloperCommand('clear')).toEqual({ ok: true, command: { type: 'clear' } });
    expect(DEVELOPER_CONSOLE_HELP).toHaveLength(15);
  });

  it('rejects unsafe amounts, malformed arguments, and unknown commands', () => {
    expect(parseDeveloperCommand('coin 0').ok).toBe(false);
    expect(parseDeveloperCommand('coin 100').ok).toBe(false);
    expect(parseDeveloperCommand('floor -1').ok).toBe(false);
    expect(parseDeveloperCommand('spawn').ok).toBe(false);
    expect(parseDeveloperCommand('god now').ok).toBe(false);
    expect(parseDeveloperCommand('unknown').ok).toBe(false);
  });

  it('starts normal runs without the admin-used ranking flag', () => {
    const state = createInitialRunState();

    expect(state.adminUsed).toBe(false);
    expect(isRunEligibleForRanking(state)).toBe(true);

    state.adminUsed = true;
    expect(isRunEligibleForRanking(state)).toBe(false);
  });
});
