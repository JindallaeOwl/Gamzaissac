import Phaser from 'phaser';
import { FloorExit } from '../entities/FloorExit';
import type { Player } from '../entities/Player';
import { RewardPickup } from '../entities/RewardPickup';
import { ROOM_CENTER_X, ROOM_CENTER_Y, ROOM_ENTRY_PROTECTION_MS } from '../config/gameConfig';
import type { Direction } from '../utils/directions';
import type { BombSystem } from './BombSystem';
import type { DungeonManager, PendingDroppedReward, RoomNode } from './DungeonManager';
import type { RewardDrop } from './RewardSystem';
import type { RoomController } from './RoomController';

interface RoomTransitionSystemConfig {
  scene: Phaser.Scene;
  dungeon: DungeonManager;
  roomController: RoomController;
  bombSystem: BombSystem;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  playerBullets: Phaser.Physics.Arcade.Group;
  enemyBullets: Phaser.Physics.Arcade.Group;
  beams: Phaser.Physics.Arcade.Group;
  items: Phaser.Physics.Arcade.Group;
  rewards: Phaser.Physics.Arcade.Group;
  floorExits: Phaser.Physics.Arcade.Group;
}

export class RoomTransitionSystem {
  private readonly scene: Phaser.Scene;
  private readonly dungeon: DungeonManager;
  private readonly roomController: RoomController;
  private readonly bombSystem: BombSystem;
  private readonly player: Player;
  private readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly playerBullets: Phaser.Physics.Arcade.Group;
  private readonly enemyBullets: Phaser.Physics.Arcade.Group;
  private readonly beams: Phaser.Physics.Arcade.Group;
  private readonly items: Phaser.Physics.Arcade.Group;
  private readonly rewards: Phaser.Physics.Arcade.Group;
  private readonly floorExits: Phaser.Physics.Arcade.Group;

  constructor(config: RoomTransitionSystemConfig) {
    this.scene = config.scene;
    this.dungeon = config.dungeon;
    this.roomController = config.roomController;
    this.bombSystem = config.bombSystem;
    this.player = config.player;
    this.enemies = config.enemies;
    this.playerBullets = config.playerBullets;
    this.enemyBullets = config.enemyBullets;
    this.beams = config.beams;
    this.items = config.items;
    this.rewards = config.rewards;
    this.floorExits = config.floorExits;
  }

  enterRoom(room: RoomNode, entryDirection: Direction): void {
    this.clearTransientObjects(false);
    const spawnPosition = this.roomController.getSpawnPositionForEntry(entryDirection);
    this.movePlayerTo(spawnPosition.x, spawnPosition.y);
    this.player.grantInvulnerability(ROOM_ENTRY_PROTECTION_MS);
    this.roomController.enterCurrentRoom(spawnPosition);
    this.restorePendingReward(room);
    this.restoreDroppedRewards(room);
    this.restoreFloorExit(room);
  }

  enterRoomDirect(room: RoomNode): void {
    this.clearTransientObjects(false);
    const spawnPosition = this.roomController.getSpawnPositionForEntry('north');
    this.movePlayerTo(spawnPosition.x, spawnPosition.y);
    this.player.grantInvulnerability(ROOM_ENTRY_PROTECTION_MS);
    this.roomController.enterCurrentRoom(spawnPosition);
    this.restorePendingReward(room);
    this.restoreDroppedRewards(room);
    this.restoreFloorExit(room);
  }

  enterFloor(floor: number, hasChargeBeam: boolean): void {
    this.movePlayerTo(ROOM_CENTER_X, ROOM_CENTER_Y);
    this.clearTransientObjects(true);
    this.dungeon.generateFloor(floor);
    this.player.hasChargeBeam = hasChargeBeam;
    this.roomController.enterCurrentRoom();
  }

  spawnPendingReward(room: RoomNode): void {
    const pending = room.pendingReward;

    if (!pending) {
      return;
    }

    const pickup = new RewardPickup(this.scene, pending.x, pending.y, pending.reward);
    pickup.setData('sourceRoomId', room.id);

    if (pending.opened) {
      pickup.openChest();
    }

    this.rewards.add(pickup);
  }

