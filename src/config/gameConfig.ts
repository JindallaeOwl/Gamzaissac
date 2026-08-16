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

// 방 내부 크기 배율. 1이면 기존 한 화면 방과 동일하게 동작한다.
// (2배 실험 결과: 개방감은 전투방 크기가 아니라 오버월드에서 얻기로 결정.
// 카메라 추적과 좌표 변환 배관은 오버월드 개발에 재사용한다.)
export const ROOM_SIZE_SCALE = 1;

const BASE_ROOM = { left: 32, top: 32, width: 416, height: 208 };

export const ROOM_RECT = {
  left: BASE_ROOM.left,
  top: BASE_ROOM.top,
  right: BASE_ROOM.left + BASE_ROOM.width * ROOM_SIZE_SCALE,
  bottom: BASE_ROOM.top + BASE_ROOM.height * ROOM_SIZE_SCALE,
  width: BASE_ROOM.width * ROOM_SIZE_SCALE,
  height: BASE_ROOM.height * ROOM_SIZE_SCALE,
};

// 벽 여백까지 포함한 월드 크기와 방 중심 좌표.
export const WORLD_WIDTH = ROOM_RECT.right + BASE_ROOM.left;
export const WORLD_HEIGHT = ROOM_RECT.bottom + BASE_ROOM.top;
export const ROOM_CENTER_X = (ROOM_RECT.left + ROOM_RECT.right) / 2;
export const ROOM_CENTER_Y = (ROOM_RECT.top + ROOM_RECT.bottom) / 2;

// 방 템플릿의 좌표는 기존 480×272 한 화면 기준으로 작성되어 있다.
// 현재 방 크기에 비례하도록 사상해, 배치 간격이 방과 함께 넓어지게 한다.
export function scaleRoomTemplatePoint(x: number, y: number): { x: number; y: number } {
  return {
    x: ROOM_RECT.left + (x - BASE_ROOM.left) * ROOM_SIZE_SCALE,
    y: ROOM_RECT.top + (y - BASE_ROOM.top) * ROOM_SIZE_SCALE,
  };
}

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
  /** 빔 차징 시간 배율(1보다 작으면 빨리 모인다). 프리즘 배열 시너지가 줄인다 */
  beamChargeMsMultiplier: number;
  /** 앞 부채꼴 전체를 정반대 방향으로도 복사해 발사. 앞이 4갈래면 뒤도 4갈래다 */
  rearFire: boolean;
  /** 물결 궤적의 조향 진폭(도). 0이면 직선으로 날아간다 */
  waveDegrees: number;
  /** 발사 입력당 연속 발사 수 (1 = 점사 없음) */
  burstCount: number;
}

export const PLAYER_HEALTH_UNITS_PER_HEART = 2;
export const PLAYER_STARTING_HEARTS = 3;
export const PLAYER_DAMAGE_PER_HIT = 1;

