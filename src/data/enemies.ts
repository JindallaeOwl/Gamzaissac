import { TextureKeys } from '../config/assets';
import { BOSS_TUNING } from '../config/gameConfig';

export type EnemyId = 'chaser' | 'shooter' | 'dasher' | 'faultWarden';

export interface EnemyDefinition {
  id: EnemyId;
  kind?: 'normal' | 'boss';
  displayName: string;
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
}

export const ENEMY_DEFINITIONS: Record<EnemyId, EnemyDefinition> = {
  chaser: {
    id: 'chaser',
    kind: 'normal',
    displayName: 'Needle Mote',
    textureKey: TextureKeys.enemyChaser,
    maxHealth: 2.2,
    speed: 128,
    contactDamage: 1,
    bodyRadius: 15,
    score: 10,
  },
  shooter: {
    id: 'shooter',
    kind: 'normal',
    displayName: 'Brass Wisp',
    textureKey: TextureKeys.enemyShooter,
    maxHealth: 2.8,
    speed: 78,
    contactDamage: 1,
    bodyRadius: 16,
    score: 18,
    bulletDamage: 1,
    bulletSpeed: 235,
    fireCooldownMs: 1350,
    keepAwayDistance: 260,
  },
  dasher: {
    id: 'dasher',
    kind: 'normal',
    displayName: 'Skitter Bolt',
    textureKey: TextureKeys.enemyDasher,
    maxHealth: 3.5,
    speed: 82,
    contactDamage: 1,
    bodyRadius: 17,
    score: 24,
    dashCooldownMs: 1550,
    dashDurationMs: 280,
    dashSpeed: 335,
    wanderSpeed: 105,
  },
  faultWarden: {
    id: 'faultWarden',
    kind: 'boss',
    displayName: 'Fault Warden',
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
  },
};
