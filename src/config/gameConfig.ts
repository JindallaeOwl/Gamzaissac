export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

export const ROOM_RECT = {
  left: 80,
  right: 880,
  top: 80,
  bottom: 560,
  width: 800,
  height: 480,
};

export const WALL_THICKNESS = 36;

export interface PlayerStats {
  health: number;
  maxHealth: number;
  moveSpeed: number;
  damage: number;
  range: number;
  fireRate: number;
  luck: number;
  projectileSpeed: number;
}

export const PLAYER_BASE_STATS: PlayerStats = {
  health: 6,
  maxHealth: 6,
  moveSpeed: 250,
  damage: 1,
  range: 430,
  fireRate: 2.8,
  luck: 0,
  projectileSpeed: 500,
};

export const COMBAT_TUNING = {
  playerIFrameMs: 850,
  playerKnockback: 220,
  enemyKnockback: 130,
  enemyBulletLifeMs: 1700,
  enemyBulletHitRadius: 22,
  doorCooldownMs: 280,
  enemyContactCooldownMs: 650,
};

export const INVENTORY_TUNING = {
  maxConsumable: 99,
  treasureRoomKeyCost: 1,
};

export const BEAM_TUNING = {
  chargeMs: 850,
  durationMs: 260,
  cooldownMs: 850,
  damage: 2.6,
  range: 560,
  width: 42,
  tickMs: 95,
};

export const FEEDBACK_TUNING = {
  hitStop: {
    bulletHitMs: 42,
    beamHitMs: 28,
    enemyDeathMs: 82,
    playerHurtMs: 95,
  },
  cameraShake: {
    bulletHit: { durationMs: 42, intensity: 0.0014 },
    beamFire: { durationMs: 90, intensity: 0.0022 },
    beamHit: { durationMs: 45, intensity: 0.0018 },
    enemyDeath: { durationMs: 95, intensity: 0.0035 },
    playerHurt: { durationMs: 130, intensity: 0.006 },
    roomClear: { durationMs: 130, intensity: 0.0024 },
  },
  effects: {
    enemyHitFlashMs: 28,
    enemyHitTint: 0xffe8ad,
    impactMs: 170,
    muzzleMs: 95,
    deathParticleCount: 10,
    floatingTextMs: 620,
    playerFlashMs: 180,
    beamChargePulseMs: 180,
  },
  audio: {
    enabled: true,
    masterVolume: 0.08,
  },
};

export const BOSS_TUNING = {
  maxHealth: 26,
  speed: 78,
  contactDamage: 1,
  bodyRadius: 34,
  score: 180,
  bulletDamage: 1,
  bulletSpeed: 245,
  fireCooldownMs: 1180,
  enragedFireCooldownMs: 820,
  burstCount: 5,
  dashCooldownMs: 2400,
  enragedDashCooldownMs: 1700,
  dashDurationMs: 340,
  dashSpeed: 330,
};

export const DEPTH = {
  floor: 0,
  item: 5,
  bullet: 10,
  actor: 20,
  effect: 30,
  ui: 100,
};
