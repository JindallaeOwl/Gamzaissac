import { COMBAT_ROOM_TEMPLATES, type RoomTemplate } from '../data/rooms';
import { randomOf, type RandomSource } from '../utils/random';

/**
 * Combat template selection. Split from DungeonManager so the two rules that
 * fight repetition — floor gating and no-immediate-repeat — can be unit tested
 * without generating a dungeon.
 *
 * Repetition is the problem this exists for: a run visits ~44 combat rooms, so
 * with uniform random over a small pool the same layout used to come back 5.5
 * times on average, back-to-back once in four picks.
 */

/** Templates allowed on a floor. `minFloor` keeps gated enemies out of early floors. */
export function getCombatTemplatesForFloor(
  floor: number,
  templates: readonly RoomTemplate[] = COMBAT_ROOM_TEMPLATES,
): RoomTemplate[] {
  return templates.filter((template) => (template.minFloor ?? 1) <= floor);
}

/**
 * Picks the next combat template, never repeating the previous one back-to-back.
 *
 * Seeing the same room twice in a row is what makes a small pool feel small, so
 * the previous pick is excluded — unless it is the only candidate, where a
 * repeat beats crashing.
 */
export function pickCombatTemplate(
  floor: number,
  previousTemplateId: string | null,
  random: RandomSource,
  templates: readonly RoomTemplate[] = COMBAT_ROOM_TEMPLATES,
): RoomTemplate {
  const eligible = getCombatTemplatesForFloor(floor, templates);

  if (eligible.length === 0) {
    throw new Error(`No combat template available for floor ${floor}`);
  }

  const fresh = eligible.filter((template) => template.id !== previousTemplateId);

  return randomOf(fresh.length > 0 ? fresh : eligible, random);
}
