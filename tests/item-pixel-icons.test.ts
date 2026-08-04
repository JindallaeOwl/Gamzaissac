import { describe, expect, it } from 'vitest';
import { ITEM_IMAGE_ASSETS, itemIconKey } from '../src/config/assets';
import { PASSIVE_ITEMS } from '../src/data/items';
import {
  buildItemIconSprite,
  findItemIconArtProblem,
  hasItemPixelIcon,
  ITEM_ICON_DESIGN_SIZE,
  ITEM_ICON_OUTLINE_COLOR,
  ITEM_PIXEL_ICONS,
  type ItemIconArt,
} from '../src/systems/itemPixelIcons';

const iconEntries = Object.entries(ITEM_PIXEL_ICONS);

function silhouetteKey(art: ItemIconArt): string {
  return art.rows.map((row) => row.replace(/[^.]/g, '#')).join('|');
}

describe('item pixel icons', () => {
  it('authors every icon on a well formed grid', () => {
    const problems = iconEntries
      .map(([id, art]) => [id, findItemIconArtProblem(art)] as const)
      .filter(([, problem]) => problem !== null);

    expect(problems).toEqual([]);
  });

  it('rejects grids that break the authoring rules', () => {
    expect(findItemIconArtProblem({ palette: { a: 0xffffff }, rows: ['aa'] })).toContain('rows');
    expect(
      findItemIconArtProblem({
        palette: { a: 0xffffff },
        rows: Array.from({ length: ITEM_ICON_DESIGN_SIZE }, () => 'a'),
      }),
    ).toContain('characters');
    expect(
      findItemIconArtProblem({
        palette: { a: 0xffffff },
        rows: Array.from({ length: ITEM_ICON_DESIGN_SIZE }, () =>
          'z'.repeat(ITEM_ICON_DESIGN_SIZE),
        ),
      }),
    ).toContain('palette does not define');
  });

  it('belongs to a real item and never duplicates another silhouette', () => {
    const itemIds = new Set(PASSIVE_ITEMS.map((item) => item.id));

    for (const [id] of iconEntries) {
      expect(itemIds.has(id), `${id} has an icon but no item definition`).toBe(true);
    }

    const silhouettes = iconEntries.map(([, art]) => silhouetteKey(art));

    expect(new Set(silhouettes).size).toBe(iconEntries.length);
  });

  it('outlines each icon without clipping it at the grid edge', () => {
    for (const [id, art] of iconEntries) {
      const sprite = buildItemIconSprite(art);
      let outlinePixels = 0;

      for (let y = 0; y < ITEM_ICON_DESIGN_SIZE; y += 1) {
        for (let x = 0; x < ITEM_ICON_DESIGN_SIZE; x += 1) {
          if (sprite.get(x, y) === ITEM_ICON_OUTLINE_COLOR) {
            outlinePixels += 1;
          }
        }
      }

      // A closed outline around any readable shape is far more than a few cells.
      expect(outlinePixels, `${id} is missing its outline`).toBeGreaterThan(12);

      // Art touching an edge would have its outline cut off, so require that the
      // outermost row and column on every side stay empty.
      const blankRow = '.'.repeat(ITEM_ICON_DESIGN_SIZE);
      const last = ITEM_ICON_DESIGN_SIZE - 1;
      const touchesEdge =
        art.rows[0] !== blankRow ||
        art.rows[last] !== blankRow ||
        art.rows.some((row) => row[0] !== '.' || row[last] !== '.');

      expect(touchesEdge, `${id} must leave a one pixel margin for its outline`).toBe(false);
    }
  });

  it('reports which items carry hand-pixeled art', () => {
    expect(hasItemPixelIcon('twin-seed')).toBe(true);
    // The Red Mushroom ships a real PNG, so it needs no grid.
    expect(hasItemPixelIcon('red-mushroom')).toBe(false);
  });

  it('leaves no item on the old badge placeholder', () => {
    const withLoadedImage = new Set(ITEM_IMAGE_ASSETS.map((asset) => asset.key));
    const onBadgeFallback = PASSIVE_ITEMS.filter(
      (item) => !hasItemPixelIcon(item.id) && !withLoadedImage.has(itemIconKey(item.id)),
    ).map((item) => item.id);

    // AssetFactory still falls back to the tinted badge so a missing icon can
    // never crash a run, but no shipped item may rely on it.
    expect(onBadgeFallback).toEqual([]);
  });
});
