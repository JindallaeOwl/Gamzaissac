import Phaser from 'phaser';
import { COMBAT_TUNING, DEPTH, FEEDBACK_TUNING, ROOM_RECT } from '../../config/gameConfig';
import type { EnemyDefinition } from '../../data/enemies';
import { Bullet } from '../Bullet';
import type { Player } from '../Player';
import { normalizeVector } from '../../utils/math';
import { getCenteredCircleBodyOffset } from '../../utils/collisionBody';
import { effectiveBodyRadius } from '../../systems/EnemyScaleRules';
import { t } from '../../i18n';

/** 챔피언 승격이 적용할 수치 묶음. 값은 스폰 정책(ChampionRules)이 정해 넘긴다 —
    엔티티는 받은 숫자를 적용할 뿐, 등장 확률 같은 정책을 알지 못한다. */
export interface ChampionModifier {
  healthMultiplier: number;
  scoreMultiplier: number;
  displayScaleMultiplier: number;
  tint: number;
}

export abstract class BaseEnemy extends Phaser.Physics.Arcade.Sprite {
  readonly definition: EnemyDefinition;
  contactDamage: number;
  readonly isBoss: boolean;

  protected hp: number;
  protected floorScale: number;
  private maxHp: number;
  private baseScoreValue: number;
  private champion = false;
  private nextContactAt = 0;
  private defeated = false;
  private persistentTint?: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    definition: EnemyDefinition,
    floor: number,
  ) {
    super(scene, x, y, definition.textureKey);
    this.definition = definition;
    this.floorScale = 1 + Math.max(0, floor - 1) * 0.16;
    this.maxHp = definition.maxHealth * this.floorScale;
    this.hp = this.maxHp;
    this.contactDamage = definition.contactDamage;
    this.baseScoreValue = Math.round(definition.score * this.floorScale);
    this.isBoss = definition.kind === 'boss';

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.actor);

    // Enemy textures are authored at their intended on-screen size and drawn at
    // scale 1. Minibosses temporarily reuse normal-enemy textures enlarged via
    // displayScale; the Arcade body scales with the sprite, so bodyRadius below
    // stays in unscaled texture pixels.
    if (definition.displayScale !== undefined) {
      this.setScale(definition.displayScale);
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const bodyOffset = getCenteredCircleBodyOffset(this.width, this.height, definition.bodyRadius);
    body.setAllowGravity(false);
    body.setCircle(definition.bodyRadius, bodyOffset.x, bodyOffset.y);
    body.setCollideWorldBounds(false);
  }

  abstract updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void;

  get scoreValue(): number {
    return this.baseScoreValue;
  }

  get isChampion(): boolean {
    return this.champion;
  }

  /** displayScale·챔피언 확대가 반영된 월드 기준 몸 반경. 현재 배율에서 계산하므로
      승격처럼 생성 후 크기가 바뀌어도 낡지 않는다 (탄 생성 위치·벽 여백에 사용). */
  get effectiveBodyRadius(): number {
    return effectiveBodyRadius(this.definition.bodyRadius, this.scaleX);
  }

  /** 전투방 스폰이 부르는 챔피언 승격 — 체력·점수·크기·금색을 한 번에 적용한다. */
  promoteToChampion(modifier: ChampionModifier): void {
    if (this.champion || this.isBoss) {
      return;
    }

    this.champion = true;
    this.maxHp *= modifier.healthMultiplier;
    this.hp *= modifier.healthMultiplier;
    this.baseScoreValue = Math.round(this.baseScoreValue * modifier.scoreMultiplier);
    this.setScale(this.scaleX * modifier.displayScaleMultiplier);
    this.setPersistentTint(modifier.tint);
  }

  takeDamage(amount: number, sourceX: number, sourceY: number): boolean {
    if (!this.active || this.defeated || !this.body) {
      return false;
    }

    this.hp -= amount;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const push = normalizeVector(this.x - sourceX, this.y - sourceY);
    body.setVelocity(push.x * COMBAT_TUNING.enemyKnockback, push.y * COMBAT_TUNING.enemyKnockback);

    this.setTint(FEEDBACK_TUNING.effects.enemyHitTint);
    this.scene.time.delayedCall(FEEDBACK_TUNING.effects.enemyHitFlashMs, () => {
      if (this.active) {
        this.restorePersistentTint();
      }
    });

    if (this.hp <= 0) {
      this.defeated = true;
      const body = this.body as Phaser.Physics.Arcade.Body | undefined;

      if (body) {
        body.enable = false;
        body.stop();
      }

      this.emit('enemy-defeated', this.scoreValue);
      this.destroy();
      return true;
    }

    return false;
  }

  /**
   * Kill this enemy immediately, bypassing any invulnerability (e.g. the Worm
   * King while burrowed). Fires the same defeat events as a normal kill so score
   * and split children still happen. Returns true only if it actually died this
   * call, so callers can count real defeats instead of assuming every target
   * dropped. Used by the developer `kill` command.
   */
  forceDefeat(): boolean {
    if (!this.active || this.defeated) {
      return false;
    }

    this.hp = 0;
    this.defeated = true;

    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (body) {
      body.enable = false;
      body.stop();
    }

    this.emit('enemy-defeated', this.scoreValue);
    this.destroy();
    return true;
  }

  takeProjectileDamage(
    amount: number,
    sourceX: number,
    sourceY: number,
  ): { defeated: boolean; overflowDamage: number } {
    const healthBeforeHit = Math.max(0, this.hp);
    const defeated = this.takeDamage(amount, sourceX, sourceY);

    return {
      defeated,
      overflowDamage: defeated ? Math.max(0, amount - healthBeforeHit) : 0,
    };
  }

  getHealthRatio(): number {
    return Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
  }

  getDisplayName(): string {
    return this.definition.displayNameKey
      ? t(this.definition.displayNameKey)
      : this.definition.displayName;
  }

  getBossBarColor(isPhaseTwo = false): number {
    if (isPhaseTwo) {
      return this.definition.bossPhaseTwoBarColor ?? this.definition.bossBarColor ?? 0xd84f66;
    }

    return this.definition.bossBarColor ?? 0xd84f66;
  }

  getPhaseTwoMessageKey(): string {
    return this.definition.phaseTwoMessageKey ?? 'messages.bossPhaseTwo';
  }

  canDealContactDamage(time: number): boolean {
    if (time < this.nextContactAt) {
      return false;
    }

    this.nextContactAt = time + COMBAT_TUNING.enemyContactCooldownMs;
    return true;
  }

  stopForAiDelay(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    body?.stop();
  }

  protected setPersistentTint(tint: number): void {
    this.persistentTint = tint;
    this.setTint(tint);
  }

  // protected: 사수처럼 발사 예고에 임시 tint를 쓰는 하위 클래스가 예고를 끝낼 때
  // clearTint 대신 이것을 불러야, 챔피언 금색 같은 지속 tint가 지워지지 않는다.
  protected restorePersistentTint(): void {
    if (this.persistentTint === undefined) {
      this.clearTint();
      return;
    }

    this.setTint(this.persistentTint);
  }

  protected moveToward(x: number, y: number, speed: number): void {
    const direction = normalizeVector(x - this.x, y - this.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(direction.x * speed, direction.y * speed);
    this.constrainToRoom();
  }

  protected fireAtPlayer(
    player: Player,
    enemyBullets: Phaser.Physics.Arcade.Group,
    speed: number,
    damage: number,
  ): void {
    const direction = normalizeVector(player.x - this.x, player.y - this.y);

    this.fireBullet(
      this.x + direction.x * (this.effectiveBodyRadius + 4),
      this.y + direction.y * (this.effectiveBodyRadius + 4),
      direction,
      enemyBullets,
      speed,
      damage,
    );
  }

  protected fireBullet(
    x: number,
    y: number,
    direction: { x: number; y: number },
    enemyBullets: Phaser.Physics.Arcade.Group,
    speed: number,
    damage: number,
  ): void {
    Bullet.spawn(this.scene, enemyBullets, {
      x,
      y,
      direction,
      owner: 'enemy',
      speed,
      damage,
      lifeMs: COMBAT_TUNING.enemyBulletLifeMs,
    });
  }

  protected constrainToRoom(): void {
    const margin = this.effectiveBodyRadius + 2;
    this.x = Phaser.Math.Clamp(this.x, ROOM_RECT.left + margin, ROOM_RECT.right - margin);
    this.y = Phaser.Math.Clamp(this.y, ROOM_RECT.top + margin, ROOM_RECT.bottom - margin);
  }
}
