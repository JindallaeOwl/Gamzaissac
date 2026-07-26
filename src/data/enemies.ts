import { TextureKeys } from '../config/assets';
import {
  BOSS_TUNING,
  PITCHFORK_FARMER_TUNING,
  PLAYER_DAMAGE_PER_HIT,
  ROOT_KERNEL_TUNING,
  WORM_KING_TUNING,
} from '../config/gameConfig';

export type EnemyId =
  | 'chaser'
  | 'shooter'
  | 'dasher'
  | 'splitter'
  | 'splitterling'
  | 'rootGnarl'
  | 'wriggleMass'
  | 'flyQueen'
  | 'thornTangle'
  | 'wormKing'
  | 'faultWarden'
  | 'rootKernel'
  | 'pitchforkFarmer';

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
  splitChildId?: EnemyId;
  splitChildCount?: number;
  // 표시·히트박스 확대 배율. 중간보스가 일반 적 텍스처를 임시 재사용할 때 사용하며,
  // Arcade body는 스프라이트 배율을 따라가므로 bodyRadius는 원본 기준으로 적는다.
  displayScale?: number;
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
    contactDamage: PLAYER_DAMAGE_PER_HIT,
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
    contactDamage: PLAYER_DAMAGE_PER_HIT,
    bodyRadius: 11,
    score: 18,
    bulletDamage: PLAYER_DAMAGE_PER_HIT,
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
    contactDamage: PLAYER_DAMAGE_PER_HIT,
    bodyRadius: 12,
    score: 24,
    dashCooldownMs: 1550,
    dashDurationMs: 280,
    dashSpeed: 170,
    wanderSpeed: 54,
  },
  splitter: {
    id: 'splitter',
    kind: 'normal',
    displayName: 'Cleave Bulb',
    textureKey: TextureKeys.enemySplitter,
    maxHealth: 4.2,
    speed: 38,
    contactDamage: PLAYER_DAMAGE_PER_HIT,
    bodyRadius: 13,
    score: 22,
    splitChildId: 'splitterling',
    splitChildCount: 2,
  },
  splitterling: {
    id: 'splitterling',
    kind: 'normal',
    displayName: 'Cleave Spore',
    textureKey: TextureKeys.enemySplitterling,
    maxHealth: 1.1,
    speed: 84,
    contactDamage: PLAYER_DAMAGE_PER_HIT,
    bodyRadius: 8,
    score: 6,
  },
  // --- I층 중간보스 4종: 기존 일반 적 AI·텍스처를 재사용하고 displayScale로 확대한다.
  // 전용 도트는 placeholder 교체 작업에서 제작 예정.
  rootGnarl: {
    id: 'rootGnarl',
    kind: 'boss',
    displayName: 'Root Gnarl',
    displayNameKey: 'bosses.rootGnarl',
    textureKey: TextureKeys.enemyChaser,
    maxHealth: 14,
    speed: 40,
    contactDamage: PLAYER_DAMAGE_PER_HIT * 2,
    bodyRadius: 11,
    score: 60,
    displayScale: 1.7,
    bossBarColor: 0x9a6d3b,
  },
  wriggleMass: {
    id: 'wriggleMass',
    kind: 'boss',
    displayName: 'Wriggle Mass',
    displayNameKey: 'bosses.wriggleMass',
    textureKey: TextureKeys.enemySplitter,
    maxHealth: 12,
    speed: 55,
    contactDamage: PLAYER_DAMAGE_PER_HIT,
    bodyRadius: 13,
    score: 60,
    displayScale: 1.6,
    splitChildId: 'splitterling',
    splitChildCount: 4,
    bossBarColor: 0x3fbf9a,
  },
  flyQueen: {
    id: 'flyQueen',
    kind: 'boss',
    displayName: 'Fly Queen',
    displayNameKey: 'bosses.flyQueen',
    textureKey: TextureKeys.enemyShooter,
    maxHealth: 13,
    speed: 46,
    contactDamage: PLAYER_DAMAGE_PER_HIT,
    bodyRadius: 11,
    score: 70,
    displayScale: 1.5,
    bulletDamage: PLAYER_DAMAGE_PER_HIT,
    bulletSpeed: 130,
    fireCooldownMs: 700,
    keepAwayDistance: 140,
    bossBarColor: 0xf7bd4d,
  },
  thornTangle: {
    id: 'thornTangle',
    kind: 'boss',
    displayName: 'Thorn Tangle',
    displayNameKey: 'bosses.thornTangle',
    textureKey: TextureKeys.enemyDasher,
    maxHealth: 13,
    speed: 46,
    contactDamage: PLAYER_DAMAGE_PER_HIT,
    bodyRadius: 12,
    score: 70,
    displayScale: 1.5,
    dashCooldownMs: 850,
    dashDurationMs: 300,
    dashSpeed: 185,
    wanderSpeed: 58,
    bossBarColor: 0xa97cff,
  },
  // --- II층 스테이지 보스: 전용 AI 클래스를 가진다.
  // wormKing 전용 임시 도트(마디진 지렁이+왕관). displayScale로 확대해 크기는 유지한다.
  wormKing: {
    id: 'wormKing',
    kind: 'boss',
    displayName: 'Old Worm King',
    displayNameKey: 'bosses.wormKing',
    textureKey: TextureKeys.enemyWormKing,
    maxHealth: WORM_KING_TUNING.maxHealth,
    speed: WORM_KING_TUNING.speed,
    contactDamage: WORM_KING_TUNING.contactDamage,
    bodyRadius: WORM_KING_TUNING.bodyRadius,
    score: WORM_KING_TUNING.score,
    displayScale: WORM_KING_TUNING.displayScale,
    bulletDamage: WORM_KING_TUNING.bulletDamage,
    bossBarColor: WORM_KING_TUNING.bossBarColor,
    bossPhaseTwoBarColor: WORM_KING_TUNING.bossBarPhaseTwoColor,
    phaseTwoMessageKey: 'messages.wormKingPhaseTwo',
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
  // 4스테이지 II층 최종 보스. 전용 임시 도트(밀짚모자·글로우 빨간 눈·쇠스랑).
  pitchforkFarmer: {
    id: 'pitchforkFarmer',
    kind: 'boss',
    displayName: 'Rusty Pitchfork Farmer',
    displayNameKey: 'bosses.pitchforkFarmer',
    textureKey: TextureKeys.enemyPitchforkFarmer,
    maxHealth: PITCHFORK_FARMER_TUNING.maxHealth,
    speed: PITCHFORK_FARMER_TUNING.speed,
    contactDamage: PITCHFORK_FARMER_TUNING.contactDamage,
    bodyRadius: PITCHFORK_FARMER_TUNING.bodyRadius,
    score: PITCHFORK_FARMER_TUNING.score,
    bulletDamage: PITCHFORK_FARMER_TUNING.bulletDamage,
    bossBarColor: PITCHFORK_FARMER_TUNING.bossBarColor,
    bossPhaseTwoBarColor: PITCHFORK_FARMER_TUNING.bossBarPhaseTwoColor,
    phaseTwoMessageKey: 'messages.pitchforkFarmerPhaseTwo',
  },
};
