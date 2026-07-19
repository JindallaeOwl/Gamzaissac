import Phaser from 'phaser';
import { Door } from '../entities/Door';
import { ItemPickup } from '../entities/ItemPickup';
import { Obstacle } from '../entities/Obstacle';
import { ShopOffer } from '../entities/ShopOffer';
import { createEnemy } from '../entities/enemies/EnemyFactory';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import {
  DEPTH,
  GAME_CENTER_X,
  GAME_CENTER_Y,
  OBSTACLE_TUNING,
  PIXEL_GRID_SIZE,
  ROOM_CLEAR_DOOR_DELAY_MS,
  ROOM_RECT,
  WALL_THICKNESS,
} from '../config/gameConfig';
import { PASSIVE_ITEMS } from '../data/items';
import { getRoomTemplate } from '../data/rooms';
import { SHOP_NPC_DISPLAY_SIZE, SHOP_NPC_POSITION, SHOP_OFFER_POSITIONS } from '../data/shop';
import { AnimationKeys, TextureKeys } from '../config/assets';
import type { ItemSystem } from './ItemSystem';
import type { DungeonManager, RoomNode } from './DungeonManager';
import type { RunState } from './RunState';
import { DIRECTIONS, type Direction } from '../utils/directions';
import { randomInt, randomOf, type RandomSource } from '../utils/random';
import { BossRewardSystem } from './BossRewardSystem';
import type { ShopSystem } from './ShopSystem';
import {
  canEnemiesActAfterRoomEntry,
  getRoomEntryEnemyAiResumeAt,
  resolveEnemySpawnAwayFromEntry,
  type RoomPoint,
} from './RoomEntrySafety';

interface RoomControllerConfig {
  scene: Phaser.Scene;
  dungeon: DungeonManager;
  enemies: Phaser.Physics.Arcade.Group;
  items: Phaser.Physics.Arcade.Group;
  itemSystem: ItemSystem;
  shopSystem: ShopSystem;
  runState: RunState;
  onRoomCleared: (room: RoomNode) => void;
  onEnemyDefeated: (score: number) => void;
  onObstacleDestroyed?: (x: number, y: number) => void;
  onBossPhaseTwo?: (boss: BaseEnemy) => void;
  random?: RandomSource;
}

export class RoomController {
  readonly walls: Phaser.Physics.Arcade.StaticGroup;
  readonly doors: Phaser.Physics.Arcade.Group;
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  readonly shopOffers: Phaser.GameObjects.Group;

  private readonly scene: Phaser.Scene;
  private readonly dungeon: DungeonManager;
  private readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly items: Phaser.Physics.Arcade.Group;
  private readonly itemSystem: ItemSystem;
  private readonly bossRewardSystem: BossRewardSystem;
  private readonly shopSystem: ShopSystem;
  private readonly runState: RunState;
  private readonly onRoomCleared: (room: RoomNode) => void;
  private readonly onEnemyDefeated: (score: number) => void;
  private readonly onObstacleDestroyed?: (x: number, y: number) => void;
  private readonly onBossPhaseTwo?: (boss: BaseEnemy) => void;
  private readonly random: RandomSource;
  private readonly doorSprites = new Map<Direction, Door>();
  private readonly floorGraphics: Phaser.GameObjects.Graphics;
  private readonly shopDecorations: Phaser.GameObjects.Group;
  private enemyAiResumeAt = 0;

  constructor(config: RoomControllerConfig) {
    this.scene = config.scene;
    this.dungeon = config.dungeon;
    this.enemies = config.enemies;
    this.items = config.items;
    this.itemSystem = config.itemSystem;
    this.bossRewardSystem = new BossRewardSystem(config.itemSystem);
    this.shopSystem = config.shopSystem;
    this.runState = config.runState;
    this.onRoomCleared = config.onRoomCleared;
    this.onEnemyDefeated = config.onEnemyDefeated;
    this.onObstacleDestroyed = config.onObstacleDestroyed;
    this.onBossPhaseTwo = config.onBossPhaseTwo;
    this.random = config.random ?? Math.random;

    this.floorGraphics = this.scene.add.graphics();
    this.floorGraphics.setDepth(DEPTH.floor);
    this.walls = this.scene.physics.add.staticGroup();
    this.doors = this.scene.physics.add.group({ allowGravity: false, immovable: true });
    this.obstacles = this.scene.physics.add.staticGroup();
    this.shopOffers = this.scene.add.group();
    this.shopDecorations = this.scene.add.group();

    this.createWalls();
    this.createDoors();
  }

  enterCurrentRoom(entryPosition?: RoomPoint): void {
    this.enemies.clear(true, true);
    this.items.clear(true, true);
    this.obstacles.clear(true, true);
    this.shopOffers.clear(true, true);
    this.shopDecorations.clear(true, true);

    const room = this.dungeon.getCurrentRoom();
    const template = getRoomTemplate(room.templateId);
    const hasWaitingEnemies = (room.type === 'combat' || room.type === 'boss') && !room.cleared;
    this.enemyAiResumeAt = hasWaitingEnemies
      ? getRoomEntryEnemyAiResumeAt(this.scene.time.now)
      : this.scene.time.now;
    this.drawRoom(template.accentColor);
    this.updateDoors(room);

    if ((room.type === 'combat' || room.type === 'boss') && !room.cleared) {
      this.spawnCombatRoom(room, entryPosition);
    }

    if (room.type === 'shop') {
      this.spawnShop(room);
    }

    if (room.type === 'treasure') {
      this.spawnTreasure(room);
    }

    if (room.type === 'boss' && room.cleared) {
      this.spawnBossReward(room);
    }

    this.spawnObstacles(room);
  }

