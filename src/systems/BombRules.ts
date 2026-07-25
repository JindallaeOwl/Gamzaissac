import { BOMB_TUNING } from '../config/gameConfig';
import { spendConsumable } from './InventorySystem';
import type { RunState } from './RunState';

export type BombPlantDecision =
  { status: 'planted'; nextBombAt: number } | { status: 'no-bombs' | 'cooldown' | 'blocked' };

export function resolveBombPlantAttempt(
  runState: RunState,
  now: number,
  nextBombAt: number,
  blocked: boolean,
): BombPlantDecision {
  if (blocked) {
    return { status: 'blocked' };
  }

  if (now < nextBombAt) {
    return { status: 'cooldown' };
  }

  const updatedInventory = spendConsumable(runState.inventory, 'bombs', 1);

  if (!updatedInventory) {
    return { status: 'no-bombs' };
  }

  runState.inventory = updatedInventory;
  return { status: 'planted', nextBombAt: now + BOMB_TUNING.cooldownMs };
}

export function isWithinBombRadius(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
): boolean {
  const dx = targetX - originX;
  const dy = targetY - originY;
  return dx * dx + dy * dy <= BOMB_TUNING.radius * BOMB_TUNING.radius;
}

// 설치된 폭탄의 fuse 타이머는 물리 정지와 무관하게 발화할 수 있다.
// 런이 끝난 뒤 도착한 폭발은 피해·장애물 파괴를 실행하지 않는다.
export function shouldDetonateBomb(runEnded: boolean): boolean {
  return !runEnded;
}
