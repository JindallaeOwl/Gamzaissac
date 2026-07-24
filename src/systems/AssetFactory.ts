import Phaser from 'phaser';
import { AnimationKeys, itemIconKey, PLAYER_DIRECTION_ROWS, TextureKeys } from '../config/assets';
import { PASSIVE_ITEMS, type ItemCategory } from '../data/items';
import {
  buildChaser,
  buildDasher,
  buildShooter,
  buildSplitter,
  buildSplitterling,
  drawEnemyTexture,
} from './enemyPixelSprites';

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  createPlayerFrameTexture(scene, TextureKeys.player, 0, 0, 0, false);
  createPlayerFrameTexture(scene, TextureKeys.playerHit, 0, 0, 0, true);
  createPlayerFrameTexture(scene, TextureKeys.playerIdle, 0, 0, 0, false);
  createPlayerFrameTexture(scene, TextureKeys.playerWalkA, -4, 4, -1, false);
  createPlayerFrameTexture(scene, TextureKeys.playerWalkMid, 0, 0, 0, false);
  createPlayerFrameTexture(scene, TextureKeys.playerWalkB, 4, -4, -1, false);
  createPlayerCosmeticTextures(scene);
  createSeedTexture(scene);
  createBulletTexture(scene, TextureKeys.playerBullet, 8, 0xe8ffff, 0x58e8ed, 0x104954);
  createBulletTexture(scene, TextureKeys.enemyBullet, 8, 0xfff0b8, 0xff8b3d, 0x681f1c);
  createChaserTexture(scene);
  createShooterTexture(scene);
  createDasherTexture(scene);
  createSplitterTexture(scene);
  createSplitterlingTexture(scene);
  createBossTexture(scene);
  createRootKernelTexture(scene);
  createDoorTexture(scene, TextureKeys.doorHorizontal, 48, 16);
  createDoorTexture(scene, TextureKeys.doorVertical, 16, 48);
  createPassiveItemIcons(scene);
  createKeyTexture(scene);
  createBombTexture(scene);
  createPlacedBombTexture(scene);
  createCoinTexture(scene);
  createFiveCoinTexture(scene);
  createChestTexture(scene);
  createFloorExitTexture(scene);
  createFloorExitEscapeTexture(scene);
  createFloorTile(scene);
  createWallTexture(scene);
  createObstacleTexture(scene);
}

function createPlayerCosmeticTextures(scene: Phaser.Scene): void {
  const eyes = scene.add.graphics();
  eyes.fillStyle(0xf7dca5, 1);
  eyes.fillCircle(5, 5, 4);
  eyes.fillCircle(15, 5, 4);
  eyes.fillStyle(0x4b2919, 1);
  eyes.fillCircle(5, 6, 2);
  eyes.fillCircle(15, 6, 2);
  eyes.generateTexture(TextureKeys.playerExtraEyes, 20, 10);
  eyes.destroy();

  const toothpick = scene.add.graphics();
  toothpick.lineStyle(3, 0xf6d59a, 1);
  toothpick.lineBetween(3, 17, 13, 2);
  toothpick.fillStyle(0xfff0bd, 1);
  toothpick.fillTriangle(12, 1, 15, 0, 13, 4);
  toothpick.generateTexture(TextureKeys.playerToothpick, 16, 19);
  toothpick.destroy();
}

function createSeedTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x07110a, 0.35);
  graphics.fillEllipse(4, 5, 8, 5);
  graphics.fillStyle(0x79cf52, 1);
  graphics.lineStyle(1, 0x214f28, 1);
  graphics.fillEllipse(4, 4, 7, 5);
  graphics.strokeEllipse(4, 4, 7, 5);
  graphics.fillStyle(0xc7f28c, 1);
  graphics.fillRect(2, 2, 2, 1);
  graphics.generateTexture(TextureKeys.playerSeed, 8, 8);
  graphics.destroy();
}

export function createPlaceholderAnimations(scene: Phaser.Scene): void {
  createYellowPlayerAnimations(scene);
  createShopNpcAnimation(scene);

  if (scene.anims.exists(AnimationKeys.playerWalk)) {
    return;
  }

  scene.anims.create({
    key: AnimationKeys.playerWalk,
    frames: [
      { key: TextureKeys.playerWalkA },
      { key: TextureKeys.playerWalkMid },
      { key: TextureKeys.playerWalkB },
      { key: TextureKeys.playerWalkMid },
    ],
    frameRate: 9,
    repeat: -1,
  });
}

