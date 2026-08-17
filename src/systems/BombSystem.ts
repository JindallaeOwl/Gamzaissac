import Phaser from 'phaser';
import { BOMB_TUNING } from '../config/gameConfig';
import { Bomb } from '../entities/Bomb';
import { Bullet } from '../entities/Bullet';
import { Obstacle } from '../entities/Obstacle';
import type { Player } from '../entities/Player';
import { ShopNpc } from '../entities/ShopNpc';
import { BaseEnemy } from '../entities/enemies/BaseEnemy';
import { normalizeVector } from '../utils/math';
import type { AudioSystem } from './AudioSystem';
import { BOMB_PUSH_BOUNCE, BOMB_PUSH_DRAG, BOMB_SEED_PUSH_SPEED } from './BombPushRules';
import { isWithinBombRadius, resolveBombPlantAttempt, shouldDetonateBomb } from './BombRules';
import type { DungeonManager, RoomNode } from './DungeonManager';
import type { EffectsSystem } from './EffectsSystem';
import type { RunState } from './RunState';

// 폭탄 하나를 방 상태와 잇는 꼬리표. 되살아난 폭탄도 같은 id를 지녀, 터질 때
// 자기 항목만 정확히 지운다(안 지우면 방에 들어올 때마다 되살아나 무한히 늘어난다).
const PLANTED_BOMB_ID_KEY = 'plantedBombId';
const PLANTED_BOMB_ROOM_KEY = 'plantedBombRoomId';

interface BombSystemConfig {
  scene: Phaser.Scene;
  dungeon: DungeonManager;
  runState: RunState;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  enemyBullets: Phaser.Physics.Arcade.Group;
  obstacles: Phaser.Physics.Arcade.StaticGroup;
  shopNpcs: Phaser.GameObjects.Group;
  effects: EffectsSystem;
  audio: AudioSystem;
  isRunEnded: () => boolean;
  // 자기 폭발에 맞았을 때 공통 피격 피드백(점멸·화면 흔들림·효과음)으로 연결한다.
  onPlayerDamaged?: () => void;
  // 상인이 날아갔을 때. 방 상태에 기록해 다시 들어와도 상인이 없고 자국만 남게 한다.
  onShopNpcDestroyed?: (x: number, y: number, direction: { x: number; y: number }) => void;
}

export type BombPlantResult = 'planted' | 'no-bombs' | 'cooldown' | 'blocked';

export class BombSystem {
  private readonly scene: Phaser.Scene;
  private readonly dungeon: DungeonManager;
  private readonly runState: RunState;
  private readonly player: Player;
  private readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly enemyBullets: Phaser.Physics.Arcade.Group;
  private readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  private readonly shopNpcs: Phaser.GameObjects.Group;
  private readonly effects: EffectsSystem;
  private readonly audio: AudioSystem;
  private readonly isRunEnded: () => boolean;
  private readonly onPlayerDamaged?: () => void;
  private readonly onShopNpcDestroyed?: (
    x: number,
    y: number,
    direction: { x: number; y: number },
  ) => void;
  // 밀리는 물체이므로 물리 그룹이다. 충돌(벽·장애물·플레이어·씨앗) 배선은
  // 보상 픽업과 같은 자리에서 GameScene이 건다.
  readonly plantedBombs: Phaser.Physics.Arcade.Group;
  private nextBombAt = 0;

