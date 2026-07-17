import { describe, expect, it } from 'vitest';
import { getTitleEscapeTarget, getTitleSubtitle, isEscapeCode } from '../src/ui/TitleMenuRules';

describe('title menu rules', () => {
  it('hides the duplicate subtitle while settings are open', () => {
    expect(getTitleSubtitle('main')).toBe('404% roguelike action');
    expect(getTitleSubtitle('settings')).toBe('');
  });

  it('uses Escape to leave settings without affecting the main menu', () => {
    expect(isEscapeCode('Escape')).toBe(true);
    expect(isEscapeCode('Enter')).toBe(false);
    expect(getTitleEscapeTarget('settings')).toBe('main');
    expect(getTitleEscapeTarget('main')).toBeNull();
  });
});
