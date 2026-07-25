import Phaser from 'phaser';
import { DEPTH, ROOM_RECT, WORM_KING_TUNING } from '../../config/gameConfig';
import type { EnemyId } from '../../data/enemies';
import type { Player } from '../Player';
import { normalizeVector } from '../../utils/math';
import {
  clampResurfacePoint,
  isBurrowInvulnerable,
  type WormKingState,
} from '../../systems/WormKingRules';
import { BaseEnemy } from './BaseEnemy';

// 2스테이지 II층 보스 "늙은 지렁이 왕".
// 패턴: (1) 꿈틀 돌진 (2) 땅굴 잠수 → 재등장 충격 링 (3) 새끼 지렁이 소환.
// 체력 절반에서 "허물 벗기"로 새끼를 한꺼번에 뿜고 이후 더 빨라지는 2페이즈에 들어간다.
// 소환은 이 클래스가 직접 적을 만들지 않고 'boss-summon' 이벤트를 쏘면
// RoomController가 방 안 적 수 제한을 적용해 생성한다(분열 처리와 같은 방식).
// 장면에 의존하지 않는 판정 규칙(잠수 무적·재등장 좌표)은 WormKingRules로 분리했다.

export class WormKingBoss extends BaseEnemy {
  private attackState: WormKingState = 'idle';
  private stateEndsAt = 0;
  private recoveryUntil = 0;
  private nextChargeAt = 0;
  private nextBurrowAt = 0;
  private nextSummonAt = 0;
  private initializedSchedule = false;
  private isPhaseTwo = false;
  private chargeDirection = { x: 0, y: 0 };
  private readonly emergeTarget = { x: 0, y: 0 };
  private telegraph?: Phaser.GameObjects.Graphics;
  private cleanedUp = false;

  override takeDamage(amount: number, sourceX: number, sourceY: number): boolean {
    // 잠수 중에는 몸통 물리 바디가 꺼져 있어 탄에는 안 맞지만, 폭탄은 위치로
    // 판정하므로 여기서 한 번 더 막는다. 그렇지 않으면 잠수 중 피격으로 페이즈가
    // 바뀌어 보이지 않는 채 갇힐 수 있다.
    if (this.isBurrowed()) {
      return false;
    }

    const defeated = super.takeDamage(amount, sourceX, sourceY);

    if (!defeated) {
      this.tryEnterPhaseTwo(this.scene.time.now);
    }

    return defeated;
  }

  private isBurrowed(): boolean {
    return isBurrowInvulnerable(this.attackState);
  }

  updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!this.active || !body || this.cleanedUp) {
      return;
    }

    if (!this.initializedSchedule) {
      this.initializedSchedule = true;
      this.nextChargeAt = time + 1400;
      this.nextBurrowAt = time + 2600;
      this.nextSummonAt = time + 3600;
    }

    switch (this.attackState) {
      case 'phaseTransition':
        body.stop();
        if (time >= this.stateEndsAt) {
          this.endPhaseTransition(time);
        }
        return;

      case 'chargeWindup':
        body.stop();
        this.updateTelegraphFlash(time);
        if (time >= this.stateEndsAt) {
          this.beginCharge(time);
        }
        return;

      case 'charging':
        body.setVelocity(
          this.chargeDirection.x * WORM_KING_TUNING.chargeSpeed,
          this.chargeDirection.y * WORM_KING_TUNING.chargeSpeed,
        );
        this.constrainToRoom();
        if (time >= this.stateEndsAt) {
          this.endCharge(time);
        }
        return;

      case 'burrowHidden':
        // 잠수 중에는 몸통(물리 바디)이 꺼져 있어 공격을 받지 않는다.
        if (time >= this.stateEndsAt) {
          this.beginBurrowTelegraph(time, player);
        }
        return;

      case 'burrowTelegraph':
        this.updateTelegraphFlash(time);
        if (time >= this.stateEndsAt) {
          this.emergeFromBurrow(time, enemyBullets);
        }
        return;

      case 'idle':
      default:
        this.updateMovement(player);
        if (time < this.recoveryUntil) {
          return;
        }
        this.maybeStartAction(time, player);
        return;
    }
  }

  override getDisplayName(): string {
    const displayName = super.getDisplayName();
    return this.isPhaseTwo ? `${displayName} II` : displayName;
  }

  isInPhaseTwo(): boolean {
    return this.isPhaseTwo;
  }

  override destroy(fromScene?: boolean): void {
    if (!this.cleanedUp) {
      this.cleanedUp = true;
      this.clearTelegraph();
    }

    super.destroy(fromScene);
  }

  private updateMovement(player: Player): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const toPlayer = normalizeVector(player.x - this.x, player.y - this.y);
    const speed = this.definition.speed * (this.isPhaseTwo ? 1.18 : 1);
    const sign = distance < WORM_KING_TUNING.preferredMinDistance ? -1 : 1;

    body.setVelocity(toPlayer.x * speed * sign, toPlayer.y * speed * sign);
    this.constrainToRoom();
  }

  private maybeStartAction(time: number, player: Player): void {
    if (time >= this.nextBurrowAt) {
      this.startBurrow(time);
    } else if (time >= this.nextChargeAt) {
      this.startChargeWindup(time, player);
    } else if (time >= this.nextSummonAt) {
      this.summonBroodlings(time);
    }
  }

  private startChargeWindup(time: number, player: Player): void {
    this.attackState = 'chargeWindup';
    this.stateEndsAt = time + WORM_KING_TUNING.chargeWindupMs;
    this.chargeDirection = normalizeVector(player.x - this.x, player.y - this.y);
    this.nextChargeAt = time + this.chargeCooldown();
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.drawChargeTelegraph(this.chargeDirection);
  }

  private beginCharge(time: number): void {
    this.clearTelegraph();
    this.attackState = 'charging';
    this.stateEndsAt = time + WORM_KING_TUNING.chargeDurationMs;
  }

  private endCharge(time: number): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.attackState = 'idle';
    this.recoveryUntil = time + WORM_KING_TUNING.actionRecoveryMs;
  }

  private startBurrow(time: number): void {
    this.clearTelegraph();
    this.attackState = 'burrowHidden';
    this.stateEndsAt = time + WORM_KING_TUNING.burrowHiddenMs;
    this.nextBurrowAt = time + this.burrowCooldown();
    (this.body as Phaser.Physics.Arcade.Body).stop();
    // active는 유지(=updateAI 계속 실행), 몸통과 표시만 끈다 → 잠수 중 무적.
    this.disableBody(false, true);
  }

  private beginBurrowTelegraph(time: number, player: Player): void {
    const point = clampResurfacePoint(player.x, player.y, ROOM_RECT, this.effectiveBodyRadius + 2);
    this.emergeTarget.x = point.x;
    this.emergeTarget.y = point.y;
    this.attackState = 'burrowTelegraph';
    this.stateEndsAt = time + WORM_KING_TUNING.burrowTelegraphMs;
    this.drawBurrowTelegraph(this.emergeTarget);
  }

  private emergeFromBurrow(time: number, enemyBullets: Phaser.Physics.Arcade.Group): void {
    this.clearTelegraph();
    // 몸통을 착지 지점으로 되살리고 다시 켠다(위치·속도 초기화 포함).
    this.enableBody(true, this.emergeTarget.x, this.emergeTarget.y, true, true);
    this.fireResurfaceRing(enemyBullets);
    this.attackState = 'idle';
    this.recoveryUntil = time + WORM_KING_TUNING.actionRecoveryMs;
  }

  private fireResurfaceRing(enemyBullets: Phaser.Physics.Arcade.Group): void {
    const count = WORM_KING_TUNING.resurfaceRingCount;
    const offset = this.effectiveBodyRadius + 4;
    const damage = this.definition.bulletDamage ?? WORM_KING_TUNING.bulletDamage;

    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      this.fireBullet(
        this.x + direction.x * offset,
        this.y + direction.y * offset,
        direction,
        enemyBullets,
        WORM_KING_TUNING.resurfaceRingSpeed,
        damage,
      );
    }
  }

  private summonBroodlings(time: number): void {
    this.emit('boss-summon', {
      childId: WORM_KING_TUNING.summonChildId as EnemyId,
      count: WORM_KING_TUNING.summonCount,
      maxAlive: WORM_KING_TUNING.maxSummonedAlive,
    });
    this.nextSummonAt = time + this.summonCooldown();
    this.recoveryUntil = time + WORM_KING_TUNING.actionRecoveryMs;
  }

  private tryEnterPhaseTwo(time: number): void {
    if (
      this.isPhaseTwo ||
      !this.active ||
      !this.body ||
      this.getHealthRatio() > WORM_KING_TUNING.phaseTwoThreshold
    ) {
      return;
    }

    this.isPhaseTwo = true;
    this.attackState = 'phaseTransition';
    this.stateEndsAt = time + WORM_KING_TUNING.phaseTwoTransitionLockMs;
    this.clearTelegraph();
    this.setPersistentTint(WORM_KING_TUNING.phaseTwoTint);
    (this.body as Phaser.Physics.Arcade.Body).stop();
    // 허물 벗기: 새끼를 한꺼번에 뿜는다(방 안 적 수 제한은 RoomController가 적용).
    this.emit('boss-summon', {
      childId: WORM_KING_TUNING.summonChildId as EnemyId,
      count: WORM_KING_TUNING.phaseTwoShedCount,
      maxAlive: WORM_KING_TUNING.maxSummonedAlive,
    });
    this.emit('boss-phase-two', this);
  }

  private endPhaseTransition(time: number): void {
    this.attackState = 'idle';
    this.recoveryUntil = time + WORM_KING_TUNING.actionRecoveryMs;
    this.nextChargeAt = time + 500;
    this.nextBurrowAt = time + 1400;
    this.nextSummonAt = time + 2600;
  }

  private chargeCooldown(): number {
    return this.isPhaseTwo
      ? WORM_KING_TUNING.phaseTwoChargeCooldownMs
      : WORM_KING_TUNING.chargeCooldownMs;
  }

  private burrowCooldown(): number {
    return this.isPhaseTwo
      ? WORM_KING_TUNING.phaseTwoBurrowCooldownMs
      : WORM_KING_TUNING.burrowCooldownMs;
  }

  private summonCooldown(): number {
    return this.isPhaseTwo
      ? WORM_KING_TUNING.phaseTwoSummonCooldownMs
      : WORM_KING_TUNING.summonCooldownMs;
  }

  private drawChargeTelegraph(direction: { x: number; y: number }): void {
    const graphics = this.createTelegraph();
    graphics.lineStyle(5, 0xbf7a3c, 0.24);
    graphics.lineBetween(this.x, this.y, this.x + direction.x * 128, this.y + direction.y * 128);
    graphics.lineStyle(3, 0xe4a35a, 0.82);
    graphics.lineBetween(this.x, this.y, this.x + direction.x * 128, this.y + direction.y * 128);
  }

  private drawBurrowTelegraph(target: { x: number; y: number }): void {
    const graphics = this.createTelegraph();
    const radius = this.effectiveBodyRadius + 8;
    graphics.fillStyle(0x9ce86a, 0.14);
    graphics.fillCircle(target.x, target.y, radius);
    graphics.lineStyle(3, 0x9ce86a, 0.78);
    graphics.strokeCircle(target.x, target.y, radius);
  }

  private updateTelegraphFlash(time: number): void {
    if (!this.telegraph) {
      return;
    }

    const remaining = Math.max(0, this.stateEndsAt - time);
    const flashing = Math.floor(remaining / 100) % 2 === 0;
    this.telegraph.setAlpha(flashing ? 1 : 0.5);
  }

  private createTelegraph(): Phaser.GameObjects.Graphics {
    this.clearTelegraph();
    this.telegraph = this.scene.add.graphics().setDepth(DEPTH.effect - 1);
    return this.telegraph;
  }

  private clearTelegraph(): void {
    this.telegraph?.destroy();
    this.telegraph = undefined;
  }
}
