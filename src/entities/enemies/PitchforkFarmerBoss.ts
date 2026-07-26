import Phaser from 'phaser';
import { DEPTH, PITCHFORK_FARMER_TUNING, ROOM_RECT } from '../../config/gameConfig';
import type { Player } from '../Player';
import { normalizeVector } from '../../utils/math';
import {
  boomerangDistance,
  brokenRingSafeIndex,
  isInBrokenRingGap,
  isWithinMeleeBlade,
  rakeSweepAngle,
  selectFarmerPattern,
  type FarmerPattern,
  type FarmerPatternCandidate,
} from '../../systems/PitchforkFarmerRules';
import { BaseEnemy } from './BaseEnemy';

// 4스테이지 II층 최종 보스 "녹슨 쇠스랑의 농부".
// 뿌리핵과 같은 "예고 → 발사" 상태머신. 1페이즈 5패턴(삼지창 찌르기·갈퀴 스윕·씨앗
// 흩뿌리기·발 구르기·쇠스랑 근접 휘두르기), 2페이즈 "광란"에서 건초 커튼·회전 낫 부메랑이
// 추가되고 쿨다운·탄속이 강화된다. 근접·부메랑은 player.damage를 직접 호출하고, 적중했을
// 때만 'player-damaged'를 쏴 GameScene의 공통 피격 피드백에 연결한다.
// 장면에 의존하지 않는 판정(스윕각·패턴 선택·안전 틈·근접 판정)은 PitchforkFarmerRules로 분리.
const F = PITCHFORK_FARMER_TUNING;

type FarmerState =
  | 'idle'
  | 'tridentTelegraph'
  | 'rakeTelegraph'
  | 'rakeSweep'
  | 'seedTelegraph'
  | 'stompTelegraph'
  | 'curtainTelegraph'
  | 'swingTelegraph'
  | 'swinging'
  | 'boomerangTelegraph'
  | 'boomerangFlying'
  | 'phaseTransition';

type CurtainDirection = 'north' | 'south' | 'west' | 'east';

interface CurtainSpawn {
  x: number;
  y: number;
  direction: { x: number; y: number };
}

export class PitchforkFarmerBoss extends BaseEnemy {
  private attackState: FarmerState = 'idle';
  private attackEndsAt = 0;
  private recoveryUntil = 0;
  private initializedSchedule = false;
  private isPhaseTwo = false;
  private lastPattern: FarmerPattern | null = null;

  private nextTridentAt = 0;
  private nextRakeAt = 0;
  private nextSeedAt = 0;
  private nextStompAt = 0;
  private nextCurtainAt = 0;
  private nextSwingAt = 0;
  private swingStart = 0;
  private nextBoomerangAt = 0;
  private boomerangStart = 0;
  private boomerangOriginX = 0;
  private boomerangOriginY = 0;
  private scytheGraphics?: Phaser.GameObjects.Graphics;

  // 예고 시작 시점에 고정하는 조준·안전 데이터.
  private aimAngle = 0;
  private seedSafeStart = 0;
  private curtainDirection: CurtainDirection = 'north';
  private curtainSafeIndex = 0;
  private rakeSweepStart = 0;
  private rakeNextShotAt = 0;

  private warningGraphics?: Phaser.GameObjects.Graphics;
  private cleanedUp = false;

  override takeDamage(amount: number, sourceX: number, sourceY: number): boolean {
    const defeated = super.takeDamage(amount, sourceX, sourceY);

    if (!defeated) {
      this.tryEnterPhaseTwo(this.scene.time.now);
    }

    return defeated;
  }

  updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!this.active || !body || this.cleanedUp) {
      return;
    }

    if (!this.initializedSchedule) {
      this.initializedSchedule = true;
      this.nextTridentAt = time + 700;
      this.nextRakeAt = time + 1400;
      this.nextSeedAt = time + 2100;
      this.nextStompAt = time + 2800;
      this.nextCurtainAt = time + 1000;
      this.nextSwingAt = time + 1200;
      this.nextBoomerangAt = time + 1500;
    }

    switch (this.attackState) {
      case 'phaseTransition':
        body.stop();
        if (time >= this.attackEndsAt) {
          this.endPhaseTransition(time);
        }
        return;

      case 'rakeSweep':
        body.stop();
        this.updateRakeSweep(time, enemyBullets);
        return;

      case 'swinging':
        body.stop();
        this.updateSwing(time, player);
        return;

      case 'boomerangFlying':
        body.stop();
        this.updateBoomerang(time, player);
        return;

      case 'idle':
        this.updateMovement(player);
        if (time < this.recoveryUntil) {
          return;
        }
        this.maybeStartPattern(time, player);
        return;

      default:
        // 남은 상태는 모두 예고(telegraph) 상태.
        body.stop();
        this.updateTelegraph(time, enemyBullets);
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
      this.clearWarning();
      this.destroyScythe();
    }

    super.destroy(fromScene);
  }

  private updateMovement(player: Player): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const toPlayer = normalizeVector(player.x - this.x, player.y - this.y);
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const speed = F.speed * (this.isPhaseTwo ? 1.15 : 1);
    let velocityX: number;
    let velocityY: number;

    if (distance < F.preferredMinDistance) {
      velocityX = -toPlayer.x;
      velocityY = -toPlayer.y;
    } else if (distance > F.preferredMaxDistance) {
      velocityX = toPlayer.x;
      velocityY = toPlayer.y;
    } else {
      // 중거리에서는 플레이어 주위를 돈다.
      velocityX = -toPlayer.y;
      velocityY = toPlayer.x;
    }

    const direction = normalizeVector(velocityX, velocityY);
    body.setVelocity(direction.x * speed, direction.y * speed);
    this.constrainToRoom();
  }

  private maybeStartPattern(time: number, player: Player): void {
    const candidates: FarmerPatternCandidate[] = [
      { pattern: 'trident', readyAt: this.nextTridentAt },
      { pattern: 'rake', readyAt: this.nextRakeAt },
      { pattern: 'seed', readyAt: this.nextSeedAt },
      { pattern: 'stomp', readyAt: this.nextStompAt },
    ];

    // 근접 휘두르기는 플레이어가 사거리 근처에 붙어 있을 때만 후보에 넣는다(허공 헛휘두름 방지).
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (distance <= F.swingTriggerRange) {
      candidates.push({ pattern: 'swing', readyAt: this.nextSwingAt });
    }

    if (this.isPhaseTwo) {
      candidates.push({ pattern: 'curtain', readyAt: this.nextCurtainAt });
      candidates.push({ pattern: 'boomerang', readyAt: this.nextBoomerangAt });
    }

    const pattern = selectFarmerPattern(candidates, time, this.lastPattern);

    if (pattern) {
      this.startPattern(pattern, time, player);
    }
  }

  private startPattern(pattern: FarmerPattern, time: number, player: Player): void {
    this.lastPattern = pattern;
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    switch (pattern) {
      case 'trident':
        this.attackState = 'tridentTelegraph';
        this.attackEndsAt = time + F.tridentTelegraphMs;
        this.nextTridentAt = time + this.cooldown(F.tridentCooldownMs);
        this.drawTridentWarning();
        return;

      case 'rake':
        this.attackState = 'rakeTelegraph';
        this.attackEndsAt = time + F.rakeTelegraphMs;
        this.nextRakeAt = time + this.cooldown(F.rakeCooldownMs);
        this.drawRakeWarning();
        return;

      case 'seed':
        this.attackState = 'seedTelegraph';
        this.attackEndsAt = time + F.seedTelegraphMs;
        this.nextSeedAt = time + this.cooldown(F.seedCooldownMs);
        this.seedSafeStart = brokenRingSafeIndex(this.aimAngle, F.seedRingCount);
        this.drawSeedWarning();
        return;

      case 'stomp':
        this.attackState = 'stompTelegraph';
        this.attackEndsAt = time + F.stompTelegraphMs;
        this.nextStompAt = time + this.cooldown(F.stompCooldownMs);
        this.drawStompWarning();
        return;

      case 'swing':
        this.attackState = 'swingTelegraph';
        this.attackEndsAt = time + F.swingTelegraphMs;
        this.nextSwingAt = time + this.cooldown(F.swingCooldownMs);
        this.drawSwingWarning();
        return;

      case 'boomerang':
        this.attackState = 'boomerangTelegraph';
        this.attackEndsAt = time + F.boomerangTelegraphMs;
        this.nextBoomerangAt = time + this.cooldown(F.boomerangCooldownMs);
        this.drawBoomerangWarning();
        return;

      case 'curtain':
        this.attackState = 'curtainTelegraph';
        this.attackEndsAt = time + F.curtainTelegraphMs;
        this.nextCurtainAt = time + this.cooldown(F.curtainCooldownMs);
        this.curtainDirection = Phaser.Utils.Array.GetRandom([
          'north',
          'south',
          'west',
          'east',
        ] as CurtainDirection[]);
        this.curtainSafeIndex = Phaser.Math.Between(1, F.curtainLaneCount - 2);
        this.drawCurtainWarning();
        return;
    }
  }

  private updateTelegraph(time: number, enemyBullets: Phaser.Physics.Arcade.Group): void {
    this.flashWarning(time);

    if (time < this.attackEndsAt) {
      return;
    }

    switch (this.attackState) {
      case 'tridentTelegraph':
        this.fireTrident(enemyBullets);
        this.finishAttack(time);
        return;
      case 'seedTelegraph':
        this.fireSeedRing(enemyBullets);
        this.finishAttack(time);
        return;
      case 'stompTelegraph':
        this.fireStompRing(enemyBullets);
        this.finishAttack(time);
        return;
      case 'curtainTelegraph':
        this.fireCurtain(enemyBullets);
        this.finishAttack(time);
        return;
      case 'rakeTelegraph':
        this.beginRakeSweep(time);
        return;
      case 'swingTelegraph':
        this.beginSwing(time);
        return;
      case 'boomerangTelegraph':
        this.beginBoomerang(time);
        return;
      default:
        this.finishAttack(time);
        return;
    }
  }

  private beginRakeSweep(time: number): void {
    this.clearWarning();
    this.attackState = 'rakeSweep';
    this.attackEndsAt = time + F.rakeSweepMs;
    this.rakeSweepStart = time;
    this.rakeNextShotAt = time;
  }

  private updateRakeSweep(time: number, enemyBullets: Phaser.Physics.Arcade.Group): void {
    if (time >= this.rakeNextShotAt) {
      const progress = (time - this.rakeSweepStart) / F.rakeSweepMs;
      const angle = rakeSweepAngle(this.aimAngle, progress, F.rakeArcRad);
      this.fireAngle(angle, enemyBullets, this.bulletSpeed(F.rakeBulletSpeed));
      this.rakeNextShotAt = time + F.rakeShotIntervalMs;
    }

    if (time >= this.attackEndsAt) {
      this.finishAttack(time);
    }
  }

  private beginSwing(time: number): void {
    this.attackState = 'swinging';
    this.attackEndsAt = time + F.swingActiveMs;
    this.swingStart = time;
    // 예고 웨지를 지우고, 움직이는 날을 매 프레임 다시 그릴 그래픽을 새로 만든다.
    this.createWarning();
  }

  private updateSwing(time: number, player: Player): void {
    const progress = (time - this.swingStart) / F.swingActiveMs;
    const bladeAngle = rakeSweepAngle(this.aimAngle, progress, F.swingArcRad);

    // 날은 보스에서 뻗은 선분. 그 선분에서 halfWidth 이내면 벤다(그래픽과 같은 값 사용).
    if (
      isWithinMeleeBlade(
        player.x,
        player.y,
        this.x,
        this.y,
        bladeAngle,
        F.swingReach,
        F.swingBladeHalfWidth,
      )
    ) {
      this.dealDirectDamage(player, F.swingDamage, this.x, this.y);
    }

    this.drawSwingBlade(bladeAngle);

    if (time >= this.attackEndsAt) {
      this.finishAttack(time);
    }
  }

  // 근접·부메랑 같은 직접 피해 경로. player.damage가 i-frame·무적을 처리하므로 매 프레임
  // 호출해도 실제 적중은 한 번뿐이며, 적중(true)일 때만 'player-damaged'를 쏴 GameScene이
  // 기존 공통 피격 피드백(점멸·화면 흔들림·피격 효과음)을 내도록 연결한다.
  private dealDirectDamage(player: Player, amount: number, sourceX: number, sourceY: number): void {
    if (player.damage(amount, sourceX, sourceY)) {
      this.emit('player-damaged');
    }
  }

  private beginBoomerang(time: number): void {
    this.clearWarning();
    this.attackState = 'boomerangFlying';
    this.attackEndsAt = time + F.boomerangFlightMs;
    this.boomerangStart = time;
    // 던진 시점 위치를 고정해 그 자리로 되돌아오게 한다(피격 넉백으로 흔들려도 안정적).
    this.boomerangOriginX = this.x;
    this.boomerangOriginY = this.y;
    this.createScythe();
    // 생성 직후 원점에 즉시 배치한다. 안 하면 다음 프레임 drawScythe 전까지 (0,0)에 보인다.
    this.drawScythe(this.boomerangOriginX, this.boomerangOriginY, 0);
  }

  private updateBoomerang(time: number, player: Player): void {
    const progress = (time - this.boomerangStart) / F.boomerangFlightMs;
    const distance = boomerangDistance(progress, F.boomerangRange);
    const scytheX = this.boomerangOriginX + Math.cos(this.aimAngle) * distance;
    const scytheY = this.boomerangOriginY + Math.sin(this.aimAngle) * distance;

    if (
      Phaser.Math.Distance.Between(scytheX, scytheY, player.x, player.y) <= F.boomerangHitRadius
    ) {
      // i-frame이 있으므로 나갈 때·돌아올 때 각각 한 번씩만 적중한다.
      this.dealDirectDamage(player, F.boomerangDamage, scytheX, scytheY);
    }

    this.drawScythe(scytheX, scytheY, (time - this.boomerangStart) * F.boomerangSpinRate);

    if (time >= this.attackEndsAt) {
      this.finishBoomerang(time);
    }
  }

  private finishBoomerang(time: number): void {
    this.destroyScythe();
    this.finishAttack(time);
  }

  private finishAttack(time: number): void {
    this.clearWarning();
    this.attackState = 'idle';
    this.recoveryUntil = time + F.attackRecoveryMs;
  }

  private tryEnterPhaseTwo(time: number): void {
    if (
      this.isPhaseTwo ||
      !this.active ||
      !this.body ||
      this.getHealthRatio() > F.phaseTwoThreshold
    ) {
      return;
    }

    this.isPhaseTwo = true;
    this.attackState = 'phaseTransition';
    this.attackEndsAt = time + F.phaseTwoTransitionLockMs;
    this.clearWarning();
    this.setPersistentTint(F.phaseTwoTint);
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.emit('boss-phase-two', this);
  }

  private endPhaseTransition(time: number): void {
    this.attackState = 'idle';
    this.recoveryUntil = time + F.attackRecoveryMs;
    // 패턴이 한꺼번에 터지지 않게 재개 시점을 어긋나게 잡고, 건초 커튼을 연다.
    this.nextTridentAt = time + 400;
    this.nextRakeAt = time + 900;
    this.nextSeedAt = time + 1400;
    this.nextStompAt = time + 1900;
    this.nextCurtainAt = time + 700;
    this.nextSwingAt = time + 1100;
    this.nextBoomerangAt = time + 1500;
  }

  private bulletSpeed(base: number): number {
    return base * (this.isPhaseTwo ? F.phaseTwoBulletSpeedScale : 1);
  }

  private cooldown(base: number): number {
    return base * (this.isPhaseTwo ? F.phaseTwoCooldownScale : 1);
  }

  private fireAngle(angle: number, enemyBullets: Phaser.Physics.Arcade.Group, speed: number): void {
    this.fireDirection({ x: Math.cos(angle), y: Math.sin(angle) }, enemyBullets, speed);
  }

  private fireDirection(
    direction: { x: number; y: number },
    enemyBullets: Phaser.Physics.Arcade.Group,
    speed: number,
  ): void {
    const offset = this.effectiveBodyRadius + 4;
    this.fireBullet(
      this.x + direction.x * offset,
      this.y + direction.y * offset,
      direction,
      enemyBullets,
      speed,
      this.definition.bulletDamage ?? F.bulletDamage,
    );
  }

  private fireTrident(enemyBullets: Phaser.Physics.Arcade.Group): void {
    const direction = { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
    const perpendicular = { x: -direction.y, y: direction.x };
    const speed = this.bulletSpeed(F.tridentBulletSpeed);
    const offset = this.effectiveBodyRadius + 4;

    for (let lane = -1; lane <= 1; lane += 1) {
      const laneOffset = lane * F.tridentLaneSpacing;
      this.fireBullet(
        this.x + direction.x * offset + perpendicular.x * laneOffset,
        this.y + direction.y * offset + perpendicular.y * laneOffset,
        direction,
        enemyBullets,
        speed,
        this.definition.bulletDamage ?? F.bulletDamage,
      );
    }
  }

  private fireSeedRing(enemyBullets: Phaser.Physics.Arcade.Group): void {
    const speed = this.bulletSpeed(F.seedBulletSpeed);

    for (let index = 0; index < F.seedRingCount; index += 1) {
      if (isInBrokenRingGap(index, this.seedSafeStart, F.seedSafeGap, F.seedRingCount)) {
        continue;
      }

      this.fireAngle((Math.PI * 2 * index) / F.seedRingCount, enemyBullets, speed);
    }
  }

  private fireStompRing(enemyBullets: Phaser.Physics.Arcade.Group): void {
    const speed = this.bulletSpeed(F.stompBulletSpeed);

    for (let index = 0; index < F.stompRingCount; index += 1) {
      this.fireAngle((Math.PI * 2 * index) / F.stompRingCount, enemyBullets, speed);
    }
  }

  private fireCurtain(enemyBullets: Phaser.Physics.Arcade.Group): void {
    const spawns = this.buildCurtainSpawns(this.curtainDirection);
    const speed = this.bulletSpeed(F.curtainBulletSpeed);

    spawns.forEach((spawn, index) => {
      if (index === this.curtainSafeIndex) {
        return;
      }

      this.fireBullet(
        spawn.x,
        spawn.y,
        spawn.direction,
        enemyBullets,
        speed,
        this.definition.bulletDamage ?? F.bulletDamage,
      );
    });
  }

  private buildCurtainSpawns(direction: CurtainDirection): CurtainSpawn[] {
    const spawns: CurtainSpawn[] = [];
    const horizontal = direction === 'north' || direction === 'south';
    const start = horizontal ? ROOM_RECT.left + 48 : ROOM_RECT.top + 36;
    const end = horizontal ? ROOM_RECT.right - 48 : ROOM_RECT.bottom - 36;

    for (let index = 0; index < F.curtainLaneCount; index += 1) {
      const position = Phaser.Math.Linear(start, end, index / (F.curtainLaneCount - 1));

      if (direction === 'north') {
        spawns.push({ x: position, y: ROOM_RECT.top + 12, direction: { x: 0, y: 1 } });
      } else if (direction === 'south') {
        spawns.push({ x: position, y: ROOM_RECT.bottom - 12, direction: { x: 0, y: -1 } });
      } else if (direction === 'west') {
        spawns.push({ x: ROOM_RECT.left + 12, y: position, direction: { x: 1, y: 0 } });
      } else {
        spawns.push({ x: ROOM_RECT.right - 12, y: position, direction: { x: -1, y: 0 } });
      }
    }

    return spawns;
  }

  private createWarning(): Phaser.GameObjects.Graphics {
    this.clearWarning();
    this.warningGraphics = this.scene.add.graphics().setDepth(DEPTH.effect - 1);
    return this.warningGraphics;
  }

  private clearWarning(): void {
    this.warningGraphics?.destroy();
    this.warningGraphics = undefined;
  }

  private flashWarning(time: number): void {
    if (!this.warningGraphics) {
      return;
    }

    const remaining = Math.max(0, this.attackEndsAt - time);
    const flashing = Math.floor(remaining / 100) % 2 === 0;
    this.warningGraphics.setAlpha(flashing ? 1 : 0.5);
  }

  private drawTridentWarning(): void {
    const graphics = this.createWarning();
    const direction = { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
    const perpendicular = { x: -direction.y, y: direction.x };
    graphics.lineStyle(3, 0xffd39a, 0.82);

    for (let lane = -1; lane <= 1; lane += 1) {
      const ox = perpendicular.x * lane * F.tridentLaneSpacing;
      const oy = perpendicular.y * lane * F.tridentLaneSpacing;
      graphics.lineBetween(
        this.x + ox,
        this.y + oy,
        this.x + ox + direction.x * 210,
        this.y + oy + direction.y * 210,
      );
    }
  }

  private drawRakeWarning(): void {
    const graphics = this.createWarning();
    const start = this.aimAngle - F.rakeArcRad / 2;
    graphics.lineStyle(3, 0xffcaa0, 0.7);
    graphics.beginPath();
    graphics.arc(this.x, this.y, 120, start, start + F.rakeArcRad, false);
    graphics.strokePath();
  }

  private drawSeedWarning(): void {
    const graphics = this.createWarning();
    graphics.lineStyle(3, 0xd7b26a, 0.6);
    graphics.strokeCircle(this.x, this.y, 40);

    for (let k = 0; k < F.seedSafeGap; k += 1) {
      const index = (this.seedSafeStart + k) % F.seedRingCount;
      const angle = (Math.PI * 2 * index) / F.seedRingCount;
      graphics.lineStyle(4, 0x9bffb0, 0.85);
      graphics.lineBetween(
        this.x + Math.cos(angle) * 30,
        this.y + Math.sin(angle) * 30,
        this.x + Math.cos(angle) * 70,
        this.y + Math.sin(angle) * 70,
      );
    }
  }

  private drawStompWarning(): void {
    const graphics = this.createWarning();
    graphics.fillStyle(0xffb347, 0.12);
    graphics.fillCircle(this.x, this.y, 62);
    graphics.lineStyle(3, 0xffca7a, 0.8);
    graphics.strokeCircle(this.x, this.y, 62);
  }

  private drawCurtainWarning(): void {
    const graphics = this.createWarning();
    const spawns = this.buildCurtainSpawns(this.curtainDirection);

    spawns.forEach((spawn, index) => {
      const safe = index === this.curtainSafeIndex;
      graphics.fillStyle(safe ? 0x8fffb0 : 0xffc46b, safe ? 0.3 : 0.75);
      graphics.fillRect(spawn.x - 4, spawn.y - 4, 8, 8);
    });
  }

  // 근접 휘두르기 예고: 날이 지나갈 부채꼴(위험 구역)을 미리 보여준다.
  private drawSwingWarning(): void {
    const graphics = this.createWarning();
    const start = this.aimAngle - F.swingArcRad / 2;
    graphics.fillStyle(0xff8a5a, 0.12);
    graphics.slice(this.x, this.y, F.swingReach, start, start + F.swingArcRad, false);
    graphics.fillPath();
    graphics.lineStyle(2, 0xffb98a, 0.7);
    graphics.beginPath();
    graphics.arc(this.x, this.y, F.swingReach, start, start + F.swingArcRad, false);
    graphics.strokePath();
  }

  // 휘두르는 동안 현재 날의 위치를 선으로 그린다(피해 판정과 일치).
  private drawSwingBlade(bladeAngle: number): void {
    const graphics = this.warningGraphics;

    if (!graphics) {
      return;
    }

    graphics.clear();
    // 선 두께 = 판정 폭(halfWidth의 2배) → 보이는 날 = 맞는 범위.
    graphics.lineStyle(F.swingBladeHalfWidth * 2, 0xfff0c0, 0.85);
    graphics.lineBetween(
      this.x,
      this.y,
      this.x + Math.cos(bladeAngle) * F.swingReach,
      this.y + Math.sin(bladeAngle) * F.swingReach,
    );
  }

  // 부메랑 예고: 낫이 날아갈 직선 궤도를 보여준다.
  private drawBoomerangWarning(): void {
    const graphics = this.createWarning();
    const direction = { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
    graphics.lineStyle(3, 0xdfe6ec, 0.6);
    graphics.lineBetween(
      this.x,
      this.y,
      this.x + direction.x * F.boomerangRange,
      this.y + direction.y * F.boomerangRange,
    );
  }

  // 회전하는 낫(초승달 날 + 자루)을 로컬 원점에 그려두고, 매 프레임 위치·회전만 바꾼다.
  private createScythe(): void {
    this.destroyScythe();
    const graphics = this.scene.add.graphics().setDepth(DEPTH.effect);
    graphics.lineStyle(3, 0xdfe6ec, 0.95);
    graphics.beginPath();
    graphics.arc(0, 0, 12, -Math.PI * 0.75, Math.PI * 0.25, false);
    graphics.strokePath();
    graphics.lineStyle(3, 0x8a5a38, 1);
    graphics.lineBetween(0, 0, 0, 11);
    this.scytheGraphics = graphics;
  }

  private drawScythe(x: number, y: number, rotation: number): void {
    this.scytheGraphics?.setPosition(x, y);
    this.scytheGraphics?.setRotation(rotation);
  }

  private destroyScythe(): void {
    this.scytheGraphics?.destroy();
    this.scytheGraphics = undefined;
  }
}
