import Phaser from 'phaser';
import { MusicKeys } from '../config/assets';
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
import {
  formatRunElapsedTime,
  MinimapExpansionController,
} from '../systems/MinimapExpansionController';
import { getRoomMusicKey, MusicSystem } from '../systems/MusicSystem';
import { RewardSystem } from '../systems/RewardSystem';
import { RoomController } from '../systems/RoomController';
import { RoomNavigationSystem } from '../systems/RoomNavigationSystem';
import { getRoomTransitionPresentation } from '../systems/RoomTransitionRules';
import { RoomTransitionSystem } from '../systems/RoomTransitionSystem';
import { ShopSystem } from '../systems/ShopSystem';
import { resolveFloorExit } from '../systems/RunProgressionSystem';
import {
  getSecretSynergySpawnPositions,
  KONAMI_CODE,
  SecretCodeTracker,
} from '../systems/SecretCodeSystem';
import { getStageProgress, stageFloorRoman } from '../data/stages';
import { canStartEscapeSequence } from '../systems/FloorExitRules';
import { createInitialRunState, isRunEnded, type RunState } from '../systems/RunState';
import { getEffectiveDamage } from '../systems/PlayerStatSystem';
import { BossHud } from '../ui/BossHud';
import { Hud } from '../ui/Hud';
import { ItemPickupAnnouncement } from '../ui/ItemPickupAnnouncement';
import { isPauseCode } from '../ui/PauseMenuRules';
import { UiCameraSystem } from '../ui/UiCameraSystem';
import { applyRenderScale } from '../utils/render';
import { bindCaptureKeydown, shouldConfirmRunEnd } from '../utils/runEndInput';
import { resetRunEndOverlayElements } from '../utils/runEndOverlays';
import { TITLE_TRANSITION_SCENE_KEY } from './TitleTransitionScene';

// 오프닝 퇴장 연출 길이. 오프닝 자체는 시간이 아니라 플레이어 입력으로만 넘어간다.
const INTRO_EXIT_MS = 440;