  constructor(config: BombSystemConfig) {
    this.scene = config.scene;
    this.dungeon = config.dungeon;
    this.runState = config.runState;
    this.player = config.player;
    this.enemies = config.enemies;
    this.enemyBullets = config.enemyBullets;
    this.obstacles = config.obstacles;
    this.shopNpcs = config.shopNpcs;
    this.effects = config.effects;
    this.audio = config.audio;
    this.isRunEnded = config.isRunEnded;
    this.onPlayerDamaged = config.onPlayerDamaged;
    this.onShopNpcDestroyed = config.onShopNpcDestroyed;
    // 폭탄의 물리 성질은 반드시 이 그룹 설정으로 준다. Phaser의 물리 그룹은 자식을
    // 추가하는 순간 바디에 그룹 기본값을 덮어쓰므로(PhysicsGroup.createCallbackHandler),
    // Bomb 생성자에서 setDrag를 해도 add 시점에 0으로 지워진다 — 그러면 한 번 밀린
    // 폭탄이 벽에 닿을 때까지 등속으로 미끄러진다.
    this.plantedBombs = this.scene.physics.add.group({
      allowGravity: false,
      dragX: BOMB_PUSH_DRAG,
      dragY: BOMB_PUSH_DRAG,
      bounceX: BOMB_PUSH_BOUNCE,
      bounceY: BOMB_PUSH_BOUNCE,
      // 어떤 경로로 밀려도 씨앗 한 발보다 빨라지지 않게 상한을 둔다. maxVelocity는
      // 축별 상한이라 대각선에서 1.4배까지 새므로, 속력 자체를 묶는 maxSpeed를 쓴다.
      maxSpeed: BOMB_SEED_PUSH_SPEED,
    });
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  /**
   * 심은 폭탄이 "밀 수 있는 물체"가 되는 시점을 판정한다. 폭탄은 플레이어 발밑에
   * 생기므로 곧바로 단단해지면 심는 순간 플레이어가 밀려나고 자기 씨앗도 발밑에서
   * 사라진다. 플레이어가 한 번 벗어난 뒤부터 켠다.
   */
  update(): void {
    for (const bomb of this.plantedBombs.getChildren() as Bomb[]) {
      bomb.updatePushArming(this.player.x, this.player.y);
    }
  }

  tryPlant(x: number, y: number): BombPlantResult {
    const decision = resolveBombPlantAttempt(
      this.runState,
      this.scene.time.now,
      this.nextBombAt,
      this.isRunEnded(),
    );

    if (decision.status !== 'planted') {
      return decision.status;
    }

    this.nextBombAt = decision.nextBombAt;
    const roomId = this.dungeon.getCurrentRoom().id;
    const state = this.dungeon.addPlantedBomb(roomId, x, y);

    this.spawnBomb(x, y, roomId, state?.id);
    return 'planted';
  }

  /**
   * 방에 다시 들어올 때 아직 터지지 않은 폭탄을 그 자리에 되살린다. 도화선은 처음부터
   * 새로 센다 — 저장한 것은 자리뿐이다.
   */
  restoreRoomBombs(room: RoomNode): void {
    for (const state of room.plantedBombs) {
      this.spawnBomb(state.x, state.y, room.id, state.id);
    }
  }

  /**
   * 방을 나가기 전에 살아있는 폭탄의 마지막 자리를 방 상태에 적어 둔다. 밀어서
   * 굴려 놓은 위치가 그대로 보존된다.
   */
  saveRoomBombPositions(): void {
    for (const bomb of this.plantedBombs.getChildren() as Bomb[]) {
      const roomId = bomb.getData(PLANTED_BOMB_ROOM_KEY) as string | undefined;
      const bombId = bomb.getData(PLANTED_BOMB_ID_KEY) as number | undefined;

      if (!bomb.active || !roomId || bombId === undefined) {
        continue;
      }

      this.dungeon.updatePlantedBomb(roomId, bombId, bomb.x, bomb.y);
    }
  }

  clear(): void {
    this.plantedBombs.clear(true, true);
  }

  private spawnBomb(x: number, y: number, roomId: string, bombId?: number): void {
    const bomb = new Bomb(this.scene, x, y, (originX, originY) => {
      // 터진 폭탄은 방 상태에서 빠져야 다시 들어올 때 되살아나지 않는다.
      if (bombId !== undefined) {
        this.dungeon.clearPlantedBomb(roomId, bombId);
      }

      this.detonate(originX, originY);
    });

    bomb.setData(PLANTED_BOMB_ROOM_KEY, roomId);
    bomb.setData(PLANTED_BOMB_ID_KEY, bombId);
    this.plantedBombs.add(bomb);
  }

  private detonate(originX: number, originY: number): void {
    if (!shouldDetonateBomb(this.isRunEnded())) {
      return;
    }

    const enemiesInRoom = [...(this.enemies.getChildren() as BaseEnemy[])];

    for (const enemy of enemiesInRoom) {
      if (!enemy.active || !enemy.body || !isWithinBombRadius(originX, originY, enemy.x, enemy.y)) {
        continue;
      }

      const enemyX = enemy.x;
      const enemyY = enemy.y;
      const defeated = enemy.takeDamage(BOMB_TUNING.damage, originX, originY);

      if (defeated) {
        this.effects.enemyDeath(enemyX, enemyY, enemy.scoreValue);
        this.audio.play('enemyDeath');
      }
    }

    const enemyBulletsInRoom = [...(this.enemyBullets.getChildren() as Bullet[])];

    for (const bullet of enemyBulletsInRoom) {
      if (!bullet.active || !isWithinBombRadius(originX, originY, bullet.x, bullet.y)) {
        continue;
      }

      if (bullet.consume()) {
        bullet.queueDestroy();
      }
    }

    const obstaclesInRoom = [...(this.obstacles.getChildren() as Obstacle[])];

    for (const obstacle of obstaclesInRoom) {
      if (!obstacle.active || !isWithinBombRadius(originX, originY, obstacle.x, obstacle.y)) {
        continue;
      }

      obstacle.destroyByBomb();
    }

    // 상점 상인은 전투 대상이 아니라 폭발에 날아가는 연출 전용이다. 물건을 사는 판정은
    // 상품과의 거리로 하므로, 상인이 사라져도 상점은 그대로 이용할 수 있다.
    const shopNpcsInRoom = [...(this.shopNpcs.getChildren() as ShopNpc[])];

    for (const npc of shopNpcsInRoom) {
      if (!npc.active || !isWithinBombRadius(originX, originY, npc.x, npc.y)) {
        continue;
      }

      // 폭발에서 상인 쪽으로 향하는 방향. 정확히 겹쳐 있으면 위로 날린다.
      const away = normalizeVector(npc.x - originX, npc.y - originY);
      const direction = away.x === 0 && away.y === 0 ? { x: 0, y: -1 } : away;

      this.effects.shopNpcBlast(npc.x, npc.y, direction);
      this.onShopNpcDestroyed?.(npc.x, npc.y, direction);
      npc.destroy();
    }

    // 플레이어 피해는 적·장애물 처리를 모두 끝낸 뒤 마지막에 판정한다. 자기 폭탄에
    // 죽으면 이 호출 안에서 'player-died'가 발생해 런이 종료되므로, 그 전에 폭발의
    // 나머지 결과가 모두 반영되게 한다.
    // 무적시간·갓모드·넉백·사망 판정은 Player.damage가 처리하고, 실제로 맞았을 때만
    // 공통 피격 피드백을 부른다(농부 보스의 근접 피해와 같은 방식).
    if (isWithinBombRadius(originX, originY, this.player.x, this.player.y)) {
      if (this.player.damage(BOMB_TUNING.selfDamage, originX, originY)) {
        this.onPlayerDamaged?.();
      }
    }

    this.effects.bombBlast(originX, originY);
    this.effects.shake('bombUse');
    this.scene.cameras.main.flash(140, 255, 176, 90, false);
    this.audio.play('bombUse');
  }
}
