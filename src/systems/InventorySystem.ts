import { INVENTORY_TUNING } from '../config/gameConfig';
import type { ConsumableType } from '../data/rewards';
import type { InventoryState } from './RunState';

export function addConsumable(
  inventory: InventoryState,
  type: ConsumableType,
  amount: number,
): InventoryState {
  return {
    ...inventory,
    [type]: Math.min(INVENTORY_TUNING.maxConsumable, inventory[type] + amount),
  };
}

export function spendConsumable(
  inventory: InventoryState,
  type: ConsumableType,
  amount: number,
): InventoryState | null {
  if (inventory[type] < amount) {
    return null;
  }

  return {
    ...inventory,
    [type]: inventory[type] - amount,
  };
}
