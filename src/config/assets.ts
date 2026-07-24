export const TextureKeys = {
  player: 'player',
  playerHit: 'player-hit',
  playerIdle: 'player-idle',
  playerWalkA: 'player-walk-a',
  playerWalkMid: 'player-walk-mid',
  playerWalkB: 'player-walk-b',
  playerYellowIdle: 'player-yellow-idle',
  playerYellowWalk: 'player-yellow-walk',
  playerYellowHurt: 'player-yellow-hurt',
  playerYellowDeath: 'player-yellow-death',
  playerYellowShadow: 'player-yellow-shadow',
  playerYellowShadowDeath: 'player-yellow-shadow-death',
  playerExtraEyes: 'player-extra-eyes',
  playerToothpick: 'player-toothpick',
  playerSeed: 'player-seed',
  playerBullet: 'player-bullet',
  enemyBullet: 'enemy-bullet',
  enemyChaser: 'enemy-chaser',
  enemyShooter: 'enemy-shooter',
  enemyDasher: 'enemy-dasher',
  enemySplitter: 'enemy-splitter',
  enemySplitterling: 'enemy-splitterling',
  enemyBoss: 'enemy-boss',
  enemyRootKernel: 'enemy-root-kernel',
  doorHorizontal: 'door-horizontal',
  doorVertical: 'door-vertical',
  hudKey: 'hud-key',
  hudBomb: 'hud-bomb',
  hudCoin: 'hud-coin',
  hudHeart: 'hud-heart',
  hudStatMoveSpeed: 'hud-stat-move-speed',
  hudStatFireRate: 'hud-stat-fire-rate',
  hudStatDamage: 'hud-stat-damage',
  hudStatRange: 'hud-stat-range',
  hudStatProjectileSpeed: 'hud-stat-projectile-speed',
  hudStatLuck: 'hud-stat-luck',
  keyPickup: 'key-pickup',
  bombPickup: 'bomb-pickup',
  bombPlaced: 'bomb-placed',
  coinPickup: 'coin-pickup',
  fiveCoinPickup: 'five-coin-pickup',
  chestPickup: 'chest-pickup',
  chestOpenPickup: 'chest-open-pickup',
  floorExit: 'floor-exit',
  floorExitEscape: 'floor-exit-escape',
  floorTile: 'floor-tile',
  wall: 'wall',
  obstacleCrate: 'obstacle-crate',
  shopNpcIdleA: 'shop-npc-idle-a',
  shopNpcIdleB: 'shop-npc-idle-b',
  itemAnnouncementScroll: 'item-announcement-scroll',
} as const;

export const MusicKeys = {
  title: 'music-title',
  journey: 'music-journey',
  shop: 'music-shop',
  boss: 'music-boss',
} as const;

export const HUD_ICON_ASSETS = [
  { key: TextureKeys.hudHeart, path: 'assets/icons/nikoichu/hud-heart.png' },
  { key: TextureKeys.hudKey, path: 'assets/icons/nikoichu/hud-key.png' },
  { key: TextureKeys.hudBomb, path: 'assets/icons/nikoichu/hud-bomb.png' },
  { key: TextureKeys.hudCoin, path: 'assets/icons/nikoichu/hud-coin.png' },
  {
    key: TextureKeys.hudStatMoveSpeed,
    path: 'assets/icons/nikoichu/hud-stat-move-speed.png',
  },
  {
    key: TextureKeys.hudStatFireRate,
    path: 'assets/icons/nikoichu/hud-stat-fire-rate.png',
  },
  { key: TextureKeys.hudStatDamage, path: 'assets/icons/nikoichu/hud-stat-damage.png' },
  { key: TextureKeys.hudStatRange, path: 'assets/icons/nikoichu/hud-stat-range.png' },
  {
    key: TextureKeys.hudStatProjectileSpeed,
    path: 'assets/icons/nikoichu/hud-stat-projectile-speed.png',
  },
  { key: TextureKeys.hudStatLuck, path: 'assets/icons/nikoichu/hud-stat-luck.png' },
] as const;

