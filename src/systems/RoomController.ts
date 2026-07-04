import Phaser from 'phaser';
import { Door } from '../entities/Door';
import { ItemPickup } from '../entities/ItemPickup';
import { createEnemy } from '../entities/enemies/EnemyFactory';
import { DEPTH, ROOM_RECT, WALL_THICKNESS } from '../config/gameConfig';
import { PASSIVE_ITEMS, TEST_BEAM_ITEM_ID } from '../data/items';
import { getRoomTemplate } from '../data/rooms';
import type { ItemSystem } from './ItemSystem';
import type { DungeonManager, RoomNode } from './DungeonManager';
import type { RunState } from './RunState';
import { DIRECTIONS, type Direction } from '../utils/directions';
import { randomInt, randomOf } from '../utils/random';

interface RoomControllerConfig {
  scene: Phaser.Scene;
  dungeon: DungeonManager;
  enemies: Phaser.Physics.Arcade.Group;
  items: Phaser.Physics.Arcade.Group;
  itemSystem: ItemSystem;
  runState: RunState;
  onRoomCleared: (room: RoomNode) => void;
  onEnemyDefeated: (score: number) => void;
}

export class RoomController {
  readonly walls: Phaser.Physics.Arcade.StaticGroup;
  readonly doors: Phaser.Physics.Arcade.Group;

  private readonly scene: Phaser.Scene;
  private readonly dungeon: DungeonManager;
  private readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly items: Phaser.Physics.Arcade.Group;
  private readonly itemSystem: ItemSystem;
  private readonly runState: RunState;
  private readonly onRoomCleared: (room: RoomNode) => void;
  private readonly onEnemyDefeated: (score: number) => void;
  private readonly doorSprites = new Map<Direction, Door>();
  private readonly floorGraphics: Phaser.GameObjects.Graphics;

  constructor(config: RoomControllerConfig) {
    this.scene = config.scene;
    this.dungeon = config.dungeon;
    this.enemies = config.enemies;
    this.items = config.items;
    this.itemSystem = config.itemSystem;
    this.runState = config.runState;
    this.onRoomCleared = config.onRoomCleared;
    this.onEnemyDefeated = config.onEnemyDefeated;

    this.floorGraphics = this.scene.add.graphics();
    this.floorGraphics.setDepth(DEPTH.floor);
    this.walls = this.scene.physics.add.staticGroup();
    this.doors = this.scene.physics.add.group({ allowGravity: false, immovable: true });

    this.createWalls();
    this.createDoors();
  }

  enterCurrentRoom(): void {
    this.enemies.clear(true, true);
    this.items.clear(true, true);

    const room = this.dungeon.getCurrentRoom();
    const template = getRoomTemplate(room.templateId);
    this.drawRoom(template.accentColor);
    this.updateDoors(room);

    if ((room.type === 'combat' || room.type === 'boss') && !room.cleared) {
      this.spawnCombatRoom(room);
    }

    if (room.type === 'reward' && !room.rewardClaimed) {
      this.spawnReward(room);
    }

    if (room.type === 'treasure') {
      this.spawnTreasure(room);
    }
  }

  update(): void {
    const room = this.dungeon.getCurrentRoom();

    if ((room.type !== 'combat' && room.type !== 'boss') || room.cleared) {
      return;
    }

    if (this.enemies.countActive(true) === 0 && this.dungeon.markCurrentCleared()) {
      this.updateDoors(room);
      this.onRoomCleared(room);
    }
  }

  getSpawnPositionForEntry(direction: Direction | null): { x: number; y: number } {
    if (!direction) {
      return { x: 480, y: 320 };
    }

    if (direction === 'north') {
      return { x: 480, y: ROOM_RECT.bottom - 58 };
    }

    if (direction === 'south') {
      return { x: 480, y: ROOM_RECT.top + 58 };
    }

    if (direction === 'east') {
      return { x: ROOM_RECT.left + 58, y: 320 };
    }

    return { x: ROOM_RECT.right - 58, y: 320 };
  }

  private spawnCombatRoom(room: RoomNode): void {
    const template = getRoomTemplate(room.templateId);
    const spawnSet = [...randomOf(template.spawnSets)];
    const extraEnemies = Math.min(4, Math.floor((this.runState.floor - 1) * 0.8));

    for (let i = 0; i < extraEnemies; i += 1) {
      spawnSet.push({
        enemyId: randomOf(['chaser', 'shooter', 'dasher'] as const),
        x: randomInt(190, 770),
        y: randomInt(160, 480),
      });
    }

    for (const spawn of spawnSet) {
      const enemy = createEnemy(
        this.scene,
        this.enemies,
        spawn.enemyId,
        spawn.x,
        spawn.y,
        this.runState.floor,
      );
      enemy.once('enemy-defeated', this.onEnemyDefeated);
    }
  }