  update(): void {
    const room = this.dungeon.getCurrentRoom();

    if ((room.type !== 'combat' && room.type !== 'boss') || room.cleared) {
      return;
    }

    if (this.enemies.countActive(true) === 0 && this.dungeon.markCurrentCleared()) {
      this.updateDoors(room, true);
      this.onRoomCleared(room);
      const clearedRoomId = room.id;
      this.scene.time.delayedCall(ROOM_CLEAR_DOOR_DELAY_MS, () => {
        if (this.dungeon.getCurrentRoom().id === clearedRoomId) {
          this.updateDoors(room, false, true);
        }
      });
    }
  }

  canEnemiesAct(time: number): boolean {
    return canEnemiesActAfterRoomEntry(time, this.enemyAiResumeAt);
  }

  refreshCurrentShop(): boolean {
    const room = this.dungeon.getCurrentRoom();

    if (room.type !== 'shop') {
      return false;
    }

    this.shopOffers.clear(true, true);
    this.shopDecorations.clear(true, true);
    this.spawnShop(room);
    return true;
  }

  spawnBossReward(room: RoomNode): void {
    if (room.type !== 'boss') {
      return;
    }

    const item = this.bossRewardSystem.resolveReward(room, this.runState.collectedItemIds);

    if (!item) {
      return;
    }

    this.items.add(new ItemPickup(this.scene, GAME_CENTER_X, GAME_CENTER_Y + 40, item, 'boss'));
  }

  updateDoorEntryGates(playerBody: Phaser.Physics.Arcade.Body): void {
    for (const door of this.doorSprites.values()) {
      if (door.active && door.isOpen) {
        door.updateEntryGate(playerBody);
      }
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

  private spawnCombatRoom(room: RoomNode, entryPosition?: RoomPoint): void {
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

    const occupiedPositions: RoomPoint[] = [];
    const obstaclePositions = template.obstacles ?? [];

    for (const spawn of spawnSet) {
      const safePosition = resolveEnemySpawnAwayFromEntry(
        spawn,
        entryPosition,
        occupiedPositions,
        obstaclePositions,
      );
      const enemy = createEnemy(
        this.scene,
        this.enemies,
        spawn.enemyId,
        safePosition.x,
        safePosition.y,
        this.runState.floor,
      );
      occupiedPositions.push(safePosition);
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

      const obstacle = new Obstacle(
        this.scene,
        position.x,
        position.y,
        health,
        (remaining) => {
          if (room.obstacleHealth) {
            room.obstacleHealth[index] = remaining;
          }
        },
        this.onObstacleDestroyed,
      );
      this.obstacles.add(obstacle);
    });
  }

  private spawnShop(room: RoomNode): void {
    if (!room.shopOffers) {
      room.shopOffers = this.shopSystem.createOffers(this.runState.collectedItemIds);
    }

    const npc = this.scene.add.sprite(
      SHOP_NPC_POSITION.x,
      SHOP_NPC_POSITION.y,
      TextureKeys.shopNpcIdleA,
    );
    if (this.scene.anims.exists(AnimationKeys.shopNpcIdle)) {
      npc.play(AnimationKeys.shopNpcIdle);
    }
    npc.setDisplaySize(SHOP_NPC_DISPLAY_SIZE, SHOP_NPC_DISPLAY_SIZE);
    npc.setDepth(DEPTH.actor);
    this.shopDecorations.add(npc);

    for (const offer of room.shopOffers) {
      if (offer.purchased) {
        continue;
      }

      const position = SHOP_OFFER_POSITIONS[offer.slot];

      if (position) {
        this.shopOffers.add(new ShopOffer(this.scene, position.x, position.y, offer));
      }
    }
  }

  private spawnTreasure(room: RoomNode): void {
    if (room.treasureClaimed) {
      return;
    }

    if (!room.treasureItemId) {
      room.treasureItemId = this.itemSystem.pickTreasureItem(this.runState.collectedItemIds).id;
    }

    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === room.treasureItemId);

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

  private updateDoors(room: RoomNode, forceClosed = false, requireFreshEntry = false): void {
    for (const direction of DIRECTIONS) {
      const door = this.doorSprites.get(direction);

      if (!door) {
        continue;
      }

      const hasExit = room.exits.includes(direction);
      const targetRoom = hasExit ? this.dungeon.getNeighbor(room, direction) : null;
      const isLockedSpecialRoom =
        (targetRoom?.type === 'shop' || targetRoom?.type === 'treasure') &&
        !targetRoom.specialRoomUnlocked;
      door.setVisible(hasExit);
      door.setActive(hasExit);
      door.setOpen(room.cleared && !forceClosed, requireFreshEntry);
      door.clearTint();

      if (hasExit && isLockedSpecialRoom && room.cleared) {
        door.setTint(targetRoom.type === 'shop' ? 0xcaa64f : 0x7f6bd9);
      }

      const body = door.body as Phaser.Physics.Arcade.Body;
      body.enable = hasExit;
    }
  }
}
