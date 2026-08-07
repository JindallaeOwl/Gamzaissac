import Phaser from 'phaser';
import { AnimationKeys } from '../../config/assets';
import { DEPTH, ROOM_RECT, WORM_KING_TUNING } from '../../config/gameConfig';
import type { EnemyDefinition, EnemyId } from '../../data/enemies';
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
// 소환은 이 클래스가 직접 적을 만들지 않고 'summon-request' 이벤트를 쏘면
// RoomController가 방 안 적 수 제한을 적용해 생성한다(분열 처리와 같은 방식).
// 장면에 의존하지 않는 판정 규칙(잠수 무적·재등장 좌표)은 WormKingRules로 분리했다.

// rise 애니메이션 길이(5프레임×10fps=약 500ms)보다 넉넉히 잡은 안전 상한.
// 완료 이벤트를 놓치더라도 이 시간이 지나면 finishEmerge를 강제해 보스가
// 땅속(무적·무접촉)에 영원히 갇히는 것을 막는다.
const EMERGE_FALLBACK_MS = 900;

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

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    definition: EnemyDefinition,
    floor: number,
  ) {
    super(scene, x, y, definition, floor);

    // 몸통이 꿈틀거리는 idle 애니메이션. 프레임 텍스처 크기는 모두 같아
    // 히트박스·기본 배율에는 영향을 주지 않는다.
    if (scene.anims.exists(AnimationKeys.enemyWormKingIdle)) {
      this.play(AnimationKeys.enemyWormKingIdle);
    }
  }

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
          this.emergeFromBurrow(enemyBullets);
        }
        return;

      case 'emerging':
        // rise 애니메이션이 끝날 때(finishEmerge)까지 이동·다음 행동을 하지 않는다.
        // 이 동안 바디는 꺼져 있어 무적·무접촉이며, 완전히 솟은 뒤에야 판정이 켜진다.
        // 완료 이벤트를 놓친 경우의 안전 상한(finishEmerge는 중복 호출에 안전).
        if (time >= this.stateEndsAt) {
          this.finishEmerge();
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
    // 텔레그래프 그래픽만 수동 정리하면 된다. 잠수/재등장은 트윈이 아니라 프레임
    // 애니메이션이라 보스를 대상으로 한 트윈은 없고, 애니메이션 완료 리스너는
    // GameObject.destroy가 알아서 제거한다. (흙먼지 트윈은 별도 그래픽이 대상이라
    // 스스로 사라진다.)
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

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    // 몸통(물리 바디)을 즉시 꺼 잠수 중 무적으로 만든다. active는 유지되어
    // updateAI가 계속 돌고, 표시는 파고드는 애니메이션이 끝날 때 감춘다.
    body.enable = false;

    // 몸을 세웠다가("웅") 흙먼지와 함께 땅으로 파고드는 전용 프레임 시퀀스.
    // 마지막(흙두둑) 프레임까지 재생되면 표시를 끈다.
    this.spawnDirtBurst(this.x, this.y);
    this.once(`animationcomplete-${AnimationKeys.enemyWormKingDig}`, () => {
      if (this.active) {
        this.setVisible(false);
      }
    });
    this.play(AnimationKeys.enemyWormKingDig);
  }

  private beginBurrowTelegraph(time: number, player: Player): void {
    const point = clampResurfacePoint(player.x, player.y, ROOM_RECT, this.effectiveBodyRadius + 2);
    this.emergeTarget.x = point.x;
    this.emergeTarget.y = point.y;
    this.attackState = 'burrowTelegraph';
    this.stateEndsAt = time + WORM_KING_TUNING.burrowTelegraphMs;
    this.drawBurrowTelegraph(this.emergeTarget);
  }

  private emergeFromBurrow(enemyBullets: Phaser.Physics.Arcade.Group): void {
    this.clearTelegraph();

    // 착지 지점으로 옮기되 몸통(물리 바디)은 아직 꺼둔 채로 둔다. 솟는 동안
    // (emerging)에는 무적·무접촉·정지 상태를 유지하고, 전체 히트박스·이동·다음
    // 행동은 rise가 끝나는 finishEmerge에서 한꺼번에 켠다 → 보이는 프레임과 판정 일치.
    this.setPosition(this.emergeTarget.x, this.emergeTarget.y);
    this.setVisible(true);
    this.attackState = 'emerging';

    // 완료 이벤트를 놓치더라도 땅속에 영원히 갇히지 않도록 안전 상한을 둔다.
    this.stateEndsAt = this.scene.time.now + EMERGE_FALLBACK_MS;

    // 흙을 뚫고 솟아오르는 전용 프레임 시퀀스. 완료 이벤트에서 finishEmerge로 마무리.
    this.spawnDirtBurst(this.emergeTarget.x, this.emergeTarget.y);
    this.once(`animationcomplete-${AnimationKeys.enemyWormKingRise}`, () => this.finishEmerge());
    this.play(AnimationKeys.enemyWormKingRise);

    // 충격 링은 기존과 같이 솟아오르는 순간 발사한다(타이밍·피해 불변).
    this.fireResurfaceRing(enemyBullets);
  }

  // rise 애니메이션이 끝난 뒤에야 전체 히트박스를 켜고 정상 행동을 재개한다.
  // 완료 이벤트에서만 호출되며, 그 사이 파괴되었거나 다른 상태로 넘어갔다면 무시한다.
  private finishEmerge(): void {
    if (!this.active || this.attackState !== 'emerging') {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.reset(this.x, this.y);
    body.enable = true;

    this.attackState = 'idle';
    this.recoveryUntil = this.scene.time.now + WORM_KING_TUNING.actionRecoveryMs;
    this.play(AnimationKeys.enemyWormKingIdle);
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

  // 잠수·재등장 지점에 흙덩이가 확 퍼지는 연출. 보스와 독립된 그래픽이라
  // 스스로 사라지며(트윈 완료 시 destroy) 보스가 죽어도 남지 않는다.
  private spawnDirtBurst(x: number, y: number): void {
    const dirt = this.scene.add.graphics().setDepth(this.depth - 1);
    dirt.setPosition(x, y);

    const clumps = 7;
    dirt.fillStyle(0x6b4a2f, 1);
    for (let i = 0; i < clumps; i += 1) {
      const angle = (Math.PI * 2 * i) / clumps;
      dirt.fillCircle(Math.cos(angle) * 12, Math.sin(angle) * 12, 3);
    }
    dirt.fillStyle(0x8a5a38, 1);
    for (let i = 0; i < clumps; i += 1) {
      const angle = (Math.PI * 2 * i) / clumps + 0.45;
      dirt.fillCircle(Math.cos(angle) * 6, Math.sin(angle) * 6, 2);
    }

    this.scene.tweens.add({
      targets: dirt,
      scale: 1.7,
      alpha: 0,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => dirt.destroy(),
    });
  }

  private summonBroodlings(time: number): void {
    this.emit('summon-request', {
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
    this.emit('summon-request', {
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