function createShopNpcAnimation(scene: Phaser.Scene): void {
  if (
    scene.anims.exists(AnimationKeys.shopNpcIdle) ||
    !scene.textures.exists(TextureKeys.shopNpcIdleA) ||
    !scene.textures.exists(TextureKeys.shopNpcIdleB)
  ) {
    return;
  }

  scene.anims.create({
    key: AnimationKeys.shopNpcIdle,
    frames: [{ key: TextureKeys.shopNpcIdleA }, { key: TextureKeys.shopNpcIdleB }],
    frameRate: 3,
    repeat: -1,
  });
}

function createYellowPlayerAnimations(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TextureKeys.playerYellowIdle)) {
    return;
  }

  const { down, side, up } = PLAYER_DIRECTION_ROWS;
  const animationDefinitions = [
    [AnimationKeys.playerIdleDown, TextureKeys.playerYellowIdle, down * 2, down * 2 + 1, 3, -1],
    [AnimationKeys.playerIdleUp, TextureKeys.playerYellowIdle, up * 2, up * 2 + 1, 3, -1],
    [AnimationKeys.playerIdleSide, TextureKeys.playerYellowIdle, side * 2, side * 2 + 1, 3, -1],
    [AnimationKeys.playerWalkDown, TextureKeys.playerYellowWalk, down * 4, down * 4 + 3, 9, -1],
    [AnimationKeys.playerWalkUp, TextureKeys.playerYellowWalk, up * 4, up * 4 + 3, 9, -1],
    [AnimationKeys.playerWalkSide, TextureKeys.playerYellowWalk, side * 4, side * 4 + 3, 9, -1],
    [AnimationKeys.playerHurtDown, TextureKeys.playerYellowHurt, down * 2, down * 2 + 1, 8, 0],
    [AnimationKeys.playerHurtUp, TextureKeys.playerYellowHurt, up * 2, up * 2 + 1, 8, 0],
    [AnimationKeys.playerHurtSide, TextureKeys.playerYellowHurt, side * 2, side * 2 + 1, 8, 0],
    [AnimationKeys.playerDeathDown, TextureKeys.playerYellowDeath, down * 3, down * 3 + 2, 6, 0],
    [AnimationKeys.playerDeathUp, TextureKeys.playerYellowDeath, up * 3, up * 3 + 2, 6, 0],
    [AnimationKeys.playerDeathSide, TextureKeys.playerYellowDeath, side * 3, side * 3 + 2, 6, 0],
    [
      AnimationKeys.playerShadowDeathDown,
      TextureKeys.playerYellowShadowDeath,
      down * 3,
      down * 3 + 2,
      6,
      0,
    ],
    [
      AnimationKeys.playerShadowDeathUp,
      TextureKeys.playerYellowShadowDeath,
      up * 3,
      up * 3 + 2,
      6,
      0,
    ],
    [
      AnimationKeys.playerShadowDeathSide,
      TextureKeys.playerYellowShadowDeath,
      side * 3,
      side * 3 + 2,
      6,
      0,
    ],
  ] as const;

  for (const [key, texture, start, end, frameRate, repeat] of animationDefinitions) {
    if (scene.anims.exists(key)) {
      continue;
    }

    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(texture, { start, end }),
      frameRate,
      repeat,
    });
  }
}

