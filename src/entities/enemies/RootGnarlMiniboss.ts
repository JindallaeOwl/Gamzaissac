import Phaser from 'phaser';
import { MINIBOSS_TUNING, ROOM_RECT } from '../../config/gameConfig';
import { getNextTelegraphAt } from '../../systems/SummonerRules';
import { createRadialDirections } from '../../utils/attackDirections';
import { clampPointInsideBounds, normalizeVector } from '../../utils/math';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

/**
 * 1스테이지 I층 중간보스 "뿌리 옹이".
 *
 * 거리에 따라 두 패턴을 골라 쓴다:
 * - 가까이 붙어 있으면 → 웅크림 예고 후 **방사형 뿌리탄** (붙어 있는 것을 벌한다)
 * - 멀리 떨어져 있으면 → 착지점 예고 후 **도약 내리찍기 + 착지 충격탄**
 *   (거리를 두는 것도 벌한다)
 *
 * 원래는 일반 추격자 AI라 15초 동안 뚜벅뚜벅 걸어오기만 했고, 방사탄만 붙였을
 * 때도 "멀리 있으면 안전"이라 여전히 쉬웠다. 두 패턴이 서로의 안전 지대를 지워
 * 매번 "지금은 어디로 움직여야 하나"를 묻게 하는 것이 목적이다.
 * 체력 절반에서 각성하면 탄이 늘고 주기가 짧아진다.
 */

// state는 Phaser GameObject.state와 충돌하므로 쓰지 않는다.
type RootGnarlState = 'chasing' | 'burstTelegraph' | 'leapTelegraph' | 'leaping' | 'recovering';

const TUNING = MINIBOSS_TUNING.rootGnarl;

// 방에 들어선 직후 곧바로 덮치지 않게 두는 첫 여유. 문에서 들어오는 순간
// 방사탄이나 도약을 맞으면 피할 자리가 없다.
const FIRST_ACTION_DELAY_MS = 1200;

export class RootGnarlMiniboss extends BaseEnemy {
  private attackState: RootGnarlState = 'chasing';
  private stateEndsAt = 0;
  private nextActionAt = 0;
  private leapTarget = { x: 0, y: 0 };

  updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    this.updatePhase();

    if (this.nextActionAt === 0) {
      this.nextActionAt = time + FIRST_ACTION_DELAY_MS;
    }

