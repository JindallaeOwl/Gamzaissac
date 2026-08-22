import Phaser from 'phaser';
import { AnimationKeys, TextureKeys } from '../config/assets';
import {
  BEAM_TUNING,
  COMBAT_TUNING,
  DEPTH,
  FEEDBACK_TUNING,
  PLAYER_BASE_ATTACK_PROFILE,
  type PlayerAttackProfile,
  type PlayerStats,
} from '../config/gameConfig';
import { Bullet } from './Bullet';
import { getSeedDisplayScale } from '../systems/ItemFeedbackRules';
import { getWaveSign } from '../systems/SeedWaveRules';
import { clamp, normalizeVector } from '../utils/math';
import { resolvePlayerFacing, type PlayerFacing } from '../utils/playerFacing';
import { createSpreadDirections, type AttackDirection } from '../utils/attackDirections';
import {
  getEffectiveBeamChargeMs,
  getEffectiveDamage,
  getEffectiveFireRate,
  getEffectiveProjectileSpeed,
} from '../systems/PlayerStatSystem';
import { movementAxes, selectFireDirection, type PlayerControls } from '../systems/InputRules';
import { clampToRoomBounds } from '../systems/RoomBoundary';
import type { Direction } from '../utils/directions';

// 입력 스냅샷 타입은 InputRules로 옮겼다. 기존 import 경로를 깨지 않도록 재수출한다.
export type { PlayerControls };

export interface BeamFiredEvent {
  directions: AttackDirection[];
}

type PlayerAnimationState = 'idle' | 'walk' | 'hurt' | 'death';

const PLAYER_ANIMATIONS: Record<
  PlayerAnimationState,
  Record<PlayerFacing, (typeof AnimationKeys)[keyof typeof AnimationKeys]>
> = {
  idle: {
    down: AnimationKeys.playerIdleDown,
    up: AnimationKeys.playerIdleUp,
    side: AnimationKeys.playerIdleSide,
  },
  walk: {
    down: AnimationKeys.playerWalkDown,
    up: AnimationKeys.playerWalkUp,
    side: AnimationKeys.playerWalkSide,
  },
  hurt: {
    down: AnimationKeys.playerHurtDown,
    up: AnimationKeys.playerHurtUp,
    side: AnimationKeys.playerHurtSide,
  },
  death: {
    down: AnimationKeys.playerDeathDown,
    up: AnimationKeys.playerDeathUp,
    side: AnimationKeys.playerDeathSide,
  },
};

const PLAYER_SHADOW_DEATH_ANIMATIONS: Record<
  PlayerFacing,
  (typeof AnimationKeys)[keyof typeof AnimationKeys]
> = {
  down: AnimationKeys.playerShadowDeathDown,
  up: AnimationKeys.playerShadowDeathUp,
  side: AnimationKeys.playerShadowDeathSide,
};

const EXTERNAL_PLAYER_SCALE = 2;

