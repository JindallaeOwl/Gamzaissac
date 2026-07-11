import Phaser from 'phaser';
import { BeamAttack } from '../entities/BeamAttack';
import { Bullet } from '../entities/Bullet';
import { Door } from '../entities/Door';
import { ItemPickup } from '../entities/ItemPickup';
import { Player, type PlayerControls } from '../entities/Player';
import { RewardPickup } from '../entities/RewardPickup';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import {
  BEAM_TUNING,
  BOSS_TUNING,
  COMBAT_TUNING,
  FEEDBACK_TUNING,
  GAME_HEIGHT,
  GAME_WIDTH,
  INVENTORY_TUNING,
} from '../config/gameConfig';
import { koreanFontStack, t, toggleLocale } from '../i18n';
import { AudioSystem } from '../systems/AudioSystem';
import { DungeonManager, type RoomNode } from '../systems/DungeonManager';
import { EffectsSystem } from '../systems/EffectsSystem';
import { addConsumable, spendConsumable } from '../systems/InventorySystem';
import { ItemSystem } from '../systems/ItemSystem';
import { RewardSystem } from '../systems/RewardSystem';
import { RoomController } from '../systems/RoomController';
import { createInitialRunState, type RunState } from '../systems/RunState';
import { Hud } from '../ui/Hud';
import { clamp } from '../utils/math';

export class GameScene extends Phaser.Scene {
  private runState!: RunState;
  private dungeon!: DungeonManager;
  private itemSystem!: ItemSystem;
  private rewardSystem!: RewardSystem;
  private effects!: EffectsSystem;
  private audio!: AudioSystem;
  private roomController!: RoomController;
  private player!: Player;
  private controls!: PlayerControls;
  private debugKey?: Phaser.Input.Keyboard.Key;
  private localeKey?: Phaser.Input.Keyboard.Key;
  private debugVisible = false;
  private nextDoorAt = 0;
  private gameOverStarted = false;
  private floorAdvanceQueued = false;
  private playerDamageFeedbackQueued = false;
  private removeRuntimeErrorListener?: () => void;
  private bossHealthBack?: Phaser.GameObjects.Rectangle;
  private bossHealthFill?: Phaser.GameObjects.Rectangle;
  private bossHealthText?: Phaser.GameObjects.Text;

  private enemies!: Phaser.Physics.Arcade.Group;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private beams!: Phaser.Physics.Arcade.Group;
  private items!: Phaser.Physics.Arcade.Group;
  private rewards!: Phaser.Physics.Arcade.Group;
  private hud!: Hud;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d1117');
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.runState = createInitialRunState();
    this.dungeon = new DungeonManager();
    this.itemSystem = new ItemSystem();
    this.rewardSystem = new RewardSystem();
    this.effects = new EffectsSystem(this);
    this.audio = new AudioSystem();
    this.dungeon.generateFloor(this.runState.floor);

    this.enemies = this.physics.add.group();
    this.playerBullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.beams = this.physics.add.group();
    this.items = this.physics.add.group();
    this.rewards = this.physics.add.group();

    this.player = new Player(this, 480, 320, this.runState.stats);
    this.controls = this.createControls();

    this.roomController = new RoomController({
      scene: this,
      dungeon: this.dungeon,
      enemies: this.enemies,
      items: this.items,
      itemSystem: this.itemSystem,
      runState: this.runState,
      onRoomCleared: (room) => this.handleRoomCleared(room),
      onEnemyDefeated: (score) => this.handleEnemyDefeated(score),
      onBossPhaseTwo: () => this.handleBossPhaseTwo(),
    });

