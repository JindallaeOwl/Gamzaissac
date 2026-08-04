import type { RandomSource } from '../utils/random';

/**
 * Geometry for the Flanker, an enemy that refuses to close in a straight line.
 * It steers to a point on a ring around the player, offset to one side, and only
 * lunges once it has actually reached that offset. Backing away in a straight
 * line therefore stops being a safe answer.
 *
 * All of it is plain maths so the behaviour can be tested without a scene. The
 * enemy class owns the state machine; this module only answers "where should it
 * be" and "may it lunge yet".
 */

export interface FlankPoint {
  x: number;
  y: number;
}

export interface FlankBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** -1 and 1 are the two ways around the player; neither is "correct". */
export type FlankSide = -1 | 1;

/**
 * Below this difference in clamping distortion the two sides are treated as
 * equally good, so the choice falls to the random source instead of always
 * favouring one side on a near-tie.
 */
export const FLANK_SIDE_TIE_EPSILON = 2;

/** Folds any angle back into -PI..PI so comparisons never straddle the seam. */
export function wrapAngle(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

/**
 * The bearing the Flanker wants to hold, measured from the player outward.
 *
 * Computed once when circling begins and then kept. Recomputing it every frame
 * would push the goal ahead of the enemy as it moves, and it would circle
 * forever without ever arriving.
 */
export function computeFlankGoalAngle(
  enemy: FlankPoint,
  player: FlankPoint,
  side: FlankSide,
  arcRadians: number,
): number {
  const bearing = Math.atan2(enemy.y - player.y, enemy.x - player.x);

  return wrapAngle(bearing + side * arcRadians);
}

/**
 * The point on the ring for a held goal angle, pulled inside the room.
 *
 * Clamping here rather than leaning on constrainToRoom matters: a target outside
 * the wall would leave the enemy grinding against it, never arriving, with the
 * state machine stuck in circling.
 */
export function computeFlankTarget(
  player: FlankPoint,
  goalAngle: number,
  ringRadius: number,
  bounds: FlankBounds,
  margin: number,
): FlankPoint {
  return {
    x: clamp(
      player.x + Math.cos(goalAngle) * ringRadius,
      bounds.left + margin,
      bounds.right - margin,
    ),
    y: clamp(
      player.y + Math.sin(goalAngle) * ringRadius,
      bounds.top + margin,
      bounds.bottom - margin,
    ),
  };
}

/**
 * The bearing of the target the enemy is actually driving at.
 *
 * Against a wall the clamped target no longer sits on the held goal angle, so
 * checking the lunge against the original angle would reject a Flanker that has
 * genuinely arrived — it would circle forever in exactly the corners where the
 * player is most cornered. Angle checks use this value instead.
 *
 * Returns zero for the degenerate case of a target on top of the player, which
 * can only happen if the room is narrower than the body margin.
 */
export function computeEffectiveGoalAngle(player: FlankPoint, target: FlankPoint): number {
  return Math.atan2(target.y - player.y, target.x - player.x);
}

/** Signed -PI..PI gap between where the enemy is and where it wants to be. */
export function computeFlankAngleError(
  enemy: FlankPoint,
  player: FlankPoint,
  effectiveGoalAngle: number,
): number {
  const bearing = Math.atan2(enemy.y - player.y, enemy.x - player.x);

  return wrapAngle(bearing - effectiveGoalAngle);
}

/** How far a side's ring point has to be dragged to fit inside the room. */
function flankDistortion(
  player: FlankPoint,
  goalAngle: number,
  ringRadius: number,
  bounds: FlankBounds,
  margin: number,
): number {
  const rawX = player.x + Math.cos(goalAngle) * ringRadius;
  const rawY = player.y + Math.sin(goalAngle) * ringRadius;
  const target = computeFlankTarget(player, goalAngle, ringRadius, bounds, margin);

  return Math.hypot(rawX - target.x, rawY - target.y);
}

/**
 * Which way around the player to travel. The side whose ring point survives the
 * room bounds better wins, so a Flanker facing a wall swings into open floor
 * rather than into the wall it cannot reach.
 */
export function pickFlankSide(
  enemy: FlankPoint,
  player: FlankPoint,
  ringRadius: number,
  arcRadians: number,
  bounds: FlankBounds,
  margin: number,
  random: RandomSource,
): FlankSide {
  const distortionFor = (side: FlankSide): number =>
    flankDistortion(
      player,
      computeFlankGoalAngle(enemy, player, side, arcRadians),
      ringRadius,
      bounds,
      margin,
    );

  const counterClockwise = distortionFor(-1);
  const clockwise = distortionFor(1);

  if (Math.abs(counterClockwise - clockwise) < FLANK_SIDE_TIE_EPSILON) {
    return random() < 0.5 ? -1 : 1;
  }

  return counterClockwise < clockwise ? -1 : 1;
}

/** Flips to the other way around the player. */
export function oppositeFlankSide(side: FlankSide): FlankSide {
  return side === 1 ? -1 : 1;
}

export interface StallCheck {
  distanceToTarget: number;
  /** Distance recorded the last time progress was sampled. */
  checkpointDistance: number;
  time: number;
  checkpointAt: number;
  windowMs: number;
  minProgress: number;
}

/**
 * True when the enemy has spent a whole window barely closing on its target.
 *
 * Obstacles are solid to enemies, and a Flanker holds one goal angle for over a
 * second, so a crate in the way leaves it grinding for the full hold. Noticing
 * the lack of progress lets it give up early instead of pushing the crate.
 */
export function hasStalledTowardTarget(check: StallCheck): boolean {
  return (
    check.time - check.checkpointAt >= check.windowMs &&
    check.checkpointDistance - check.distanceToTarget < check.minProgress
  );
}

export interface BlockedAxes {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/**
 * A unit step perpendicular to whichever axis is obstructed, signed toward the
 * goal so the detour still makes progress. Slipping sideways is what clears the
 * corner of a crate that a head-on push never will.
 *
 * Returns null when nothing is blocking, and also when both axes are — wedged in
 * a corner no perpendicular exists, and the stall retarget handles it instead.
 */
export function computeSlideDirection(
  blocked: BlockedAxes,
  goalDirection: FlankPoint,
): FlankPoint | null {
  const horizontallyBlocked = blocked.left || blocked.right;
  const verticallyBlocked = blocked.up || blocked.down;

  if (horizontallyBlocked === verticallyBlocked) {
    return null;
  }

  if (horizontallyBlocked) {
    return { x: 0, y: goalDirection.y >= 0 ? 1 : -1 };
  }

  return { x: goalDirection.x >= 0 ? 1 : -1, y: 0 };
}

export interface LungeCommitCheck {
  distanceToTarget: number;
  angleError: number;
  distanceToPlayer: number;
  arrivalTolerance: number;
  angleTolerance: number;
  lungeRange: number;
  time: number;
  nextLungeAt: number;
}

/**
 * All four gates must open. Distance to the player alone is deliberately not
 * enough — that is what would turn the Flanker back into a slow Chaser.
 */
export function shouldCommitLunge(check: LungeCommitCheck): boolean {
  return (
    check.distanceToTarget <= check.arrivalTolerance &&
    Math.abs(check.angleError) <= check.angleTolerance &&
    check.distanceToPlayer <= check.lungeRange &&
    check.time >= check.nextLungeAt
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