// 점사(burstCount > 1)에서 연속 발사 사이 간격의 상한. 리듬의 "따다닥" 밀도를
// 정하며, 연사가 아주 빨라 기본 발사 간격이 이보다 짧아지면 그쪽을 따른다 —
// 점사가 고연사 빌드를 오히려 늦추지 않기 위해서다.
const BURST_SHOT_INTERVAL_MS = 85;

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: PlayerStats;
  hasChargeBeam = false;
  private attackProfile: PlayerAttackProfile;
  private readonly usesExternalAssets: boolean;
  private readonly shadow: Phaser.GameObjects.Sprite;
  private readonly extraEyes: Phaser.GameObjects.Image;
  private readonly toothpick: Phaser.GameObjects.Image;

  private nextShotAt = 0;
  private burstShotsRemaining = 0;
  private nextBurstShotAt = 0;
  private invulnerableUntil = 0;
  private beamCooldownUntil = 0;
  private beamChargeStartedAt: number | null = null;
  private beamChargeDirection: { x: number; y: number } | null = null;
  private nextBeamChargePulseAt = 0;
  private hurtAnimationUntil = 0;
  private facing: PlayerFacing = 'down';
  private dead = false;
  private godMode = false;
  private openPassages: readonly Direction[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stats: PlayerStats,
    attackProfile: PlayerAttackProfile = PLAYER_BASE_ATTACK_PROFILE,
  ) {
    super(
      scene,
      x,
      y,
      scene.textures.exists(TextureKeys.playerYellowIdle)
        ? TextureKeys.playerYellowIdle
        : TextureKeys.playerIdle,
    );
    this.stats = stats;
    this.attackProfile = { ...attackProfile };
    this.usesExternalAssets = scene.textures.exists(TextureKeys.playerYellowIdle);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.actor).setScale(this.usesExternalAssets ? EXTERNAL_PLAYER_SCALE : 0.6);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    if (this.usesExternalAssets) {
      // The 2x visual scale makes the character readable while this smaller
      // source-pixel body keeps the gameplay collision radius unchanged.
      body.setCircle(4, 12, 17);
    } else {
      body.setCircle(10);
    }
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(220, 220);

    this.shadow = scene.add
      .sprite(x, y, TextureKeys.playerYellowShadow)
      .setScale(this.usesExternalAssets ? EXTERNAL_PLAYER_SCALE : 1)
      .setDepth(DEPTH.actor - 1)
      .setVisible(this.usesExternalAssets);

    const cosmeticScale = this.usesExternalAssets ? 0.5 : 0.6;

    this.extraEyes = scene.add
      .image(x, y - (this.usesExternalAssets ? 8 : 7), TextureKeys.playerExtraEyes)
      .setScale(cosmeticScale)
      .setDepth(DEPTH.actor + 1);
    this.toothpick = scene.add
      .image(
        x + (this.usesExternalAssets ? 6 : 5),
        y - (this.usesExternalAssets ? 14 : 15),
        TextureKeys.playerToothpick,
      )
      .setScale(cosmeticScale)
      .setDepth(DEPTH.actor + 1);
    this.playDirectionalAnimation('idle');
    this.syncCosmetics();
  }

  setStats(stats: PlayerStats): void {
    this.stats = stats;
  }

  setAttackProfile(profile: PlayerAttackProfile): void {
    this.attackProfile = { ...profile };
    this.syncCosmetics();
  }

  setCombatVisible(visible: boolean): void {
    this.setVisible(visible);
    this.shadow.setVisible(visible && this.usesExternalAssets);
    this.syncCosmetics();
  }

  update(time: number, controls: PlayerControls, bulletGroup: Phaser.Physics.Arcade.Group): void {
    if (!this.active || this.dead) {
      return;
    }

    this.updateMovement(time, controls);
    this.updateAttack(time, controls, bulletGroup);
    this.constrainToRoom();
    this.syncCosmetics();
  }

  damage(amount: number, sourceX: number, sourceY: number): boolean {
    if (!this.active || !this.body || this.godMode) {
      return false;
    }

    const now = this.scene.time.now;

    if (now < this.invulnerableUntil) {
      return false;
    }

    this.invulnerableUntil = now + COMBAT_TUNING.playerIFrameMs;
    this.hurtAnimationUntil = now + 250;
    this.stats.health = clamp(this.stats.health - amount, 0, this.stats.maxHealth);

    const hitVector = normalizeVector(this.x - sourceX, this.y - sourceY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(
      hitVector.x * COMBAT_TUNING.playerKnockback,
      hitVector.y * COMBAT_TUNING.playerKnockback,
    );

    this.emit('health-changed', this.stats);
    this.playDirectionalAnimation('hurt');

    if (this.stats.health <= 0) {
      this.emit('player-died');
    }

    return true;
  }

  grantInvulnerability(durationMs: number): void {
    this.invulnerableUntil = Math.max(
      this.invulnerableUntil,
      this.scene.time.now + Math.max(0, durationMs),
    );
  }

  setGodMode(enabled: boolean): void {
    this.godMode = enabled;
  }

  private updateMovement(time: number, controls: PlayerControls): void {
    const { x: inputX, y: inputY } = movementAxes(controls);
    const direction = normalizeVector(inputX, inputY);
    const body = this.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(direction.x * this.stats.moveSpeed, direction.y * this.stats.moveSpeed);
    this.updateMovementVisual(time, inputX, inputY);
  }

  private updateMovementVisual(time: number, inputX: number, inputY: number): void {
    const moving = inputX !== 0 || inputY !== 0;
    const facingVisual = resolvePlayerFacing(inputX, inputY);
    this.facing = facingVisual.facing;
    this.setFlipX(facingVisual.flipX);

    if (this.usesExternalAssets) {
      if (time < this.hurtAnimationUntil) {
        this.playDirectionalAnimation('hurt');
      } else {
        this.playDirectionalAnimation(moving ? 'walk' : 'idle');
      }

      return;
    }

    if (moving) {
      this.play(AnimationKeys.playerWalk, true);
      return;
    }

    this.anims.stop();

    if (this.texture.key !== TextureKeys.playerIdle) {
      this.setTexture(TextureKeys.playerIdle);
    }
  }

  private updateAttack(
    time: number,
    controls: PlayerControls,
    bulletGroup: Phaser.Physics.Arcade.Group,
  ): void {
    if (this.hasChargeBeam) {
      // 빔 전환 시 점사 잔여분이 남아 있으면 비운다. 지금은 tryShoot만 읽어
      // 무해하지만, 남겨 두면 빔이 꺼지는 순간 잔여분이 한꺼번에 발사된다.
      this.burstShotsRemaining = 0;
      this.updateBeamCharge(time, controls);
      return;
    }

    this.tryShoot(time, controls, bulletGroup);
  }

  private tryShoot(
    time: number,
    controls: PlayerControls,
    bulletGroup: Phaser.Physics.Arcade.Group,
  ): void {
    // 같은 프레임의 점사 후속 발과 새 발사가 같은 입력 스냅샷을 읽게 한 번만 구한다.
    const direction = this.getFireDirection(controls);
    this.updatePendingBurst(time, direction, bulletGroup);

    if (!direction || time < this.nextShotAt || this.burstShotsRemaining > 0) {
      return;
    }

    const shotIntervalMs = 1000 / getEffectiveFireRate(this.stats);
    // 쿨다운은 점사 발수만큼 선불하지 않고 실제로 쏜 발마다 쌓는다(후속 발은
    // updatePendingBurst가 같은 방식으로 더한다). 풀 점사는 발수 × 간격이 되어
    // 평균 발사 수가 유지되고, 점사를 끊으면 쏜 만큼만 기다리므로 끊어 쏘는
    // 플레이가 손해 보지 않는다.
    this.nextShotAt = time + shotIntervalMs;
    this.fireSeedShot(direction, bulletGroup);

    if (this.attackProfile.burstCount > 1) {
      this.burstShotsRemaining = this.attackProfile.burstCount - 1;
      this.nextBurstShotAt = time + Math.min(BURST_SHOT_INTERVAL_MS, shotIntervalMs);
    }
  }

  // 진행 중인 점사의 후속 발. 발사 입력을 유지하는 동안만 이어진다 — 입력을
  // 놓으면 남은 점사가 취소되고, 쿨다운은 이미 쏜 발만큼만 쌓여 있어 손해가
  // 없다. 입력을 쥔 채 방을 옮기면 일반 연사와 똑같이 새 방에서 이어진다.
  private updatePendingBurst(
    time: number,
    direction: AttackDirection | null,
    bulletGroup: Phaser.Physics.Arcade.Group,
  ): void {
    if (this.burstShotsRemaining <= 0) {
      return;
    }

    if (!direction) {
      this.burstShotsRemaining = 0;
      return;
    }

    if (time < this.nextBurstShotAt) {
      return;
    }

    const shotIntervalMs = 1000 / getEffectiveFireRate(this.stats);
    this.burstShotsRemaining -= 1;
    // 쏜 발만큼 쿨다운을 쌓는다. max는 프레임 지연으로 time이 이미 nextShotAt을
    // 지난 경우에도 쌓인 빚이 사라지지 않게 한다.
    this.nextShotAt = Math.max(this.nextShotAt, time) + shotIntervalMs;
    this.nextBurstShotAt = time + Math.min(BURST_SHOT_INTERVAL_MS, shotIntervalMs);
    this.fireSeedShot(direction, bulletGroup);
  }

  // 한 번의 발사: 앞 부채꼴 + (있다면) 뒷씨앗 + 발사 이벤트(총구 연출·효과음).
  // 점사의 후속 발도 이것을 거쳐 첫 발과 같은 피드백을 낸다.
  private fireSeedShot(direction: AttackDirection, bulletGroup: Phaser.Physics.Arcade.Group): void {
    const seedCount = this.attackProfile.seedCount;
    this.spawnSeedFan(direction, seedCount, bulletGroup, 0);

    // 뒷발사: 앞 부채꼴 전체가 정반대 방향으로도 복사된다 — 앞이 4갈래면 뒤도
    // 4갈래(플레이 피드백으로 확정한 거울 규칙). 물결 위상은 앞 부채꼴에서 이어
    // 세어 앞뒤 씨앗이 같은 박자로 흔들리지 않게 한다.
    if (this.attackProfile.rearFire) {
      this.spawnSeedFan({ x: -direction.x, y: -direction.y }, seedCount, bulletGroup, seedCount);
    }

    const muzzleX = this.x + direction.x * 12;
    const muzzleY = this.y + direction.y * 12;
    this.emit('player-shot', { x: muzzleX, y: muzzleY, direction });
  }

  /**
   * 씨앗 부채꼴 발사의 몸통. 부채꼴 계산과 수치 계산(실효 스탯·표시 배율·판정
   * 배율)이 한 곳에 있어, 앞으로 다른 발사 경로가 생겨도 이것을 부르면 일반
   * 사격과 같은 씨앗이 나간다.
   */
  private spawnSeedFan(
    direction: AttackDirection,
    seedCount: number,
    bulletGroup: Phaser.Physics.Arcade.Group,
    waveIndexOffset: number,
  ): void {
    const seedDirections = createSpreadDirections(
      direction,
      seedCount,
      this.attackProfile.spreadStepDegrees,
    );
    const projectileSpeed = getEffectiveProjectileSpeed(this.stats);
    const damage = getEffectiveDamage(this.stats);
    // 공격력이 오르면 씨앗이 "보기에만" 커진다. 판정은 아이템이 명시한
    // seedScale(scale)만 따르므로, 순수 공격력 아이템이 히트박스를 몰래 키우는
    // 숨은 밸런스 변경이 생기지 않는다. 방향 수와 무관하게 발사당 한 번 계산한다.
    const seedDisplayScale = getSeedDisplayScale(this.attackProfile.seedScale, damage);
    const seedTint = this.attackProfile.forceRedSeeds ? 0xff4d4d : undefined;
    const centerIndex = (seedDirections.length - 1) / 2;

    seedDirections.forEach((seedDirection, index) => {
      const lateralOffset = (index - centerIndex) * 2;
      const seedX = this.x + seedDirection.x * 12 - direction.y * lateralOffset;
      const seedY = this.y + seedDirection.y * 12 + direction.x * lateralOffset;

      Bullet.spawn(this.scene, bulletGroup, {
        x: seedX,
        y: seedY,
        direction: seedDirection,
        owner: 'player',
        speed: projectileSpeed,
        damage,
        lifeMs: (this.stats.range / projectileSpeed) * 1000,
        overflowPenetration: this.attackProfile.overflowPenetration,
        scale: this.attackProfile.seedScale,
        displayScale: seedDisplayScale,
        tint: seedTint,
        waveDegrees: this.attackProfile.waveDegrees,
        // 이웃 씨앗과 위상을 엇갈리게 해 부채꼴이 한 덩어리로 흔들리지 않게 한다.
        waveSign: getWaveSign(index + waveIndexOffset),
      });
    });
  }

  private updateBeamCharge(time: number, controls: PlayerControls): void {
    const direction = this.getFireDirection(controls);

    if (direction) {
      if (this.beamChargeStartedAt === null) {
        this.beamChargeStartedAt = time;
        this.beamChargeDirection = direction;
        this.nextBeamChargePulseAt = 0;
        this.emit('beam-charge-started');
      } else {
        this.beamChargeDirection = direction;
      }

      const requiredChargeMs = getEffectiveBeamChargeMs(
        this.stats,
        this.attackProfile.beamChargeMsMultiplier,
      );
      const chargeProgress = Math.min(1, (time - this.beamChargeStartedAt) / requiredChargeMs);
      this.setTint(chargeProgress >= 1 ? 0xff7af2 : 0x8beeff);

      if (time >= this.nextBeamChargePulseAt) {
        this.nextBeamChargePulseAt = time + FEEDBACK_TUNING.effects.beamChargePulseMs;
        this.emit('beam-charge-pulse', { ready: chargeProgress >= 1 });
      }

      return;
    }

    if (this.beamChargeStartedAt === null || !this.beamChargeDirection) {
      this.clearTint();
      return;
    }

    const chargeMs = time - this.beamChargeStartedAt;
    const canFire =
      chargeMs >= getEffectiveBeamChargeMs(this.stats, this.attackProfile.beamChargeMsMultiplier) &&
      time >= this.beamCooldownUntil;

    if (canFire) {
      this.beamCooldownUntil = time + BEAM_TUNING.cooldownMs;
      const event: BeamFiredEvent = {
        directions: createSpreadDirections(
          this.beamChargeDirection,
          this.attackProfile.seedCount,
          this.attackProfile.spreadStepDegrees,
        ),
      };
      this.emit('beam-fired', event);
    }

    this.beamChargeStartedAt = null;
    this.beamChargeDirection = null;
    this.clearTint();
  }

  private getFireDirection(controls: PlayerControls): AttackDirection | null {
    // 우선순위(위→아래→왼쪽→오른쪽) 규칙은 InputRules에 있고 단위 테스트로 고정된다.
    return selectFireDirection(controls);
  }

  setOpenPassages(directions: readonly Direction[]): void {
    this.openPassages = directions;
  }

  private constrainToRoom(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!body) {
      return;
    }

    // 외형 중심이 아닌 물리 몸 중심을 기준으로 경계를 잡아 상·하·좌·우 문간의
    // 통과 폭이 똑같게 유지된다.
    const offsetX = body.center.x - this.x;
    const offsetY = body.center.y - this.y;
    const bounded = clampToRoomBounds(
      { x: this.x + offsetX, y: this.y + offsetY },
      this.openPassages,
    );
    this.x = bounded.x - offsetX;
    this.y = bounded.y - offsetY;
  }

  private syncCosmetics(): void {
    const visible = this.visible && this.active;
    const eyeYOffset = this.usesExternalAssets ? 8 : 7;
    const toothpickOffsetX = this.usesExternalAssets ? 6 : 5;
    const toothpickOffsetY = this.usesExternalAssets ? 14 : 15;
    this.shadow
      .setPosition(this.x, this.y)
      .setFlipX(this.flipX)
      .setAlpha(this.alpha)
      .setVisible(visible && this.usesExternalAssets);
    this.extraEyes
      .setPosition(this.x, this.y - eyeYOffset)
      .setFlipX(this.flipX)
      .setAlpha(this.alpha)
      .setVisible(!this.dead && visible && this.attackProfile.extraForeheadEyeCount > 0);
    this.toothpick
      .setPosition(
        this.x + (this.flipX ? -toothpickOffsetX : toothpickOffsetX),
        this.y - toothpickOffsetY,
      )
      .setFlipX(this.flipX)
      .setAlpha(this.alpha)
      .setVisible(!this.dead && visible && this.attackProfile.hasToothpickCosmetic);
  }

  private playDirectionalAnimation(state: PlayerAnimationState): void {
    if (!this.usesExternalAssets) {
      return;
    }

    const animationKey = PLAYER_ANIMATIONS[state][this.facing];

    if (this.scene.anims.exists(animationKey)) {
      this.play(animationKey, true);
    }
  }

  playDeathAnimation(): void {
    this.dead = true;
    this.scene.tweens.killTweensOf(this);
    this.setAlpha(1);
    this.playDirectionalAnimation('death');

    if (this.usesExternalAssets) {
      const shadowAnimationKey = PLAYER_SHADOW_DEATH_ANIMATIONS[this.facing];

      if (this.scene.anims.exists(shadowAnimationKey)) {
        this.shadow.play(shadowAnimationKey, true);
      }
    }

    this.extraEyes.setVisible(false);
    this.toothpick.setVisible(false);
  }

  override destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    this.extraEyes.destroy();
    this.toothpick.destroy();
    super.destroy(fromScene);
  }

  playHitFeedback(): void {
    if (!this.active) {
      return;
    }

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0.36,
      duration: 70,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.alpha = 1;
      },
    });
  }
}
