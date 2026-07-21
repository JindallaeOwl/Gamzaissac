import Phaser from 'phaser';
import { DEPTH } from '../config/gameConfig';
import { gameFontStack } from '../i18n';
import { getRenderScale } from '../systems/GameSettings';
import { getAnnouncementMotion } from './ItemPickupAnnouncementRules';
import type { UiObjectRegistrar } from './UiCameraSystem';

interface AnnouncementEntry {
  title: string;
  description: string;
}

export interface ItemPickupAnnouncementInput {
  title: string;
  description: string;
}

export class ItemPickupAnnouncement {
  private readonly scene: Phaser.Scene;
  private readonly registerUiObject: UiObjectRegistrar;
  private readonly queue: AnnouncementEntry[] = [];
  private activeContainer?: Phaser.GameObjects.Container;
  private activeTween?: Phaser.Tweens.TweenChain;

  constructor(scene: Phaser.Scene, registerUiObject: UiObjectRegistrar) {
    this.scene = scene;
    this.registerUiObject = registerUiObject;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  show(input: ItemPickupAnnouncementInput): void {
    this.queue.push({
      title: input.title.endsWith('!') ? input.title : `${input.title}!`,
      description: input.description,
    });

    if (!this.activeContainer) {
      this.playNext();
    }
  }

  destroy(): void {
    this.queue.length = 0;
    this.activeTween?.stop();
    this.activeTween = undefined;
    this.activeContainer?.destroy(true);
    this.activeContainer = undefined;
  }

  private playNext(): void {
    const entry = this.queue.shift();

    if (!entry) {
      return;
    }

    const motion = getAnnouncementMotion();
    const title = this.registerUiObject(
      this.scene.add
        .text(0, -8, entry.title, {
          fontFamily: gameFontStack(),
          fontSize: '19px',
          fontStyle: 'bold',
          color: '#ffe39b',
          stroke: '#090b10',
          strokeThickness: 4,
          resolution: getRenderScale(),
          align: 'center',
        })
        .setOrigin(0.5),
    );
    const description = this.registerUiObject(
      this.scene.add
        .text(0, 14, entry.description, {
          fontFamily: gameFontStack(),
          fontSize: '8px',
          color: '#f7f3e8',
          stroke: '#090b10',
          strokeThickness: 3,
          resolution: getRenderScale(),
          align: 'center',
          wordWrap: { width: 360, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0),
    );
    const container = this.registerUiObject(
      this.scene.add.container(motion.start.x, motion.start.y, [title, description]),
    );
    container
      .setDepth(DEPTH.ui + 10)
      .setAlpha(0)
      .setScale(0.72);
    this.activeContainer = container;

    this.activeTween = this.scene.tweens.chain({
      tweens: [
        {
          targets: container,
          x: motion.rest.x,
          y: motion.rest.y,
          alpha: 1,
          scaleX: 1.08,
          scaleY: 0.92,
          duration: 230,
          ease: 'Back.easeOut',
        },
        {
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 90,
          ease: 'Sine.easeOut',
        },
        {
          targets: container,
          x: motion.rest.x + 10,
          scaleX: 0.94,
          scaleY: 1.08,
          delay: 740,
          duration: 110,
          ease: 'Sine.easeOut',
        },
        {
          targets: container,
          x: motion.exit.x,
          y: motion.exit.y,
          alpha: 0,
          scaleX: 1.14,
          scaleY: 0.86,
          duration: 250,
          ease: 'Back.easeIn',
        },
      ],
      onComplete: () => {
        container.destroy(true);
        this.activeContainer = undefined;
        this.activeTween = undefined;
        this.playNext();
      },
    });
  }
}
