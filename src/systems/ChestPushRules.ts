export const CHEST_PUSH_SPEED = 76;
export const CHEST_PUSH_DRAG = 420;
export const CHEST_PUSH_COOLDOWN_MS = 90;

export interface ChestPushVelocity {
  x: number;
  y: number;
}

export function getChestPushVelocity(x: number, y: number): ChestPushVelocity | null {
  const length = Math.hypot(x, y);

  if (length < 0.1) {
    return null;
  }

  return {
    x: (x / length) * CHEST_PUSH_SPEED,
    y: (y / length) * CHEST_PUSH_SPEED,
  };
}

export function estimateChestSlideDistance(): number {
  return (CHEST_PUSH_SPEED * CHEST_PUSH_SPEED) / (2 * CHEST_PUSH_DRAG);
}
