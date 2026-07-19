// Boss rooms only use stat-up items. ItemSystem also rejects attack-changing
// passives and ability unlocks if one is added here by mistake.
export const BOSS_REWARD_ITEM_IDS: readonly string[] = [
  'life-seed',
  'pulse-relay',
  'glass-fern',
  'feather-coil',
  'hot-pebble',
  'steady-pin',
  'moon-dial',
  'long-echo',
];
