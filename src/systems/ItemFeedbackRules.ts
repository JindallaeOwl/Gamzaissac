import { SEED_SCALE_LIMITS } from '../config/gameConfig';
import { clamp } from '../utils/math';

/**
 * Rules for making items feel like something happened.
 *
 * 25 of the 33 passives only move numbers, which alpha testers read as "nothing
 * changed". The cheapest honest fix is the Isaac one: the weapon itself shows
 * the stats. Pure maths so the curve can be unit tested.
 *
 * The result is DISPLAY ONLY. Bullet compensates the sprite scale out of its
 * physics body, so damage changes how the seed looks but never how it collides
 * — hitbox size stays authored exclusively by items via seedScale.
 */

/**
 * How much the damage stat may swell the seed. The floor is 1 on purpose: this
 * game's world hitbox has always been more generous than the drawing at high
 * seedScale, so drawing the seed *smaller* than before would widen that gap and
 * make visibly-missed shots connect. Damage below base simply looks unchanged.
 * The cap stops growth at effective damage 4 so late stacking cannot fill the
 * room.
 */
export const SEED_DAMAGE_FACTOR_MIN = 1;
export const SEED_DAMAGE_FACTOR_MAX = 2;

/**
 * Ceiling for the drawn size only. Derived from the stored-scale cap (×1.25) so
 * a mega-seed build with high damage still looks bigger than a plain damage
 * build, and so raising SEED_SCALE_LIMITS.max can never silently leave the
 * stored scale above what the drawing is allowed to show.
 */
export const SEED_DISPLAY_SCALE_MAX = SEED_SCALE_LIMITS.max * 1.25;

/**
 * The scale a fired seed is drawn at.
 *
 * Base damage is 1, so a fresh run starts at exactly seedScale — nothing looks
 * different until an item changes something. The square root keeps growth
 * readable but sublinear. `effectiveDamage` is the caller's already-resolved
 * damage (getEffectiveDamage), not re-derived here, so the seed can never
 * disagree with the number the bullet actually deals.
 */
export function getSeedDisplayScale(seedScale: number, effectiveDamage: number): number {
  const damageFactor = clamp(
    Math.sqrt(effectiveDamage),
    SEED_DAMAGE_FACTOR_MIN,
    SEED_DAMAGE_FACTOR_MAX,
  );

  return clamp(seedScale * damageFactor, SEED_SCALE_LIMITS.min, SEED_DISPLAY_SCALE_MAX);
}
