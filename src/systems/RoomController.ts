import Phaser from 'phaser';
import { Door } from '../entities/Door';
import { ItemPickup } from '../entities/ItemPickup';
import { Obstacle } from '../entities/Obstacle';
import { createEnemy } from '../entities/enemies/EnemyFactory';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import {
  DEPTH,
  GAME_CENTER_X,
  GAME_CENTER_Y,
  OBSTACLE_TUNING,
  PIXEL_GRID_SIZE,
  ROOM_RECT,
  WALL_THICKNESS,
} from '../config/gameConfig';
import { PASSIVE_ITEMS } from '../data/items';
import { getRoomTemplate } from '../data/rooms';
import type { ItemSystem } from './ItemSystem';
import type { DungeonManager, RoomNode } from './DungeonManager';
import type { RunState } from './RunState';
import { DIRECTIONS, type Direction } from '../utils/directions';
import { randomInt, randomOf, type RandomSource } from '../utils/random';

interface RoomControllerConfig {
  scene: Phaser.Scene;
  dungeon: DungeonManager;
  enemies: Phaser.Physics.Arcade.Group;
  items: Phaser.Physics.Arcade.Group;
  itemSystem: ItemSystem;
  runState: RunState;
  onRoomCleared: (room: RoomNode) => void;
  onEnemyDefeated: (score: number) => void;
  onBossPhaseTwo?: (boss: BaseEnemy) => void;
  random?: RandomSource;
}

export class RoomController {
  readonly walls: Phaser.Physics.Arcade.StaticGroup;
  readonly doors: Phaser.Physics.Arcade.Group;
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;

  private readonly scene: Phaser.Scene;
  private readonly dungeon: DungeonManager;
  private readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly items: Phaser.Physics.Arcade.Group;
  private readonly itemSystem: ItemSystem;
  private readonly runState: RunState;
  private readonly onRoomCleared: (room: RoomNode) => void;
  private readonly onEnemyDefeated: (score: number) => void;
  private readonly onBossPhaseTwo?: (boss: BaseEnemy) => void;
  private readonly random: RandomSource;
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
    this.onBossPhaseTwo = config.onBossPhaseTwo;
    this.random = config.random ?? Math.random;

    this.floorGraphics = this.scene.add.graphics();
    this.floorGraphics.setDepth(DEPTH.floor);
    this.walls = this.scene.physics.add.staticGroup();
    this.doors = this.scene.physics.add.group({ allowGravity: false, immovable: true });
    this.obstacles = this.scene.physics.add.staticGroup();