export const ITEM_IMAGE_ASSETS = [
  {
    key: itemIconKey('red-mushroom'),
    path: 'assets/items/red-mushroom.png',
  },
] as const;

export const UI_IMAGE_ASSETS = [
  {
    key: TextureKeys.itemAnnouncementScroll,
    path: 'assets/ui/item-announcement-scroll.png',
  },
] as const;

export const PICKUP_SPRITESHEET_ASSETS = [
  {
    key: TextureKeys.chestPickup,
    path: 'assets/pickups/treasure-chest.png',
    frameWidth: 64,
    frameHeight: 64,
  },
] as const;

export const MUSIC_ASSETS = [
  { key: MusicKeys.title, path: 'assets/music/chajamakesmusic/start.ogg' },
  { key: MusicKeys.journey, path: 'assets/music/chajamakesmusic/journey.ogg' },
  { key: MusicKeys.shop, path: 'assets/music/chajamakesmusic/shop.ogg' },
  { key: MusicKeys.boss, path: 'assets/music/chajamakesmusic/boss-battle.ogg' },
] as const;

export const PLAYER_SPRITESHEET_ASSETS = [
  {
    key: TextureKeys.playerYellowIdle,
    path: 'assets/characters/snoblin-yellow/idle.png',
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: TextureKeys.playerYellowWalk,
    path: 'assets/characters/snoblin-yellow/walk.png',
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: TextureKeys.playerYellowHurt,
    path: 'assets/characters/snoblin-yellow/hurt.png',
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: TextureKeys.playerYellowDeath,
    path: 'assets/characters/snoblin-yellow/death.png',
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: TextureKeys.playerYellowShadowDeath,
    path: 'assets/characters/snoblin-yellow/shadow/shadow_death.png',
    frameWidth: 32,
    frameHeight: 32,
  },
] as const;

export const PLAYER_IMAGE_ASSETS = [
  {
    key: TextureKeys.playerYellowShadow,
    path: 'assets/characters/snoblin-yellow/shadow/shadow_static.png',
  },
] as const;

export const SHOP_NPC_IMAGE_ASSETS = [
  {
    key: TextureKeys.shopNpcIdleA,
    path: 'assets/npcs/potato-merchant/idle-a.png',
  },
  {
    key: TextureKeys.shopNpcIdleB,
    path: 'assets/npcs/potato-merchant/idle-b.png',
  },
] as const;

// Snoblin sheets are arranged top-to-bottom as down, side, then up.
// Left-facing movement reuses the side row with horizontal flipping.
export const PLAYER_DIRECTION_ROWS = {
  down: 0,
  side: 1,
  up: 2,
} as const;

export const AnimationKeys = {
  playerWalk: 'player-walk',
  playerIdleDown: 'player-idle-down',
  playerIdleUp: 'player-idle-up',
  playerIdleSide: 'player-idle-side',
  playerWalkDown: 'player-walk-down',
  playerWalkUp: 'player-walk-up',
  playerWalkSide: 'player-walk-side',
  playerHurtDown: 'player-hurt-down',
  playerHurtUp: 'player-hurt-up',
  playerHurtSide: 'player-hurt-side',
  playerDeathDown: 'player-death-down',
  playerDeathUp: 'player-death-up',
  playerDeathSide: 'player-death-side',
  playerShadowDeathDown: 'player-shadow-death-down',
  playerShadowDeathUp: 'player-shadow-death-up',
  playerShadowDeathSide: 'player-shadow-death-side',
  shopNpcIdle: 'shop-npc-idle',
} as const;

// Passive item pickups each get their own generated icon (see AssetFactory)
// so players can tell them apart by shape, not just tint color.
export function itemIconKey(itemId: string): string {
  return `item-icon-${itemId}`;
}