  private spawnReward(room: RoomNode): void {
    if (!room.rewardItemId) {
      room.rewardItemId = this.itemSystem.pickRewardItem(this.runState.collectedItemIds).id;
    }

    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === room.rewardItemId);

    if (!item) {
      return;
    }

    const pickup = new ItemPickup(this.scene, 480, 320, item);
    this.items.add(pickup);
  }

  private spawnTreasure(room: RoomNode): void {
    if (!room.treasureClaimed) {
      if (!room.rewardItemId) {
        room.rewardItemId = this.itemSystem.pickTreasureItem(this.runState.collectedItemIds).id;
      }

      const item = PASSIVE_ITEMS.find((candidate) => candidate.id === room.rewardItemId);

      if (item) {
        this.items.add(new ItemPickup(this.scene, 480, 320, item));
      }
    }

    if (!room.beamItemClaimed && !this.runState.unlockedAbilityIds.includes('charge-beam')) {
      const beamItem = PASSIVE_ITEMS.find((candidate) => candidate.id === TEST_BEAM_ITEM_ID);

      if (beamItem) {
        this.items.add(
          new ItemPickup(this.scene, ROOM_RECT.left + 86, ROOM_RECT.top + 76, beamItem),
        );
      }
    }
  }

  private drawRoom(accentColor: number): void {
    this.floorGraphics.clear();
    this.floorGraphics.fillStyle(0x121820, 1);
    this.floorGraphics.fillRect(ROOM_RECT.left, ROOM_RECT.top, ROOM_RECT.width, ROOM_RECT.height);
    this.floorGraphics.lineStyle(2, accentColor, 0.45);

    for (let x = ROOM_RECT.left + 40; x < ROOM_RECT.right; x += 40) {
      this.floorGraphics.lineBetween(x, ROOM_RECT.top, x, ROOM_RECT.bottom);
    }

    for (let y = ROOM_RECT.top + 40; y < ROOM_RECT.bottom; y += 40) {
      this.floorGraphics.lineBetween(ROOM_RECT.left, y, ROOM_RECT.right, y);
    }

    this.floorGraphics.lineStyle(4, accentColor, 1);
    this.floorGraphics.strokeRect(
      ROOM_RECT.left + 2,
      ROOM_RECT.top + 2,
      ROOM_RECT.width - 4,
      ROOM_RECT.height - 4,
    );
  }

  private createWalls(): void {
    this.addWall(480, ROOM_RECT.top - WALL_THICKNESS / 2, ROOM_RECT.width, WALL_THICKNESS);
    this.addWall(480, ROOM_RECT.bottom + WALL_THICKNESS / 2, ROOM_RECT.width, WALL_THICKNESS);
    this.addWall(ROOM_RECT.left - WALL_THICKNESS / 2, 320, WALL_THICKNESS, ROOM_RECT.height);
    this.addWall(ROOM_RECT.right + WALL_THICKNESS / 2, 320, WALL_THICKNESS, ROOM_RECT.height);
  }

  private addWall(x: number, y: number, width: number, height: number): void {
    const wall = this.scene.add.rectangle(x, y, width, height, 0x303843, 1);
    wall.setDepth(DEPTH.floor + 1);
    this.scene.physics.add.existing(wall, true);
    this.walls.add(wall);
  }

  private createDoors(): void {
    const positions: Record<Direction, { x: number; y: number }> = {
      north: { x: 480, y: ROOM_RECT.top + 15 },
      south: { x: 480, y: ROOM_RECT.bottom - 15 },
      east: { x: ROOM_RECT.right - 15, y: 320 },
      west: { x: ROOM_RECT.left + 15, y: 320 },
    };

    for (const direction of DIRECTIONS) {
      const position = positions[direction];
      const door = new Door(this.scene, position.x, position.y, direction);
      this.doors.add(door);
      this.doorSprites.set(direction, door);
    }
  }

  private updateDoors(room: RoomNode): void {
    for (const direction of DIRECTIONS) {
      const door = this.doorSprites.get(direction);

      if (!door) {
        continue;
      }

      const hasExit = room.exits.includes(direction);
      const targetRoom = hasExit ? this.dungeon.getNeighbor(room, direction) : null;
      const isLockedTreasure = targetRoom?.type === 'treasure' && !targetRoom.treasureUnlocked;
      door.setVisible(hasExit);
      door.setActive(hasExit);
      door.setOpen(room.cleared);

      if (hasExit && isLockedTreasure && room.cleared) {
        door.setTint(0x7f6bd9);
      }

      const body = door.body as Phaser.Physics.Arcade.Body;
      body.enable = hasExit;
    }
  }
}
