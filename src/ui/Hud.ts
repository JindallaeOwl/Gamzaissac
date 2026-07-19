import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH, GAME_WIDTH } from '../config/gameConfig';
import { getRenderScale } from '../systems/GameSettings';
import { formatRunElapsedTime } from '../systems/MinimapExpansionController';
import { gameFontStack, t } from '../i18n';
import type { DungeonManager } from '../systems/DungeonManager';
import type { RunState } from '../systems/RunState';
import { getHeartFillUnits } from '../utils/healthHearts';
import { getHudStatValues, type HudStatValues } from './HudStatPresentation';
import { calculateExpandedMinimapCellLayout } from './MinimapLayout';
import type { UiObjectRegistrar } from './UiCameraSystem';

// Keep a small inset around the corner HUD so it remains easy to read at
// different window sizes and aspect ratios.
const HUD_EDGE_MARGIN = 4;
const PANEL_TOP = HUD_EDGE_MARGIN;
const HEART_START_X = HUD_EDGE_MARGIN + 2;
const HEART_TOP = HUD_EDGE_MARGIN + 1;
const HEART_STEP_X = 15;
const RESOURCE_ICON_X = HUD_EDGE_MARGIN + 2;
const RESOURCE_VALUE_X = HUD_EDGE_MARGIN + 18;
const RESOURCE_START_Y = PANEL_TOP + 23;
const RESOURCE_ROW_GAP = 17;
const STAT_ICON_X = HUD_EDGE_MARGIN + 3;
const STAT_VALUE_X = HUD_EDGE_MARGIN + 18;
const STAT_START_Y = PANEL_TOP + 79;
const STAT_ROW_GAP = 15;
const STAT_ICON_SIZE = 12;
const STAT_ALPHA = 0.72;
const MINIMAP_PANEL_WIDTH = 64;
const MINIMAP_PANEL_HEIGHT = 48;
const EXPANDED_MINIMAP_PANEL_WIDTH = 118;
const EXPANDED_MINIMAP_PANEL_HEIGHT = 82;
const MINIMAP_TRANSITION_MS = 180;

