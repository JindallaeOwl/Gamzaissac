export const CHEST_PUSH_SPEED = 76;
export const CHEST_PUSH_DRAG = 420;
export const CHEST_PUSH_COOLDOWN_MS = 90;
export const HEART_PUSH_SPEED = 52;
export const HEART_PUSH_DRAG = 520;
export const HEART_PUSH_COOLDOWN_MS = 120;

export interface ChestPushVelocity {
  x: number;
  y: number;
}

export function getChestPushVelocity(x: number, y: number): ChestPushVelocity | null {
  return getPushVelocity(x, y, CHEST_PUSH_SPEED);
}

export function getHeartPushVelocity(x: number, y: number): ChestPushVelocity | null {
  return getPushVelocity(x, y, HEART_PUSH_SPEED);
}

function getPushVelocity(x: number, y: number, speed: number): ChestPushVelocity | null {
  const length = Math.hypot(x, y);

  if (length < 0.1) {
    return null;
  }

  return {
    x: (x / length) * speed,
    y: (y / length) * speed,
  };
}

export function estimateChestSlideDistance(): number {
  return (CHEST_PUSH_SPEED * CHEST_PUSH_SPEED) / (2 * CHEST_PUSH_DRAG);
}

export function estimateHeartSlideDistance(): number {
  return (HEART_PUSH_SPEED * HEART_PUSH_SPEED) / (2 * HEART_PUSH_DRAG);
}