function createPlayerFrameTexture(
  scene: Phaser.Scene,
  key: string,
  leftFootOffset: number,
  rightFootOffset: number,
  bodyBob: number,
  hit: boolean,
): void {
  const graphics = scene.add.graphics();
  const bodyY = 25 + bodyBob;
  const leftFootX = 17 + leftFootOffset;
  const rightFootX = 31 + rightFootOffset;

  graphics.fillStyle(0x05090e, 0.38);
  graphics.fillEllipse(24, 52, 36, 7);

  // Two separate legs and feet move in opposite directions on walk frames.
  graphics.lineStyle(3, 0x5f341d, 1);
  graphics.lineBetween(18, bodyY + 18, leftFootX, 49);
  graphics.lineBetween(30, bodyY + 18, rightFootX, 49);
  graphics.fillStyle(0x754324, 1);
  graphics.fillEllipse(leftFootX, 50, 9, 5);
  graphics.fillEllipse(rightFootX, 50, 9, 5);

  // Small arms keep the silhouette readable without copying the reference art.
  graphics.lineStyle(3, 0x6b3a20, 1);
  graphics.lineBetween(8, bodyY + 2, 3, bodyY + 10);
  graphics.lineBetween(40, bodyY + 2, 45, bodyY + 9);
  graphics.fillCircle(3, bodyY + 11, 2);
  graphics.fillCircle(45, bodyY + 10, 2);

  const skin = hit ? 0xd98a73 : 0xc98a4d;
  const outline = hit ? 0x7a3028 : 0x6b3a20;
  graphics.fillStyle(skin, 1);
  graphics.lineStyle(3, outline, 1);
  graphics.fillEllipse(24, bodyY, 35, 43);
  graphics.strokeEllipse(24, bodyY, 35, 43);

  // Warm highlights and irregular peel marks make it read as a potato.
  graphics.fillStyle(hit ? 0xf0b49e : 0xe1ad6c, 0.9);
  graphics.fillEllipse(17, bodyY - 10, 11, 8);
  graphics.fillEllipse(30, bodyY + 10, 12, 7);
  graphics.fillStyle(0x9a5c31, 0.85);
  graphics.fillCircle(33, bodyY - 12, 2);
  graphics.fillCircle(13, bodyY + 9, 2);
  graphics.fillCircle(35, bodyY + 5, 1.5);
  graphics.fillCircle(20, bodyY + 15, 1.5);

  graphics.fillStyle(0x4b2919, 1);
  graphics.fillCircle(17, bodyY - 1, 3);
  graphics.fillCircle(31, bodyY - 1, 3);
  graphics.fillStyle(0xffe6ba, 1);
  graphics.fillCircle(18, bodyY - 2, 1);
  graphics.fillCircle(32, bodyY - 2, 1);

  graphics.fillStyle(hit ? 0xff7f87 : 0xe97f86, 0.75);
  graphics.fillEllipse(11, bodyY + 5, 7, 4);
  graphics.fillEllipse(37, bodyY + 5, 7, 4);
  graphics.lineStyle(2, 0x4b2919, 1);
  graphics.lineBetween(21, bodyY + 5, 23, bodyY + 7);
  graphics.lineBetween(23, bodyY + 7, 26, bodyY + 7);
  graphics.lineBetween(26, bodyY + 7, 28, bodyY + 5);

  graphics.generateTexture(key, 48, 56);
  graphics.destroy();
}

function createBulletTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  core: number,
  fill: number,
  stroke: number,
): void {
  const half = size / 2;
  const graphics = scene.add.graphics();
  graphics.fillStyle(fill, 0.22);
  graphics.fillCircle(half, half, half);
  graphics.fillStyle(fill, 1);
  graphics.fillCircle(half, half, half - 2);
  graphics.lineStyle(2, stroke, 1);
  graphics.strokeCircle(half, half, half - 2);
  graphics.fillStyle(core, 1);
  graphics.fillCircle(half - 1, half - 1, Math.max(2, half - 4));
  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

function createChaserTexture(scene: Phaser.Scene): void {
  drawEnemyTexture(scene, TextureKeys.enemyChaser, buildChaser);
}

function createShooterTexture(scene: Phaser.Scene): void {
  drawEnemyTexture(scene, TextureKeys.enemyShooter, buildShooter);
}

function createDasherTexture(scene: Phaser.Scene): void {
  drawEnemyTexture(scene, TextureKeys.enemyDasher, buildDasher);
}

function createSplitterTexture(scene: Phaser.Scene): void {
  drawEnemyTexture(scene, TextureKeys.enemySplitter, buildSplitter);
}

function createSplitterlingTexture(scene: Phaser.Scene): void {
  drawEnemyTexture(scene, TextureKeys.enemySplitterling, buildSplitterling);
}

function createBossTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x05090e, 0.5);
  graphics.fillEllipse(38, 70, 60, 10);
  graphics.fillStyle(0x3f5966, 1);
  graphics.lineStyle(5, 0xe9b94e, 1);
  graphics.fillRoundedRect(4, 4, 68, 68, 10);
  graphics.strokeRoundedRect(4, 4, 68, 68, 10);
  graphics.fillStyle(0x263944, 1);
  graphics.fillRoundedRect(11, 11, 54, 50, 7);
  graphics.lineStyle(2, 0x78909b, 0.8);
  graphics.strokeRoundedRect(11, 11, 54, 50, 7);
  graphics.fillStyle(0x111920, 1);
  graphics.fillRect(18, 22, 12, 12);
  graphics.fillRect(46, 22, 12, 12);
  graphics.fillStyle(0xffd166, 1);
  graphics.fillCircle(24, 28, 3);
  graphics.fillCircle(52, 28, 3);
  graphics.fillStyle(0x10151c, 1);
  graphics.fillCircle(38, 45, 13);
  graphics.lineStyle(3, 0xff6687, 1);
  graphics.strokeCircle(38, 45, 10);
  graphics.lineBetween(38, 35, 38, 55);
  graphics.lineBetween(28, 45, 48, 45);
  graphics.fillStyle(0xff6687, 1);
  graphics.fillCircle(38, 45, 4);
  graphics.lineStyle(2, 0xe9b94e, 0.8);
  graphics.lineBetween(8, 18, 16, 18);
  graphics.lineBetween(60, 18, 68, 18);
  graphics.lineBetween(8, 58, 16, 58);
  graphics.lineBetween(60, 58, 68, 58);
  graphics.generateTexture(TextureKeys.enemyBoss, 76, 76);
  graphics.destroy();
}

function createRootKernelTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x05090e, 0.48);
  graphics.fillEllipse(40, 73, 62, 9);

  graphics.lineStyle(6, 0x173c2a, 1);
  graphics.lineBetween(14, 31, 3, 22);
  graphics.lineBetween(66, 30, 77, 17);
  graphics.lineBetween(17, 61, 5, 72);
  graphics.lineBetween(64, 59, 77, 70);
  graphics.lineStyle(2, 0x65d58a, 0.9);
  graphics.lineBetween(14, 31, 3, 22);
  graphics.lineBetween(66, 30, 77, 17);
  graphics.lineBetween(17, 61, 5, 72);
  graphics.lineBetween(64, 59, 77, 70);

  graphics.fillStyle(0x315d3d, 1);
  graphics.fillRect(14, 15, 48, 48);
  graphics.fillRect(9, 25, 60, 28);
  graphics.fillRect(20, 10, 31, 58);
  graphics.fillStyle(0x48794d, 1);
  graphics.fillRect(15, 18, 12, 11);
  graphics.fillRect(52, 25, 13, 17);
  graphics.fillRect(23, 54, 15, 11);
  graphics.lineStyle(3, 0x142b20, 1);
  graphics.strokeRect(14, 15, 48, 48);
  graphics.strokeRect(9, 25, 60, 28);

  graphics.fillStyle(0x0b1714, 1);
  graphics.fillRect(25, 25, 31, 30);
  graphics.fillStyle(0x2cc9bd, 1);
  graphics.fillRect(29, 29, 23, 22);
  graphics.fillStyle(0xa6fff0, 1);
  graphics.fillRect(33, 32, 8, 6);
  graphics.fillStyle(0x116b68, 1);
  graphics.fillRect(43, 40, 7, 9);

  graphics.fillStyle(0xb5df70, 1);
  graphics.fillRect(18, 34, 4, 8);
  graphics.fillRect(58, 45, 5, 5);
  graphics.fillRect(37, 14, 7, 4);
  graphics.fillStyle(0x17291f, 1);
  graphics.fillRect(19, 56, 6, 5);
  graphics.fillRect(55, 18, 5, 7);

  graphics.generateTexture(TextureKeys.enemyRootKernel, 80, 80);
  graphics.destroy();
}

function createDoorTexture(scene: Phaser.Scene, key: string, width: number, height: number): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x111820, 1);
  graphics.fillRoundedRect(0, 0, width, height, 5);
  graphics.lineStyle(4, 0x667988, 1);
  graphics.strokeRoundedRect(2, 2, width - 4, height - 4, 5);
  graphics.lineStyle(2, 0xf0c85a, 0.95);

  if (width > height) {
    graphics.lineBetween(10, height / 2, width - 10, height / 2);
    graphics.fillStyle(0x2b3843, 1);
    graphics.fillRect(width / 2 - 5, 4, 10, height - 8);
  } else {
    graphics.lineBetween(width / 2, 10, width / 2, height - 10);
    graphics.fillStyle(0x2b3843, 1);
    graphics.fillRect(4, height / 2 - 5, width - 8, 10);
  }

  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

