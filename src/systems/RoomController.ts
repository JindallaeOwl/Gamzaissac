import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { Door } from '../entities/Door';
import { ItemPickup } from '../entities/ItemPickup';
import { Obstacle } from '../entities/Obstacle';
import { ShopOffer } from '../entities/ShopOffer';
import { ShopNpc } from '../entities/ShopNpc';
import { createEnemy } from '../entities/enemies/EnemyFactory';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import {
  DEPTH,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  OBSTACLE_TUNING,
  ROOM_CLEAR_DOOR_DELAY_MS,
  ROOM_RECT,
  scaleRoomTemplatePoint,
  WALL_THICKNESS,
} from '../config/gameConfig';
import { PASSIVE_ITEMS } from '../data/items';
import { ENEMY_DEFINITIONS, type EnemyId } from '../data/enemies';
import { getRoomTemplate } from '../data/rooms';
import { getStageProgress, resolveRoomAccentColor } from '../data/stages';
import {
  getAllowedSummonCount,
  getBossSummonSpawns,
  getReinforcementCount,
  getReinforcementPool,
  getSplitChildSpawns,
} from './EnemyReinforcementRules';
import {
  SHOP_NPC_DISPLAY_SIZE,
  SHOP_NPC_POSITION,
  SHOP_NPC_SPEECH_GAP,
  SHOP_OFFER_POSITIONS,
} from '../data/shop';
import type { ItemSystem } from './ItemSystem';
import type { DungeonManager, RoomNode } from './DungeonManager';
import { isRunEnded, type RunState } from './RunState';
import { shouldExecuteDeferredSummon } from './WormKingRules';
import { DIRECTIONS, type Direction } from '../utils/directions';
import { randomInt, randomOf, type RandomSource } from '../utils/random';
import { BossRewardSystem } from './BossRewardSystem';
import type { ShopSystem } from './ShopSystem';
import { createShopNpcSpeechBubble } from '../ui/ShopNpcSpeechBubble';
import { t } from '../i18n';
import {
  canEnemiesActAfterRoomEntry,
  getRoomEntryEnemyAiResumeAt,
  resolveEnemySpawnAwayFromEntry,
  type RoomPoint,
} from './RoomEntrySafety';
import {
  FLOOR_TILE_SIZE,
  hashSeed,
  pickFloorDecoration,
  type FloorDecoration,
} from './floorPixelSprites';

// 장식 종류 → 타일 텍스처 키 매핑.
const FLOOR_DECORATION_TEXTURES: Record<FloorDecoration, string> = {
  pebbles: TextureKeys.floorSoilPebbles,
  roots: TextureKeys.floorSoilRoots,
  cracks: TextureKeys.floorSoilCracks,
  damp: TextureKeys.floorSoilDamp,
};

// 보스가 전투 중 새끼를 소환할 때 실어 보내는 요청. maxAlive로 동시 생존 수를 제한한다.
interface BossSummonRequest {
  childId: EnemyId;
  count: number;
  maxAlive: number;
}

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
  // 보스가 탄·접촉이 아닌 직접 피해(근접 휘두르기·부메랑)로 플레이어를 맞혔을 때,
  // 기존 공통 피격 피드백을 내기 위한 콜백.
  onPlayerDamaged?: () => void;
  random?: RandomSource;
}

export class RoomController {
  readonly walls: Phaser.Physics.Arcade.StaticGroup;
  readonly doors: Phaser.Physics.Arcade.Group;
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  readonly shopOffers: Phaser.GameObjects.Group;
  readonly shopNpcs: Phaser.Physics.Arcade.Group;

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
  private readonly onPlayerDamaged?: () => void;
  private readonly random: RandomSource;
  private readonly doorSprites = new Map<Direction, Door>();
  private readonly floorGraphics: Phaser.GameObjects.Graphics;
  private readonly floorTileSprite: Phaser.GameObjects.TileSprite;
  private readonly floorDecorations: Phaser.GameObjects.Group;
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
    this.onPlayerDamaged = config.onPlayerDamaged;
    this.random = config.random ?? Math.random;

