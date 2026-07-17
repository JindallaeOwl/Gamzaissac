export const TextureKeys = {
  player: 'player',
  playerHit: 'player-hit',
  playerIdle: 'player-idle',
  playerWalkA: 'player-walk-a',
  playerWalkMid: 'player-walk-mid',
  playerWalkB: 'player-walk-b',
  playerExtraEyes: 'player-extra-eyes',
  playerToothpick: 'player-toothpick',
  playerSeed: 'player-seed',
  playerBullet: 'player-bullet',
  enemyBullet: 'enemy-bullet',
  enemyChaser: 'enemy-chaser',
  enemyShooter: 'enemy-shooter',
  enemyDasher: 'enemy-dasher',
  enemyBoss: 'enemy-boss',
  enemyRootKernel: 'enemy-root-kernel',
  doorHorizontal: 'door-horizontal',
  doorVertical: 'door-vertical',
  hudKey: 'hud-key',
  hudBomb: 'hud-bomb',
  hudCoin: 'hud-coin',
  keyPickup: 'key-pickup',
  bombPickup: 'bomb-pickup',
  bombPlaced: 'bomb-placed',
  coinPickup: 'coin-pickup',
  chestPickup: 'chest-pickup',
  floorExit: 'floor-exit',
  floorTile: 'floor-tile',
  wall: 'wall',
  obstacleCrate: 'obstacle-crate',
} as const;

export const HUD_ICON_ASSETS = [
  { key: TextureKeys.hudKey, path: 'assets/icons/nikoichu/hud-key.png' },
  { key: TextureKeys.hudBomb, path: 'assets/icons/nikoichu/hud-bomb.png' },
  { key: TextureKeys.hudCoin, path: 'assets/icons/nikoichu/hud-coin.png' },
] as const;

export const AnimationKeys = {
  playerWalk: 'player-walk',
} as const;

// Passive item pickups each get their own generated icon (see AssetFactory)
// so players can tell them apart by shape, not just tint color.
export function itemIconKey(itemId: string): string {
  return `item-icon-${itemId}`;
}