    this.createWalls();
    this.createDoors();
  }

  enterCurrentRoom(): void {
    this.enemies.clear(true, true);
    this.items.clear(true, true);
    this.obstacles.clear(true, true);

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

    this.spawnObstacles(room);
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
      return { x: GAME_CENTER_X, y: GAME_CENTER_Y };
    }

    if (direction === 'north') {
      return { x: GAME_CENTER_X, y: ROOM_RECT.bottom - 28 };
    }

    if (direction === 'south') {
      return { x: GAME_CENTER_X, y: ROOM_RECT.top + 28 };
    }

    if (direction === 'east') {
      return { x: ROOM_RECT.left + 28, y: GAME_CENTER_Y };
    }

    return { x: ROOM_RECT.right - 28, y: GAME_CENTER_Y };
  }

  private spawnCombatRoom(room: RoomNode): void {
    const template = getRoomTemplate(room.templateId);
    const spawnSet = [...randomOf(template.spawnSets, this.random)];
    const extraEnemies =
      room.type === 'combat' ? Math.min(4, Math.floor((this.runState.floor - 1) * 0.8)) : 0;

    for (let i = 0; i < extraEnemies; i += 1) {
      spawnSet.push({
        enemyId: randomOf(['chaser', 'shooter', 'dasher'] as const, this.random),
        x: randomInt(96, 384, this.random),
        y: randomInt(64, 208, this.random),
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

      if (enemy.isBoss && this.onBossPhaseTwo) {
        enemy.once('boss-phase-two', this.onBossPhaseTwo);
      }
    }
  }

  private spawnObstacles(room: RoomNode): void {
    const positions = getRoomTemplate(room.templateId).obstacles ?? [];

    if (!room.obstacleHealth) {
      room.obstacleHealth = positions.map(() => OBSTACLE_TUNING.maxHealth);
    }

    positions.forEach((position, index) => {
      const health = room.obstacleHealth?.[index] ?? OBSTACLE_TUNING.maxHealth;

      if (health <= 0) {
        return;
      }

      const obstacle = new Obstacle(this.scene, position.x, position.y, health, (remaining) => {
        if (room.obstacleHealth) {
          room.obstacleHealth[index] = remaining;
        }
      });
      this.obstacles.add(obstacle);
    });
  }

  private spawnReward(room: RoomNode): void {
    if (!room.rewardItemId) {
      room.rewardItemId = this.itemSystem.pickRewardItem(this.runState.collectedItemIds).id;
    }

    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === room.rewardItemId);

    if (!item) {
      return;
    }

    const pickup = new ItemPickup(this.scene, GAME_CENTER_X, GAME_CENTER_Y, item);
    this.items.add(pickup);
  }

  private spawnTreasure(room: RoomNode): void {
    if (room.treasureClaimed) {
      return;
    }

    if (!room.rewardItemId) {
      room.rewardItemId = this.itemSystem.pickTreasureItem(this.runState.collectedItemIds).id;
    }

    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === room.rewardItemId);

    if (item) {
      this.items.add(new ItemPickup(this.scene, GAME_CENTER_X, GAME_CENTER_Y, item));
    }
  }

  private drawRoom(accentColor: number): void {
    this.floorGraphics.clear();
    this.floorGraphics.fillStyle(0x090e14, 1);
    this.floorGraphics.fillRect(
      ROOM_RECT.left - 8,
      ROOM_RECT.top - 8,
      ROOM_RECT.width + 16,
      ROOM_RECT.height + 16,
    );
    this.floorGraphics.fillStyle(0x121a22, 1);
    this.floorGraphics.fillRect(ROOM_RECT.left, ROOM_RECT.top, ROOM_RECT.width, ROOM_RECT.height);
    this.floorGraphics.lineStyle(1, 0x293640, 0.42);

    for (let x = ROOM_RECT.left + PIXEL_GRID_SIZE; x < ROOM_RECT.right; x += PIXEL_GRID_SIZE) {
      this.floorGraphics.lineBetween(x, ROOM_RECT.top, x, ROOM_RECT.bottom);
    }

    for (let y = ROOM_RECT.top + PIXEL_GRID_SIZE; y < ROOM_RECT.bottom; y += PIXEL_GRID_SIZE) {
      this.floorGraphics.lineBetween(ROOM_RECT.left, y, ROOM_RECT.right, y);
    }

    for (let x = ROOM_RECT.left + 8; x < ROOM_RECT.right; x += 64) {
      for (let y = ROOM_RECT.top + 8; y < ROOM_RECT.bottom; y += 64) {
        this.floorGraphics.fillStyle(0x60717e, 0.28);
        this.floorGraphics.fillCircle(x, y, 2);
        this.floorGraphics.fillCircle(x + 48, y + 48, 2);
      }
    }

    this.floorGraphics.lineStyle(2, accentColor, 0.9);
    this.floorGraphics.strokeRect(
      ROOM_RECT.left + 2,
      ROOM_RECT.top + 2,
      ROOM_RECT.width - 4,
      ROOM_RECT.height - 4,
    );

    const corner = 18;
    this.floorGraphics.lineStyle(3, accentColor, 1);
    this.floorGraphics.lineBetween(
      ROOM_RECT.left + 8,
      ROOM_RECT.top + 8,
      ROOM_RECT.left + corner,
      ROOM_RECT.top + 8,
    );
    this.floorGraphics.lineBetween(
      ROOM_RECT.left + 8,
      ROOM_RECT.top + 8,
      ROOM_RECT.left + 8,
      ROOM_RECT.top + corner,
    );
    this.floorGraphics.lineBetween(
      ROOM_RECT.right - 8,
      ROOM_RECT.top + 8,
      ROOM_RECT.right - corner,
      ROOM_RECT.top + 8,
    );
    this.floorGraphics.lineBetween(
      ROOM_RECT.right - 8,
      ROOM_RECT.top + 8,
      ROOM_RECT.right - 8,
      ROOM_RECT.top + corner,
    );
    this.floorGraphics.lineBetween(
      ROOM_RECT.left + 8,
      ROOM_RECT.bottom - 8,
      ROOM_RECT.left + corner,
      ROOM_RECT.bottom - 8,
    );
    this.floorGraphics.lineBetween(
      ROOM_RECT.left + 8,
      ROOM_RECT.bottom - 8,
      ROOM_RECT.left + 8,
      ROOM_RECT.bottom - corner,
    );
    this.floorGraphics.lineBetween(
      ROOM_RECT.right - 8,
      ROOM_RECT.bottom - 8,
      ROOM_RECT.right - corner,
      ROOM_RECT.bottom - 8,
    );
    this.floorGraphics.lineBetween(
      ROOM_RECT.right - 8,
      ROOM_RECT.bottom - 8,
      ROOM_RECT.right - 8,
      ROOM_RECT.bottom - corner,
    );
  }

  private createWalls(): void {
    this.addWall(
      GAME_CENTER_X,
      ROOM_RECT.top - WALL_THICKNESS / 2,
      ROOM_RECT.width,
      WALL_THICKNESS,
    );
    this.addWall(
      GAME_CENTER_X,
      ROOM_RECT.bottom + WALL_THICKNESS / 2,
      ROOM_RECT.width,
      WALL_THICKNESS,
    );
    this.addWall(
      ROOM_RECT.left - WALL_THICKNESS / 2,
      GAME_CENTER_Y,
      WALL_THICKNESS,
      ROOM_RECT.height,
    );
    this.addWall(
      ROOM_RECT.right + WALL_THICKNESS / 2,
      GAME_CENTER_Y,
      WALL_THICKNESS,
      ROOM_RECT.height,
    );
  }

  private addWall(x: number, y: number, width: number, height: number): void {
    const wall = this.scene.add.rectangle(x, y, width, height, 0x26323c, 1);
    wall.setStrokeStyle(2, 0x5f707d, 0.85);
    wall.setDepth(DEPTH.floor + 1);
    this.scene.physics.add.existing(wall, true);
    this.walls.add(wall);
  }

  private createDoors(): void {
    const positions: Record<Direction, { x: number; y: number }> = {
      north: { x: GAME_CENTER_X, y: ROOM_RECT.top + 8 },
      south: { x: GAME_CENTER_X, y: ROOM_RECT.bottom - 8 },
      east: { x: ROOM_RECT.right - 8, y: GAME_CENTER_Y },
      west: { x: ROOM_RECT.left + 8, y: GAME_CENTER_Y },
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
