export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 272;
export const GAME_CENTER_X = GAME_WIDTH / 2;
export const GAME_CENTER_Y = GAME_HEIGHT / 2;
export const PIXEL_GRID_SIZE = 16;
export const PIXEL_ART_SIZES = {
  tile: 16,
  hudIcon: 16,
  collectible: 32,
  player: 32,
  normalEnemy: 32,
  largeEnemy: [48, 64],
  boss: [64, 96],
} as const;

// Gameplay is authored on a 480x272 pixel-art canvas. The render scale only
// changes how many physical pixels draw each gameplay pixel.
export const RENDER_SCALE = readStoredRenderScale();

function readStoredRenderScale(): number {
  try {
    const raw = window.localStorage.getItem('die-al-and-error-settings-v1');
    const parsed = raw ? (JSON.parse(raw) as { renderQuality?: string }) : null;

    if (parsed?.renderQuality === 'low') {
      return 1;
    }

    if (parsed?.renderQuality === 'high') {
      return 4;
    }
  } catch {
    // Use the high-quality fallback when storage is unavailable or malformed.
  }

  return 4;
}

export const ROOM_RECT = {
  left: 32,
  right: 448,
  top: 32,
  bottom: 240,
  width: 416,
  height: 208,
};

export const WALL_THICKNESS = 16;

export interface PlayerStats {
  health: number;
  maxHealth: number;
  moveSpeed: number;
  damage: number;
  range: number;
  fireRate: number;
  luck: number;
  projectileSpeed: number;
  damageMultiplier: number;
  fireRateMultiplier: number;
  projectileSpeedMultiplier: number;
}

export interface PlayerAttackProfile {
  seedCount: number;
  spreadStepDegrees: number;
  overflowPenetration: boolean;
  seedScale: number;
  forceRedSeeds: boolean;
  extraForeheadEyeCount: number;
  hasToothpickCosmetic: boolean;
}

export const PLAYER_BASE_STATS: PlayerStats = {
  health: 6,
  maxHealth: 6,
  moveSpeed: 130,
  damage: 1,
  range: 220,
  fireRate: 2.8,
  luck: 0,
  projectileSpeed: 260,
  damageMultiplier: 1,
  fireRateMultiplier: 1,
  projectileSpeedMultiplier: 1,
};

export const PLAYER_BASE_ATTACK_PROFILE: PlayerAttackProfile = {
  seedCount: 1,
  spreadStepDegrees: 12,
  overflowPenetration: false,
  seedScale: 1,
  forceRedSeeds: false,
  extraForeheadEyeCount: 0,
  hasToothpickCosmetic: false,
};

export const COMBAT_TUNING = {
  playerIFrameMs: 850,
  playerKnockback: 110,
  enemyKnockback: 65,
  enemyBulletLifeMs: 1700,
  enemyBulletHitRadius: 11,
  doorCooldownMs: 280,
  enemyContactCooldownMs: 650,
};

export const ROOM_CLEAR_DOOR_DELAY_MS = 500;

export const ITEM_PREVIEW_RADIUS = 48;

export const INVENTORY_TUNING = {
  maxConsumable: 99,
  treasureRoomKeyCost: 1,
};

export const BEAM_TUNING = {
  chargeMs: 850,
  durationMs: 260,
  cooldownMs: 850,
  damage: 2.6,
  range: 280,
  width: 20,
  tickMs: 95,
};

export const FEEDBACK_TUNING = {
  cameraShake: {
    bulletHit: { durationMs: 42, intensity: 0.0014 },
    beamFire: { durationMs: 90, intensity: 0.0022 },
    beamHit: { durationMs: 45, intensity: 0.0018 },
    enemyDeath: { durationMs: 95, intensity: 0.0035 },
    playerHurt: { durationMs: 130, intensity: 0.006 },
    roomClear: { durationMs: 130, intensity: 0.0024 },
    bossPhaseTwo: { durationMs: 230, intensity: 0.007 },
    bombUse: { durationMs: 200, intensity: 0.0065 },
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
  speed: 42,
  contactDamage: 1,
  bodyRadius: 28,
  score: 180,
  bulletDamage: 1,
  bulletSpeed: 125,
  fireCooldownMs: 1180,
  burstCount: 5,
  dashCooldownMs: 2400,
  dashDurationMs: 340,
  dashSpeed: 170,
  phaseTwoThreshold: 0.5,
  phaseTwoTint: 0xff587d,
  phaseTwoBurstCount: 7,
  phaseTwoBulletSpeed: 160,
  phaseTwoFireCooldownMs: 760,
  phaseTwoDashCooldownMs: 1550,
  phaseTwoTransitionLockMs: 500,
  phaseTwoRadialCount: 8,
};

export const ROOT_KERNEL_TUNING = {
  maxHealth: 30,
  speed: 32,
  contactDamage: 1,
  bodyRadius: 28,
  score: 220,
  bulletDamage: 1,
  crossBulletSpeed: 120,
  curtainBulletSpeed: 145,
  ringBulletSpeed: 112,
  crossCooldownMs: 1900,
  curtainCooldownMs: 3200,
  crossTelegraphMs: 650,
  curtainTelegraphMs: 800,
  ringTelegraphMs: 750,
  attackRecoveryMs: 300,
  preferredMinDistance: 105,
  preferredMaxDistance: 132,
  crossLaneSpacing: 10,
  curtainLaneCount: 7,
  phaseTwoThreshold: 0.5,
  phaseTwoTransitionLockMs: 700,
  phaseTwoCrossCooldownMs: 1450,
  phaseTwoCurtainCooldownMs: 2500,
  phaseTwoTint: 0xff6b55,
  bossBarColor: 0x63c978,
  bossBarPhaseTwoColor: 0xff6b55,
  ringBulletCount: 12,
};

export const BOMB_TUNING = {
  damage: 5,
  radius: 115,
  cooldownMs: 900,
  fuseMs: 3000,
  knockback: 130,
};

export const OBSTACLE_TUNING = {
  maxHealth: 3,
  hitTint: 0xffe8ad,
  hitFlashMs: 60,
};

export const DEPTH = {
  floor: 0,
  item: 5,
  bullet: 10,
  actor: 20,
  effect: 30,
  ui: 100,
};
