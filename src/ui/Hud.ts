import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, RENDER_SCALE, type PlayerStats } from '../config/gameConfig';
import { koreanFontStack, t } from '../i18n';
import type { DungeonManager } from '../systems/DungeonManager';
import type { RunState } from '../systems/RunState';
import { getEffectiveDamage, getEffectiveFireRate } from '../systems/PlayerStatSystem';

const HUD_EDGE_MARGIN = 0;
const STATS_PANEL_WIDTH = 244;
const STATS_PANEL_HEIGHT = 122;
const MINIMAP_PANEL_WIDTH = 128;
const MINIMAP_PANEL_HEIGHT = 94;
const PANEL_TOP = 0;

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly inventoryText: Phaser.GameObjects.Text;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly roomText: Phaser.GameObjects.Text;
  private readonly messageText: Phaser.GameObjects.Text;
  private readonly itemHintText: Phaser.GameObjects.Text;
  private readonly debugText: Phaser.GameObjects.Text;
  private readonly minimap: Phaser.GameObjects.Graphics;
  private readonly messagePanel: Phaser.GameObjects.Rectangle;
  private messageUntil = 0;
  private debugVisible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.createPanel(
      HUD_EDGE_MARGIN + STATS_PANEL_WIDTH / 2,
      PANEL_TOP + STATS_PANEL_HEIGHT / 2,
      STATS_PANEL_WIDTH,
      STATS_PANEL_HEIGHT,
      0.62,
    );
    this.createPanel(
      GAME_WIDTH - HUD_EDGE_MARGIN - MINIMAP_PANEL_WIDTH / 2,
      PANEL_TOP + MINIMAP_PANEL_HEIGHT / 2,
      MINIMAP_PANEL_WIDTH,
      MINIMAP_PANEL_HEIGHT,
    );
    this.messagePanel = this.createPanel(GAME_WIDTH / 2, 594, 680, 54).setVisible(false);

    const statsTextX = HUD_EDGE_MARGIN + 8;
    this.healthText = this.createText(statsTextX, PANEL_TOP + 4, 18);
    this.inventoryText = this.createText(statsTextX, PANEL_TOP + 29, 13);
    this.statsText = this.createText(statsTextX, PANEL_TOP + 49, 12);
    this.roomText = this.createText(statsTextX, PANEL_TOP + 97, 12);
    this.messageText = this.createText(GAME_WIDTH / 2, 584, 16).setOrigin(0.5);
    this.itemHintText = this.createText(GAME_WIDTH / 2, 606, 13).setOrigin(0.5);
    this.debugText = this.createText(
      statsTextX,
      PANEL_TOP + STATS_PANEL_HEIGHT + 12,
      13,
    ).setVisible(false);
    this.minimap = scene.add.graphics();
    this.minimap.setDepth(DEPTH.ui);
  }

  setDebugVisible(visible: boolean): void {
    this.debugVisible = visible;
    this.debugText.setVisible(visible);
  }

  showMessage(message: string, durationMs = 2200): void {
    this.messageText.setText(message);
    this.messageUntil = this.scene.time.now + durationMs;
    this.messagePanel.setVisible(true);
  }

  showItemHint(text: string): void {
    this.itemHintText.setText(text);
    this.messagePanel.setVisible(true);
  }

  clearItemHint(): void {
    this.itemHintText.setText('');
    this.messagePanel.setVisible(this.scene.time.now <= this.messageUntil);
  }

  update(
    runState: RunState,
    dungeon: DungeonManager,
    enemyCount: number,
    playerPosition: { x: number; y: number },
    activeBulletCount: number,
    fps: number,
  ): void {
    const stats = runState.stats;
    const effectiveDamage = getEffectiveDamage(stats);
    const effectiveFireRate = getEffectiveFireRate(stats);
    this.healthText.setText(
      `${t('hud.hp')} ${formatStat(stats.health)} / ${formatStat(stats.maxHealth)}`,
    );
    this.inventoryText.setText(
      `${t('hud.key')} ${runState.inventory.keys}  ${t('hud.bomb')} ${runState.inventory.bombs}  ${t(
        'hud.coin',
      )} ${runState.inventory.coins}`,
    );
    this.statsText.setText(
      [
        `${t('hud.damage')} ${effectiveDamage.toFixed(1)}  ${t('hud.range')} ${Math.round(
          stats.range,
        )}  ${t('hud.fireRate')} ${effectiveFireRate.toFixed(1)}`,
        `${t('hud.luck')} ${stats.luck.toFixed(1)}  ${t('hud.speed')} ${Math.round(
          stats.moveSpeed,
        )}`,
      ].join('\n'),
    );
    this.roomText.setText(
      `${t('hud.floor')} ${runState.floor}  ${t('hud.cleared')} ${
        runState.clearedRooms
      }  ${t('hud.left')} ${dungeon.getCombatRoomsRemaining() + dungeon.getBossRoomsRemaining()}`,
    );

    if (this.scene.time.now > this.messageUntil) {
      this.messageText.setText('');
      this.messagePanel.setVisible(this.itemHintText.text.length > 0);
    }

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
    const size = 12;
    const gap = 3;
    const minX = Math.min(...rooms.map((room) => room.coord.x));
    const maxX = Math.max(...rooms.map((room) => room.coord.x));
    const minY = Math.min(...rooms.map((room) => room.coord.y));
    const mapWidth = (maxX - minX) * (size + gap) + size;
    const originX = GAME_WIDTH - HUD_EDGE_MARGIN - 12 - mapWidth;
    const originY = PANEL_TOP + 12;

    this.minimap.clear();

    for (const room of rooms) {
      const x = originX + (room.coord.x - minX) * (size + gap);
      const y = originY + (room.coord.y - minY) * (size + gap);
      const color =
        room.type === 'reward'
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
        this.minimap.lineStyle(2, 0xffffff, 1);
        this.minimap.strokeRect(x - 2, y - 2, size + 4, size + 4);
      }
    }
  }

  private createText(x: number, y: number, size: number): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, '', {
        fontFamily: koreanFontStack(),
        fontSize: `${size}px`,
        color: '#f7f3e8',
        stroke: '#090b10',
        strokeThickness: 4,
        resolution: RENDER_SCALE,
      })
      .setDepth(DEPTH.ui);
  }

  private createPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    alpha = 0.78,
  ): Phaser.GameObjects.Rectangle {
    return this.scene.add
      .rectangle(x, y, width, height, 0x070c12, alpha)
      .setStrokeStyle(2, 0x40525f, 0.82)
      .setDepth(DEPTH.ui - 1);
  }
}

function formatStat(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
