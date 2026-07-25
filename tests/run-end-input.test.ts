import { describe, expect, it } from 'vitest';
import { isRunEndConfirmCode } from '../src/utils/runEndInput';

describe('run-end confirm input', () => {
  it.each(['Enter', 'NumpadEnter', 'Space'])('accepts %s', (code) => {
    expect(isRunEndConfirmCode(code)).toBe(true);
  });

  it.each(['Escape', 'KeyW', 'ArrowUp'])('ignores %s', (code) => {
    expect(isRunEndConfirmCode(code)).toBe(false);
  });
});
