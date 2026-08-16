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
  getDeveloperSpawnPoint,
  getReinforcementCount,
  getReinforcementIds,
  getSplitChildSpawns,
} from './EnemyReinforcementRules';
import {
  getSummonSpawns,
  resolveSummonCount,
  shouldExecuteDeferredSummon,
  SummonOwnershipIndex,
} from './EnemySummonRules';
import {
  SHOP_NPC_DISPLAY_SIZE,
  SHOP_NPC_POSITION,
  SHOP_NPC_SPEECH_GAP,
  SHOP_OFFER_POSITIONS,
} from '../data/shop';
import type { ItemSystem } from './ItemSystem';
import type { DungeonManager, RoomNode, ShopNpcBlastState } from './DungeonManager';
import { isRunEnded, type RunState } from './RunState';
import { DIRECTIONS, type Direction } from '../utils/directions';
import { createSeededRandom, randomInt, randomOf, type RandomSource } from '../utils/random';
import { BossRewardSystem } from './BossRewardSystem';
import { CHAMPION_TUNING, rollChampionIndex } from './ChampionRules';
import type { ShopSystem } from './ShopSystem';
import { createShopNpcSpeechBubble, SHOP_SPEECH_BUBBLE_DATA_KEY } from '../ui/ShopNpcSpeechBubble';
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

// 적이 전투 중 하수인을 부를 때 실어 보내는 요청. maxAlive는 그 적 한 마리가
// 동시에 유지할 수 있는 하수인 수다(방 전체 상한과는 별개).
interface EnemySummonRequest {
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
  /** 챔피언이 죽은 자리 — 처치 보상(보물 상자)을 떨구는 데 쓴다 */
  onChampionDefeated?: (x: number, y: number) => void;
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
  private readonly onChampionDefeated?: (x: number, y: number) => void;
  private readonly onObstacleDestroyed?: (x: number, y: number) => void;
  private readonly onBossPhaseTwo?: (boss: BaseEnemy) => void;
  private readonly onPlayerDamaged?: () => void;
  private readonly random: RandomSource;
  private readonly doorSprites = new Map<Direction, Door>();
  private readonly floorGraphics: Phaser.GameObjects.Graphics;
  private readonly floorTileSprite: Phaser.GameObjects.TileSprite;
  private readonly floorDecorations: Phaser.GameObjects.Group;
  private readonly shopDecorations: Phaser.GameObjects.Group;
  // 소환사별 하수인 소유권. 개인 상한과 방 전체 상한을 따로 세기 위해 필요하다.
  private readonly summonOwnership = new SummonOwnershipIndex<BaseEnemy>();
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
    this.onChampionDefeated = config.onChampionDefeated;
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
    // clear가 자식을 destroy하며 아래 정리 리스너를 깨우므로, 그 뒤에 비운다.
    this.summonOwnership.clear();
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
    // 상한 계산에는 템플릿이 이미 깐 적도 포함해야 한다. 이 시점의 spawnSet은
    // 아직 증원이 더해지기 전이라 곧 템플릿 배치 그대로다.
    const templateEnemyIds = spawnSet.map((spawn) => spawn.enemyId);

    // The rule function applies the per-room caps, so a room can never fill up
    // with the same behaviour-heavy reinforcement.
    for (const enemyId of getReinforcementIds(
      this.runState.floor,
      extraEnemies,
      this.random,
      templateEnemyIds,
    )) {
      spawnSet.push({
        enemyId,
        x: randomInt(ROOM_RECT.left + 64, ROOM_RECT.right - 64, this.random),
        y: randomInt(ROOM_RECT.top + 32, ROOM_RECT.bottom - 32, this.random),
      });
    }

