import { TextureKeys } from '../config/assets';
import { BOSS_TUNING, ROOT_KERNEL_TUNING } from '../config/gameConfig';

export type EnemyId = 'chaser' | 'shooter' | 'dasher' | 'faultWarden' | 'rootKernel';

export interface EnemyDefinition {
  id: EnemyId;
  kind?: 'normal' | 'boss';
  displayName: string;
  displayNameKey?: string;
  textureKey: string;
  maxHealth: number;
  speed: number;
  contactDamage: number;
  bodyRadius: number;
  score: number;
  bulletDamage?: number;
  bulletSpeed?: number;
  fireCooldownMs?: number;
  keepAwayDistance?: number;
  dashCooldownMs?: number;
  dashDurationMs?: number;
  dashSpeed?: number;
  wanderSpeed?: number;
  bossBarColor?: number;
  bossPhaseTwoBarColor?: number;
  phaseTwoMessageKey?: string;
}

export const ENEMY_DEFINITIONS: Record<EnemyId, EnemyDefinition> = {
  chaser: {
    id: 'chaser',
    kind: 'normal',
    displayName: 'Needle Mote',
    textureKey: TextureKeys.enemyChaser,
    maxHealth: 2.2,
    speed: 66,
    contactDamage: 1,
    bodyRadius: 11,
    score: 10,
  },
  shooter: {
    id: 'shooter',
    kind: 'normal',
    displayName: 'Brass Wisp',
    textureKey: TextureKeys.enemyShooter,
    maxHealth: 2.8,
    speed: 42,
    contactDamage: 1,
    bodyRadius: 11,
    score: 18,
    bulletDamage: 1,
    bulletSpeed: 120,
    fireCooldownMs: 1350,
    keepAwayDistance: 132,
  },
  dasher: {
    id: 'dasher',
    kind: 'normal',
    displayName: 'Skitter Bolt',
    textureKey: TextureKeys.enemyDasher,
    maxHealth: 3.5,
    speed: 44,
    contactDamage: 1,
    bodyRadius: 12,
    score: 24,
    dashCooldownMs: 1550,
    dashDurationMs: 280,
    dashSpeed: 170,
    wanderSpeed: 54,
  },
  faultWarden: {
    id: 'faultWarden',
    kind: 'boss',
    displayName: 'Fault Warden',
    displayNameKey: 'bosses.faultWarden',
    textureKey: TextureKeys.enemyBoss,
    maxHealth: BOSS_TUNING.maxHealth,
    speed: BOSS_TUNING.speed,
    contactDamage: BOSS_TUNING.contactDamage,
    bodyRadius: BOSS_TUNING.bodyRadius,
    score: BOSS_TUNING.score,
    bulletDamage: BOSS_TUNING.bulletDamage,
    bulletSpeed: BOSS_TUNING.bulletSpeed,
    fireCooldownMs: BOSS_TUNING.fireCooldownMs,
    dashCooldownMs: BOSS_TUNING.dashCooldownMs,
    dashDurationMs: BOSS_TUNING.dashDurationMs,
    dashSpeed: BOSS_TUNING.dashSpeed,
    bossBarColor: 0xd84f66,
    bossPhaseTwoBarColor: BOSS_TUNING.phaseTwoTint,
    phaseTwoMessageKey: 'messages.bossPhaseTwo',
  },
  rootKernel: {
    id: 'rootKernel',
    kind: 'boss',
    displayName: 'ROOT KERNEL',
    displayNameKey: 'bosses.rootKernel',
    textureKey: TextureKeys.enemyRootKernel,
    maxHealth: ROOT_KERNEL_TUNING.maxHealth,
    speed: ROOT_KERNEL_TUNING.speed,
    contactDamage: ROOT_KERNEL_TUNING.contactDamage,
    bodyRadius: ROOT_KERNEL_TUNING.bodyRadius,
    score: ROOT_KERNEL_TUNING.score,
    bulletDamage: ROOT_KERNEL_TUNING.bulletDamage,
    bossBarColor: ROOT_KERNEL_TUNING.bossBarColor,
    bossPhaseTwoBarColor: ROOT_KERNEL_TUNING.bossBarPhaseTwoColor,
    phaseTwoMessageKey: 'messages.rootKernelPhaseTwo',
  },
};
