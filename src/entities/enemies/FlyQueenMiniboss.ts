import Phaser from 'phaser';
import { MINIBOSS_TUNING } from '../../config/gameConfig';
import type { EnemyId } from '../../data/enemies';
import { getNextTelegraphAt } from '../../systems/SummonerRules';
import { createSpreadDirections } from '../../utils/attackDirections';
import { normalizeVector } from '../../utils/math';
import type { Player } from '../Player';
import { ShooterEnemy } from './ShooterEnemy';

/**
 * 1스테이지 I층 중간보스 "파리 여왕".
 *
 * 사수 AI(거리 유지 + 예고 후 발사)를 물려받고 두 가지를 얹는다: 한 발이던 사격이
 * 부채꼴이 되고, 주기적으로 파리를 부른다. 여왕부터 잡을지 하수인부터 치울지
 * 고르게 만드는 것이 목적이다. 원래는 일반 사수와 코드가 완전히 같았다.
 *
 * 사격 리듬·예고·거리 유지는 손대지 않는다 — 그건 사수 AI가 이미 하는 일이고,
 * 여기서는 "무엇을 쏘는가"와 "소환"만 더한다.
 */

type FlyQueenSummonState = 'idle' | 'telegraphing' | 'recovering';

const TUNING = MINIBOSS_TUNING.flyQueen;

// 방에 들어선 직후 곧바로 소환하지 않게 두는 첫 여유.
const FIRST_SUMMON_DELAY_MS = 2200;

export class FlyQueenMiniboss extends ShooterEnemy {
  private summonState: FlyQueenSummonState = 'idle';
  private stateEndsAt = 0;
  private nextSummonAt = 0;

  override updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    this.updatePhase();

    if (this.nextSummonAt === 0) {
      this.nextSummonAt = time + FIRST_SUMMON_DELAY_MS;
    }

    // 소환 중에는 사수 행동을 멈춘다. 멈춰 서 있는 동안이 밀고 들어갈 창이다.
    switch (this.summonState) {
      case 'telegraphing':
        this.updateSummonTelegraph(time);
        return;
      case 'recovering':
        this.updateSummonRecovery(time);
        return;
      case 'idle':
        // 발사 예고 중에는 끼어들지 않는다. 가로채면 노란 예고 점등·확대가 소환
        // 내내 남고, 돌아오는 순간 부채꼴이 즉시 튀어나온다.
        if (time >= this.nextSummonAt && !this.isTelegraphingShot) {
          this.beginSummonTelegraph(time);
          return;
        }
    }

    super.updateAI(time, player, enemyBullets);
  }

  /**
   * 사격을 부채꼴로 바꾼다. 사수 AI가 발사 시점에 이것을 부르므로, 예고·쿨다운
   * 리듬은 그대로 두고 탄만 늘어난다.
   */
  protected override fireAtPlayer(
    player: Player,
    enemyBullets: Phaser.Physics.Arcade.Group,
    speed: number,
    damage: number,
  ): void {
    const aim = normalizeVector(player.x - this.x, player.y - this.y);
    const radius = this.effectiveBodyRadius + 4;

    for (const direction of createSpreadDirections(aim, this.fanCount(), TUNING.fanSpreadDegrees)) {
      this.fireBullet(
        this.x + direction.x * radius,
        this.y + direction.y * radius,
        direction,
        enemyBullets,
        speed,
        damage,
      );
    }
  }

  private updatePhase(): void {
    if (!this.tryLatchPhaseTwo(MINIBOSS_TUNING.phaseTwoThreshold)) {
      return;
    }

    this.setPersistentTint(TUNING.phaseTwoTint);
  }

  private beginSummonTelegraph(time: number): void {
    this.summonState = 'telegraphing';
    this.stateEndsAt = time + TUNING.summonTelegraphMs;
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.showTelegraphRing(TUNING.telegraphColor);
  }

  private updateSummonTelegraph(time: number): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.syncTelegraphRing();

    if (time < this.stateEndsAt) {
      return;
    }

    this.clearTelegraphRing();
    // 예고가 끝나는 순간에 부른다 — 예고 중에 처치하면 소환 자체가 없다.
    this.emit('summon-request', {
      childId: this.definition.summonChildId as EnemyId,
      count: this.definition.summonCount ?? 2,
      maxAlive: this.definition.summonMaxAlive ?? 3,
    });
    // 예고 시간을 빼고 계산해 소환 사이 간격이 정확히 쿨다운이 되게 한다.
    this.nextSummonAt = getNextTelegraphAt(time, this.summonCooldown(), TUNING.summonTelegraphMs);
    this.summonState = 'recovering';
    this.stateEndsAt = time + TUNING.summonRecoveryMs;
  }

  private updateSummonRecovery(time: number): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();

    if (time >= this.stateEndsAt) {
      this.summonState = 'idle';
    }
  }

  private fanCount(): number {
    return this.isInPhaseTwo() ? TUNING.phaseTwoFanCount : TUNING.fanCount;
  }

  private summonCooldown(): number {
    return this.isInPhaseTwo() ? TUNING.phaseTwoSummonCooldownMs : TUNING.summonCooldownMs;
  }
}
