import Phaser from 'phaser';
import { BeamAttack } from '../entities/BeamAttack';
import { Bullet } from '../entities/Bullet';
import { Door } from '../entities/Door';
import { FloorExit } from '../entities/FloorExit';
import { ItemPickup } from '../entities/ItemPickup';
import { Player, type BeamFiredEvent, type PlayerControls } from '../entities/Player';
import { ShopNpc } from '../entities/ShopNpc';
import { RewardPickup } from '../entities/RewardPickup';
import { ShopOffer } from '../entities/ShopOffer';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import {
  BEAM_TUNING,
  COMBAT_TUNING,
  ROOM_CENTER_X,
  ROOM_CENTER_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ITEM_PREVIEW_RADIUS,
} from '../config/gameConfig';
import { PASSIVE_ITEMS, PRISM_LANCE_ITEM_ID, QUAD_SHOT_ITEM_ID } from '../data/items';
import { getShopProduct, SHOP_INTERACTION_RADIUS, type ShopProductDefinition } from '../data/shop';
import { t, toggleLocale } from '../i18n';
import { AudioSystem } from '../systems/AudioSystem';
import { BombSystem } from '../systems/BombSystem';
import { CombatCollisionSystem } from '../systems/CombatCollisionSystem';
import { DeveloperConsoleController } from '../systems/DeveloperConsoleController';
import { DungeonManager, type RoomNode } from '../systems/DungeonManager';
import { EffectsSystem } from '../systems/EffectsSystem';
import { ItemSystem } from '../systems/ItemSystem';
import { MinimapExpansionController } from '../systems/MinimapExpansionController';
import { getRoomMusicKey, MusicSystem } from '../systems/MusicSystem';
import { RewardSystem } from '../systems/RewardSystem';
import { RoomController } from '../systems/RoomController';
import { RoomNavigationSystem } from '../systems/RoomNavigationSystem';
import { getRoomTransitionPresentation } from '../systems/RoomTransitionRules';
import { RoomTransitionSystem } from '../systems/RoomTransitionSystem';
import { ShopSystem } from '../systems/ShopSystem';
import { advanceRunToNextFloor } from '../systems/RunProgressionSystem';
import {
  getSecretSynergySpawnPositions,
  KONAMI_CODE,
  SecretCodeTracker,
} from '../systems/SecretCodeSystem';
import { floorExitKindForFloor } from '../systems/FloorExitRules';
import { createInitialRunState, isRunEnded, type RunState } from '../systems/RunState';
import { getEffectiveDamage } from '../systems/PlayerStatSystem';
import { BossHud } from '../ui/BossHud';
import { Hud } from '../ui/Hud';
import { ItemPickupAnnouncement } from '../ui/ItemPickupAnnouncement';
import { isPauseCode } from '../ui/PauseMenuRules';
import { UiCameraSystem } from '../ui/UiCameraSystem';
import { applyRenderScale } from '../utils/render';
import { isGameOverRestartCode } from '../utils/gameOverInput';
import { TITLE_TRANSITION_SCENE_KEY } from './TitleTransitionScene';

interface GameOverData {
  clearedRooms: number;
  itemCount: number;
  score: number;
}

