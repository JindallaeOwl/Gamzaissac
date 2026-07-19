import Phaser from 'phaser';
import { DEPTH } from '../config/gameConfig';
import { getRenderScale } from '../systems/GameSettings';
import { gameFontStack } from '../i18n';

const MIN_BUBBLE_WIDTH = 112;
const MAX_BUBBLE_WIDTH = 208;
const MIN_BUBBLE_HEIGHT = 22;
const DEFAULT_BUBBLE_VISIBLE_MS = 3000;

interface ShopNpcSpeechBubbleOptions {
  visibleMs?: number;
  onDismiss?: () => void;
}

export function createShopNpcSpeechBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  options: ShopNpcSpeechBubbleOptions = {},
): Phaser.GameObjects.Container {
  const visibleMs = options.visibleMs ?? DEFAULT_BUBBLE_VISIBLE_MS;
  const bubble = scene.add
    .container(x, y + 2)
    .setDepth(DEPTH.actor + 2)
    .setAlpha(0)
    .setScale(0.92);
  const label = scene.add
    .text(0, -1, message, {
      fontFamily: gameFontStack(),
      fontSize: '7px',
      color: '#2b211b',
      align: 'center',
      wordWrap: { width: MAX_BUBBLE_WIDTH - 16, useAdvancedWrap: true },
      resolution: getRenderScale(),
    })
    .setOrigin(0.5);
  const bubbleWidth = Phaser.Math.Clamp(label.width + 16, MIN_BUBBLE_WIDTH, MAX_BUBBLE_WIDTH);
  const bubbleHeight = Math.max(MIN_BUBBLE_HEIGHT, label.height + 10);
  const background = scene.add.graphics();
  background.fillStyle(0xf7f0d8, 0.96);
  background.lineStyle(1, 0x3a2a20, 1);
  background.fillRoundedRect(-bubbleWidth / 2, -bubbleHeight / 2, bubbleWidth, bubbleHeight, 4);
  background.strokeRoundedRect(-bubbleWidth / 2, -bubbleHeight / 2, bubbleWidth, bubbleHeight, 4);
  background.fillStyle(0xf7f0d8, 0.96);
  background.fillTriangle(-4, bubbleHeight / 2, 4, bubbleHeight / 2, 0, bubbleHeight / 2 + 6);
  background.lineStyle(1, 0x3a2a20, 1);
  background.lineBetween(-4, bubbleHeight / 2, 0, bubbleHeight / 2 + 6);
  background.lineBetween(0, bubbleHeight / 2 + 6, 4, bubbleHeight / 2);

  bubble.add([background, label]);
  scene.tweens.add({
    targets: bubble,
    y,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 170,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(visibleMs, () => {
        if (!bubble.active) {
          return;
        }

        scene.tweens.add({
          targets: bubble,
          y: y - 3,
          alpha: 0,
          duration: 220,
          ease: 'Sine.easeIn',
          onComplete: () => {
            bubble.destroy(true);
            options.onDismiss?.();
          },
        });
      });
    },
  });

  return bubble;
}
