/**
 * Rules for the Summoner, a support enemy that hangs back and calls in help.
 *
 * It answers the player's habit of shooting whatever is closest: ignore the
 * caller and the room fills up. Kept free of Phaser so the spacing bands and the
 * summon cadence can be unit tested without a scene.
 */

/** What the Summoner should do about its distance from the player. */
export type KeepAwayMove = 'retreat' | 'approach' | 'strafe';

/**
 * Dead band around the preferred distance. Without it the enemy would flip
 * between retreating and approaching every frame and vibrate on the spot.
 * The values match ShooterEnemy so the two read as the same kind of spacing.
 */
export const KEEP_AWAY_RETREAT_MARGIN = 24;
export const KEEP_AWAY_APPROACH_MARGIN = 30;

export function resolveKeepAwayMove(distance: number, keepAwayDistance: number): KeepAwayMove {
  if (distance < keepAwayDistance - KEEP_AWAY_RETREAT_MARGIN) {
    return 'retreat';
  }

  if (distance > keepAwayDistance + KEEP_AWAY_APPROACH_MARGIN) {
    return 'approach';
  }

  return 'strafe';
}

/**
 * When the next telegraph should start so that summons land exactly
 * `summonCooldownMs` apart.
 *
 * The telegraph runs before the summon, so waiting a full cooldown and only then
 * starting it would stretch the real gap to cooldown + telegraph. The telegraph
 * is subtracted here instead, which keeps `summonCooldownMs` meaning what it
 * says: the interval between one summon and the next.
 *
 * A telegraph longer than the cooldown clamps to zero — the next telegraph
 * starts immediately, and the interval becomes the telegraph itself.
 */
export function getNextTelegraphAt(
  emitTime: number,
  summonCooldownMs: number,
  summonTelegraphMs: number,
): number {
  return emitTime + Math.max(0, summonCooldownMs - summonTelegraphMs);
}