export class GameScene extends Phaser.Scene {
  private runState!: RunState;
  private dungeon!: DungeonManager;
  private itemSystem!: ItemSystem;
  private rewardSystem!: RewardSystem;
  private shopSystem!: ShopSystem;
  private roomNavigation!: RoomNavigationSystem;
  private roomTransitions!: RoomTransitionSystem;
  private effects!: EffectsSystem;
  private audio!: AudioSystem;
  private music!: MusicSystem;
  private bombSystem!: BombSystem;
  private combatCollisions!: CombatCollisionSystem;
  private roomController!: RoomController;
  private player!: Player;
  private controls!: PlayerControls;
  private debugKey?: Phaser.Input.Keyboard.Key;
  private localeKey?: Phaser.Input.Keyboard.Key;
  private bombKey?: Phaser.Input.Keyboard.Key;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private minimapKey?: Phaser.Input.Keyboard.Key;
  private minimapExpansion = new MinimapExpansionController();
  private runElapsedMs = 0;
  private secretCodeTracker!: SecretCodeTracker;
  private developerConsoleController!: DeveloperConsoleController;
  private debugVisible = false;
  private nextDoorAt = 0;
  private gameOverStarted = false;
  private gameOverOverlay!: HTMLElement;
  private gameOverTitle!: HTMLElement;
  private gameOverSummary!: HTMLElement;
  private gameOverRestartButton!: HTMLButtonElement;
  private gameOverTransitionStarted = false;
  private readonly handleGameOverKeyDown = (event: KeyboardEvent): void => {
    if (
      !this.gameOverStarted ||
      this.gameOverTransitionStarted ||
      !isGameOverRestartCode(event.code)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.restartAfterGameOver();
  };
  private floorTransitionStarted = false;
  private playerDamageFeedbackQueued = false;
  private pauseTransitionStarted = false;
  private removeRuntimeErrorListener?: () => void;
  private bossHud!: BossHud;
  private uiCameraSystem!: UiCameraSystem;
  private itemPickupAnnouncement!: ItemPickupAnnouncement;
  private readonly handlePauseKeyDown = (event: KeyboardEvent): void => {
    if (
      !isPauseCode(event.code) ||
      event.repeat ||
      isRunEnded(this.runState) ||
      this.pauseTransitionStarted ||
      !this.scene.isActive()
    ) {
      return;
    }

    event.preventDefault();
    this.pauseTransitionStarted = true;
    this.scene.pause();
    this.scene.run('PauseScene');
  };
  private readonly handleGameSceneResume = (): void => {
    this.pauseTransitionStarted = false;
    this.minimapExpansion.cancelHold();
    this.hud.setMapExpanded(this.minimapExpansion.expanded);
  };

  private enemies!: Phaser.Physics.Arcade.Group;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private beams!: Phaser.Physics.Arcade.Group;
  private items!: Phaser.Physics.Arcade.Group;
  private rewards!: Phaser.Physics.Arcade.Group;
  private floorExits!: Phaser.Physics.Arcade.Group;
  private hud!: Hud;

  constructor() {
    super('GameScene');
  }

  create(): void {
    // Phaser reuses this Scene instance across restarts, so field initializers
    // like `= false` only ever run once. Reset run-scoped state explicitly or
    // a prior game-over leaves gameOverStarted stuck true and freezes update().
    this.debugVisible = false;
    this.nextDoorAt = 0;
    this.gameOverStarted = false;
    this.gameOverTransitionStarted = false;
    this.floorTransitionStarted = false;
    this.playerDamageFeedbackQueued = false;
    this.pauseTransitionStarted = false;
    this.runElapsedMs = 0;
    this.minimapExpansion = new MinimapExpansionController();
    this.secretCodeTracker = new SecretCodeTracker(KONAMI_CODE);

    this.cameras.main.setBackgroundColor('#0d1117');
    applyRenderScale(this);
    this.uiCameraSystem = new UiCameraSystem(this);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.physics.world.resume();

    this.runState = createInitialRunState();
    this.dungeon = new DungeonManager();
    this.itemSystem = new ItemSystem();
    this.rewardSystem = new RewardSystem();
    this.shopSystem = new ShopSystem(this.itemSystem);
    this.roomNavigation = new RoomNavigationSystem(this.dungeon);
    this.effects = new EffectsSystem(this);
    this.audio = new AudioSystem();
    this.music = new MusicSystem(this);
    this.dungeon.generateFloor(this.runState.floor);

    this.enemies = this.physics.add.group();
    this.playerBullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.beams = this.physics.add.group();
    this.items = this.physics.add.group();
    this.rewards = this.physics.add.group();
    this.floorExits = this.physics.add.group({ allowGravity: false, immovable: true });

    this.player = new Player(
      this,
      ROOM_CENTER_X,
      ROOM_CENTER_Y,
      this.runState.stats,
      this.runState.attackProfile,
    );
    this.controls = this.createControls();

    // 방이 화면보다 크면 카메라가 플레이어를 따라간다. ROOM_SIZE_SCALE이 1이면
    // 카메라 경계가 화면과 같아져 기존처럼 고정 화면으로 동작한다.
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.roomController = new RoomController({
      scene: this,
      dungeon: this.dungeon,
      enemies: this.enemies,
      items: this.items,
      itemSystem: this.itemSystem,
      shopSystem: this.shopSystem,
      runState: this.runState,
      onRoomCleared: (room) => this.handleRoomCleared(room),
      onEnemyDefeated: (score) => this.handleEnemyDefeated(score),
      onObstacleDestroyed: (x, y) => this.handleObstacleDestroyed(x, y),
      onBossPhaseTwo: (boss) => this.handleBossPhaseTwo(boss),
    });
    this.bombSystem = new BombSystem({
      scene: this,
      runState: this.runState,
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      obstacles: this.roomController.obstacles,
      effects: this.effects,
      audio: this.audio,
      isRunEnded: () => isRunEnded(this.runState),
    });
    this.roomTransitions = new RoomTransitionSystem({
      scene: this,
      dungeon: this.dungeon,
      roomController: this.roomController,
      bombSystem: this.bombSystem,
      player: this.player,
      enemies: this.enemies,
      playerBullets: this.playerBullets,
      enemyBullets: this.enemyBullets,
      beams: this.beams,
      items: this.items,
      rewards: this.rewards,
      floorExits: this.floorExits,
    });

    this.hud = new Hud(this, this.uiCameraSystem.register);
    this.itemPickupAnnouncement = new ItemPickupAnnouncement(this, this.uiCameraSystem.register);
    this.developerConsoleController = new DeveloperConsoleController({
      scene: this,
      runState: this.runState,
      dungeon: this.dungeon,
      player: this.player,
      enemies: this.enemies,
      items: this.items,
      effects: this.effects,
      shopSystem: this.shopSystem,
      roomController: this.roomController,
      roomTransitions: this.roomTransitions,
      hud: this.hud,
      isRunEnded: () => isRunEnded(this.runState),
      isPauseTransitionStarted: () => this.pauseTransitionStarted,
      resetFloorTransition: () => {
        this.floorTransitionStarted = false;
      },
      onRoomChanged: (room) => this.updateBackgroundMusic(room),
      getShopProductName: (product) => this.getShopProductName(product),
    });
    this.developerConsoleController.setup();
    this.prepareGameOverOverlay();
    this.combatCollisions = new CombatCollisionSystem({
      scene: this,
      player: this.player,
      enemies: this.enemies,
      playerBullets: this.playerBullets,
      enemyBullets: this.enemyBullets,
      beams: this.beams,
      walls: this.roomController.walls,
      obstacles: this.roomController.obstacles,
      effects: this.effects,
      audio: this.audio,
      isRunEnded: () => isRunEnded(this.runState),
      onPlayerDamaged: () => this.queuePlayerDamagedFeedback(),
    });
    this.setupRuntimeErrorReporting();
    this.bossHud = new BossHud(this, this.enemies, this.uiCameraSystem.register);
    this.setupAudioUnlock();
    this.roomController.enterCurrentRoom();
    this.updateBackgroundMusic(this.dungeon.getCurrentRoom());
    this.setupPhysics();
    this.setupPlayerEvents();
    this.setupPauseInput();
    this.hud.showMessage(t('messages.floor', { floor: 1 }));
    this.cameras.main.fadeIn(220, 5, 9, 14);
  }

  update(time: number, delta: number): void {
    if (isRunEnded(this.runState)) {
      return;
    }

    this.runElapsedMs += Math.max(0, delta);
    this.updateMinimapExpansionInput(time);

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

    if (this.bombKey && Phaser.Input.Keyboard.JustDown(this.bombKey)) {
      this.tryUseBomb();
    }

    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.tryPurchaseNearestShopOffer();
    }

    this.player.update(time, this.controls, this.playerBullets);

    const enemiesCanAct = this.roomController.canEnemiesAct(time);

    for (const enemy of this.enemies.getChildren() as BaseEnemy[]) {
      if (enemy.active) {
        if (enemiesCanAct) {
          enemy.updateAI(time, this.player, this.enemyBullets);
        } else {
          enemy.stopForAiDelay();
        }
      }
    }

    for (const bullet of this.playerBullets.getChildren() as Bullet[]) {
      bullet.update(time);
    }

    for (const bullet of this.enemyBullets.getChildren() as Bullet[]) {
      bullet.update(time);
    }

    this.combatCollisions.update();

    for (const beam of this.beams.getChildren() as BeamAttack[]) {
      beam.update(time);
    }

    this.roomController.updateDoorEntryGates(this.player.body as Phaser.Physics.Arcade.Body);
    this.roomController.update();
    this.bossHud.update();
    this.updateItemHint();
    this.hud.update(
      this.runState,
      this.dungeon,
      this.enemies.countActive(true),
      {
        x: this.player.x,
        y: this.player.y,
      },
      this.playerBullets.countActive(true) + this.enemyBullets.countActive(true),
      Math.round(this.game.loop.actualFps),
      this.runElapsedMs,
    );
  }

