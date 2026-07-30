import Phaser from 'phaser';
import { DEPTH } from '../config/gameConfig';
import { getRenderScale } from '../systems/GameSettings';
import { gameFontStack } from '../i18n';

/**
 * 이 컨테이너가 상인 말풍선임을 표시하는 데이터 키.
 * 폭발로 말풍선만 골라 걷어낼 때, 같은 그룹의 다른 오브젝트까지 파괴하지 않도록 쓴다.
 */
export const SHOP_SPEECH_BUBBLE_DATA_KEY = 'shopSpeechBubble';

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
  bubble.setData(SHOP_SPEECH_BUBBLE_DATA_KEY, true);
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
            // 퇴장 도중 폭발 등으로 이미 걷혔다면 후속 동작을 하지 않는다.
            // 이 확인이 없으면 사라진 말풍선이 후속 대사를 되살린다.
            if (!bubble.active) {
              return;
            }

            bubble.destroy(true);
            options.onDismiss?.();
          },
        });
      });
    },
  });

  return bubble;
}