// Placeholder icons: a tinted badge circle plus a shape hinting at the
// item's effect, so pickups read as distinct even before real pixel art
// replaces them (only tint currently distinguishes them, which is hard to
// tell apart at a glance).
function createPassiveItemIcons(scene: Phaser.Scene): void {
  for (const item of PASSIVE_ITEMS) {
    if (!scene.textures.exists(itemIconKey(item.id))) {
      createItemIcon(scene, item.id, item.tint, item.category);
    }
  }
}

function createItemIcon(
  scene: Phaser.Scene,
  id: string,
  tint: number,
  category: ItemCategory,
): void {
  const symbolColor = 0x10151c;
  const graphics = scene.add.graphics();

  graphics.fillStyle(tint, 1);
  graphics.fillCircle(16, 16, 14);
  graphics.lineStyle(2, symbolColor, 0.5);
  graphics.strokeCircle(16, 16, 14);

  drawItemSymbol(graphics, id, symbolColor, tint, category);

  graphics.generateTexture(itemIconKey(id), 32, 32);
  graphics.destroy();
}

function drawItemSymbol(
  graphics: Phaser.GameObjects.Graphics,
  id: string,
  color: number,
  tint: number,
  category: ItemCategory,
): void {
  switch (id) {
    case 'red-mushroom': {
      // maximum health: a simple heart-shaped seed
      graphics.fillStyle(color, 1);
      graphics.fillCircle(12, 13, 6);
      graphics.fillCircle(20, 13, 6);
      graphics.fillTriangle(7, 14, 25, 14, 16, 26);
      break;
    }
    case 'pulse-relay': {
      // fire rate: two small ">" chevrons, rapid-fire cue
      graphics.fillStyle(color, 1);
      graphics.fillTriangle(9, 9, 9, 23, 15, 16);
      graphics.fillTriangle(17, 9, 17, 23, 23, 16);
      break;
    }
    case 'glass-fern': {
      // damage: a single sharp upward shard
      graphics.fillStyle(color, 1);
      graphics.fillTriangle(16, 7, 24, 24, 8, 24);
      break;
    }
    case 'feather-coil': {
      // move speed: one bold forward "play" arrow
      graphics.fillStyle(color, 1);
      graphics.fillTriangle(10, 8, 10, 24, 23, 16);
      break;
    }
    case 'hot-pebble': {
      // range + projectile speed + damage: a small flame
      graphics.fillStyle(color, 1);
      graphics.fillTriangle(16, 8, 22, 22, 10, 22);
      graphics.fillCircle(16, 23, 4);
      break;
    }
    case 'pocket-battery': {
      // health: a medical cross
      graphics.fillStyle(color, 1);
      graphics.fillRect(13, 8, 6, 16);
      graphics.fillRect(8, 13, 16, 6);
      break;
    }
    case 'steady-pin': {
      // fire rate + projectile speed: a steady crosshair
      graphics.lineStyle(2, color, 1);
      graphics.strokeCircle(16, 16, 7);
      graphics.lineBetween(16, 5, 16, 27);
      graphics.lineBetween(5, 16, 27, 16);
      break;
    }
    case 'moon-dial': {
      // luck: a crescent moon (dark circle bitten by a badge-colored one)
      graphics.fillStyle(color, 1);
      graphics.fillCircle(15, 16, 8);
      graphics.fillStyle(tint, 1);
      graphics.fillCircle(19, 13, 8);
      break;
    }
    case 'long-echo': {
      // range: concentric ripples
      graphics.lineStyle(2, color, 1);
      graphics.strokeCircle(16, 16, 4);
      graphics.strokeCircle(16, 16, 8);
      graphics.strokeCircle(16, 16, 12);
      break;
    }
    case 'prism-lance': {
      // charge beam ability: a prism with a beam line through it
      graphics.fillStyle(color, 1);
      graphics.beginPath();
      graphics.moveTo(16, 6);
      graphics.lineTo(25, 16);
      graphics.lineTo(16, 26);
      graphics.lineTo(7, 16);
      graphics.closePath();
      graphics.fillPath();
      graphics.lineStyle(2, tint, 1);
      graphics.lineBetween(9, 16, 23, 16);
      break;
    }
    case 'quad-shot': {
      graphics.fillStyle(color, 1);
      graphics.fillCircle(11, 11, 3);
      graphics.fillCircle(21, 11, 3);
      graphics.fillCircle(11, 21, 3);
      graphics.fillCircle(21, 21, 3);
      break;
    }
    case 'mega-seed': {
      graphics.fillStyle(color, 1);
      graphics.fillEllipse(16, 16, 18, 12);
      graphics.lineStyle(2, tint, 1);
      graphics.lineBetween(11, 11, 21, 21);
      break;
    }
    case 'toothpick': {
      graphics.lineStyle(4, color, 1);
      graphics.lineBetween(9, 24, 23, 8);
      graphics.fillStyle(color, 1);
      graphics.fillTriangle(21, 7, 26, 5, 24, 10);
      break;
    }
    default: {
      drawCategorySymbol(graphics, category, color);
    }
  }
}