  private createControls(): PlayerControls {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.debugKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    this.localeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.bombKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.minimapKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    keyboard.on('keydown', this.handleSecretCodeKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', this.handleSecretCodeKey, this);
    });

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

  private updateMinimapExpansionInput(time: number): void {
    if (!this.minimapKey) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.minimapKey)) {
      this.minimapExpansion.press(time);
    }

    if (Phaser.Input.Keyboard.JustUp(this.minimapKey)) {
      this.minimapExpansion.release(time);
    }

    this.hud.setMapExpanded(this.minimapExpansion.expanded);
  }

  private handleSecretCodeKey(event: KeyboardEvent): void {
    if (this.secretCodeTracker.push(event.code)) {
      this.spawnSecretSynergyItems();
    }
  }

  private spawnSecretSynergyItems(): void {
    if (isRunEnded(this.runState)) {
      return;
    }

    const prismLance = PASSIVE_ITEMS.find((candidate) => candidate.id === PRISM_LANCE_ITEM_ID);
    const quadShot = PASSIVE_ITEMS.find((candidate) => candidate.id === QUAD_SHOT_ITEM_ID);

    if (!prismLance || !quadShot) {
      return;
    }

    const positions = getSecretSynergySpawnPositions(this.player.x, this.player.y);
    this.items.add(
      new ItemPickup(this, positions.prismLance.x, positions.prismLance.y, prismLance, 'secret'),
    );
    this.items.add(
      new ItemPickup(this, positions.quadShot.x, positions.quadShot.y, quadShot, 'secret'),
    );
    this.effects.pickup(positions.prismLance.x, positions.prismLance.y);
    this.effects.pickup(positions.quadShot.x, positions.quadShot.y);
    this.audio.play('pickup');
    this.hud.showMessage(t('messages.secretItemSpawned'), 1600);
  }

  private setupPhysics(): void {
    this.combatCollisions.register();

    this.physics.add.collider(
      this.player,
      this.roomController.shopNpcs,
      (playerObject, npcObject) => {
        const player = playerObject as Player;
        (npcObject as ShopNpc).pushFrom(player.x, player.y, this.time.now);
      },
    );

    this.physics.add.overlap(this.player, this.items, (_playerObject, itemObject) => {
      this.collectItem(itemObject as ItemPickup);
    });

    this.physics.add.overlap(
      this.player,
      this.rewards,
      (_playerObject, rewardObject) => {
        this.collectReward(rewardObject as RewardPickup);
      },
      (_playerObject, rewardObject) => !(rewardObject as RewardPickup).isPushable,
    );
    this.physics.add.collider(
      this.player,
      this.rewards,
      (_playerObject, rewardObject) => {
        this.handlePushableRewardCollision(rewardObject as RewardPickup);
      },
      (_playerObject, rewardObject) => (rewardObject as RewardPickup).isPushable,
    );
    this.physics.add.collider(
      this.rewards,
      this.roomController.walls,
      undefined,
      (rewardObject) => (rewardObject as RewardPickup).isPushable,
    );
    this.physics.add.collider(
      this.rewards,
      this.roomController.obstacles,
      undefined,
      (rewardObject) => (rewardObject as RewardPickup).isPushable,
    );
    this.physics.add.collider(
      this.rewards,
      this.rewards,
      undefined,
      (firstRewardObject, secondRewardObject) =>
        firstRewardObject !== secondRewardObject &&
        (firstRewardObject as RewardPickup).isPushable &&
        (secondRewardObject as RewardPickup).isPushable,
    );

    this.physics.add.overlap(
      this.player,
      this.roomController.doors,
      (_playerObject, doorObject) => {
        this.handleDoorOverlap(doorObject as Door);
      },
    );
    this.physics.add.overlap(this.player, this.floorExits, (_playerObject, exitObject) => {
      this.handleFloorExitOverlap(exitObject as FloorExit);
    });
  }

  private setupPlayerEvents(): void {
    this.player.on('player-died', () => {
      // 판정은 RunState.outcome이 기준이고, gameOverStarted는 오버레이·전환의
      // 중복 실행을 막는 표시용 상태로만 쓴다.
      if (isRunEnded(this.runState) || this.gameOverStarted) {
        return;
      }

      const gameOverData = {
        clearedRooms: this.runState.clearedRooms,
        itemCount: this.runState.collectedItemIds.length,
        score: this.runState.score,
      };
      this.runState.outcome = 'defeated';
      this.gameOverStarted = true;

      // Display the browser overlay before touching the physics world. It is
      // independent of Phaser's render loop, so later cleanup cannot prevent
      // the game-over screen from appearing.
      this.showGameOverOverlay(gameOverData);

      try {
        const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;

        if (body) {
          body.stop();
          body.enable = false;
        }

        this.physics.world.pause();
      } catch (error) {
        console.error('Player death physics cleanup failed.', error);
      }

      try {
        this.player.playDeathAnimation();
      } catch (error) {
        console.error('Player death animation failed.', error);
      }
    });

    this.player.on('beam-fired', (event: BeamFiredEvent) => {
      const damage = BEAM_TUNING.damage + getEffectiveDamage(this.runState.stats) * 0.8;

      for (const direction of event.directions) {
        this.beams.add(
          new BeamAttack(this, this.player.x, this.player.y, direction, BEAM_TUNING.range, damage),
        );
      }

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

  private prepareGameOverOverlay(): void {
    const overlay = document.querySelector<HTMLElement>('#game-over-overlay');
    const title = document.querySelector<HTMLElement>('#game-over-title');
    const summary = document.querySelector<HTMLElement>('#game-over-summary');
    const restartButton = document.querySelector<HTMLButtonElement>('#game-over-restart');

    if (!overlay || !title || !summary || !restartButton) {
      throw new Error('Game-over overlay elements are missing.');
    }

    this.gameOverOverlay = overlay;
    this.gameOverTitle = title;
    this.gameOverSummary = summary;
    this.gameOverRestartButton = restartButton;
    this.gameOverOverlay.hidden = true;
    this.gameOverOverlay.classList.remove('is-leaving');
    this.gameOverRestartButton.disabled = false;
    this.gameOverRestartButton.onclick = () => this.restartAfterGameOver();
    document.addEventListener('keydown', this.handleGameOverKeyDown, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('keydown', this.handleGameOverKeyDown, true);
      this.resetGameOverOverlay();
    });
  }

  private showGameOverOverlay(data: GameOverData): void {
    this.gameOverTitle.textContent = t('gameOver.title');
    this.gameOverSummary.textContent = t('gameOver.summary', {
      rooms: data.clearedRooms,
      items: data.itemCount,
      score: data.score,
    });
    this.gameOverRestartButton.textContent = t('gameOver.restart');
    this.gameOverOverlay.hidden = false;
    this.gameOverRestartButton.focus();
  }

  private restartAfterGameOver(): void {
    if (!this.gameOverStarted || this.gameOverTransitionStarted) {
      return;
    }

    this.gameOverTransitionStarted = true;
    this.gameOverRestartButton.disabled = true;
    this.gameOverOverlay.classList.add('is-leaving');
    this.scene.launch(TITLE_TRANSITION_SCENE_KEY);
  }

  private resetGameOverOverlay(): void {
    this.gameOverOverlay.hidden = true;
    this.gameOverOverlay.classList.remove('is-leaving');
    this.gameOverRestartButton.disabled = false;
    this.gameOverRestartButton.onclick = null;
  }

  private setupAudioUnlock(): void {
    this.input.once('pointerdown', () => this.audio.unlock());
    this.input.keyboard?.once('keydown', () => this.audio.unlock());
  }

  private setupPauseInput(): void {
    document.addEventListener('keydown', this.handlePauseKeyDown, true);
    this.events.on(Phaser.Scenes.Events.RESUME, this.handleGameSceneResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('keydown', this.handlePauseKeyDown, true);
      this.events.off(Phaser.Scenes.Events.RESUME, this.handleGameSceneResume);
    });
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

  private handleDoorOverlap(door: Door): void {
    if (!door.canEnter() || this.time.now < this.nextDoorAt) {
      return;
    }

    const navigation = this.roomNavigation.tryMove(this.runState, door.direction);

    if (navigation.status === 'no-target') {
      return;
    }

    if (navigation.status === 'key-needed') {
      this.nextDoorAt = this.time.now + COMBAT_TUNING.doorCooldownMs;
      this.hud.showMessage(t('messages.keyNeeded'), 1200);
      return;
    }

    if (navigation.unlockedRoomType) {
      this.hud.showMessage(
        t(
          navigation.unlockedRoomType === 'shop'
            ? 'messages.shopUnlocked'
            : 'messages.treasureUnlocked',
        ),
        1200,
      );
    }

    const moved = navigation.room;

    this.nextDoorAt = this.time.now + COMBAT_TUNING.doorCooldownMs;
    this.roomTransitions.enterRoom(moved, door.direction);
    this.updateBackgroundMusic(moved);
    const presentation = getRoomTransitionPresentation(moved.type);
    this.cameras.main.fadeIn(presentation.fadeInMs, 6, 9, 14);

    if (presentation.messageKey) {
      this.hud.showMessage(t(presentation.messageKey), 1100);
    }
  }

  private updateItemHint(): void {
    const shopOffer = this.findNearestShopOffer();

    if (shopOffer) {
      const product = getShopProduct(shopOffer.offer.productId);

      if (product) {
        this.hud.showItemHint(
          t('messages.shopOffer', {
            name: this.getShopProductName(product),
            price: shopOffer.offer.price,
          }),
        );
        return;
      }
    }

    let nearest: ItemPickup | null = null;
    let nearestDistSq = ITEM_PREVIEW_RADIUS * ITEM_PREVIEW_RADIUS;

    for (const pickup of this.items.getChildren() as ItemPickup[]) {
      if (!pickup.active) {
        continue;
      }

      const dx = pickup.x - this.player.x;
      const dy = pickup.y - this.player.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= nearestDistSq) {
        nearest = pickup;
        nearestDistSq = distSq;
      }
    }

    if (!nearest) {
      this.hud.clearItemHint();
      return;
    }

    this.hud.showItemHint(
      t('messages.itemPreview', {
        name: t(nearest.item.nameKey),
        description: t(nearest.item.descriptionKey),
        rarity: t(`rarities.${nearest.item.rarity}`),
        category: t(`itemCategories.${nearest.item.category}`),
      }),
    );
  }

  private collectItem(pickup: ItemPickup): void {
    if (!pickup.active) {
      return;
    }

    const acquisition = this.itemSystem.acquireItem(this.runState, pickup.item);

    if (!acquisition.acquired) {
      this.hud.showMessage(
        t('messages.itemMaxStacks', {
          name: t(pickup.item.nameKey),
          max: pickup.item.maxStacks,
        }),
        1400,
      );
      return;
    }

    if (acquisition.newlyUnlockedAbilityId === 'charge-beam') {
      this.player.hasChargeBeam = true;
    }

    this.player.setStats(this.runState.stats);
    this.player.setAttackProfile(this.runState.attackProfile);
    const currentRoom = this.dungeon.getCurrentRoom();

    if (pickup.source === 'room' && currentRoom.type === 'treasure') {
      this.dungeon.markCurrentTreasureClaimed();
    } else if (pickup.source === 'room' && currentRoom.type === 'combat') {
      this.dungeon.markCurrentCombatItemRewardClaimed();
    } else if (pickup.source === 'boss' && currentRoom.type === 'boss') {
      this.dungeon.markCurrentBossRewardClaimed();
    }

    const description = t(pickup.item.descriptionKey);
    this.itemPickupAnnouncement.show({
      title: t(pickup.item.nameKey),
      description,
    });
    this.effects.pickup(pickup.x, pickup.y);
    this.audio.play('pickup');
    pickup.destroy();
  }

  private findNearestShopOffer(): ShopOffer | null {
    if (this.dungeon.getCurrentRoom().type !== 'shop') {
      return null;
    }

    let nearest: ShopOffer | null = null;
    let nearestDistSq = SHOP_INTERACTION_RADIUS * SHOP_INTERACTION_RADIUS;

    for (const offer of this.roomController.shopOffers.getChildren() as ShopOffer[]) {
      if (!offer.active) {
        continue;
      }

      const dx = offer.x - this.player.x;
      const dy = offer.y - this.player.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= nearestDistSq) {
        nearest = offer;
        nearestDistSq = distSq;
      }
    }

    return nearest;
  }

  private tryPurchaseNearestShopOffer(): void {
    const offerObject = this.findNearestShopOffer();

    if (!offerObject) {
      return;
    }

    const result = this.shopSystem.purchase(this.runState, offerObject.offer);

    if (result.status === 'coins-needed') {
      this.hud.showMessage(t('messages.shopCoinsNeeded', { price: result.price }), 1200);
      return;
    }

    if (result.status === 'health-full') {
      this.hud.showMessage(t('messages.shopHealthFull'), 1200);
      return;
    }

    if (result.status === 'resource-full') {
      this.hud.showMessage(t('messages.shopResourceFull'), 1200);
      return;
    }

    if (result.status === 'item-capped') {
      this.hud.showMessage(
        t('messages.itemMaxStacks', {
          name: t(result.item.nameKey),
          max: result.item.maxStacks,
        }),
        1400,
      );
      return;
    }

    if (result.status !== 'purchased') {
      return;
    }

    if (result.acquisition?.newlyUnlockedAbilityId === 'charge-beam') {
      this.player.hasChargeBeam = true;
    }

    this.player.setStats(this.runState.stats);
    this.player.setAttackProfile(this.runState.attackProfile);
    const productName = this.getShopProductName(result.product);
    this.hud.showMessage(t('messages.shopPurchased', { name: productName }), 2200);
    this.effects.pickup(offerObject.x, offerObject.y);
    this.audio.play('pickup');
    offerObject.destroy();
  }

  private getShopProductName(product: ShopProductDefinition): string {
    if (product.kind !== 'passive') {
      return t(product.nameKey);
    }

    const item = PASSIVE_ITEMS.find((candidate) => candidate.id === product.itemId);
    return item ? t(item.nameKey) : product.itemId;
  }

  private collectReward(pickup: RewardPickup): void {
    if (!pickup.active || pickup.isOpenedChest) {
      return;
    }

    const result = this.rewardSystem.applyPickup(this.runState, pickup.reward);

    if (!result.collected) {
      this.hud.showMessage(t('messages.resourceFull', { resource: t(result.labelKey) }), 1100);
      return;
    }

    if (result.type === 'chest') {
      if (result.chestResult.type === 'heal') {
        this.player.setStats(this.runState.stats);
      }

      this.hud.showMessage(this.formatChestResult(result.chestResult), 1600);
      pickup.openChest();
      this.roomTransitions.markPendingChestOpened(pickup);
      this.effects.pickup(pickup.x, pickup.y);
      this.audio.play('pickup');
      return;
    } else {
      if (result.type === 'health') {
        this.player.setStats(this.runState.stats);
      }

      this.hud.showMessage(
        t('messages.rewardGain', {
          amount: result.amount,
          resource: t(result.labelKey),
        }),
        1200,
      );
    }

    this.effects.pickup(pickup.x, pickup.y);
    this.audio.play('pickup');
    this.roomTransitions.clearPendingRewardForPickup(pickup);
    pickup.destroy();
  }

  private handlePushableRewardCollision(pickup: RewardPickup): void {
    if (!pickup.active || !pickup.isPushable) {
      return;
    }

    this.collectReward(pickup);
    if (!pickup.active) {
      return;
    }

    const inputX = Number(this.controls.right.isDown) - Number(this.controls.left.isDown);
    const inputY = Number(this.controls.down.isDown) - Number(this.controls.up.isDown);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const hasMovementInput = inputX !== 0 || inputY !== 0;
    const pushX = hasMovementInput ? inputX : playerBody.velocity.x;
    const pushY = hasMovementInput ? inputY : playerBody.velocity.y;
    pickup.push(pushX, pushY, this.time.now);
  }

  private handleRoomCleared(room: RoomNode): void {
    this.runState.clearedRooms += 1;
    this.dropRoomClearReward(room);
    this.roomController.spawnCombatItemReward(room);
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

    if (room.type === 'boss') {
      this.music.play(getRoomMusicKey('combat'));
      this.roomController.spawnBossReward(room);
      this.roomTransitions.spawnFloorExit();
      const exitKind = floorExitKindForFloor(this.runState.floor);
      this.hud.showMessage(
        t(exitKind === 'escape' ? 'messages.escapeOpening' : 'messages.nextFloorOpening'),
        2200,
      );
    }
  }

  private handleEnemyDefeated(score: number): void {
    this.runState.score += score;
  }

  private handleObstacleDestroyed(x: number, y: number): void {
    const reward = this.rewardSystem.rollDestroyedCrateCoinDrop();

    if (!reward) {
      return;
    }

    this.roomTransitions.spawnPersistentReward(this.dungeon.getCurrentRoom(), reward, x, y);
  }

  private handleBossPhaseTwo(boss: BaseEnemy): void {
    if (isRunEnded(this.runState)) {
      return;
    }

    this.hud.showMessage(t(boss.getPhaseTwoMessageKey()), 1700);
    this.effects.shake('bossPhaseTwo');
    this.cameras.main.flash(160, 255, 88, 125, false);
    this.audio.play('bossPhaseTwo');
  }

  private tryUseBomb(): void {
    if (this.bombSystem.tryPlant(this.player.x, this.player.y) === 'no-bombs') {
      this.hud.showMessage(t('messages.noBombs'), 900);
    }
  }

  private dropRoomClearReward(room: RoomNode): void {
    const reward = this.rewardSystem.rollRoomClearReward(this.runState.stats);

    if (!reward) {
      return;
    }

    const x = ROOM_CENTER_X + Phaser.Math.Between(-30, 30);
    const y = ROOM_CENTER_Y + Phaser.Math.Between(-20, 20);
    room.pendingReward = { reward, x, y };
    this.roomTransitions.spawnPendingReward(room);
  }

  private handlePlayerDamaged(): void {
    if (isRunEnded(this.runState)) {
      return;
    }

    this.player.playHitFeedback();
    this.effects.shake('playerHurt');
    this.effects.playerHurtFlash();
    this.audio.play('playerHurt');
  }

  private queuePlayerDamagedFeedback(): void {
    if (this.playerDamageFeedbackQueued || isRunEnded(this.runState)) {
      return;
    }

    this.playerDamageFeedbackQueued = true;
    this.time.delayedCall(0, () => {
      this.playerDamageFeedbackQueued = false;
      this.handlePlayerDamaged();
    });
  }

  private handleFloorExitOverlap(exit: FloorExit): void {
    if (isRunEnded(this.runState) || this.floorTransitionStarted || !exit.canEnter(this.time.now)) {
      return;
    }

    this.floorTransitionStarted = true;
    exit.disableBody(true, false);
    this.cameras.main.fadeOut(180, 5, 9, 14);
    this.time.delayedCall(180, () => this.advanceFloor());
  }

  private advanceFloor(): void {
    if (isRunEnded(this.runState)) {
      return;
    }

    this.floorTransitionStarted = false;
    advanceRunToNextFloor(this.runState);
    this.player.setStats(this.runState.stats);
    this.roomTransitions.enterFloor(
      this.runState.floor,
      this.runState.unlockedAbilityIds.includes('charge-beam'),
    );
    this.updateBackgroundMusic(this.dungeon.getCurrentRoom());
    this.cameras.main.fadeIn(260, 5, 9, 14);
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

  private updateBackgroundMusic(room: RoomNode): void {
    this.music.play(getRoomMusicKey(room.type));
  }
}