    this.hud = new Hud(this);
    this.setupRuntimeErrorReporting();
    this.createBossHud();
    this.setupAudioUnlock();
    this.roomController.enterCurrentRoom();
    this.setupPhysics();
    this.setupPlayerEvents();
    this.hud.showMessage(t('messages.floor', { floor: 1 }));
  }

  update(time: number): void {
    if (this.gameOverStarted) {
      return;
    }

    if (this.debugKey && Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.debugVisible = !this.debugVisible;
      this.hud.setDebugVisible(this.debugVisible);
      this.physics.world.drawDebug = this.debugVisible;
      this.physics.world.debugGraphic?.setVisible(this.debugVisible);
    }

    if (this.localeKey && Phaser.Input.Keyboard.JustDown(this.localeKey)) {
      const locale = toggleLocale();
      this.hud.showMessage(t(locale === 'ko' ? 'messages.localeKo' : 'messages.localeEn'), 1100);
    }

    this.player.update(time, this.controls, this.playerBullets);

    for (const enemy of this.enemies.getChildren() as BaseEnemy[]) {
      if (enemy.active) {
        enemy.updateAI(time, this.player, this.enemyBullets);
      }
    }

    for (const bullet of this.playerBullets.getChildren() as Bullet[]) {
      bullet.update(time);
    }

    for (const bullet of this.enemyBullets.getChildren() as Bullet[]) {
      bullet.update(time);
    }

    this.resolveEnemyBulletHits();

    for (const beam of this.beams.getChildren() as BeamAttack[]) {
      beam.update(time);
    }

    this.roomController.update();
    this.updateBossHud();
    this.hud.update(this.runState, this.dungeon, this.enemies.countActive(true), {
      x: this.player.x,
      y: this.player.y,
    });
  }

  private createControls(): PlayerControls {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.debugKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    this.localeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);

    return {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      fireUp: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      fireDown: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      fireLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      fireRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };
  }

  private setupPhysics(): void {
    this.physics.add.collider(this.player, this.roomController.walls);
    this.physics.add.collider(this.enemies, this.roomController.walls);
    this.physics.add.collider(this.playerBullets, this.roomController.walls, (bulletObject) => {
      const bullet = bulletObject as Bullet;
      const x = bullet.x;
      const y = bullet.y;

      if (!bullet.consume()) {
        return;
      }

      this.effects.impact(x, y, 0xc7fff4);
      bullet.queueDestroy();
    });
    this.physics.add.collider(this.enemyBullets, this.roomController.walls, (bulletObject) => {
      const bullet = bulletObject as Bullet;
      const x = bullet.x;
      const y = bullet.y;

      if (!bullet.consume()) {
        return;
      }

      this.effects.impact(x, y, 0xffb347);
      bullet.queueDestroy();
    });

    this.physics.add.overlap(this.playerBullets, this.enemies, (bulletObject, enemyObject) => {
      const bullet = bulletObject as Bullet;
      const enemy = enemyObject as BaseEnemy;

      if (!bullet.active || !enemy.active || !bullet.body || !enemy.body) {
        return;
      }

      const bulletX = bullet.x;
      const bulletY = bullet.y;
      const enemyX = enemy.x;
      const enemyY = enemy.y;

      if (!bullet.consume()) {
        return;
      }

      const defeated = enemy.takeDamage(bullet.damage, bulletX, bulletY);
      this.effects.impact(bulletX, bulletY, defeated ? 0xffd166 : 0xf7f3e8);
      bullet.queueDestroy();

      if (defeated) {
        this.effects.hitStop(FEEDBACK_TUNING.hitStop.enemyDeathMs);
        this.effects.shake('enemyDeath');
        this.effects.enemyDeath(enemyX, enemyY, enemy.scoreValue);
        this.audio.play('enemyDeath');
      } else {
        this.effects.hitStop(FEEDBACK_TUNING.hitStop.bulletHitMs);
        this.effects.shake('bulletHit');
        this.audio.play('hit');
      }
    });

    this.physics.add.overlap(this.player, this.enemies, (_playerObject, enemyObject) => {
      const enemy = enemyObject as BaseEnemy;

      if (enemy.active && enemy.body && enemy.canDealContactDamage(this.time.now)) {
        const damaged = this.player.damage(enemy.contactDamage, enemy.x, enemy.y);

        if (damaged) {
          this.queuePlayerDamagedFeedback();
        }
      }
    });

    this.physics.add.overlap(this.player, this.items, (_playerObject, itemObject) => {
      this.collectItem(itemObject as ItemPickup);
    });

    this.physics.add.overlap(this.player, this.rewards, (_playerObject, rewardObject) => {
      this.collectReward(rewardObject as RewardPickup);
    });

    this.physics.add.overlap(this.beams, this.enemies, (beamObject, enemyObject) => {
      const beam = beamObject as BeamAttack;
      const enemy = enemyObject as BaseEnemy;

      if (beam.active && enemy.active && enemy.body && beam.canDamage(enemy, this.time.now)) {
        const enemyX = enemy.x;
        const enemyY = enemy.y;
        const defeated = enemy.takeDamage(beam.damage, this.player.x, this.player.y);
        this.effects.beamImpact(enemyX, enemyY);

        if (defeated) {
          this.effects.hitStop(FEEDBACK_TUNING.hitStop.enemyDeathMs);
          this.effects.shake('enemyDeath');
          this.effects.enemyDeath(enemyX, enemyY, enemy.scoreValue);
          this.audio.play('enemyDeath');
        } else {
          this.effects.hitStop(FEEDBACK_TUNING.hitStop.beamHitMs);
          this.effects.shake('beamHit');
          this.audio.play('hit');
        }
      }
    });

    this.physics.add.overlap(
      this.player,
      this.roomController.doors,
      (_playerObject, doorObject) => {
        this.handleDoorOverlap(doorObject as Door);
      },
    );
  }

  private setupPlayerEvents(): void {
    this.player.on('player-died', () => {
      this.gameOverStarted = true;
      this.player.setActive(false);
      this.player.setVisible(false);
      const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;

      if (body) {
        body.enable = false;
        body.stop();
      }

      this.effects.shake('playerHurt');
      this.time.delayedCall(320, () => {
        this.scene.start('GameOverScene', {
          clearedRooms: this.runState.clearedRooms,
          itemCount: this.runState.collectedItemIds.length,
          score: this.runState.score,
        });
      });
    });

    this.player.on('beam-fired', (direction: { x: number; y: number }) => {
      const beam = new BeamAttack(
        this,
        this.player.x,
        this.player.y,
        direction,
        Math.max(this.runState.stats.range, BEAM_TUNING.range),
        BEAM_TUNING.damage + this.runState.stats.damage * 0.8,
      );
      this.beams.add(beam);
      this.effects.beamFire(this.player.x, this.player.y);
      this.effects.shake('beamFire');
      this.audio.play('beamFire');
    });

    this.player.on(
      'player-shot',
      (event: { x: number; y: number; direction: { x: number; y: number } }) => {
        this.effects.muzzleFlash(event.x, event.y, event.direction);
        this.audio.play('shoot');
      },
    );

    this.player.on('beam-charge-started', () => {
      this.audio.play('beamCharge');
    });

    this.player.on('beam-charge-pulse', (event: { ready: boolean }) => {
      this.effects.beamChargePulse(this.player.x, this.player.y, event.ready);
    });
  }

  private setupAudioUnlock(): void {
    this.input.once('pointerdown', () => this.audio.unlock());
    this.input.keyboard?.once('keydown', () => this.audio.unlock());
  }

  private setupRuntimeErrorReporting(): void {
    const handleError = (event: ErrorEvent): void => {
      const message = event.message || event.error?.message || 'Runtime error';
      this.hud.showMessage(`ERROR: ${message}`, 6000);
      this.debugVisible = true;
      this.hud.setDebugVisible(true);
    };

    window.addEventListener('error', handleError);
    this.removeRuntimeErrorListener = () => window.removeEventListener('error', handleError);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeRuntimeErrorListener?.();
      this.removeRuntimeErrorListener = undefined;
    });
  }

  private resolveEnemyBulletHits(): void {
    if (!this.player.active || !this.player.body || this.gameOverStarted) {
      return;
    }

    const hitRadiusSq = COMBAT_TUNING.enemyBulletHitRadius * COMBAT_TUNING.enemyBulletHitRadius;

    for (const bullet of this.enemyBullets.getChildren() as Bullet[]) {
      if (!bullet.active || !bullet.body) {
        continue;
      }

      const dx = bullet.x - this.player.x;
      const dy = bullet.y - this.player.y;

      if (dx * dx + dy * dy > hitRadiusSq) {
        continue;
      }

      const bulletX = bullet.x;
      const bulletY = bullet.y;

      if (!bullet.consume()) {
        continue;
      }

      const damaged = this.player.damage(bullet.damage, bulletX, bulletY);
      bullet.queueDestroy();

      if (damaged) {
        this.queuePlayerDamagedFeedback();
      }
    }
  }

  private handleDoorOverlap(door: Door): void {
    if (!door.isOpen || this.time.now < this.nextDoorAt) {
      return;
    }

    const targetRoom = this.dungeon.peek(door.direction);

    if (!targetRoom) {
      return;
    }

    if (targetRoom.type === 'treasure' && !targetRoom.treasureUnlocked) {
      const updatedInventory = spendConsumable(
        this.runState.inventory,
        'keys',
        INVENTORY_TUNING.treasureRoomKeyCost,
      );

      if (!updatedInventory) {
        this.nextDoorAt = this.time.now + COMBAT_TUNING.doorCooldownMs;
        this.hud.showMessage(t('messages.keyNeeded'), 1200);
        return;
      }

      this.runState.inventory = updatedInventory;
      this.dungeon.unlockRoom(targetRoom.id);
      this.hud.showMessage(t('messages.treasureUnlocked'), 1200);
    }

    const moved = this.dungeon.move(door.direction);

    if (!moved) {
      return;
    }

    this.nextDoorAt = this.time.now + COMBAT_TUNING.doorCooldownMs;
    this.playerBullets.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.beams.clear(true, true);
    this.rewards.clear(true, true);

    const spawnPosition = this.roomController.getSpawnPositionForEntry(door.direction);
    this.player.setPosition(spawnPosition.x, spawnPosition.y);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

    this.roomController.enterCurrentRoom();
    this.hud.showMessage(
      moved.type === 'reward'
        ? t('messages.cacheFound')
        : moved.type === 'treasure'
          ? t('messages.treasureRoom')
          : moved.type === 'boss'
            ? t('messages.bossRoom')
            : t('messages.roomEntered'),
      1100,
    );
  }

  private collectItem(pickup: ItemPickup): void {
    if (!pickup.active) {
      return;
    }

    this.runState.stats = this.itemSystem.applyItem(this.runState.stats, pickup.item);
    this.runState.collectedItemIds.push(pickup.item.id);

    if (
      pickup.item.abilityId &&
      !this.runState.unlockedAbilityIds.includes(pickup.item.abilityId)
    ) {
      this.runState.unlockedAbilityIds.push(pickup.item.abilityId);
      this.player.hasChargeBeam = true;
    }

    this.player.setStats(this.runState.stats);
    const currentRoom = this.dungeon.getCurrentRoom();

    if (currentRoom.type === 'reward') {
      this.dungeon.markCurrentRewardClaimed();
    } else if (currentRoom.type === 'treasure' && pickup.item.abilityId) {
      this.dungeon.markCurrentBeamItemClaimed();
    } else if (currentRoom.type === 'treasure') {
      this.dungeon.markCurrentTreasureClaimed();
    }

    this.hud.showMessage(
      t('messages.itemPickup', {
        name: t(pickup.item.nameKey),
        description: t(pickup.item.descriptionKey),
      }),
      3000,
    );
    this.effects.pickup(pickup.x, pickup.y);
    this.audio.play('pickup');
    pickup.destroy();
    this.queueNextFloorIfReady();
  }

  private collectReward(pickup: RewardPickup): void {
    if (!pickup.active) {
      return;
    }

    const reward = pickup.reward;

    if (reward.kind === 'chest') {
      const result = this.rewardSystem.rollChestResult(this.runState.stats);

      if (result.type === 'heal') {
        this.runState.stats.health = clamp(
          this.runState.stats.health + result.amount,
          0,
          this.runState.stats.maxHealth,
        );
        this.player.setStats(this.runState.stats);
      } else {
        this.runState.inventory = addConsumable(
          this.runState.inventory,
          result.consumable,
          result.amount,
        );
      }

      this.hud.showMessage(this.formatChestResult(result), 1600);
      this.effects.pickup(pickup.x, pickup.y);
      this.audio.play('pickup');
      pickup.destroy();
      return;
    }

    if (!this.rewardSystem.canTakeConsumable(this.runState.inventory, reward.kind)) {
      this.hud.showMessage(t('messages.resourceFull', { resource: t(reward.labelKey) }), 1100);
      return;
    }

    this.runState.inventory = addConsumable(this.runState.inventory, reward.kind, reward.amount);
    this.hud.showMessage(
      t('messages.rewardGain', {
        amount: reward.amount,
        resource: t(reward.labelKey),
      }),
      1200,
    );
    this.effects.pickup(pickup.x, pickup.y);
    this.audio.play('pickup');
    pickup.destroy();
  }

  private handleRoomCleared(room: RoomNode): void {
    this.runState.clearedRooms += 1;
    this.dropRoomClearReward(room);
    this.hud.showMessage(
      room.type === 'boss'
        ? t('messages.stageClear')
        : this.dungeon.isFloorObjectiveCleared()
          ? t('messages.floorCleared')
          : t('messages.roomClear'),
      1600,
    );
    this.effects.roomClear();
    this.effects.shake('roomClear');
    this.audio.play('roomClear');
    this.queueNextFloorIfReady();
  }

  private handleEnemyDefeated(score: number): void {
    this.runState.score += score;
  }

  private handleBossPhaseTwo(): void {
    if (this.gameOverStarted) {
      return;
    }

    this.hud.showMessage(t('messages.bossPhaseTwo'), 1700);
    this.effects.shake('bossPhaseTwo');
    this.cameras.main.flash(160, 255, 88, 125, false);
    this.audio.play('bossPhaseTwo');
  }

  private dropRoomClearReward(room: RoomNode): void {
    const reward = this.rewardSystem.rollRoomClearReward(this.runState.stats);

    if (!reward) {
      return;
    }

    const pickup = new RewardPickup(
      this,
      480 + Phaser.Math.Between(-60, 60),
      320 + Phaser.Math.Between(-40, 40),
      reward,
    );
    pickup.setData('sourceRoomId', room.id);
    this.rewards.add(pickup);
  }

  private handlePlayerDamaged(): void {
    if (this.gameOverStarted) {
      return;
    }

    this.player.playHitFeedback();
    this.effects.shake('playerHurt');
    this.effects.playerHurtFlash();
    this.audio.play('playerHurt');
  }

  private queuePlayerDamagedFeedback(): void {
    if (this.playerDamageFeedbackQueued || this.gameOverStarted) {
      return;
    }

    this.playerDamageFeedbackQueued = true;
    this.time.delayedCall(0, () => {
      this.playerDamageFeedbackQueued = false;
      this.handlePlayerDamaged();
    });
  }

  private queueNextFloorIfReady(): void {
    if (this.floorAdvanceQueued || !this.dungeon.isFloorObjectiveCleared()) {
      return;
    }

    const hasUnclaimedReward = this.dungeon
      .getRooms()
      .some((room) => room.type === 'reward' && !room.rewardClaimed);

    if (hasUnclaimedReward) {
      return;
    }

    this.floorAdvanceQueued = true;
    this.hud.showMessage(t('messages.nextFloorOpening'), 1800);
    this.time.delayedCall(1800, () => this.advanceFloor());
  }

  private advanceFloor(): void {
    if (this.gameOverStarted) {
      return;
    }

    this.floorAdvanceQueued = false;
    this.runState.floor += 1;
    this.runState.stats.health = Math.min(
      this.runState.stats.maxHealth,
      this.runState.stats.health + 1,
    );
    this.player.setStats(this.runState.stats);
    this.player.setPosition(480, 320);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

    this.playerBullets.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.enemies.clear(true, true);
    this.items.clear(true, true);
    this.rewards.clear(true, true);
    this.beams.clear(true, true);

    this.dungeon.generateFloor(this.runState.floor);
    this.player.hasChargeBeam = this.runState.unlockedAbilityIds.includes('charge-beam');
    this.roomController.enterCurrentRoom();
    this.hud.showMessage(t('messages.floor', { floor: this.runState.floor }), 1800);
  }

  private formatChestResult(result: ReturnType<RewardSystem['rollChestResult']>): string {
    if (result.type === 'heal') {
      return t('messages.chestHealed', { amount: result.amount });
    }

    return t('messages.chestConsumable', {
      amount: result.amount,
      resource: t(`resources.${result.consumable}`),
    });
  }

  private createBossHud(): void {
    this.bossHealthBack = this.add
      .rectangle(GAME_WIDTH / 2, 28, 320, 12, 0x10151c, 0.86)
      .setOrigin(0.5)
      .setDepth(101)
      .setVisible(false);
    this.bossHealthFill = this.add
      .rectangle(GAME_WIDTH / 2 - 158, 28, 316, 8, 0xd84f66, 1)
      .setOrigin(0, 0.5)
      .setDepth(102)
      .setVisible(false);
    this.bossHealthText = this.add
      .text(GAME_WIDTH / 2, 48, '', {
        fontFamily: koreanFontStack(),
        fontSize: '13px',
        color: '#ffe39b',
        stroke: '#090b10',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(103)
      .setVisible(false);
  }

  private updateBossHud(): void {
    const boss = (this.enemies.getChildren() as BaseEnemy[]).find(
      (enemy) => enemy.active && enemy.isBoss,
    );
    const visible = Boolean(boss);

    this.bossHealthBack?.setVisible(visible);
    this.bossHealthFill?.setVisible(visible);
    this.bossHealthText?.setVisible(visible);

    if (!boss || !this.bossHealthFill || !this.bossHealthText) {
      return;
    }

    const phaseAwareBoss = boss as BaseEnemy & { isInPhaseTwo?: () => boolean };
    const isPhaseTwo = phaseAwareBoss.isInPhaseTwo?.() ?? false;

    this.bossHealthFill.displayWidth = 316 * boss.getHealthRatio();
    this.bossHealthFill.setFillStyle(isPhaseTwo ? BOSS_TUNING.phaseTwoTint : 0xd84f66, 1);
    this.bossHealthText.setText(boss.getDisplayName());
    this.bossHealthText.setColor(isPhaseTwo ? '#ffb3c1' : '#ffe39b');
  }
}
