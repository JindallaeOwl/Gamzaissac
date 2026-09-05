import { describe, expect, it } from 'vitest';
import { ACTIVE_ITEMS } from '../src/data/activeItems';
import {
  activeEntry,
  catalogEntryId,
  catalogEntryNumber,
  findCatalogEntry,
  ITEM_CATALOG,
  passiveEntry,
} from '../src/data/itemCatalog';
import { PASSIVE_ITEMS } from '../src/data/items';
import { getDeveloperConsoleSuggestions } from '../src/systems/DeveloperConsoleAutocomplete';

describe('item catalog', () => {
  it('holds every passive and active item exactly once', () => {
    expect(ITEM_CATALOG).toHaveLength(PASSIVE_ITEMS.length + ACTIVE_ITEMS.length);
    expect(new Set(ITEM_CATALOG.map(catalogEntryId)).size).toBe(ITEM_CATALOG.length);
  });

  it('is ordered by item number', () => {
    const numbers = ITEM_CATALOG.map(catalogEntryNumber);

    expect(numbers).toEqual([...numbers].sort((left, right) => left - right));
  });

  it('keeps item numbers unique across both kinds', () => {
    // 번호가 겹치면 `spawn 037`이 어느 것을 뜻하는지 모호해진다.
    expect(new Set(ITEM_CATALOG.map(catalogEntryNumber)).size).toBe(ITEM_CATALOG.length);
  });

  it('finds every item by id and by number, with the right kind', () => {
    for (const item of PASSIVE_ITEMS) {
      expect(findCatalogEntry(item.id)).toEqual(passiveEntry(item));
      expect(findCatalogEntry(String(item.itemNumber))).toEqual(passiveEntry(item));
    }

    for (const item of ACTIVE_ITEMS) {
      expect(findCatalogEntry(item.id)).toEqual(activeEntry(item));
      expect(findCatalogEntry(String(item.itemNumber))).toEqual(activeEntry(item));
    }
  });

  it('finds zero padded numbers the console actually types', () => {
    for (const item of ACTIVE_ITEMS) {
      const padded = item.itemNumber.toString().padStart(3, '0');

      expect(findCatalogEntry(padded)).toEqual(activeEntry(item));
    }
  });

  it('returns nothing for unknown references', () => {
    expect(findCatalogEntry('no-such-item')).toBeUndefined();
    expect(findCatalogEntry('999')).toBeUndefined();
    expect(findCatalogEntry('')).toBeUndefined();
  });
});

describe('developer console spawn suggestions', () => {
  it('suggests active items too, not just passives', () => {
    // 콘솔로는 되는데 자동완성에는 안 뜨는 어긋남을 막는다. 이미 다 입력한 것은
    // 제안하지 않는 기존 동작이라, 한 글자 모자란 접두사로 확인한다.
    for (const item of ACTIVE_ITEMS) {
      const typed = `spawn ${item.id.slice(0, -1)}`;
      const suggestions = getDeveloperConsoleSuggestions(typed, 100);

      expect(
        suggestions.some((entry) => entry.completion === `spawn ${item.id}`),
        `${item.id} is missing from spawn autocomplete`,
      ).toBe(true);
    }
  });

  it('suggests an active item by its number', () => {
    for (const item of ACTIVE_ITEMS) {
      const padded = item.itemNumber.toString().padStart(3, '0');
      const suggestions = getDeveloperConsoleSuggestions(`spawn ${padded.slice(0, -1)}`, 100);

      expect(suggestions.some((entry) => entry.completion === `spawn ${padded}`)).toBe(true);
    }
  });
});