function drawCategorySymbol(
  graphics: Phaser.GameObjects.Graphics,
  category: ItemCategory,
  color: number,
): void {
  graphics.fillStyle(color, 1);

  if (category === 'offense') {
    graphics.fillTriangle(16, 6, 25, 24, 7, 24);
    graphics.fillCircle(16, 18, 3);
    return;
  }

  if (category === 'defense') {
    graphics.beginPath();
    graphics.moveTo(16, 6);
    graphics.lineTo(25, 10);
    graphics.lineTo(22, 23);
    graphics.lineTo(16, 27);
    graphics.lineTo(10, 23);
    graphics.lineTo(7, 10);
    graphics.closePath();
    graphics.fillPath();
    return;
  }

  if (category === 'utility') {
    graphics.fillTriangle(7, 16, 18, 7, 18, 12);
    graphics.fillRect(15, 12, 10, 8);
    graphics.fillTriangle(18, 20, 18, 25, 7, 16);
    return;
  }

  graphics.fillCircle(11, 16, 5);
  graphics.fillCircle(21, 16, 5);
  graphics.fillRect(11, 11, 10, 10);
}

function createKeyTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x05090e, 0.4);
  graphics.fillEllipse(18, 28, 28, 5);
  graphics.lineStyle(8, 0x143f4d, 0.55);
  graphics.strokeCircle(12, 16, 8);
  graphics.lineStyle(5, 0x8bd3ff, 1);
  graphics.strokeCircle(12, 16, 7);
  graphics.lineBetween(19, 16, 31, 16);
  graphics.lineBetween(26, 16, 26, 23);
  graphics.lineBetween(31, 16, 31, 21);
  graphics.generateTexture(TextureKeys.keyPickup, 36, 32);
  graphics.destroy();
}

function createBombTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x05090e, 0.4);
  graphics.fillEllipse(18, 32, 28, 5);
  graphics.fillStyle(0x323946, 1);
  graphics.fillCircle(17, 19, 12);
  graphics.lineStyle(3, 0xff8f70, 1);
  graphics.strokeCircle(17, 19, 11);
  graphics.lineStyle(3, 0xf7f3e8, 1);
  graphics.lineBetween(22, 10, 28, 4);
  graphics.fillStyle(0xffd166, 1);
  graphics.fillCircle(30, 3, 3);
  graphics.generateTexture(TextureKeys.bombPickup, 36, 36);
  graphics.destroy();
}

function createPlacedBombTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x202630, 1);
  graphics.fillCircle(20, 22, 15);
  graphics.lineStyle(4, 0xffb35a, 1);
  graphics.strokeCircle(20, 22, 13);
  graphics.fillStyle(0xff6b4a, 1);
  graphics.fillCircle(31, 5, 4);
  graphics.lineStyle(4, 0xf7d774, 1);
  graphics.lineBetween(25, 12, 30, 7);
  graphics.generateTexture(TextureKeys.bombPlaced, 40, 40);
  graphics.destroy();
}

function createCoinTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x05090e, 0.4);
  graphics.fillEllipse(16, 29, 25, 5);
  graphics.fillStyle(0xffd166, 1);
  graphics.fillCircle(16, 16, 12);
  graphics.lineStyle(3, 0x7d5f1a, 1);
  graphics.strokeCircle(16, 16, 10);
  graphics.lineStyle(2, 0xffffff, 0.65);
  graphics.lineBetween(16, 8, 16, 24);
  graphics.generateTexture(TextureKeys.coinPickup, 32, 32);
  graphics.destroy();
}

function createFiveCoinTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x05090e, 0.45);
  graphics.fillEllipse(16, 29, 25, 5);
  graphics.fillStyle(0x15191f, 1);
  graphics.fillCircle(16, 16, 12);
  graphics.lineStyle(3, 0xaeb7c2, 1);
  graphics.strokeCircle(16, 16, 10);
  graphics.fillStyle(0xe7edf5, 1);
  graphics.fillRect(12, 9, 8, 2);
  graphics.fillRect(12, 9, 2, 7);
  graphics.fillRect(12, 14, 7, 2);
  graphics.fillRect(18, 14, 2, 7);
  graphics.fillRect(12, 20, 8, 2);
  graphics.generateTexture(TextureKeys.fiveCoinPickup, 32, 32);
  graphics.destroy();
}

function createChestTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.chestPickup)) {
    return;
  }

  const closed = scene.add.graphics();
  closed.fillStyle(0x05090e, 0.48);
  closed.fillRect(5, 29, 22, 2);
  closed.fillStyle(0x28140f, 1);
  closed.fillRect(5, 6, 22, 22);
  closed.fillRect(3, 10, 26, 15);
  closed.fillStyle(0xe6a61f, 1);
  closed.fillRect(6, 7, 20, 19);
  closed.fillStyle(0x6e3025, 1);
  closed.fillRect(8, 9, 16, 7);
  closed.fillRect(8, 19, 16, 5);
  closed.fillStyle(0x39191a, 1);
  closed.fillRect(8, 14, 16, 4);
  closed.fillStyle(0xffd65a, 1);
  closed.fillRect(8, 7, 3, 19);
  closed.fillRect(21, 7, 3, 19);
  closed.fillRect(4, 16, 24, 3);
  closed.fillStyle(0xffefb0, 1);
  closed.fillRect(14, 15, 4, 7);
  closed.fillStyle(0x55301c, 1);
  closed.fillRect(15, 18, 2, 3);
  closed.fillStyle(0xe6a61f, 1);
  closed.fillRect(5, 26, 4, 3);
  closed.fillRect(23, 26, 4, 3);
  closed.generateTexture(TextureKeys.chestPickup, 32, 32);
  closed.destroy();

  const opened = scene.add.graphics();
  opened.fillStyle(0x05090e, 0.48);
  opened.fillRect(4, 29, 24, 2);
  opened.fillStyle(0x28140f, 1);
  opened.fillRect(7, 2, 18, 3);
  opened.fillRect(5, 5, 22, 10);
  opened.fillStyle(0xe6a61f, 1);
  opened.fillRect(8, 3, 16, 2);
  opened.fillRect(6, 6, 20, 7);
  opened.fillStyle(0x6e3025, 1);
  opened.fillRect(8, 7, 16, 4);
  opened.fillStyle(0xffd65a, 1);
  opened.fillRect(10, 5, 3, 9);
  opened.fillRect(20, 5, 3, 9);
  opened.fillStyle(0x28140f, 1);
  opened.fillRect(4, 15, 24, 14);
  opened.fillRect(2, 18, 28, 8);
  opened.fillStyle(0xe6a61f, 1);
  opened.fillRect(5, 17, 22, 10);
  opened.fillStyle(0x130c0d, 1);
  opened.fillRect(7, 17, 18, 5);
  opened.fillStyle(0x6e3025, 1);
  opened.fillRect(7, 23, 18, 3);
  opened.fillStyle(0xffd65a, 1);
  opened.fillRect(5, 21, 22, 3);
  opened.fillStyle(0xffefb0, 1);
  opened.fillRect(14, 20, 4, 6);
  opened.fillStyle(0x55301c, 1);
  opened.fillRect(15, 22, 2, 3);
  opened.fillStyle(0xe6a61f, 1);
  opened.fillRect(4, 27, 4, 3);
  opened.fillRect(24, 27, 4, 3);
  opened.generateTexture(TextureKeys.chestOpenPickup, 32, 32);
  opened.destroy();
}

function createFloorExitTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x020407, 0.55);
  graphics.fillEllipse(32, 24, 62, 30);
  graphics.fillStyle(0x05080d, 1);
  graphics.fillEllipse(32, 20, 54, 25);
  graphics.lineStyle(4, 0x65727d, 1);
  graphics.strokeEllipse(32, 20, 56, 27);
  graphics.lineStyle(2, 0xa7c4ca, 0.55);
  graphics.strokeEllipse(32, 18, 43, 16);
  graphics.fillStyle(0x17242b, 0.8);
  graphics.fillEllipse(32, 18, 31, 10);
  graphics.generateTexture(TextureKeys.floorExit, 64, 40);
  graphics.destroy();
}

