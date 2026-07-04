export type Direction = 'north' | 'south' | 'east' | 'west';

export const DIRECTIONS: Direction[] = ['north', 'south', 'east', 'west'];

export const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

export function moveCoord(
  coord: { x: number; y: number },
  direction: Direction,
): { x: number; y: number } {
  const vector = DIRECTION_VECTORS[direction];
  return { x: coord.x + vector.x, y: coord.y + vector.y };
}
