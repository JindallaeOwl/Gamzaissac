import Phaser from 'phaser';
import { itemIconKey } from '../config/assets';
import { GAME_CENTER_X, ROOM_RECT } from '../config/gameConfig';
import { ItemPickup } from '../entities/ItemPickup';
import type { Player } from '../entities/Player';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import { findItemByReference, formatItemNumber, PASSIVE_ITEMS } from '../data/items';
import { ROOM_CLEAR_REWARDS } from '../data/rewards';
import { getShopProduct, type ShopProductDefinition } from '../data/shop';
import { t } from '../i18n';
import { DeveloperConsole, type DeveloperConsoleCommandResult } from '../ui/DeveloperConsole';
import type { Hud } from '../ui/Hud';
import type { EffectsSystem } from './EffectsSystem';
import {
  DEVELOPER_CONSOLE_HELP,
  parseDeveloperCommand,
  type DeveloperCommand,
} from './DeveloperConsoleCommands';
import type { DungeonManager, RoomNode } from './DungeonManager';
import { addConsumable } from './InventorySystem';
import type { RoomController } from './RoomController';
import type { RoomTransitionSystem } from './RoomTransitionSystem';
import type { RunState } from './RunState';
import type { ShopSystem } from './ShopSystem';

export interface DeveloperConsoleControllerConfig {
  scene: Phaser.Scene;
  runState: RunState;
  dungeon: DungeonManager;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  items: Phaser.Physics.Arcade.Group;
  effects: EffectsSystem;
  shopSystem: ShopSystem;
  roomController: RoomController;
  roomTransitions: RoomTransitionSystem;
  hud: Hud;
  isRunEnded: () => boolean;
  isPauseTransitionStarted: () => boolean;
  resetFloorTransition: () => void;
  onRoomChanged: (room: RoomNode) => void;
  getShopProductName: (product: ShopProductDefinition) => string;
}

export class DeveloperConsoleController {
  private readonly config: DeveloperConsoleControllerConfig;
  private developerConsole?: DeveloperConsole;
  private godModeEnabled = false;

  constructor(config: DeveloperConsoleControllerConfig) {
    this.config = config;
  }