// 최종층 탈출구: 같은 규격(64x40)의 굴이지만 지상의 빛이 새어들어 밝게 빛난다.
// 규격을 일반 출구와 동일하게 유지해 FloorExit의 물리 몸 설정을 공유한다.
function createFloorExitEscapeTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x020407, 0.55);
  graphics.fillEllipse(32, 24, 62, 30);
  graphics.fillStyle(0x1a1607, 1);
  graphics.fillEllipse(32, 20, 54, 25);
  graphics.lineStyle(4, 0x8a7d55, 1);
  graphics.strokeEllipse(32, 20, 56, 27);
  // 새어드는 빛: 중심으로 갈수록 밝은 노란 띠
  graphics.fillStyle(0xffd65a, 0.55);
  graphics.fillEllipse(32, 19, 40, 15);
  graphics.fillStyle(0xffe9a0, 0.85);
  graphics.fillEllipse(32, 18, 28, 10);
  graphics.fillStyle(0xfff7d6, 1);
  graphics.fillEllipse(32, 18, 16, 6);
  // 빛줄기 몇 가닥
  graphics.lineStyle(2, 0xffe9a0, 0.7);
  graphics.lineBetween(24, 14, 20, 4);
  graphics.lineBetween(32, 13, 32, 2);
  graphics.lineBetween(40, 14, 44, 4);
  graphics.generateTexture(TextureKeys.floorExitEscape, 64, 40);
  graphics.destroy();
}

function createFloorTile(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x111820, 1);
  graphics.fillRect(0, 0, 16, 16);
  graphics.fillStyle(0x17212b, 1);
  graphics.fillRect(1, 1, 14, 14);
  graphics.lineStyle(1, 0x2d3a47, 0.8);
  graphics.strokeRect(1, 1, 14, 14);
  graphics.lineStyle(1, 0x080d12, 0.75);
  graphics.lineBetween(1, 15, 15, 15);
  graphics.lineBetween(15, 1, 15, 15);
  graphics.fillStyle(0x4d5f6d, 0.65);
  graphics.fillRect(3, 3, 1, 1);
  graphics.fillRect(12, 11, 1, 1);
  graphics.generateTexture(TextureKeys.floorTile, 16, 16);
  graphics.destroy();
}

function createWallTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x25313b, 1);
  graphics.fillRect(0, 0, 16, 16);
  graphics.fillStyle(0x3e4d59, 1);
  graphics.fillRect(1, 1, 14, 3);
  graphics.fillStyle(0x131b22, 1);
  graphics.fillRect(1, 13, 14, 2);
  graphics.lineStyle(1, 0x0d141a, 1);
  graphics.strokeRect(0, 0, 15, 15);
  graphics.lineStyle(1, 0x60717e, 0.65);
  graphics.lineBetween(3, 6, 13, 6);
  graphics.lineBetween(3, 10, 13, 10);
  graphics.generateTexture(TextureKeys.wall, 16, 16);
  graphics.destroy();
}

function createObstacleTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x160e09, 0.45);
  graphics.fillEllipse(20, 37, 34, 6);
  graphics.fillStyle(0x765033, 1);
  graphics.fillRoundedRect(2, 2, 36, 36, 4);
  graphics.lineStyle(3, 0x2b1b10, 1);
  graphics.strokeRoundedRect(2, 2, 36, 36, 4);
  graphics.lineStyle(3, 0xa8794c, 0.9);
  graphics.lineBetween(5, 9, 35, 9);
  graphics.lineBetween(5, 30, 35, 30);
  graphics.lineStyle(4, 0x4a2d1c, 1);
  graphics.lineBetween(7, 6, 33, 34);
  graphics.lineBetween(33, 6, 7, 34);
  graphics.fillStyle(0xd4b07a, 1);
  graphics.fillCircle(8, 8, 2);
  graphics.fillCircle(32, 8, 2);
  graphics.fillCircle(8, 32, 2);
  graphics.fillCircle(32, 32, 2);
  graphics.lineStyle(2, 0x2b1b10, 1);
  graphics.lineBetween(18, 13, 22, 19);
  graphics.lineBetween(22, 19, 18, 24);
  graphics.generateTexture(TextureKeys.obstacleCrate, 40, 40);
  graphics.destroy();
}