export const PLAYER_BASE_STATS: PlayerStats = {
  health: PLAYER_STARTING_HEARTS * PLAYER_HEALTH_UNITS_PER_HEART,
  maxHealth: PLAYER_STARTING_HEARTS * PLAYER_HEALTH_UNITS_PER_HEART,
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

// 저장되는 seedScale의 한계. ItemSystem(중첩 계산)과 표시 배율 계산이 같은 값을
// 봐야, 한쪽만 조정했을 때 "아이템을 먹어도 커지지 않는" 어긋남이 생기지 않는다.
export const SEED_SCALE_LIMITS = { min: 0.6, max: 2.4 } as const;

export const PLAYER_BASE_ATTACK_PROFILE: PlayerAttackProfile = {
  seedCount: 1,
  spreadStepDegrees: 12,
  overflowPenetration: false,
  seedScale: 1,
  forceRedSeeds: false,
  extraForeheadEyeCount: 0,
  hasToothpickCosmetic: false,
  beamChargeMsMultiplier: 1,
  rearFire: false,
  waveDegrees: 0,
  burstCount: 1,
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
export const ROOM_ENTRY_SAFE_RADIUS = 72;
export const ROOM_ENTRY_PROTECTION_MS = 600;
export const ROOM_ENTRY_ENEMY_AI_DELAY_MS = 400;
export const TITLE_TRANSITION_MS = 280;

export const ITEM_PREVIEW_RADIUS = 48;

export const INVENTORY_TUNING = {
  maxConsumable: 99,
  specialRoomKeyCost: 1,
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
    // 아이템으로 수치가 바뀐 HUD 스탯을 잠깐 밝히는 시간과 색. 색은 setTint용
    // 숫자다 — setColor는 텍스트 캔버스를 다시 그리지만 tint는 GPU에서 곱한다.
    statFlashMs: 1100,
    statFlashColor: 0xffd370,
  },
  audio: {
    enabled: true,
    masterVolume: 0.08,
  },
};

export const BOSS_TUNING = {
  maxHealth: 26,
  speed: 42,
  contactDamage: PLAYER_DAMAGE_PER_HIT,
  bodyRadius: 28,
  score: 180,
  bulletDamage: PLAYER_DAMAGE_PER_HIT,
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
  contactDamage: PLAYER_DAMAGE_PER_HIT,
  bodyRadius: 28,
  score: 220,
  bulletDamage: PLAYER_DAMAGE_PER_HIT,
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

// 2스테이지 II층 보스 "늙은 지렁이 왕". 8층 중 4층(중간 난도)에 배치한다.
// 탄막형인 뿌리핵과 달리 근접 돌진·땅굴 잠수·새끼 소환으로 압박하는 이동형 보스다.
export const WORM_KING_TUNING = {
  maxHealth: 22,
  speed: 48,
  contactDamage: PLAYER_DAMAGE_PER_HIT,
  bodyRadius: 13,
  score: 150,
  displayScale: 1.9,
  bulletDamage: PLAYER_DAMAGE_PER_HIT,
  // 유지 거리: 너무 가까우면 물러난다.
  preferredMinDistance: 74,
  // 꿈틀 돌진: 예고 후 플레이어 쪽으로 길게 파고든다.
  chargeCooldownMs: 3200,
  chargeWindupMs: 360,
  chargeDurationMs: 340,
  chargeSpeed: 214,
  // 땅굴 잠수 → 재등장: 잠수 중에는 무적, 착지 지점에 예고 원 후 충격 링을 뿜는다.
  burrowCooldownMs: 5200,
  burrowHiddenMs: 620,
  burrowTelegraphMs: 640,
  resurfaceRingCount: 10,
  resurfaceRingSpeed: 118,
  // 새끼 지렁이 소환: 동시에 살아있는 새끼 수를 maxSummonedAlive로 제한한다.
  summonCooldownMs: 6000,
  summonCount: 2,
  summonChildId: 'splitterling',
  maxSummonedAlive: 5,
  // 행동 사이 최소 간격.
  actionRecoveryMs: 320,
  // 2페이즈 "허물 벗기": 체력 절반에서 새끼를 한꺼번에 뿜고 이후 더 빨라진다.
  phaseTwoThreshold: 0.5,
  phaseTwoTint: 0x9ce86a,
  phaseTwoTransitionLockMs: 640,
  phaseTwoShedCount: 4,
  phaseTwoChargeCooldownMs: 2200,
  phaseTwoBurrowCooldownMs: 3800,
  phaseTwoSummonCooldownMs: 4400,
  bossBarColor: 0x6db24b,
  bossBarPhaseTwoColor: 0x9ce86a,
} as const;

// 4스테이지 II층 최종 보스 "녹슨 쇠스랑의 농부". 8층(최종)에 배치하며 모든 보스 중
// 가장 단단하다. 뿌리핵처럼 "예고 → 발사" 상태머신. 1페이즈 5패턴(삼지창 찌르기·갈퀴
// 스윕·씨앗 흩뿌리기·발 구르기·쇠스랑 근접 휘두르기), 2페이즈 "광란"에서 건초 커튼과
// 회전 낫 부메랑이 추가되고 쿨다운·탄속이 강화된다.
export const PITCHFORK_FARMER_TUNING = {
  maxHealth: 34,
  speed: 34,
  contactDamage: PLAYER_DAMAGE_PER_HIT,
  bodyRadius: 28,
  score: 260,
  bulletDamage: PLAYER_DAMAGE_PER_HIT,
  preferredMinDistance: 110,
  preferredMaxDistance: 150,
  attackRecoveryMs: 320,
  // 삼지창 찌르기: 조준 방향으로 나란한 3발.
  tridentTelegraphMs: 380,
  tridentCooldownMs: 2000,
  tridentBulletSpeed: 175,
  tridentLaneSpacing: 12,
  // 갈퀴 휘두르기: 예고 후 부채꼴을 훑으며 발사.
  rakeTelegraphMs: 500,
  rakeSweepMs: 640,
  rakeCooldownMs: 3200,
  rakeBulletSpeed: 135,
  rakeArcRad: (Math.PI / 180) * 130,
  rakeShotIntervalMs: 60,
  // 씨앗 흩뿌리기: 안전 틈 있는 깨진 링.
  seedTelegraphMs: 500,
  seedCooldownMs: 2800,
  seedBulletSpeed: 118,
  seedRingCount: 12,
  seedSafeGap: 2,
  // 발 구르기: 보스 중심에서 꽉 찬 링 충격파.
  stompTelegraphMs: 600,
  stompCooldownMs: 3600,
  stompBulletSpeed: 122,
  stompRingCount: 14,
  // 쇠스랑 휘두르기(근접): 가까이 붙은 플레이어를 벤다. 날은 보스에서 뻗은 선분이고,
  // 그 선분에서 swingBladeHalfWidth(px) 이내면 맞는다(보이는 날 두께 = 판정). 예고는
  // 날이 지나갈 150° 부채꼴 전체, 활성 시 현재 날 선분이 그 안을 훑는다. triggerRange
  // 안에 있을 때만 패턴 후보로 선택된다.
  swingTelegraphMs: 420,
  swingActiveMs: 300,
  swingCooldownMs: 2600,
  swingArcRad: (Math.PI / 180) * 150,
  swingReach: 62,
  swingBladeHalfWidth: 7,
  swingTriggerRange: 96,
  swingDamage: PLAYER_DAMAGE_PER_HIT,
  // 2페이즈 "광란".
  phaseTwoThreshold: 0.5,
  phaseTwoTransitionLockMs: 700,
  phaseTwoTint: 0xff7a3d,
  phaseTwoCooldownScale: 0.65,
  phaseTwoBulletSpeedScale: 1.2,
  // 회전 낫 부메랑(2페이즈 전용): 나갔다 돌아오며 두 번 위협한다. 보스가 직접 관리하는
  // 투사체라 나가는 동안 제자리에 선다(throw 시점 위치로 돌아옴).
  boomerangTelegraphMs: 460,
  boomerangFlightMs: 1200,
  boomerangCooldownMs: 3400,
  boomerangRange: 150,
  boomerangHitRadius: 16,
  boomerangSpinRate: 0.02,
  boomerangDamage: PLAYER_DAMAGE_PER_HIT,
  // 건초 커튼(2페이즈 전용): 안전 레인 하나 있는 탄 벽.
  curtainTelegraphMs: 700,
  curtainCooldownMs: 3000,
  curtainBulletSpeed: 150,
  curtainLaneCount: 7,
  bossBarColor: 0xb06a2c,
  bossBarPhaseTwoColor: 0xff7a3d,
} as const;

// 폭탄은 "반쪽 방을 지우는 버튼"이 아니라 "쓸까 말까 고민되는 도구"로 잡는다.
// 이전 반지름 115는 지름 230으로 방 높이(208)보다 커서, 가운데에 놓으면 세로 전체와
// 가로 절반이 한 번에 정리됐다. 75로 줄여 방 면적의 48% → 20%가 되게 하고, 대신
// damage를 올려 잡몹이 아니라 보스에게 의미가 생기게 한다(잡몹 체력은 1층 기준
// 2.2~4.2라 5로도 이미 즉사였다).
//
// selfDamage는 플레이어도 폭발에 휘말리게 해 "리스크 없는 순수 이득"을 없앤다.
// 일반 피격과 같은 반 칸(PLAYER_DAMAGE_PER_HIT)이며, 피격 무적·넉백·사망 판정은
// Player.damage가 그대로 처리한다. fuse를 3초에서 2초로 줄인 것도 같은 의도로,
// 설치 후 빠져나갈 여유를 좁혀 놓는 위치가 실제 판단이 되게 한다.
export const BOMB_TUNING = {
  damage: 7,
  selfDamage: PLAYER_DAMAGE_PER_HIT,
  radius: 75,
  cooldownMs: 900,
  fuseMs: 2000,
  knockback: 130,
};

export const OBSTACLE_TUNING = {
  maxHealth: 3,
  hitTint: 0xffe8ad,
  hitFlashMs: 60,
  // 40×40 텍스처를 이 배율로 줄여 그린다.
  displayScale: 0.8,
  // 충돌 범위. 정적 바디는 setScale을 따라가지 않으므로 직접 지정해야 한다.
  // 텍스처 가장자리 여백과 아래쪽 접지 그림자는 제외하고, 실제로 그려진 나무
  // 상자(텍스처 36×34)에 표시 배율을 곱한 크기다. 그림보다 크면 보이지 않는
  // 벽에 걸리는 것처럼 느껴진다.
  bodyWidth: 29,
  bodyHeight: 27,
};

export const DEPTH = {
  floor: 0,
  item: 5,
  bullet: 10,
  actor: 20,
  effect: 30,
  ui: 100,
};