  setup(): void {
    const { scene } = this.config;
    this.developerConsole = new DeveloperConsole({
      canOpen: () =>
        !this.config.isRunEnded() &&
        !this.config.isPauseTransitionStarted() &&
        scene.scene.isActive(),
      onOpenChanged: (open) => this.handleOpenChanged(open),
      onCommand: (input) => this.execute(input),
      getItemOptions: () =>
        PASSIVE_ITEMS.map((item) => ({
          id: item.id,
          itemNumber: item.itemNumber,
          name: t(item.nameKey),
          imageSource: scene.textures
            .get(itemIconKey(item.id))
            .getSourceImage() as CanvasImageSource,
        })),
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  execute(input: string): DeveloperConsoleCommandResult {
    const parsed = parseDeveloperCommand(input);

    if (!parsed.ok) {
      return { lines: [parsed.error] };
    }

    if (parsed.command.type === 'help') {
      return { lines: DEVELOPER_CONSOLE_HELP };
    }

    if (parsed.command.type === 'clear') {
      return { clear: true };
    }

    if (parsed.command.type === 'items') {
      return { openItemPicker: true };
    }

    this.markAdminUsed();
    return this.applyCommand(parsed.command);
  }

  destroy(): void {
    this.developerConsole?.destroy();
    this.developerConsole = undefined;
  }

  private handleOpenChanged(open: boolean): void {
    const { scene } = this.config;
    const keyboard = scene.input.keyboard;

    if (open) {
      keyboard?.resetKeys();
      keyboard?.disableGlobalCapture();

      if (keyboard) {
        keyboard.enabled = false;
      }

      scene.scene.pause();
    } else if (!this.config.isRunEnded()) {
      if (keyboard) {
        keyboard.enabled = true;
      }

      keyboard?.enableGlobalCapture();
      keyboard?.resetKeys();
      scene.scene.resume();
    }
  }

  private applyCommand(command: DeveloperCommand): DeveloperConsoleCommandResult {
    const { runState, player } = this.config;

    if (command.type === 'god') {
      this.godModeEnabled = !this.godModeEnabled;
      player.setGodMode(this.godModeEnabled);
      return { lines: [`무적 모드: ${this.godModeEnabled ? 'ON' : 'OFF'}`] };
    }

    if (command.type === 'heal') {
      runState.stats.health = runState.stats.maxHealth;
      player.setStats(runState.stats);
      return { lines: [`체력 회복: ${runState.stats.health}/${runState.stats.maxHealth}`] };
    }

    if (command.type === 'add-resource') {
      runState.inventory = addConsumable(runState.inventory, command.resource, command.amount);
      return {
        lines: [`${t(`resources.${command.resource}`)}: ${runState.inventory[command.resource]}`],
      };
    }

    if (command.type === 'kill') {
      return this.killActiveEnemies();
    }

    if (command.type === 'boss') {
      return this.moveToRoom('boss', '보스방');
    }

    if (command.type === 'shop') {
      return this.moveToRoom('shop', '상점방');
    }

    if (command.type === 'treasure') {
      return this.moveToRoom('treasure', '보물방');
    }

    if (command.type === 'spawn') {
      return this.spawnItem(command.itemId);
    }

    if (command.type === 'sale') {
      return this.forceShopSale();
    }

    if (command.type === 'floor') {
      return this.enterFloor(command.floor);
    }

    return { lines: ['실행할 수 없는 명령어입니다.'] };
  }

  private killActiveEnemies(): DeveloperConsoleCommandResult {
    let killed = 0;

    // Killing a splitter spawns children during the loop, so a single snapshot
    // would leave them alive. Repeat until the group is empty, bounded to avoid
    // an infinite loop if an enemy ever replicates without end.
    for (let pass = 0; pass < 8; pass += 1) {
      const activeEnemies = (this.config.enemies.getChildren() as BaseEnemy[]).filter(
        (enemy) => enemy.active,
      );

      if (activeEnemies.length === 0) {
        break;
      }

      for (const enemy of activeEnemies) {
        // forceDefeat ignores invulnerability (e.g. a burrowed Worm King, which
        // shrugs off MAX_SAFE_INTEGER damage) and counts only enemies that
        // actually died, so the tally stays accurate.
        if (enemy.forceDefeat()) {
          killed += 1;
        }
      }
    }

    return { lines: [`적 ${killed}명 처치`] };
  }

  private enterFloor(floor: number): DeveloperConsoleCommandResult {
    const { runState, roomTransitions, dungeon } = this.config;
    runState.floor = floor;
    this.config.resetFloorTransition();
    roomTransitions.enterFloor(floor, runState.unlockedAbilityIds.includes('charge-beam'));
    this.config.onRoomChanged(dungeon.getCurrentRoom());
    return { lines: [`${floor}층으로 이동`] };
  }

  private spawnItem(itemId: string): DeveloperConsoleCommandResult {
    if (itemId === 'chest') {
      return this.spawnChest();
    }

    if (itemId === 'coin') {
      return this.spawnCoin(1);
    }

    if (itemId === 'five-coin') {
      return this.spawnCoin(5);
    }

    if (itemId === 'heart') {
      return this.spawnHeart();
    }

    const item = findItemByReference(itemId);

    if (!item) {
      return {
        lines: [
          `아이템을 찾을 수 없습니다: ${itemId}`,
          `사용 가능: chest, coin, five-coin, heart, ${PASSIVE_ITEMS.map((candidate) => candidate.id).join(', ')}`,
        ],
      };
    }

    const position = this.getSpawnPosition();
    this.config.items.add(
      new ItemPickup(this.config.scene, position.x, position.y, item, 'secret'),
    );
    this.config.effects.pickup(position.x, position.y);
    return { lines: [`아이템 생성: ${formatItemNumber(item.itemNumber)} ${item.id}`] };
  }

  private spawnChest(): DeveloperConsoleCommandResult {
    const definition = ROOM_CLEAR_REWARDS.find((reward) => reward.kind === 'chest');

    if (!definition) {
      return { lines: ['상자 정보를 찾을 수 없습니다.'] };
    }

    const position = this.getSpawnPosition();
    const reward = {
      kind: definition.kind,
      amount: definition.amountMin,
      labelKey: definition.labelKey,
      tint: definition.tint,
    } as const;
    this.spawnPersistentReward(reward, position.x, position.y);
    return { lines: ['상자 생성: chest'] };
  }

  private spawnCoin(amount: 1 | 5): DeveloperConsoleCommandResult {
    const definition = ROOM_CLEAR_REWARDS.find((reward) => reward.kind === 'coins');

    if (!definition) {
      return { lines: ['코인 정보를 찾을 수 없습니다.'] };
    }

    const position = this.getSpawnPosition();
    const reward = {
      kind: 'coins',
      amount,
      labelKey: definition.labelKey,
      tint: definition.tint,
      appearance: amount === 5 ? 'five-coin' : undefined,
    } as const;
    this.spawnPersistentReward(reward, position.x, position.y);
    return { lines: [`코인 생성: ${amount}코인`] };
  }

  private spawnHeart(): DeveloperConsoleCommandResult {
    const definition = ROOM_CLEAR_REWARDS.find((reward) => reward.kind === 'heart');

    if (!definition) {
      return { lines: ['하트 정보를 찾을 수 없습니다.'] };
    }

    const position = this.getSpawnPosition();
    const reward = {
      kind: 'heart',
      amount: 1,
      labelKey: definition.labelKey,
      tint: definition.tint,
    } as const;
    this.spawnPersistentReward(reward, position.x, position.y);
    return { lines: ['하트 생성: heart'] };
  }

  private spawnPersistentReward(
    reward: Parameters<RoomTransitionSystem['spawnPersistentReward']>[1],
    x: number,
    y: number,
  ): void {
    this.config.roomTransitions.spawnPersistentReward(
      this.config.dungeon.getCurrentRoom(),
      reward,
      x,
      y,
    );
    this.config.effects.pickup(x, y);
  }

  private getSpawnPosition(): { x: number; y: number } {
    const offsetX = this.config.player.x < GAME_CENTER_X ? 44 : -44;
    return {
      x: Phaser.Math.Clamp(
        this.config.player.x + offsetX,
        ROOM_RECT.left + 24,
        ROOM_RECT.right - 24,
      ),
      y: Phaser.Math.Clamp(this.config.player.y, ROOM_RECT.top + 24, ROOM_RECT.bottom - 24),
    };
  }

  private moveToRoom(
    roomType: Extract<RoomNode['type'], 'boss' | 'shop' | 'treasure'>,
    roomLabel: string,
  ): DeveloperConsoleCommandResult {
    const { dungeon } = this.config;
    const currentRoom = dungeon.getCurrentRoom();

    if (currentRoom.type === roomType) {
      return { lines: [`이미 ${roomLabel}에 있습니다.`] };
    }

    const targetRoom = dungeon.getRooms().find((room) => room.type === roomType);

    if (!targetRoom) {
      return { lines: [`현재 층에서 ${roomLabel}을 찾을 수 없습니다.`] };
    }

    if (roomType === 'shop' || roomType === 'treasure') {
      dungeon.unlockRoom(targetRoom.id);
    }

    if (!dungeon.moveToRoom(targetRoom.id)) {
      return { lines: [`${roomLabel} 이동에 실패했습니다.`] };
    }

    this.config.roomTransitions.enterRoomDirect(targetRoom);
    this.config.onRoomChanged(targetRoom);
    return { lines: [`${this.config.runState.floor}층 ${roomLabel}으로 이동`] };
  }

  private forceShopSale(): DeveloperConsoleCommandResult {
    const room = this.config.dungeon.getCurrentRoom();

    if (room.type !== 'shop' || !room.shopOffers) {
      return { lines: ['상점방에서만 사용할 수 있습니다.'] };
    }

    const offer = this.config.shopSystem.forceDiscount(room.shopOffers);

    if (!offer) {
      return { lines: ['할인할 수 있는 상품이 없습니다.'] };
    }

    this.config.roomController.refreshCurrentShop();
    const product = getShopProduct(offer.productId);
    return {
      lines: [
        `세일 적용: ${product ? this.config.getShopProductName(product) : offer.productId} ${offer.price}코인`,
      ],
    };
  }

  private markAdminUsed(): void {
    this.config.runState.adminUsed = true;
    this.config.hud.setAdminVisible(true);
  }
}