    switch (this.attackState) {
      case 'chasing':
        this.updateChasing(time, player);
        return;
      case 'burstTelegraph':
        this.updateBurstTelegraph(time, player, enemyBullets);
        return;
      case 'leapTelegraph':
        this.updateLeapTelegraph(time);
        return;
      case 'leaping':
        this.updateLeaping(time, enemyBullets);
        return;
      case 'recovering':
        this.updateRecovering(time);
    }
  }

  private updatePhase(): void {
    if (!this.tryLatchPhaseTwo(MINIBOSS_TUNING.phaseTwoThreshold)) {
      return;
    }

    this.setPersistentTint(TUNING.phaseTwoTint);
  }

  private updateChasing(time: number, player: Player): void {
    if (time >= this.nextActionAt) {
      // 거리로 패턴을 고른다. 붙어 있으면 방사탄, 멀면 도약 — 그래서 어느 쪽도
      // 안전한 자리가 아니다.
      const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

      if (distance >= TUNING.leapMinDistance) {
        this.beginLeapTelegraph(time, player);
      } else {
        this.beginBurstTelegraph(time);
      }

      return;
    }

    this.moveToward(player.x, player.y, this.definition.speed * this.floorScale);
  }

  /** 멈춰 서 있는 것이 핵심이다: 밀고 들어가 때릴 창이면서 동시에 경고다. */
  private beginBurstTelegraph(time: number): void {
    this.attackState = 'burstTelegraph';
    this.stateEndsAt = time + TUNING.telegraphMs;
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.showTelegraphRing(TUNING.telegraphColor);
  }

  private updateBurstTelegraph(
    time: number,
    player: Player,
    enemyBullets: Phaser.Physics.Arcade.Group,
  ): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();
    // 피격 넉백에 본체가 밀려도 링이 따라오게 한다.
    this.syncTelegraphRing();

    if (time < this.stateEndsAt) {
      return;
    }

    this.clearTelegraphRing();
    // 예고가 끝나는 순간에 쏜다 — 예고 중에 처치하면 발사 자체가 일어나지 않는다.
    const aimAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    this.fireRadialBurst(enemyBullets, this.bulletCount(), TUNING.bulletSpeed, {
      x: Math.cos(aimAngle),
      y: Math.sin(aimAngle),
    });
    this.finishAction(time, TUNING.telegraphMs);
  }

  /**
   * 도약 예고. 착지점은 예고를 시작한 순간의 플레이어 자리로 고정한다 —
   * 예고 중에 따라오면 피해도 맞으므로 예고가 거짓이 된다.
   *
   * 플레이어가 뛸 수 있는 거리보다 멀면 갈 수 있는 만큼만 목표로 삼는다. 닿지도
   * 못할 자리에 표식을 찍으면 예고가 거짓이 되기 때문이다 — 그때 도약의 성과는
   * 피해가 아니라 거리를 좁히는 것이고, 좁혀진 뒤에는 방사탄 사거리에 들어온다.
   */
  private beginLeapTelegraph(time: number, player: Player): void {
    const toPlayer = normalizeVector(player.x - this.x, player.y - this.y);
    const reach = Math.min(
      Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y),
      TUNING.leapMaxDistance,
    );

    this.leapTarget = clampPointInsideBounds(
      this.x + toPlayer.x * reach,
      this.y + toPlayer.y * reach,
      ROOM_RECT,
      this.effectiveBodyRadius + 2,
    );
    this.attackState = 'leapTelegraph';
    this.stateEndsAt = time + TUNING.leapTelegraphMs;
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.showGroundMarker(
      this.leapTarget.x,
      this.leapTarget.y,
      TUNING.landingMarkerColor,
      this.effectiveBodyRadius + 10,
    );
  }

  private updateLeapTelegraph(time: number): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();

    if (time < this.stateEndsAt) {
      return;
    }

    this.attackState = 'leaping';
    // 목표에 닿지 못해도(벽·장애물에 걸려도) 이 시간이 지나면 착지한다.
    this.stateEndsAt = time + TUNING.leapMaxDurationMs;
  }

  private updateLeaping(time: number, enemyBullets: Phaser.Physics.Arcade.Group): void {
    // 고정된 착지점을 향해 계속 조향한다. 넉백에 밀려도 목표를 잃지 않는다.
    this.moveToward(this.leapTarget.x, this.leapTarget.y, TUNING.leapSpeed);

    const reached =
      Phaser.Math.Distance.Between(this.x, this.y, this.leapTarget.x, this.leapTarget.y) <=
      TUNING.leapArrivalTolerance;

    if (!reached && time < this.stateEndsAt) {
      return;
    }

    this.land(time, enemyBullets);
  }

  /** 착지 충격: 자기 자리에서 사방으로 뿌리 가시가 퍼진다. */
  private land(time: number, enemyBullets: Phaser.Physics.Arcade.Group): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.clearGroundMarker();
    // 기준각을 두지 않아 착지 지점 기준의 고른 원이 된다 — 도약 방향과 무관하게
    // "이 자리에서 물러나라"는 한 가지 읽기만 남는다.
    this.fireRadialBurst(
      enemyBullets,
      this.landingShockBulletCount(),
      TUNING.landingShockBulletSpeed,
    );
    this.finishAction(time, TUNING.leapTelegraphMs);
  }

  /** 행동 하나가 끝났을 때의 공통 마무리 — 회복에 들어가고 다음 행동을 예약한다. */
  private finishAction(time: number, telegraphMs: number): void {
    // 예고 시간을 빼고 계산해 행동 사이 간격이 정확히 쿨다운이 되게 한다
    // (소환사와 같은 방식). 회복 시간은 쿨다운 안에 포함된다.
    this.nextActionAt = getNextTelegraphAt(time, this.actionCooldown(), telegraphMs);
    this.attackState = 'recovering';
    this.stateEndsAt = time + TUNING.recoveryMs;
  }

  private updateRecovering(time: number): void {
    // 뿌리를 다시 뽑는 시간. 이 틈이 반격 창이다.
    (this.body as Phaser.Physics.Arcade.Body).stop();

    if (time >= this.stateEndsAt) {
      this.attackState = 'chasing';
    }
  }

  private fireRadialBurst(
    enemyBullets: Phaser.Physics.Arcade.Group,
    count: number,
    speed: number,
    aim?: { x: number; y: number },
  ): void {
    const radius = this.effectiveBodyRadius + 4;

    for (const direction of createRadialDirections(count, aim)) {
      this.fireBullet(
        this.x + direction.x * radius,
        this.y + direction.y * radius,
        direction,
        enemyBullets,
        speed,
        this.definition.bulletDamage ?? 1,
      );
    }
  }

  private bulletCount(): number {
    return this.isInPhaseTwo() ? TUNING.phaseTwoBulletCount : TUNING.bulletCount;
  }

  private landingShockBulletCount(): number {
    return this.isInPhaseTwo()
      ? TUNING.phaseTwoLandingShockBulletCount
      : TUNING.landingShockBulletCount;
  }

  private actionCooldown(): number {
    return this.isInPhaseTwo() ? TUNING.phaseTwoActionCooldownMs : TUNING.actionCooldownMs;
  }
}
