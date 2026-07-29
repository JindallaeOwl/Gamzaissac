import { describe, expect, it } from 'vitest';
import {
  calculateExpandedMinimapCellLayout,
  calculateMinimapCapacity,
  calculateMinimapViewport,
} from '../src/ui/MinimapLayout';

describe('expanded minimap layout', () => {
  it('enlarges a compact room layout to fill the expanded panel', () => {
    const layout = calculateExpandedMinimapCellLayout(3, 3, 118, 82);

    expect(layout.size).toBe(18);
    expect(layout.gap).toBe(4.5);
  });

  it('shrinks larger floor layouts enough to stay inside the panel', () => {
    const layout = calculateExpandedMinimapCellLayout(5, 4, 118, 82);
    const renderedWidth = 5 * layout.size + 4 * layout.gap;
    const renderedHeight = 4 * layout.size + 3 * layout.gap;

    expect(renderedWidth).toBeLessThanOrEqual(102);
    expect(renderedHeight).toBeLessThanOrEqual(66);
    expect(layout.size).toBeGreaterThan(10);
  });

  // 간격에는 최소값이 있어서, 비례식만으로 칸 크기를 잡으면 실제 렌더 크기가 패널을
  // 넘긴다. 실측상 가장 큰 맵(7x8)에서 확장 미니맵이 넘치던 회귀를 막는다.
  it('keeps the tallest generated layout inside the panel despite the minimum gap', () => {
    const layout = calculateExpandedMinimapCellLayout(7, 8, 118, 82);
    const renderedWidth = 7 * layout.size + 6 * layout.gap;
    const renderedHeight = 8 * layout.size + 7 * layout.gap;

    expect(renderedWidth).toBeLessThanOrEqual(102);
    expect(renderedHeight).toBeLessThanOrEqual(66);
    expect(layout.size).toBeGreaterThan(0);
  });
});

describe('minimap capacity', () => {
  it('counts how many cells fit, first cell needing no gap', () => {
    // 작은 미니맵 기준: 64x48 패널에 칸 6 + 간격 2.
    expect(calculateMinimapCapacity(64, 6, 2)).toBe(8);
    expect(calculateMinimapCapacity(48, 6, 2)).toBe(6);
  });

  it('never drops below one cell', () => {
    expect(calculateMinimapCapacity(4, 6, 2)).toBe(1);
    expect(calculateMinimapCapacity(64, 0, 2)).toBe(1);
  });
});

describe('minimap viewport', () => {
  const base = { mapMinX: 0, mapMaxX: 9, mapMinY: 0, mapMaxY: 9, focusX: 5, focusY: 5 };

  it('shows the whole map when it fits, ignoring the focus', () => {
    const viewport = calculateMinimapViewport({
      ...base,
      mapMaxX: 3,
      mapMaxY: 3,
      focusX: 0,
      focusY: 3,
      columnCapacity: 8,
      rowCapacity: 6,
    });

    expect(viewport).toEqual({ minX: 0, maxX: 3, minY: 0, maxY: 3 });
  });

  it('centers on the focused room once the map is larger than the panel', () => {
    const viewport = calculateMinimapViewport({
      ...base,
      columnCapacity: 5,
      rowCapacity: 5,
    });

    // 용량 5, 중심 5 → 5-2 = 3부터 7까지.
    expect(viewport).toEqual({ minX: 3, maxX: 7, minY: 3, maxY: 7 });
  });

  it('stops at the map edges instead of scrolling past them', () => {
    const nearStart = calculateMinimapViewport({
      ...base,
      focusX: 0,
      focusY: 0,
      columnCapacity: 5,
      rowCapacity: 5,
    });
    const nearEnd = calculateMinimapViewport({
      ...base,
      focusX: 9,
      focusY: 9,
      columnCapacity: 5,
      rowCapacity: 5,
    });

    expect(nearStart).toEqual({ minX: 0, maxX: 4, minY: 0, maxY: 4 });
    expect(nearEnd).toEqual({ minX: 5, maxX: 9, minY: 5, maxY: 9 });
  });

  it('always keeps the focused room inside the viewport', () => {
    for (let focus = 0; focus <= 9; focus += 1) {
      const viewport = calculateMinimapViewport({
        ...base,
        focusX: focus,
        focusY: focus,
        columnCapacity: 4,
        rowCapacity: 4,
      });

      expect(viewport.minX, `focus ${focus}`).toBeLessThanOrEqual(focus);
      expect(viewport.maxX, `focus ${focus}`).toBeGreaterThanOrEqual(focus);
      expect(viewport.maxX - viewport.minX + 1, `focus ${focus}`).toBe(4);
    }
  });

  it('handles negative room coordinates', () => {
    const viewport = calculateMinimapViewport({
      mapMinX: -4,
      mapMaxX: 2,
      mapMinY: -1,
      mapMaxY: 1,
      focusX: -4,
      focusY: 0,
      columnCapacity: 3,
      rowCapacity: 6,
    });

    expect(viewport).toEqual({ minX: -4, maxX: -2, minY: -1, maxY: 1 });
  });
});
