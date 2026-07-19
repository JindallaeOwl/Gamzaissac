import { describe, expect, it } from 'vitest';
import { getDeveloperConsoleSuggestions } from '../src/systems/DeveloperConsoleAutocomplete';

describe('developer console autocomplete', () => {
  it('suggests command names from a partial prefix', () => {
    expect(getDeveloperConsoleSuggestions('sp')[0]).toMatchObject({
      completion: 'spawn ',
    });
    expect(getDeveloperConsoleSuggestions('tre')[0]).toMatchObject({
      completion: 'treasure',
    });
    expect(getDeveloperConsoleSuggestions('help')).toEqual([]);
  });

  it('suggests numbered items after the spawn command', () => {
    const suggestions = getDeveloperConsoleSuggestions('spawn 01');

    expect(suggestions).toContainEqual({
      completion: 'spawn 013',
      label: 'ID: 013  prism-lance',
    });
    expect(getDeveloperConsoleSuggestions('spawn 013')).toEqual([]);
  });

  it('suggests item IDs and special pickups after the spawn command', () => {
    expect(getDeveloperConsoleSuggestions('spawn red')[0]).toMatchObject({
      completion: 'spawn red-mushroom',
    });
    expect(getDeveloperConsoleSuggestions('spawn fi')[0]).toMatchObject({
      completion: 'spawn five-coin',
    });
  });
});
