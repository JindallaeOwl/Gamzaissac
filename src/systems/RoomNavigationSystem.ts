import { INVENTORY_TUNING } from '../config/gameConfig';
import type { Direction } from '../utils/directions';
import type { DungeonManager, RoomNode } from './DungeonManager';
import { spendConsumable } from './InventorySystem';
import type { RunState } from './RunState';

export type RoomNavigationResult =
  | { status: 'no-target' }
  | { status: 'key-needed' }
  | { status: 'moved'; room: RoomNode; treasureUnlocked: boolean };

export class RoomNavigationSystem {
  constructor(private readonly dungeon: DungeonManager) {}

  tryMove(runState: RunState, direction: Direction): RoomNavigationResult {
    const targetRoom = this.dungeon.peek(direction);

    if (!targetRoom) {
      return { status: 'no-target' };
    }

    let treasureUnlocked = false;

    if (targetRoom.type === 'treasure' && !targetRoom.treasureUnlocked) {
      const updatedInventory = spendConsumable(
        runState.inventory,
        'keys',
        INVENTORY_TUNING.treasureRoomKeyCost,
      );

      if (!updatedInventory) {
        return { status: 'key-needed' };
      }

      runState.inventory = updatedInventory;
      this.dungeon.unlockRoom(targetRoom.id);
      treasureUnlocked = true;
    }

    const room = this.dungeon.move(direction);

    if (!room) {
      return { status: 'no-target' };
    }

    return { status: 'moved', room, treasureUnlocked };
  }
}