  spawnPersistentReward(room: RoomNode, reward: RewardDrop, x: number, y: number): boolean {
    const droppedReward = this.dungeon.addDroppedReward(room.id, reward, x, y);

    if (!droppedReward) {
      return false;
    }

    this.spawnDroppedReward(room, droppedReward);
    return true;
  }

  private spawnDroppedReward(room: RoomNode, droppedReward: PendingDroppedReward): void {
    const pickup = new RewardPickup(
      this.scene,
      droppedReward.x,
      droppedReward.y,
      droppedReward.reward,
    );
    pickup.setData('sourceRoomId', room.id);
    pickup.setData('droppedRewardId', droppedReward.id);

    if (droppedReward.opened) {
      pickup.openChest();
    }

    this.rewards.add(pickup);
  }

  markPendingChestOpened(pickup: RewardPickup): void {
    const sourceRoomId = pickup.getData('sourceRoomId') as string | undefined;
    const droppedRewardId = pickup.getData('droppedRewardId') as number | undefined;

    if (sourceRoomId && droppedRewardId !== undefined && pickup.isChest) {
      this.dungeon.updateDroppedReward(sourceRoomId, droppedRewardId, pickup.x, pickup.y, true);
    } else if (sourceRoomId && pickup.isChest) {
      this.dungeon.updatePendingChest(sourceRoomId, pickup.x, pickup.y, true);
    }
  }

  clearPendingRewardForPickup(pickup: RewardPickup): void {
    const sourceRoomId = pickup.getData('sourceRoomId') as string | undefined;
    const droppedRewardId = pickup.getData('droppedRewardId') as number | undefined;

    if (sourceRoomId && droppedRewardId !== undefined) {
      this.dungeon.clearDroppedReward(sourceRoomId, droppedRewardId);
    } else if (sourceRoomId) {
      this.dungeon.clearPendingReward(sourceRoomId);
    }
  }

  spawnFloorExit(): void {
    if (this.floorExits.countActive(true) > 0) {
      return;
    }

    this.floorExits.add(new FloorExit(this.scene, ROOM_CENTER_X, ROOM_CENTER_Y));
  }

  private clearTransientObjects(includeRoomEntities: boolean): void {
    this.savePendingRewardPositions();
    this.playerBullets.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.beams.clear(true, true);
    this.rewards.clear(true, true);
    this.floorExits.clear(true, true);
    this.bombSystem.clear();

    if (includeRoomEntities) {
      this.enemies.clear(true, true);
      this.items.clear(true, true);
    }
  }

  private savePendingRewardPositions(): void {
    for (const pickup of this.rewards.getChildren() as RewardPickup[]) {
      const sourceRoomId = pickup.getData('sourceRoomId') as string | undefined;
      const droppedRewardId = pickup.getData('droppedRewardId') as number | undefined;

      if (!pickup.active || !pickup.isPushable || !sourceRoomId) {
        continue;
      }

      if (droppedRewardId !== undefined) {
        this.dungeon.updateDroppedReward(
          sourceRoomId,
          droppedRewardId,
          pickup.x,
          pickup.y,
          pickup.isOpenedChest || undefined,
        );
      } else if (pickup.isChest) {
        this.dungeon.updatePendingChest(sourceRoomId, pickup.x, pickup.y, pickup.isOpenedChest);
      } else {
        this.dungeon.updatePendingRewardPosition(sourceRoomId, pickup.x, pickup.y);
      }
    }
  }

  private movePlayerTo(x: number, y: number): void {
    this.player.setPosition(x, y);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  private restorePendingReward(room: RoomNode): void {
    if (room.pendingReward) {
      this.spawnPendingReward(room);
    }
  }

  private restoreDroppedRewards(room: RoomNode): void {
    for (const droppedReward of room.droppedRewards) {
      this.spawnDroppedReward(room, droppedReward);
    }
  }

  private restoreFloorExit(room: RoomNode): void {
    if (room.type === 'boss' && room.cleared) {
      this.spawnFloorExit();
    }
  }
}