// 연출을 끝까지 보여 준 뒤에야 넘길 수 있게 하는 잠금 시간. 이 값이 지나야 스킵
// 안내가 나타나고 입력도 받는다 — "안내가 보이면 넘길 수 있다"가 항상 성립하도록
// startIntro가 같은 값을 CSS 변수(--intro-skip-delay)로 내려보낸다.
const INTRO_SKIP_READY_MS = 2200;

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
      !shouldConfirmRunEnd({
        overlayShown: this.gameOverStarted,
        transitionStarted: this.gameOverTransitionStarted,
        outcome: this.runState.outcome,
        expectedOutcome: 'defeated',
        code: event.code,
      })
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.restartAfterGameOver();
  };
  private introOverlay?: HTMLElement;
  private introActive = false;
  private introHideTimer?: number;
  private introSkipReadyAt = 0;
  private detachIntroInput?: () => void;
  private readonly handleIntroDismiss = (event: Event): void => {
    if (!this.introActive) {
      return;
    }

    // 오프닝을 넘기는 입력이 그대로 게임 조작으로 새지 않게 막는다. 다만 일시정지
    // 리스너가 먼저 등록돼 있어 전파 차단만으로는 부족하므로, handlePauseKeyDown
    // 쪽에도 introActive 가드를 둔다.
    event.preventDefault();
    event.stopImmediatePropagation();

    // 연출이 끝나기 전(스킵 안내가 뜨기 전)에는 입력을 삼킨다. 첫 프레임에 키를
    // 누르고 있던 것만으로 오프닝이 통째로 사라지는 것을 막는다.
    if (performance.now() < this.introSkipReadyAt) {
      return;
    }

    this.dismissIntro();
  };
  private escapeStarted = false;
  private escapeOverlay!: HTMLElement;
  private escapeTitle!: HTMLElement;
  private escapeSummary!: HTMLElement;
  private escapeReturnButton!: HTMLButtonElement;
  private escapeTransitionStarted = false;
  private readonly handleEscapeKeyDown = (event: KeyboardEvent): void => {
    if (
      !shouldConfirmRunEnd({
        overlayShown: this.escapeStarted,
        transitionStarted: this.escapeTransitionStarted,
        outcome: this.runState.outcome,
        expectedOutcome: 'escaped',
        code: event.code,
      })
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.returnToTitleAfterEscape();
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
      // 오프닝 중 Esc는 오프닝을 넘기기만 하고 일시정지를 열지 않는다.
      this.introActive ||
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
    this.escapeStarted = false;
    this.escapeTransitionStarted = false;
    this.floorTransitionStarted = false;
    this.playerDamageFeedbackQueued = false;
    this.pauseTransitionStarted = false;
    this.introActive = false;
    this.runElapsedMs = 0;
    this.minimapExpansion = new MinimapExpansionController();
    this.secretCodeTracker = new SecretCodeTracker(KONAMI_CODE);

    // 방 바깥 여백은 순수한 검은색 — 땅속의 어둠으로 읽히게 한다.
    this.cameras.main.setBackgroundColor('#000000');
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
      onPlayerDamaged: () => this.queuePlayerDamagedFeedback(),
    });
    this.bombSystem = new BombSystem({
      scene: this,
      runState: this.runState,
      player: this.player,
      enemies: this.enemies,
      enemyBullets: this.enemyBullets,
      obstacles: this.roomController.obstacles,
      effects: this.effects,
      audio: this.audio,
      isRunEnded: () => isRunEnded(this.runState),
      onPlayerDamaged: () => this.queuePlayerDamagedFeedback(),
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
    this.prepareEscapeOverlay();
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
    this.hud.showMessage(this.formatStageFloorLabel());
    this.cameras.main.fadeIn(220, 5, 9, 14);
    this.startIntro();
  }

  update(time: number, delta: number): void {
    if (isRunEnded(this.runState)) {
      return;
    }

    // 오프닝이 떠 있는 동안은 게임 로직 전체를 멈춘다. physics만 정지시키면
    // 플레이어 입력·폭탄·적 AI·방 갱신이 계속 돌아가므로 여기서 조기 반환한다.
    // 플레이 시간(runElapsedMs)이 흐르지 않는 것도 이 반환으로 함께 보장된다.
    if (this.introActive) {
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
    const removeListener = bindCaptureKeydown(document, this.handleGameOverKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      removeListener();
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
    resetRunEndOverlayElements(this.gameOverOverlay, this.gameOverRestartButton);
    this.gameOverRestartButton.onclick = null;
  }

  // 런 시작 오프닝. 게임 화면 위에 DOM 오버레이로 재생해 픽셀 격자에 구속되지 않는
  // 부드러운 모션을 낸다. 연출 도중에는 물리를 멈춰 뒤에서 게임이 진행되지 않게 한다.
  private startIntro(): void {
    const overlay = document.querySelector<HTMLElement>('#intro-overlay');
    const kicker = document.querySelector<HTMLElement>('#intro-kicker');
    const title = document.querySelector<HTMLElement>('#intro-title');
    const subtitle = document.querySelector<HTMLElement>('#intro-subtitle');
    const skip = document.querySelector<HTMLElement>('#intro-skip');

    // 오프닝은 연출일 뿐이므로 마크업이 없더라도 게임 시작을 막지 않는다.
    if (!overlay || !kicker || !title || !subtitle || !skip) {
      return;
    }

    kicker.textContent = t('intro.kicker');
    this.renderIntroTitleLetters(title, t('intro.title'));
    subtitle.textContent = t('intro.subtitle');
    skip.textContent = t('intro.skip');

    // 이전 런의 숨김 타이머가 살아 있으면 방금 띄운 오버레이를 감춰 버리므로 먼저 끈다.
    this.clearIntroHideTimer();
    this.introOverlay = overlay;
    this.introActive = true;
    // 동작 줄이기를 켜면 CSS가 모든 지연을 0으로 만들어 스킵 안내가 곧바로 나타난다.
    // 그때는 입력 잠금도 함께 0이어야 "안내가 보이면 넘길 수 있다"가 유지된다.
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const skipReadyMs = prefersReducedMotion ? 0 : INTRO_SKIP_READY_MS;

    // 안내 등장 지연(CSS)과 입력 잠금(JS)이 반드시 같은 값에서 나오게 한다.
    overlay.style.setProperty('--intro-skip-delay', `${skipReadyMs}ms`);
    this.introSkipReadyAt = performance.now() + skipReadyMs;
    overlay.classList.remove('is-leaving');
    overlay.hidden = false;
    this.physics.world.pause();

    const detachKeydown = bindCaptureKeydown(document, this.handleIntroDismiss);
    document.addEventListener('pointerdown', this.handleIntroDismiss, true);
    this.detachIntroInput = () => {
      detachKeydown();
      document.removeEventListener('pointerdown', this.handleIntroDismiss, true);
    };

    // 자동 진행은 없다. 플레이어가 키를 누르거나 클릭할 때까지 오프닝을 유지한다.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownIntro());
  }

  // 제목을 글자 단위 span으로 쪼개 각 글자가 따로 점등하게 한다.
  // 순서(--i)는 CSS가 시차를 계산하는 데 쓰고, 공백은 칸을 유지하도록 NBSP로 바꾼다.
  private renderIntroTitleLetters(target: HTMLElement, text: string): void {
    const letters = Array.from(text).map((character, index) => {
      const span = document.createElement('span');
      span.className = 'intro-letter';
      span.textContent = character === ' ' ? '\u00a0' : character;
      span.style.setProperty('--i', String(index));
      // \uae00\uc790 \uc870\uac01\uc740 \uc5f0\ucd9c\uc6a9\uc774\ubbc0\ub85c \ubcf4\uc870 \uae30\uc220\uc5d0\ub294 \ub178\ucd9c\ud558\uc9c0 \uc54a\uace0, \uc81c\ubaa9 \uc804\uccb4\ub294
      // aria-label\ub85c \ud55c \ubc88\uc5d0 \uc77d\ud788\uac8c \ud55c\ub2e4.
      span.setAttribute('aria-hidden', 'true');
      return span;
    });

    target.setAttribute('aria-label', text);
    target.replaceChildren(...letters);
  }

  // 플레이어 입력으로 오프닝을 넘긴다. 퇴장 연출을 재생한 뒤 오버레이를 감춘다.
  private dismissIntro(): void {
    if (!this.introActive) {
      return;
    }

    this.releaseIntroHold();

    const overlay = this.introOverlay;

    if (!overlay) {
      return;
    }

    overlay.classList.add('is-leaving');
    this.clearIntroHideTimer();
    this.introHideTimer = window.setTimeout(() => {
      this.introHideTimer = undefined;
      overlay.hidden = true;
      overlay.classList.remove('is-leaving');
    }, INTRO_EXIT_MS);
  }

  // 씬 종료 경로. 오프닝이 진행 중이든 퇴장 연출 중이든, 남은 타이머와 오버레이
  // 표시 상태를 무조건 되돌린다. 중복 호출에 안전하다.
  private teardownIntro(): void {
    this.clearIntroHideTimer();

    const overlay = this.introOverlay;

    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('is-leaving');
    }

    this.releaseIntroHold();
  }

  // 입력 잠금과 물리 정지를 푼다. 리스너를 먼저 떼어 이후 단계가 실패해도 남지 않게 한다.
  private releaseIntroHold(): void {
    this.detachIntroInput?.();
    this.detachIntroInput = undefined;

    if (!this.introActive) {
      return;
    }

    this.introActive = false;
    this.physics.world.resume();
  }

  private clearIntroHideTimer(): void {
    if (this.introHideTimer !== undefined) {
      window.clearTimeout(this.introHideTimer);
      this.introHideTimer = undefined;
    }
  }

  private prepareEscapeOverlay(): void {
    const overlay = document.querySelector<HTMLElement>('#escape-overlay');
    const title = document.querySelector<HTMLElement>('#escape-title');
    const summary = document.querySelector<HTMLElement>('#escape-summary');
    const returnButton = document.querySelector<HTMLButtonElement>('#escape-return');

    if (!overlay || !title || !summary || !returnButton) {
      throw new Error('Escape overlay elements are missing.');
    }

    this.escapeOverlay = overlay;
    this.escapeTitle = title;
    this.escapeSummary = summary;
    this.escapeReturnButton = returnButton;
    this.escapeOverlay.hidden = true;
    this.escapeOverlay.classList.remove('is-leaving');
    this.escapeReturnButton.disabled = false;
    this.escapeReturnButton.onclick = () => this.returnToTitleAfterEscape();
    const removeListener = bindCaptureKeydown(document, this.handleEscapeKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      removeListener();
      this.resetEscapeOverlay();
    });
  }

  private startEscapeSequence(): void {
    if (!canStartEscapeSequence(this.runState.outcome, this.escapeStarted)) {
      return;
    }

    this.escapeStarted = true;

    // 게임오버와 동일하게, 물리 정리보다 먼저 브라우저 오버레이를 띄워
    // 이후 정리 과정의 오류가 승리 화면 표시를 막지 못하게 한다.
    this.showEscapeOverlay();

    try {
      const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;

      if (body) {
        body.stop();
        body.enable = false;
      }

      this.physics.world.pause();
    } catch (error) {
      console.error('Escape physics cleanup failed.', error);
    }

    // 물리 정지는 Scene 타이머(fuse)를 멈추지 않으므로 설치된 폭탄을 제거한다.
    this.bombSystem.clear();
    this.music.play(MusicKeys.title);
  }

  private showEscapeOverlay(): void {
    this.escapeTitle.textContent = t('escape.title');
    this.escapeSummary.textContent = t('escape.summary', {
      rooms: this.runState.clearedRooms,
      items: this.runState.collectedItemIds.length,
      score: this.runState.score,
      // 확장 미니맵과 동일한 HH:MM:SS 형식을 재사용한다.
      time: formatRunElapsedTime(this.runElapsedMs),
    });
    this.escapeReturnButton.textContent = t('escape.returnToTitle');
    this.escapeOverlay.hidden = false;
    this.escapeReturnButton.focus();
  }

  private returnToTitleAfterEscape(): void {
    if (!this.escapeStarted || this.escapeTransitionStarted) {
      return;
    }

    this.escapeTransitionStarted = true;
    this.escapeReturnButton.disabled = true;
    this.escapeOverlay.classList.add('is-leaving');
    this.scene.launch(TITLE_TRANSITION_SCENE_KEY);
  }

  private resetEscapeOverlay(): void {
    resetRunEndOverlayElements(this.escapeOverlay, this.escapeReturnButton);
    this.escapeReturnButton.onclick = null;
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
      // 메시지 3분화: I층 보스(일반 굴) / II층 보스(스테이지 클리어) / 최종층(탈출구)
      const progress = getStageProgress(this.runState.floor);
      const messageKey = progress.isFinalFloor
        ? 'messages.escapeOpening'
        : progress.floorInStage === 2
          ? 'messages.stageCleared'
          : 'messages.nextFloorOpening';
      this.hud.showMessage(t(messageKey), 2200);
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

    // 판정은 순수 규칙이 담당한다: 다음 층 이동 / 최종층 탈출 / 무시.
    const outcome = resolveFloorExit(this.runState);

    if (outcome.kind === 'ignored') {
      return;
    }

    exit.disableBody(true, false);

    if (outcome.kind === 'run-clear') {
      this.startEscapeSequence();
      return;
    }

    this.floorTransitionStarted = true;
    this.cameras.main.fadeOut(180, 5, 9, 14);
    this.time.delayedCall(180, () => this.enterNextFloor());
  }

  // resolveFloorExit가 층 증가·회복을 이미 확정했으므로 여기서는 화면 전환만 한다.
  private enterNextFloor(): void {
    if (isRunEnded(this.runState)) {
      return;
    }

    this.floorTransitionStarted = false;
    this.player.setStats(this.runState.stats);
    this.roomTransitions.enterFloor(
      this.runState.floor,
      this.runState.unlockedAbilityIds.includes('charge-beam'),
    );
    this.updateBackgroundMusic(this.dungeon.getCurrentRoom());
    this.cameras.main.fadeIn(260, 5, 9, 14);
    this.hud.showMessage(this.formatStageFloorLabel(), 1800);
  }

  private formatStageFloorLabel(): string {
    const progress = getStageProgress(this.runState.floor);
    return t('messages.floor', {
      floor: this.runState.floor,
      stage: t(progress.stage.nameKey),
      roman: stageFloorRoman(progress.floorInStage),
    });
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
