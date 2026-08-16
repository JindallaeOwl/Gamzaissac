import { BEAM_TUNING, PLAYER_BASE_STATS, type PlayerStats } from '../config/gameConfig';
import { clamp } from '../utils/math';

export function getEffectiveDamage(stats: PlayerStats): number {
  return clamp(stats.damage * stats.damageMultiplier, 0.1, 999);
}

export function getEffectiveFireRate(stats: PlayerStats): number {
  return clamp(stats.fireRate * stats.fireRateMultiplier, 0.35, 15);
}

export function getEffectiveProjectileSpeed(stats: PlayerStats): number {
  return clamp(stats.projectileSpeed * stats.projectileSpeedMultiplier, 120, 1200);
}

// beamChargeMsMultiplier는 공격 프로필의 곱 배율(프리즘 배열 등)이다. clamp 안에서
// 곱해야 배율로도 하한(250ms)을 뚫을 수 없다.
export function getEffectiveBeamChargeMs(stats: PlayerStats, beamChargeMsMultiplier = 1): number {
  return clamp(
    BEAM_TUNING.chargeMs *
      beamChargeMsMultiplier *
      (PLAYER_BASE_STATS.fireRate / getEffectiveFireRate(stats)),
    250,
    5000,
  );
}