    // 바닥은 세 층으로 쌓는다: 흙 베이스 TileSprite → 장식 타일(돌·뿌리·균열·습기)
    // → 경계·스테이지 액센트를 그리는 floorGraphics. 모두 벽(DEPTH.floor + 1) 아래.
    this.floorTileSprite = this.scene.add.tileSprite(
      ROOM_CENTER_X,
      ROOM_CENTER_Y,
      ROOM_RECT.width,
      ROOM_RECT.height,
      TextureKeys.floorSoilBase,
    );
    this.floorTileSprite.setDepth(DEPTH.floor);
    this.floorDecorations = this.scene.add.group();
    this.floorGraphics = this.scene.add.graphics();
    this.floorGraphics.setDepth(DEPTH.floor + 0.5);
    this.walls = this.scene.physics.add.staticGroup();
    this.doors = this.scene.physics.add.group({ allowGravity: false, immovable: true });
    this.obstacles = this.scene.physics.add.staticGroup();
    this.shopOffers = this.scene.add.group();
    this.shopNpcs = this.scene.physics.add.group({ allowGravity: false });
    this.shopDecorations = this.scene.add.group();

    this.createWalls();
    this.createWallVisuals();
    this.createDoors();
  }

  // 아이작류 입체감의 벽 외형. 위쪽 벽은 흙 단면(정면), 좌우는 어두운 옆면(오른쪽은
  // flipX로 미러), 아래는 윗면 캡. 위·아래 띠는 모서리까지 덮도록 벽 두께만큼 넓힌다.
  // 물리 충돌은 createWalls의 보이지 않는 사각형이 그대로 담당한다.
  private createWallVisuals(): void {
    const depth = DEPTH.floor + 0.75;
    const bandWidth = ROOM_RECT.width + WALL_THICKNESS * 2;

    this.scene.add
      .tileSprite(
        ROOM_CENTER_X,
        ROOM_RECT.top - WALL_THICKNESS / 2,
        bandWidth,
        WALL_THICKNESS,
        TextureKeys.wallSoilFace,
      )
      .setDepth(depth);
    this.scene.add
      .tileSprite(
        ROOM_CENTER_X,
        ROOM_RECT.bottom + WALL_THICKNESS / 2,
        bandWidth,
        WALL_THICKNESS,
        TextureKeys.wallSoilCap,
      )
      .setDepth(depth);
    this.scene.add
      .tileSprite(
        ROOM_RECT.left - WALL_THICKNESS / 2,
        ROOM_CENTER_Y,
        WALL_THICKNESS,
        ROOM_RECT.height,
        TextureKeys.wallSoilSide,
      )
      .setDepth(depth);
    this.scene.add
      .tileSprite(
        ROOM_RECT.right + WALL_THICKNESS / 2,
        ROOM_CENTER_Y,
        WALL_THICKNESS,
        ROOM_RECT.height,
        TextureKeys.wallSoilSide,
      )
      .setFlipX(true)
      .setDepth(depth);
  }

  enterCurrentRoom(entryPosition?: RoomPoint): void {
    this.enemies.clear(true, true);
    this.items.clear(true, true);
    this.obstacles.clear(true, true);
    this.shopOffers.clear(true, true);
    this.shopNpcs.clear(true, true);
    this.shopDecorations.clear(true, true);

    const room = this.dungeon.getCurrentRoom();
    const template = getRoomTemplate(room.templateId);
    const hasWaitingEnemies = (room.type === 'combat' || room.type === 'boss') && !room.cleared;
    this.enemyAiResumeAt = hasWaitingEnemies
      ? getRoomEntryEnemyAiResumeAt(this.scene.time.now)
      : this.scene.time.now;
    this.drawRoom(
      resolveRoomAccentColor(
        room.type,
        template.accentColor,
        getStageProgress(this.runState.floor).stage.accentColor,
      ),
    );
    this.updateDoors(room);

    if ((room.type === 'combat' || room.type === 'boss') && !room.cleared) {
      this.spawnCombatRoom(room, entryPosition);
    }

    if (room.type === 'shop') {
      this.spawnShop(room, true);
    }

    if (room.type === 'treasure') {
      this.spawnTreasure(room);
    }

    if (room.type === 'combat' && room.cleared) {
      this.spawnCombatItemReward(room);
    }

    if (room.type === 'boss' && room.cleared) {
      this.spawnBossReward(room);
    }

    this.spawnObstacles(room);
  }

  update(): void {
    for (const npc of this.shopNpcs.getChildren() as ShopNpc[]) {
      if (npc.active) {
        npc.updateMotion(this.scene.time.now);
      }
    }

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
    this.shopNpcs.clear(true, true);
    this.shopDecorations.clear(true, true);
    this.spawnShop(room, false);
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

    this.items.add(new ItemPickup(this.scene, ROOM_CENTER_X, ROOM_CENTER_Y + 40, item, 'boss'));
  }

  spawnCombatItemReward(room: RoomNode): void {
    if (room.type !== 'combat' || room.combatItemRewardClaimed) {
      return;
    }

    if (!room.combatItemRewardRolled) {
      room.combatItemRewardRolled = true;
      room.combatItemRewardId = this.itemSystem.rollCombatRewardItem(
        this.runState.collectedItemIds,
        this.runState.stats.luck,
      )?.id;
    }

    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === room.combatItemRewardId);

    if (item) {
      this.items.add(new ItemPickup(this.scene, ROOM_CENTER_X, ROOM_CENTER_Y - 26, item));
    }
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
      return { x: ROOM_CENTER_X, y: ROOM_CENTER_Y };
    }

    if (direction === 'north') {
      return { x: ROOM_CENTER_X, y: ROOM_RECT.bottom - 28 };
    }

    if (direction === 'south') {
      return { x: ROOM_CENTER_X, y: ROOM_RECT.top + 28 };
    }

    if (direction === 'east') {
      return { x: ROOM_RECT.left + 28, y: ROOM_CENTER_Y };
    }

    return { x: ROOM_RECT.right - 28, y: ROOM_CENTER_Y };
  }

  private spawnCombatRoom(room: RoomNode, entryPosition?: RoomPoint): void {
    const template = getRoomTemplate(room.templateId);
    // Template coordinates are authored in the original one-screen room space,
    // so they are mapped into the current (possibly larger) room first.
    const spawnSet = randomOf(template.spawnSets, this.random).map((spawn) => ({
      ...spawn,
      ...scaleRoomTemplatePoint(spawn.x, spawn.y),
    }));
    const extraEnemies = getReinforcementCount(this.runState.floor, room.type);
    const extraPool = getReinforcementPool(this.runState.floor);

    for (let i = 0; i < extraEnemies; i += 1) {
      spawnSet.push({
        enemyId: randomOf(extraPool, this.random),
        x: randomInt(ROOM_RECT.left + 64, ROOM_RECT.right - 64, this.random),
        y: randomInt(ROOM_RECT.top + 32, ROOM_RECT.bottom - 32, this.random),
      });
    }

    const occupiedPositions: RoomPoint[] = [];
    const obstaclePositions = (template.obstacles ?? []).map((position) =>
      scaleRoomTemplatePoint(position.x, position.y),
    );

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
      this.registerSpawnedEnemy(enemy, spawn.enemyId);
    }
  }

  private registerSpawnedEnemy(enemy: BaseEnemy, enemyId: EnemyId): void {
    enemy.once('enemy-defeated', this.onEnemyDefeated);

    if (enemy.isBoss && this.onBossPhaseTwo) {
      enemy.once('boss-phase-two', this.onBossPhaseTwo);
    }

    // A boss (e.g. the Worm King) summons adds by emitting an event repeatedly
    // rather than creating enemies itself, mirroring the split path below.
    if (enemy.isBoss) {
      enemy.on('boss-summon', (payload: BossSummonRequest) =>
        this.handleBossSummon(enemy, payload),
      );
      // Direct-damage attacks (Farmer's melee swing / boomerang) call player.damage
      // themselves, so they route their hit feedback through here on a real hit.
      enemy.on('player-damaged', () => this.onPlayerDamaged?.());
    }

    // A splitter spawns its children while it is still counted as active, so the
    // room never briefly registers zero enemies and opens its doors early.
    if (ENEMY_DEFINITIONS[enemyId].splitChildId) {
      enemy.once('enemy-defeated', () => this.spawnSplitChildren(enemy, enemyId));
    }
  }

  private handleBossSummon(boss: BaseEnemy, request: BossSummonRequest): void {
    const roomId = this.dungeon.getCurrentRoom().id;

    // The event fires from inside the enemy update loop, so defer the spawn to
    // avoid mutating the enemies group while it is being iterated. By the time it
    // runs the boss may be dead, the room may have changed, or the run may have
    // ended (game over / escape) — only summon when all three are still valid.
    this.scene.time.delayedCall(0, () => {
      const canSummon = shouldExecuteDeferredSummon({
        bossActive: boss.active,
        sameRoom: this.dungeon.getCurrentRoom().id === roomId,
        runEnded: isRunEnded(this.runState),
      });

      if (!canSummon) {
        return;
      }

      // countActive includes the boss itself, so subtract it to count only adds.
      const aliveAdds = Math.max(0, this.enemies.countActive(true) - 1);
      const spawnCount = getAllowedSummonCount(request.count, aliveAdds, request.maxAlive);

      if (spawnCount <= 0) {
        return;
      }

      const spawns = getBossSummonSpawns(
        request.childId,
        spawnCount,
        boss.x,
        boss.y,
        ROOM_RECT,
        this.random,
      );

      for (const spawn of spawns) {
        const child = createEnemy(
          this.scene,
          this.enemies,
          spawn.enemyId,
          spawn.x,
          spawn.y,
          this.runState.floor,
        );
        this.registerSpawnedEnemy(child, spawn.enemyId);
      }
    });
  }

  private spawnSplitChildren(parent: BaseEnemy, parentId: EnemyId): void {
    const childSpawns = getSplitChildSpawns(parentId, parent.x, parent.y, ROOM_RECT, this.random);

    for (const spawn of childSpawns) {
      const child = createEnemy(
        this.scene,
        this.enemies,
        spawn.enemyId,
        spawn.x,
        spawn.y,
        this.runState.floor,
      );
      this.registerSpawnedEnemy(child, spawn.enemyId);
    }
  }

  private spawnObstacles(room: RoomNode): void {
    const positions = (getRoomTemplate(room.templateId).obstacles ?? []).map((position) =>
      scaleRoomTemplatePoint(position.x, position.y),
    );

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

  private spawnShop(room: RoomNode, showGreeting: boolean): void {
    if (!room.shopOffers) {
      room.shopOffers = this.shopSystem.createOffers(this.runState.collectedItemIds);
    }

    const npcPosition = scaleRoomTemplatePoint(SHOP_NPC_POSITION.x, SHOP_NPC_POSITION.y);
    const npc = new ShopNpc(this.scene, npcPosition.x, npcPosition.y);
    this.shopNpcs.add(npc);
    // 상인 머리 위. 크기에서 파생시켜 상인을 키워도 말풍선이 겹치지 않는다.
    const speechY = npcPosition.y - SHOP_NPC_DISPLAY_SIZE / 2 - SHOP_NPC_SPEECH_GAP;

    if (showGreeting) {
      const shopRoomId = room.id;
      const greeting = createShopNpcSpeechBubble(
        this.scene,
        npcPosition.x,
        speechY,
        t('shop.greeting'),
        {
          visibleMs: 3000,
          onDismiss: () => {
            if (this.dungeon.getCurrentRoom().id !== shopRoomId) {
              return;
            }

            const followUp = createShopNpcSpeechBubble(
              this.scene,
              npcPosition.x,
              speechY,
              t('shop.greetingFollowUp'),
              { visibleMs: 3000 },
            );
            this.shopDecorations.add(followUp);
          },
        },
      );
      this.shopDecorations.add(greeting);
    }

    for (const offer of room.shopOffers) {
      if (offer.purchased) {
        continue;
      }

      const position = SHOP_OFFER_POSITIONS[offer.slot];

      if (position) {
        const worldPosition = scaleRoomTemplatePoint(position.x, position.y);
        this.shopOffers.add(new ShopOffer(this.scene, worldPosition.x, worldPosition.y, offer));
      }
    }
  }

  private spawnTreasure(room: RoomNode): void {
    if (room.treasureClaimed) {
      return;
    }

    if (!room.treasureItemId) {
      room.treasureItemId = this.itemSystem.pickTreasureItem(this.runState.collectedItemIds)?.id;
    }

    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === room.treasureItemId);

    if (item) {
      this.items.add(new ItemPickup(this.scene, ROOM_CENTER_X, ROOM_CENTER_Y, item));
    }
  }

  private drawRoom(accentColor: number): void {
    // 바닥 본체는 흙 타일(TileSprite + 장식 산재)이, 벽 외형은 벽 TileSprite가
    // 담당한다. 이 그래픽은 벽 밑 접촉 그림자와 스테이지 액센트 테두리만 그린다.
    this.floorGraphics.clear();

    this.refreshFloorDecorations();

    // 벽 밑 접촉 그림자(계단식 띠): 위에서 빛이 든다고 가정하고 위쪽 벽 아래를
    // 가장 짙게 깐다. 아이작류 입체감의 핵심 단서로, 겹치는 모서리는 자연히 더 어둡다.
    this.floorGraphics.fillStyle(0x000000, 0.24);
    this.floorGraphics.fillRect(ROOM_RECT.left, ROOM_RECT.top, ROOM_RECT.width, 4);
    this.floorGraphics.fillStyle(0x000000, 0.12);
    this.floorGraphics.fillRect(ROOM_RECT.left, ROOM_RECT.top + 4, ROOM_RECT.width, 2);
    this.floorGraphics.fillStyle(0x000000, 0.14);
    this.floorGraphics.fillRect(ROOM_RECT.left, ROOM_RECT.top, 4, ROOM_RECT.height);
    this.floorGraphics.fillRect(ROOM_RECT.right - 4, ROOM_RECT.top, 4, ROOM_RECT.height);
    this.floorGraphics.fillStyle(0x000000, 0.1);
    this.floorGraphics.fillRect(ROOM_RECT.left, ROOM_RECT.bottom - 2, ROOM_RECT.width, 2);

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

  // 흙 바닥 위 장식 타일(돌·뿌리·균열·습기)을 칸 단위로 산재시킨다. 배치는
  // (층:방 id) 시드 기반 결정론이라 같은 방에 다시 들어와도 무늬가 유지된다.
  private refreshFloorDecorations(): void {
    this.floorDecorations.clear(true, true);

    const room = this.dungeon.getCurrentRoom();
    const seed = hashSeed(`${this.runState.floor}:${room.id}`);
    const columns = Math.floor(ROOM_RECT.width / FLOOR_TILE_SIZE);
    const rows = Math.floor(ROOM_RECT.height / FLOOR_TILE_SIZE);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const decoration = pickFloorDecoration(column, row, columns, rows, seed);

        if (!decoration) {
          continue;
        }

        const image = this.scene.add.image(
          ROOM_RECT.left + column * FLOOR_TILE_SIZE + FLOOR_TILE_SIZE / 2,
          ROOM_RECT.top + row * FLOOR_TILE_SIZE + FLOOR_TILE_SIZE / 2,
          FLOOR_DECORATION_TEXTURES[decoration],
        );
        image.setDepth(DEPTH.floor + 0.25);
        this.floorDecorations.add(image);
      }
    }
  }

  private createWalls(): void {
    this.addWall(
      ROOM_CENTER_X,
      ROOM_RECT.top - WALL_THICKNESS / 2,
      ROOM_RECT.width,
      WALL_THICKNESS,
    );
    this.addWall(
      ROOM_CENTER_X,
      ROOM_RECT.bottom + WALL_THICKNESS / 2,
      ROOM_RECT.width,
      WALL_THICKNESS,
    );
    this.addWall(
      ROOM_RECT.left - WALL_THICKNESS / 2,
      ROOM_CENTER_Y,
      WALL_THICKNESS,
      ROOM_RECT.height,
    );
    this.addWall(
      ROOM_RECT.right + WALL_THICKNESS / 2,
      ROOM_CENTER_Y,
      WALL_THICKNESS,
      ROOM_RECT.height,
    );
  }

  private addWall(x: number, y: number, width: number, height: number): void {
    // 외형은 createWallVisuals의 흙 벽 TileSprite가 담당하므로 물리 몸체만 남긴다.
    const wall = this.scene.add.rectangle(x, y, width, height, 0x000000, 0);
    wall.setVisible(false);
    this.scene.physics.add.existing(wall, true);
    this.walls.add(wall);
  }

  private createDoors(): void {
    const positions: Record<Direction, { x: number; y: number }> = {
      north: { x: ROOM_CENTER_X, y: ROOM_RECT.top + 8 },
      south: { x: ROOM_CENTER_X, y: ROOM_RECT.bottom - 8 },
      east: { x: ROOM_RECT.right - 8, y: ROOM_CENTER_Y },
      west: { x: ROOM_RECT.left + 8, y: ROOM_CENTER_Y },
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
