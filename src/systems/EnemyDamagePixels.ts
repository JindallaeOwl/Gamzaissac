export const ENEMY_PIXEL_FRAGMENTS = 'enemy-pixel-fragments';

export interface FragmentImpact {
  kind: 'beam' | 'explosion';
  x: number;
  y: number;
}

export interface DamageScar {
  x: number;
  y: number;
}

export function fragmentImpulse(impact?: FragmentImpact): { x: number; y: number; power: number } {
  if (!impact) return { x: 0, y: 0, power: 1 };
  const length = Math.hypot(impact.x, impact.y);
  const speed = impact.kind === 'explosion' ? 190 : 145;
  return {
    x: length ? (impact.x / length) * speed : 0,
    y: length ? (impact.y / length) * speed : -speed,
    power: impact.kind === 'explosion' ? 1.65 : 1.25,
  };
}

export interface ColoredFragment {
  x: number;
  y: number;
  color: number;
  size: number;
  dx: number;
  dy: number;
  impact?: FragmentImpact;
}

export interface PixelSample {
  x: number;
  y: number;
  color: number;
}

export function opaquePixels(data: Uint8ClampedArray, width: number): PixelSample[] {
  const pixels: PixelSample[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    pixels.push({
      x: (i / 4) % width,
      y: Math.floor(i / 4 / width),
      color: (data[i] << 16) | (data[i + 1] << 8) | data[i + 2],
    });
  }
  return pixels;
}

/** Pick a small crater on the attack-facing silhouette, including existing holes. */
export function selectChipPixels(
  pixels: readonly PixelSample[],
  width: number,
  height: number,
  sourceX: number,
  sourceY: number,
  budget: number,
): PixelSample[] {
  if (!pixels.length || budget <= 0) return [];
  const dx = sourceX - width / 2;
  const dy = sourceY - height / 2;
  const length = Math.hypot(dx, dy);
  const reach = Math.max(width, height);
  const targetX = width / 2 + (length ? dx / length : 0) * reach;
  const targetY = height / 2 + (length ? dy / length : 1) * reach;
  const distance = (p: PixelSample): number => (p.x - targetX) ** 2 + (p.y - targetY) ** 2;
  const edge = pixels.reduce((best, p) => (distance(p) < distance(best) ? p : best));
  const radius = Math.max(2, Math.min(5, Math.min(width, height) / 10));
  return pixels
    .filter((p) => (p.x - edge.x) ** 2 + (p.y - edge.y) ** 2 <= radius ** 2)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, Math.floor(budget));
}

export function tintPixel(color: number, tint: number): number {
  const channel = (shift: number): number =>
    Math.round((((color >> shift) & 255) * ((tint >> shift) & 255)) / 255);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
