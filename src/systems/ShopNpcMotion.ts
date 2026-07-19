export const SHOP_NPC_PUSH_SPEED = 24;
export const SHOP_NPC_RETURN_SPEED = 18;
export const SHOP_NPC_RETURN_DELAY_MS = 110;
export const SHOP_NPC_MAX_DISPLACEMENT = 3;

export interface MotionVector {
  x: number;
  y: number;
}

export function getShopNpcPushVelocity(
  npcX: number,
  npcY: number,
  sourceX: number,
  sourceY: number,
): MotionVector | null {
  return normalizeToSpeed(npcX - sourceX, npcY - sourceY, SHOP_NPC_PUSH_SPEED);
}

export function getShopNpcReturnVelocity(
  npcX: number,
  npcY: number,
  homeX: number,
  homeY: number,
): MotionVector | null {
  return normalizeToSpeed(homeX - npcX, homeY - npcY, SHOP_NPC_RETURN_SPEED);
}

export function clampShopNpcToHome(
  npcX: number,
  npcY: number,
  homeX: number,
  homeY: number,
): MotionVector {
  const offsetX = npcX - homeX;
  const offsetY = npcY - homeY;
  const distance = Math.hypot(offsetX, offsetY);

  if (distance <= SHOP_NPC_MAX_DISPLACEMENT || distance === 0) {
    return { x: npcX, y: npcY };
  }

  const scale = SHOP_NPC_MAX_DISPLACEMENT / distance;
  return {
    x: homeX + offsetX * scale,
    y: homeY + offsetY * scale,
  };
}

function normalizeToSpeed(x: number, y: number, speed: number): MotionVector | null {
  const length = Math.hypot(x, y);

  if (length === 0) {
    return null;
  }

  return { x: (x / length) * speed, y: (y / length) * speed };
}