interface HealthHeartImages {
  empty: Phaser.GameObjects.Image;
  fill: Phaser.GameObjects.Image;
}

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly registerUiObject: UiObjectRegistrar;
  private readonly healthHearts: HealthHeartImages[] = [];
  private readonly keyCountText: Phaser.GameObjects.Text;
  private readonly bombCountText: Phaser.GameObjects.Text;
  private readonly coinCountText: Phaser.GameObjects.Text;
  private readonly statValueTexts: Record<keyof HudStatValues, Phaser.GameObjects.Text>;
  private readonly messageText: Phaser.GameObjects.Text;
  private readonly itemHintText: Phaser.GameObjects.Text;
  private readonly debugText: Phaser.GameObjects.Text;
  private readonly adminText: Phaser.GameObjects.Text;
  private readonly minimap: Phaser.GameObjects.Graphics;
  private readonly minimapPanel: Phaser.GameObjects.Rectangle;
  private readonly runInfoText: Phaser.GameObjects.Text;
  private minimapExpansionProgress = 0;
  private minimapExpandedTarget = false;
  private minimapTween?: Phaser.Tweens.Tween;
  private messageUntil = 0;
  private debugVisible = false;
  private lastHealth = Number.NaN;
  private lastMaxHealth = Number.NaN;
  private lastMinimapSignature = '';

  constructor(scene: Phaser.Scene, registerUiObject: UiObjectRegistrar) {
    this.scene = scene;
    this.registerUiObject = registerUiObject;

    this.minimapPanel = this.createPanel(
      GAME_WIDTH - HUD_EDGE_MARGIN - MINIMAP_PANEL_WIDTH / 2,
      PANEL_TOP + MINIMAP_PANEL_HEIGHT / 2,
      MINIMAP_PANEL_WIDTH,
      MINIMAP_PANEL_HEIGHT,
    );
    this.createInventoryIcon(
      RESOURCE_ICON_X,
      RESOURCE_START_Y,
      TextureKeys.hudCoin,
      TextureKeys.coinPickup,
      0xffd166,
    );
    this.createInventoryIcon(
      RESOURCE_ICON_X,
      RESOURCE_START_Y + RESOURCE_ROW_GAP,
      TextureKeys.hudBomb,
      TextureKeys.bombPickup,
      0xff8f70,
    );
    this.createInventoryIcon(
      RESOURCE_ICON_X,
      RESOURCE_START_Y + RESOURCE_ROW_GAP * 2,
      TextureKeys.hudKey,
      TextureKeys.keyPickup,
      0x8bd3ff,
    );
    this.coinCountText = this.createText(RESOURCE_VALUE_X, RESOURCE_START_Y + 1, 9).setFontStyle(
      'bold',
    );
    this.bombCountText = this.createText(
      RESOURCE_VALUE_X,
      RESOURCE_START_Y + RESOURCE_ROW_GAP + 1,
      9,
    ).setFontStyle('bold');
    this.keyCountText = this.createText(
      RESOURCE_VALUE_X,
      RESOURCE_START_Y + RESOURCE_ROW_GAP * 2 + 1,
      9,
    ).setFontStyle('bold');
    this.statValueTexts = {
      moveSpeed: this.createStatRow(0, TextureKeys.hudStatMoveSpeed, 0xd8b07a),
      fireRate: this.createStatRow(1, TextureKeys.hudStatFireRate, 0xff596d),
      damage: this.createStatRow(2, TextureKeys.hudStatDamage, 0xc9785b),
      range: this.createStatRow(3, TextureKeys.hudStatRange, 0xf2f0e8),
      projectileSpeed: this.createStatRow(4, TextureKeys.hudStatProjectileSpeed, 0xa9c8e8),
      luck: this.createStatRow(5, TextureKeys.hudStatLuck, 0x75ce76),
    };
    this.messageText = this.createText(GAME_WIDTH / 2, 250, 8)
      .setOrigin(0.5)
      .setFontStyle('bold');
    this.itemHintText = this.createText(GAME_WIDTH / 2, 261, 6)
      .setOrigin(0.5)
      .setFontStyle('bold');
    this.debugText = this.createText(
      HUD_EDGE_MARGIN + 2,
      STAT_START_Y + STAT_ROW_GAP * 6 + 2,
      6,
    ).setVisible(false);
    this.adminText = this.createText(GAME_WIDTH / 2, PANEL_TOP + 2, 8)
      .setOrigin(0.5, 0)
      .setColor('#ff5d72')
      .setFontStyle('bold')
      .setText('ADMIN')
      .setVisible(false);
    this.runInfoText = this.createText(GAME_WIDTH / 2, PANEL_TOP + 2, 7)
      .setOrigin(0.5, 0)
      .setAlign('center')
      .setFontStyle('bold')
      .setAlpha(0);
    this.minimap = this.registerUiObject(scene.add.graphics());
    this.minimap.setDepth(DEPTH.ui);
  }

  setDebugVisible(visible: boolean): void {
    this.debugVisible = visible;
    this.debugText.setVisible(visible);
  }

  setAdminVisible(visible: boolean): void {
    this.adminText.setVisible(visible);
  }

  setMapExpanded(expanded: boolean): void {
    if (expanded === this.minimapExpandedTarget) {
      return;
    }

    this.minimapExpandedTarget = expanded;
    this.minimapTween?.stop();
    const target = expanded ? 1 : 0;
    const duration = Math.max(
      1,
      MINIMAP_TRANSITION_MS * Math.abs(target - this.minimapExpansionProgress),
    );
    this.minimapTween = this.scene.tweens.add({
      targets: this,
      minimapExpansionProgress: target,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.minimapTween = undefined;
      },
    });
  }

  showMessage(message: string, durationMs = 2200): void {
    this.messageText.setText(message);
    this.messageUntil = this.scene.time.now + durationMs;
  }

  showItemHint(text: string): void {
    if (this.itemHintText.text !== text) {
      this.itemHintText.setText(text);
    }
  }

  clearItemHint(): void {
    if (this.itemHintText.text.length > 0) {
      this.itemHintText.setText('');
    }
  }

  update(
    runState: RunState,
    dungeon: DungeonManager,
    enemyCount: number,
    playerPosition: { x: number; y: number },
    activeBulletCount: number,
    fps: number,
    runElapsedMs: number,
  ): void {
    const stats = runState.stats;
    const statValues = getHudStatValues(stats);
    if (stats.health !== this.lastHealth || stats.maxHealth !== this.lastMaxHealth) {
      this.updateHealthHearts(stats.health, stats.maxHealth);
      this.lastHealth = stats.health;
      this.lastMaxHealth = stats.maxHealth;
    }
    this.keyCountText.setText(this.formatInventoryCount(runState.inventory.keys));
    this.bombCountText.setText(this.formatInventoryCount(runState.inventory.bombs));
    this.coinCountText.setText(this.formatInventoryCount(runState.inventory.coins));
    for (const key of Object.keys(this.statValueTexts) as (keyof HudStatValues)[]) {
      this.statValueTexts[key].setText(statValues[key]);
    }
    if (this.messageUntil > 0 && this.scene.time.now > this.messageUntil) {
      this.messageText.setText('');
      this.messageUntil = 0;
    }

    this.updateMinimapPresentation(runState.score, runElapsedMs);
    this.drawMinimap(dungeon);

    if (this.debugVisible) {
      const room = dungeon.getCurrentRoom();
      this.debugText.setText(
        [
          `${t('hud.room')} ${room.id} ${t(`roomTypes.${room.type}`)} ${
            room.cleared ? t('hud.open') : t('hud.locked')
          }`,
          `${t('hud.enemies')} ${enemyCount}`,
          `${t('hud.bullets')} ${activeBulletCount}  ${t('hud.fps')} ${fps}`,
          `${t('hud.player')} ${Math.round(playerPosition.x)}, ${Math.round(playerPosition.y)}`,
          `${t('hud.items')} ${runState.collectedItemIds.length}  ${t('hud.abilities')} ${
            runState.unlockedAbilityIds.length
          }`,
          `${t('hud.score')} ${runState.score}`,
        ].join('\n'),
      );
    }
  }

  private drawMinimap(dungeon: DungeonManager): void {
    const rooms = dungeon.getRooms();
    const current = dungeon.getCurrentRoom();
    const signature = `${this.minimapExpansionProgress.toFixed(3)}|${current.id}|${rooms
      .map(
        (room) =>
          `${room.id}:${room.coord.x},${room.coord.y}:${room.type}:${Number(
            room.discovered,
          )}:${Number(room.cleared)}`,
      )
      .join('|')}`;

    if (signature === this.lastMinimapSignature) {
      return;
    }

    this.lastMinimapSignature = signature;
    const progress = this.minimapExpansionProgress;
    const minX = Math.min(...rooms.map((room) => room.coord.x));
    const maxX = Math.max(...rooms.map((room) => room.coord.x));
    const minY = Math.min(...rooms.map((room) => room.coord.y));
    const maxY = Math.max(...rooms.map((room) => room.coord.y));
    const expandedLayout = calculateExpandedMinimapCellLayout(
      maxX - minX + 1,
      maxY - minY + 1,
      EXPANDED_MINIMAP_PANEL_WIDTH,
      EXPANDED_MINIMAP_PANEL_HEIGHT,
    );
    const size = Phaser.Math.Linear(6, expandedLayout.size, progress);
    const gap = Phaser.Math.Linear(2, expandedLayout.gap, progress);
    const mapWidth = (maxX - minX) * (size + gap) + size;
    const mapHeight = (maxY - minY) * (size + gap) + size;
    const panelWidth = Phaser.Math.Linear(
      MINIMAP_PANEL_WIDTH,
      EXPANDED_MINIMAP_PANEL_WIDTH,
      progress,
    );
    const panelHeight = Phaser.Math.Linear(
      MINIMAP_PANEL_HEIGHT,
      EXPANDED_MINIMAP_PANEL_HEIGHT,
      progress,
    );
    const panelLeft = GAME_WIDTH - HUD_EDGE_MARGIN - panelWidth;
    const originX = panelLeft + (panelWidth - mapWidth) / 2;
    const originY = PANEL_TOP + (panelHeight - mapHeight) / 2;

    this.minimap.clear();

    for (const room of rooms) {
      const x = originX + (room.coord.x - minX) * (size + gap);
      const y = originY + (room.coord.y - minY) * (size + gap);
      const color =
        room.type === 'shop'
          ? 0xf3c766
          : room.type === 'treasure'
            ? 0xb59cff
            : room.type === 'boss'
              ? 0xd84f66
              : room.type === 'start'
                ? 0x6ff5ff
                : 0xff7a90;
      const alpha = room.discovered || room.id === current.id ? 1 : 0.28;

      this.minimap.fillStyle(room.cleared ? color : 0x58606b, alpha);
      this.minimap.fillRect(x, y, size, size);

      if (room.id === current.id) {
        this.minimap.lineStyle(1, 0xffffff, 1);
        this.minimap.strokeRect(x - 1, y - 1, size + 2, size + 2);
      }
    }
  }

  private updateMinimapPresentation(score: number, runElapsedMs: number): void {
    const progress = this.minimapExpansionProgress;
    const panelWidth = Phaser.Math.Linear(
      MINIMAP_PANEL_WIDTH,
      EXPANDED_MINIMAP_PANEL_WIDTH,
      progress,
    );
    const panelHeight = Phaser.Math.Linear(
      MINIMAP_PANEL_HEIGHT,
      EXPANDED_MINIMAP_PANEL_HEIGHT,
      progress,
    );
    this.minimapPanel
      .setPosition(GAME_WIDTH - HUD_EDGE_MARGIN - panelWidth / 2, PANEL_TOP + panelHeight / 2)
      .setDisplaySize(panelWidth, panelHeight)
      .setAlpha(Phaser.Math.Linear(1, 0.82, progress));

    const runInfo = `${t('hud.time')}: ${formatRunElapsedTime(runElapsedMs)}\n${t(
      'hud.score',
    )}: ${score}`;

    if (this.runInfoText.text !== runInfo) {
      this.runInfoText.setText(runInfo);
    }

    this.runInfoText.setAlpha(progress * 0.68);
    this.adminText.y = Phaser.Math.Linear(PANEL_TOP + 2, PANEL_TOP + 25, progress);
  }

  private createText(x: number, y: number, size: number): Phaser.GameObjects.Text {
    return this.registerUiObject(
      this.scene.add.text(x, y, '', {
        fontFamily: gameFontStack(),
        fontSize: `${size}px`,
        color: '#f7f3e8',
        stroke: '#090b10',
        strokeThickness: 2,
        resolution: getRenderScale(),
      }),
    ).setDepth(DEPTH.ui);
  }

  private updateHealthHearts(health: number, maxHealth: number): void {
    const fillUnits = getHeartFillUnits(health, maxHealth);

    while (this.healthHearts.length < fillUnits.length) {
      const index = this.healthHearts.length;
      const x = HEART_START_X + index * HEART_STEP_X;
      const y = HEART_TOP;
      const empty = this.registerUiObject(this.scene.add.image(x, y, TextureKeys.hudHeart))
        .setOrigin(0)
        .setDisplaySize(16, 16)
        .setTint(0x4b2730)
        .setDepth(DEPTH.ui);
      const fill = this.registerUiObject(this.scene.add.image(x, y, TextureKeys.hudHeart))
        .setOrigin(0)
        .setDisplaySize(16, 16)
        .setTint(0xff5d72)
        .setDepth(DEPTH.ui + 1);
      this.healthHearts.push({ empty, fill });
    }

    this.healthHearts.forEach((heart, index) => {
      const units = fillUnits[index];
      const visible = units !== undefined;
      heart.empty.setVisible(visible);
      heart.fill.setVisible(visible && units > 0);

      if (units === 1) {
        heart.fill.setCrop(0, 0, 8, 16);
      } else if (units === 2) {
        heart.fill.setCrop(0, 0, 16, 16);
      }
    });
  }

  private createInventoryIcon(
    x: number,
    y: number,
    preferredTexture: string,
    fallbackTexture: string,
    tint: number,
  ): Phaser.GameObjects.Image {
    const texture = this.scene.textures.exists(preferredTexture)
      ? preferredTexture
      : fallbackTexture;

    return this.registerUiObject(this.scene.add.image(x, y, texture))
      .setOrigin(0)
      .setDisplaySize(14, 14)
      .setTint(tint)
      .setDepth(DEPTH.ui);
  }

  private createStatRow(row: number, texture: string, tint: number): Phaser.GameObjects.Text {
    const y = STAT_START_Y + row * STAT_ROW_GAP;
    this.registerUiObject(this.scene.add.image(STAT_ICON_X, y, texture))
      .setOrigin(0)
      .setDisplaySize(STAT_ICON_SIZE, STAT_ICON_SIZE)
      .setTint(tint)
      .setAlpha(STAT_ALPHA)
      .setDepth(DEPTH.ui);

    return this.createText(STAT_VALUE_X, y + 1, 8)
      .setColor('#ffffff')
      .setStroke('#05070a', 3)
      .setAlpha(STAT_ALPHA)
      .setFontStyle('bold');
  }

  private formatInventoryCount(count: number): string {
    return Math.max(0, Math.floor(count)).toString().padStart(2, '0');
  }

  private createPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    alpha = 0.78,
  ): Phaser.GameObjects.Rectangle {
    return this.registerUiObject(this.scene.add.rectangle(x, y, width, height, 0x070c12, alpha))
      .setStrokeStyle(1, 0x40525f, 0.82)
      .setDepth(DEPTH.ui - 1);
  }
}
