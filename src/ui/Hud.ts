import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH, FEEDBACK_TUNING, GAME_WIDTH } from '../config/gameConfig';
import { UI_GOLD, UI_THEME } from '../config/uiTheme';
import { getStageProgress, stageFloorRoman } from '../data/stages';
import { getRenderScale } from '../systems/GameSettings';
import { formatRunElapsedTime } from '../systems/MinimapExpansionController';
import { gameFontStack, t } from '../i18n';
import type { DungeonManager } from '../systems/DungeonManager';
import type { RunState } from '../systems/RunState';
import { getHeartFillUnits } from '../utils/healthHearts';
import { getHudStatValues, type HudStatValues } from './HudStatPresentation';
import {
  calculateExpandedMinimapCellLayout,
  calculateMinimapCapacity,
  calculateMinimapViewport,
} from './MinimapLayout';
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
// 생성 시와 강조 해제 시가 같은 값을 봐야 한다. 흩어 적으면 해제가 다른 색으로 되돌린다.
const STAT_BASE_COLOR = '#ffffff';
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
  // 첫 update는 빈 문자열 → 실제 값 채우기라, 그 프레임의 변화는 강조하지 않는다.
  private hasStatBaseline = false;
  // 강조 트윈이 위치를 흔드는 동안에도 되돌아올 원래 y. 생성 직후 한 번 채우므로
  // 바운스로 이미 흔들린 y를 기준으로 잘못 잡는 순서 의존이 없다.
  private readonly statBaseY = new Map<keyof HudStatValues, number>();
  // 진행 중인 색 페이드. 대상이 Text가 아니라 진행도 객체라 killTweensOf(text)에
  // 걸리지 않으므로, 재강조 때 직접 세워야 이전 페이드가 새 강조와 싸우지 않는다.
  private readonly statColorTweens = new Map<keyof HudStatValues, Phaser.Tweens.Tween>();
  // 지나가는 중인 광택 띠. 일시정지 직전에 한꺼번에 걷어내기 위해 추적한다.
  private readonly activeGlints = new Set<Phaser.GameObjects.Rectangle>();
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

    for (const key of Object.keys(this.statValueTexts) as (keyof HudStatValues)[]) {
      this.statBaseY.set(key, this.statValueTexts[key].y);
    }
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

  /** 캔버스 포인터가 현재 크기의 미니맵 패널 안에 있는지 확인한다. */
  containsMinimapScreenPoint(screenX: number, screenY: number): boolean {
    const uiCamera = this.scene.cameras.getCamera('UiCamera');

    if (!uiCamera) {
      return false;
    }

    const logicalPoint = uiCamera.getWorldPoint(screenX, screenY);
    return this.minimapPanel.getBounds().contains(logicalPoint.x, logicalPoint.y);
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
      const text = this.statValueTexts[key];
      // "현재 표시 중인 값"은 Text 자신이 들고 있으므로(text.text) 별도 스냅숏을
      // 두지 않는다 — 두 진실이 어긋날 일이 없다.
      const changed = this.hasStatBaseline && text.text !== statValues[key];

      text.setText(statValues[key]);

      if (changed) {
        this.flashStatText(key, text);
      }
    }
    this.hasStatBaseline = true;
    if (this.messageUntil > 0 && this.scene.time.now > this.messageUntil) {
      this.messageText.setText('');
      this.messageUntil = 0;
    }

    const stageLabel = this.formatStageFloorLabel(runState.floor);
    this.updateMinimapPresentation(runState.score, runElapsedMs, stageLabel);
    this.drawMinimap(dungeon);

    if (this.debugVisible) {
      const room = dungeon.getCurrentRoom();
      this.debugText.setText(
        [
          stageLabel,
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

    // 작은 미니맵은 칸 크기가 고정이라 방이 많이 퍼지면 패널 밖으로 넘쳤다.
    // 들어갈 만큼만 현재 방 중심으로 잘라 보여 주고, 다 들어가면 지도 전체를 보여 준다.
    // 확장 미니맵은 칸을 줄여 전부 담으므로 이 창이 자연히 지도 전체가 된다.
    const viewport = calculateMinimapViewport({
      mapMinX: minX,
      mapMaxX: maxX,
      mapMinY: minY,
      mapMaxY: maxY,
      focusX: current.coord.x,
      focusY: current.coord.y,
      columnCapacity: calculateMinimapCapacity(panelWidth, size, gap),
      rowCapacity: calculateMinimapCapacity(panelHeight, size, gap),
    });
    const mapWidth = (viewport.maxX - viewport.minX) * (size + gap) + size;
    const mapHeight = (viewport.maxY - viewport.minY) * (size + gap) + size;
    const panelLeft = GAME_WIDTH - HUD_EDGE_MARGIN - panelWidth;
    const originX = panelLeft + (panelWidth - mapWidth) / 2;
    const originY = PANEL_TOP + (panelHeight - mapHeight) / 2;

    this.minimap.clear();

    for (const room of rooms) {
      if (
        room.coord.x < viewport.minX ||
        room.coord.x > viewport.maxX ||
        room.coord.y < viewport.minY ||
        room.coord.y > viewport.maxY
      ) {
        continue;
      }

      const x = originX + (room.coord.x - viewport.minX) * (size + gap);
      const y = originY + (room.coord.y - viewport.minY) * (size + gap);
      // 방 종류 색은 정보를 전달하므로 구분은 유지하되, 차갑던 색조만 흙 테마에
      // 맞춰 눌렀다(시작방 하늘색 → 옅은 금색, 미클리어 회색 → 따뜻한 흙색).
      const color =
        room.type === 'shop'
          ? 0xf3c766
          : room.type === 'treasure'
            ? 0xb59cff
            : room.type === 'boss'
              ? 0xd84f66
              : room.type === 'start'
                ? 0xdcc079
                : 0xc9785b;
      const alpha = room.discovered || room.id === current.id ? 1 : 0.28;

      this.minimap.fillStyle(room.cleared ? color : 0x4a3a28, alpha);
      this.minimap.fillRect(x, y, size, size);

      if (room.id === current.id) {
        this.minimap.lineStyle(1, UI_GOLD, 1);
        this.minimap.strokeRect(x - 1, y - 1, size + 2, size + 2);
      }
    }
  }

  private formatStageFloorLabel(floor: number): string {
    const progress = getStageProgress(floor);
    return t('messages.floor', {
      floor,
      stage: t(progress.stage.nameKey),
      roman: stageFloorRoman(progress.floorInStage),
    });
  }

  private updateMinimapPresentation(score: number, runElapsedMs: number, stageLabel: string): void {
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

    const runInfo = `${stageLabel}\n${t('hud.time')}: ${formatRunElapsedTime(runElapsedMs)}\n${t(
      'hud.score',
    )}: ${score}`;

    if (this.runInfoText.text !== runInfo) {
      this.runInfoText.setText(runInfo);
    }

    this.runInfoText.setAlpha(progress * 0.68);
    this.adminText.y = Phaser.Math.Linear(PANEL_TOP + 2, PANEL_TOP + 25, progress);
  }

  /**
   * 값이 바뀐 스탯을 금색으로 밝히고, 살짝 튀어올랐다가, 광택이 한 번 훑고
   * 지나간 뒤 부드럽게 원래 색으로 가라앉는다.
   *
   * 수명은 전부 트윈이 관리한다 — update 루프의 시간 비교로 되돌리면 런 종료로
   * update가 멈추는 순간 금색이 영영 남는데, 트윈은 씬이 살아 있는 한 끝까지
   * 돌아 스스로 정리된다. 같은 스탯이 연달아 바뀌면 이전 트윈을 죽이고 원위치로
   * 되돌린 뒤 새로 시작해, 연출이 겹겹이 쌓이지 않는다.
   */
  private flashStatText(key: keyof HudStatValues, text: Phaser.GameObjects.Text): void {
    const baseY = this.statBaseY.get(key) ?? text.y;

    this.scene.tweens.killTweensOf(text);
    this.statColorTweens.get(key)?.stop();
    // setColor는 텍스트 캔버스를 매번 다시 그리지만 tint는 GPU에서 곱하기만
    // 한다. 글자가 흰색이라 금색 tint = 금색 글자가 되고, 어두운 테두리는
    // 곱해도 어두운 채라 가독성이 유지된다.
    text.setY(baseY).setTint(FEEDBACK_TUNING.effects.statFlashColor).setAlpha(1);

    // 짧게 튀어오른다. 왕복이라 끝나면 스스로 원위치다.
    this.scene.tweens.add({
      targets: text,
      y: baseY - 3,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    // 광택: 밝은 세로 띠가 글자 위를 왼쪽에서 오른쪽으로 한 번 훑는다.
    const glint = this.registerUiObject(
      this.scene.add.rectangle(text.x - 4, baseY - 2, 4, text.height + 4, 0xffffff, 0.75),
    )
      .setOrigin(0, 0)
      .setDepth(DEPTH.ui + 1)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.activeGlints.add(glint);
    this.scene.tweens.add({
      targets: glint,
      x: text.x + text.width + 4,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.activeGlints.delete(glint);
        glint.destroy();
      },
    });

    // 금색 tint → 무색(흰색 곱)으로 서서히 가라앉는다. tint는 직접 트윈할 수
    // 없어 진행도를 트윈하고 매 단계 보간한다.
    const gold = Phaser.Display.Color.ValueToColor(FEEDBACK_TUNING.effects.statFlashColor);
    const base = Phaser.Display.Color.ValueToColor(0xffffff);
    const progress = { value: 0 };

    const colorTween = this.scene.tweens.add({
      targets: progress,
      value: 1,
      delay: FEEDBACK_TUNING.effects.statFlashMs * 0.35,
      duration: FEEDBACK_TUNING.effects.statFlashMs * 0.65,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(
          gold,
          base,
          100,
          progress.value * 100,
        );

        text.setTint(Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b));
        text.setAlpha(1 - (1 - STAT_ALPHA) * progress.value);
      },
      onComplete: () => {
        text.clearTint();
        text.setAlpha(STAT_ALPHA);
        this.statColorTweens.delete(key);
      },
    });

    this.statColorTweens.set(key, colorTween);
  }

  /**
   * 진행 중인 스탯 강조를 즉시 원상 복구한다. 일시정지는 트윈을 함께 멈추므로,
   * 부르지 않으면 금색 글자·튀어오른 위치·광택 띠가 정지 화면에 얼어붙는다.
   */
  settleStatFlashes(): void {
    for (const key of Object.keys(this.statValueTexts) as (keyof HudStatValues)[]) {
      const text = this.statValueTexts[key];

      this.scene.tweens.killTweensOf(text);
      this.statColorTweens.get(key)?.stop();
      text.clearTint();
      text.setAlpha(STAT_ALPHA);

      const baseY = this.statBaseY.get(key);

      if (baseY !== undefined) {
        text.setY(baseY);
      }
    }

    this.statColorTweens.clear();

    for (const glint of this.activeGlints) {
      this.scene.tweens.killTweensOf(glint);
      glint.destroy();
    }

    this.activeGlints.clear();
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
      .setColor(STAT_BASE_COLOR)
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
    return this.registerUiObject(
      this.scene.add.rectangle(x, y, width, height, UI_THEME.panelFill, alpha),
    )
      .setStrokeStyle(1, UI_THEME.panelStroke, UI_THEME.panelStrokeAlpha)
      .setDepth(DEPTH.ui - 1);
  }
}