    const occupiedPositions: RoomPoint[] = [];
    const obstaclePositions = (template.obstacles ?? []).map((position) =>
      scaleRoomTemplatePoint(position.x, position.y),
    );
    // 챔피언은 전투방의 자연 스폰에서만, 방마다 한 번만 굴린다 — 방을 나갔다 와서
    // 스폰이 다시 깔려도 재추첨으로 상자를 반복 획득할 수 없다. 보스방은 굴리지
    // 않고, 분열 새끼·소환 하수인·콘솔 스폰은 이 경로를 지나지 않아 자연히 제외된다.
    let championIndex: number | null = null;

    if (room.type === 'combat' && !room.championRolled) {
      room.championRolled = true;
      championIndex = rollChampionIndex(this.random, spawnSet.length, this.runState.floor);
    }

    for (const [index, spawn] of spawnSet.entries()) {
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

      if (index === championIndex) {
        enemy.promoteToChampion(CHAMPION_TUNING);
      }

      occupiedPositions.push(safePosition);
      this.registerSpawnedEnemy(enemy, spawn.enemyId);
    }
  }

  private registerSpawnedEnemy(enemy: BaseEnemy, enemyId: EnemyId): void {
    enemy.once('enemy-defeated', this.onEnemyDefeated);

    // Boss-only wiring. Phase transitions and direct-damage feedback have no
    // meaning for a regular enemy.
    if (enemy.isBoss) {
      if (this.onBossPhaseTwo) {
        enemy.once('boss-phase-two', this.onBossPhaseTwo);
      }

      // Direct-damage attacks (Farmer's melee swing / boomerang) call player.damage
      // themselves, so they route their hit feedback through here on a real hit.
      enemy.on('player-damaged', () => this.onPlayerDamaged?.());
    }

    // Summoning is not boss-only, so the listener goes on every enemy and only
    // the classes that can summon ever emit. Enemies request a summon rather
    // than creating one themselves, mirroring the split path below.
    enemy.on('summon-request', (payload: EnemySummonRequest) =>
      this.handleEnemySummon(enemy, payload),
    );

    // One place to drop an enemy out of the ownership index, whether it died or
    // the room was torn down underneath it.
    enemy.once('destroy', () => this.summonOwnership.forget(enemy));

    // A splitter spawns its children while it is still counted as active, so the
    // room never briefly registers zero enemies and opens its doors early.
    if (ENEMY_DEFINITIONS[enemyId].splitChildId) {
      enemy.once('enemy-defeated', () => this.spawnSplitChildren(enemy, enemyId));
    }

    // 챔피언 처치 보상. 승격은 스폰 경로가 정하지만 배선은 다른 처치 리스너와
    // 같은 집에 둔다 — 새 스폰 경로가 챔피언을 만들어도 여기만 지나면 상자가
    // 빠지지 않는다.
    if (enemy.isChampion) {
      enemy.once('enemy-defeated', () => this.onChampionDefeated?.(enemy.x, enemy.y));
    }
  }

  private handleEnemySummon(summoner: BaseEnemy, request: EnemySummonRequest): void {
    const roomId = this.dungeon.getCurrentRoom().id;

    // The event fires from inside the enemy update loop, so defer the spawn to
    // avoid mutating the enemies group while it is being iterated. By the time it
    // runs the summoner may be dead, the room may have changed, or the run may
    // have ended (game over / escape) — only summon when all three still hold.
    this.scene.time.delayedCall(0, () => {
      const canSummon = shouldExecuteDeferredSummon({
        summonerActive: summoner.active,
        sameRoom: this.dungeon.getCurrentRoom().id === roomId,
        runEnded: isRunEnded(this.runState),
      });

      if (!canSummon) {
        return;
      }

      // Each summoner is charged only for its own minions: a shared count
      // would let whoever summoned first take the whole allowance, and in a
      // combat room the enemies already standing there would be miscounted.
      const spawnCount = resolveSummonCount({
        requested: request.count,
        ownMinionsAlive: this.summonOwnership.countMinionsOf(summoner),
        ownMaxAlive: request.maxAlive,
        roomMinionsAlive: this.summonOwnership.countAllMinions(),
        isBossRoom: this.dungeon.getCurrentRoom().type === 'boss',
      });

      if (spawnCount <= 0) {
        return;
      }

      const spawns = getSummonSpawns(
        request.childId,
        spawnCount,
        summoner.x,
        summoner.y,
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
        this.summonOwnership.remember(summoner, child);
      }
    });
  }

  /**
   * Drops one enemy into the current room for the developer console.
   *
   * Routed through registerSpawnedEnemy like every other spawn so the split and
   * defeat wiring is identical to a naturally placed enemy — a console spawn
   * that behaved differently would be useless for testing.
   */
  spawnDeveloperEnemy(enemyId: EnemyId, playerX: number, playerY: number): BaseEnemy {
    const position = getDeveloperSpawnPoint(
      playerX,
      playerY,
      ENEMY_DEFINITIONS[enemyId].bodyRadius,
      ROOM_RECT,
    );
    const enemy = createEnemy(
      this.scene,
      this.enemies,
      enemyId,
      position.x,
      position.y,
      this.runState.floor,
    );

    this.registerSpawnedEnemy(enemy, enemyId);

    return enemy;
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

    // 폭탄에 날아간 상인은 다시 나오지 않고 바닥 자국만 남는다.
    if (room.shopNpcBlast) {
      this.spawnShopNpcBlastStain(room.shopNpcBlast);
      this.spawnShopOffers(room);
      return;
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
            const currentRoom = this.dungeon.getCurrentRoom();

            // 방을 떠났거나 그 사이 상인이 폭탄에 날아갔으면 후속 대사를 띄우지 않는다.
            if (currentRoom.id !== shopRoomId || currentRoom.shopNpcBlast) {
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

    this.spawnShopOffers(room);
  }

  private spawnShopOffers(room: RoomNode): void {
    for (const offer of room.shopOffers ?? []) {
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

  /**
   * 폭탄에 상인이 날아간 사실을 방 상태에 남기고, 그 자리에 바닥 자국을 바로 그린다.
   * 방 입장 때만 그리면 정작 터지는 순간에는 자국이 보이지 않는다.
   */
  markShopNpcDestroyed(x: number, y: number, direction: { x: number; y: number }): void {
    const room = this.dungeon.getCurrentRoom();

    if (room.type !== 'shop' || room.shopNpcBlast) {
      return;
    }

    room.shopNpcBlast = { x, y, directionX: direction.x, directionY: direction.y };
    this.spawnShopNpcBlastStain(room.shopNpcBlast);
  }

  /**
   * 떠 있는 상인 말풍선을 모두 걷어내고 그 자리(경계)를 돌려준다.
   * 호출자가 그 자리에 부서지는 연출을 그린다.
   */
  consumeShopSpeechBubbleBounds(): Phaser.Geom.Rectangle[] {
    const bounds: Phaser.Geom.Rectangle[] = [];

    for (const child of this.shopDecorations.getChildren()) {
      if (
        !(child instanceof Phaser.GameObjects.Container) ||
        !child.active ||
        !child.getData(SHOP_SPEECH_BUBBLE_DATA_KEY)
      ) {
        continue;
      }

      bounds.push(child.getBounds());
      // 파괴만 하면 진행 중인 퇴장 트윈이 대상을 붙든 채 onComplete를 실행해
      // 후속 대사가 되살아난다. 트윈을 먼저 끊는다.
      this.scene.tweens.killTweensOf(child);
      child.destroy(true);
    }

    return bounds;
  }

  /**
   * 폭탄에 상인이 날아간 자리에 남는 바닥 자국. 방을 다시 들어와도 그대로 남는다.
   *
   * 둥근 얼룩이 아니라 폭발 방향으로 뻗은 날카로운 그을음 파편들이다. 각 파편은
   * 시작이 굵고 끝이 뾰족한 사각형이라, 바깥으로 튀어 나간 궤적처럼 읽힌다.
   * 모양은 폭발 위치를 시드로 한 재현 가능한 난수라 재입장해도 똑같이 그려진다.
   */
  private spawnShopNpcBlastStain(blast: ShopNpcBlastState): void {
    const stain = this.scene.add.graphics().setDepth(DEPTH.floor + 0.4);
    // 덮어씌우지 않고 곱해서 어둡게 한다. 아래 흙 알갱이 무늬가 그대로 비쳐 보이므로
    // "검은 도형이 놓인" 것이 아니라 "땅이 그을린" 것으로 읽힌다. 겹친 부분이 자연히
    // 더 짙어지는 것도 그을음이 쌓인 느낌을 준다.
    stain.setBlendMode(Phaser.BlendModes.MULTIPLY);
    const random = createSeededRandom(hashSeed(`${blast.x},${blast.y}`));
    const baseAngle = Math.atan2(blast.directionY, blast.directionX);
    const flowX = Math.cos(baseAngle);
    const flowY = Math.sin(baseAngle);
    const sideX = -flowY;
    const sideY = flowX;
    const REACH = 34;

    // 넓고 아주 옅은 그을음 바탕을 먼저 깐다. 날카로운 파편만 있으면 배경에서 떠 보인다.
    // 파편 아래 깔려 경계를 부드럽게 이어 주는 역할이다.
    for (let i = 0; i < 6; i += 1) {
      const along = random() * REACH * 0.7;
      const side = (random() + random() - 1) * 9;

      stain.fillStyle(0x000000, 0.09 + random() * 0.07);
      stain.fillEllipse(
        blast.x + flowX * along + sideX * side,
        blast.y + flowY * along + sideY * side,
        24 + random() * 22,
        15 + random() * 13,
      );
    }

    for (let i = 0; i < 30; i += 1) {
      // 시작점을 군집 안에 흩는다. 모두 한 점에서 뻗으면 붓으로 그은 것처럼 보인다.
      // 폭발 방향으로는 멀리, 옆으로는 좁게 퍼뜨려 흐름이 남게 한다.
      const along = random() * random() * REACH;
      const side = (random() + random() - 1) * 10;
      const originX = blast.x + flowX * along + sideX * side;
      const originY = blast.y + flowY * along + sideY * side;

      // 각도는 폭발 방향을 따르되 넉넉히 흔들어 규칙적인 부채꼴을 깬다.
      const angle = baseAngle + (random() + random() - 1) * 1.25;
      const length = 5 + random() * 20;
      const halfNear = 0.7 + random() * 1.3;
      const halfFar = halfNear * (0.1 + random() * 0.3);

      // 멀리 흩어진 조각일수록 옅게 — 전체적으로 가운데가 짙은 그라데이션이 된다.
      const fade = along / REACH;
      const alpha = Math.max(0.12, 0.9 - fade * 0.62 - random() * 0.14);

      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const perpX = -dirY;
      const perpY = dirX;
      const farX = originX + dirX * length;
      const farY = originY + dirY * length;

      stain.fillStyle(0x000000, alpha);
      stain.fillPoints(
        [
          new Phaser.Geom.Point(originX + perpX * halfNear, originY + perpY * halfNear),
          new Phaser.Geom.Point(farX + perpX * halfFar, farY + perpY * halfFar),
          new Phaser.Geom.Point(farX - perpX * halfFar, farY - perpY * halfFar),
          new Phaser.Geom.Point(originX - perpX * halfNear, originY - perpY * halfNear),
        ],
        true,
      );
    }

    // 가장자리에 흩뿌려진 그을음 알갱이. 자국이 배경과 만나는 경계를 흐린다.
    for (let i = 0; i < 16; i += 1) {
      const along = random() * REACH * 1.25;
      const side = (random() + random() - 1) * 13;
      const fade = along / (REACH * 1.25);

      stain.fillStyle(0x000000, Math.max(0.08, 0.5 - fade * 0.38));
      stain.fillCircle(
        blast.x + flowX * along + sideX * side,
        blast.y + flowY * along + sideY * side,
        0.5 + random() * 1.2,
      );
    }

    this.shopDecorations.add(stain);
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
