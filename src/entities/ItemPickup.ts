import Phaser from 'phaser';
import { itemIconKey } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import {
  catalogEntryDescriptionKey,
  catalogEntryId,
  catalogEntryNameKey,
  type CatalogEntry,
} from '../data/itemCatalog';
import type { PassiveItemDefinition } from '../data/items';
import type { ActiveItemDefinition } from '../data/activeItems';

export type ItemPickupSource = 'room' | 'boss' | 'secret';

export class ItemPickup extends Phaser.Physics.Arcade.Sprite {
  /** 바닥에 놓인 아이템. 패시브일 수도 액티브일 수도 있다. */
  readonly entry: CatalogEntry;
  readonly source: ItemPickupSource;
  /**
   * 액티브 아이템이 슬롯에서 밀려나 떨어진 것이라면 그때까지 모은 충전.
   * 다시 주우면 이 값이 그대로 돌아온다 — 바꿔 보다가 손해 보지 않게 한다.
   */
  readonly carriedCharge: number;
  /** 방 상태에 등록된 id. 다시 주울 때 그 항목을 지우는 데 쓴다. */
  private droppedActiveItemId?: number;
  private armed = true;
  private armDistance = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    entry: CatalogEntry,
    source: ItemPickupSource = 'room',
    carriedCharge = 0,
  ) {
    super(scene, x, y, itemIconKey(catalogEntryId(entry)));
    this.entry = entry;
    this.source = source;
    this.carriedCharge = carriedCharge;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.item);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(13);

    scene.tweens.add({
      targets: this,
      y: y - 4,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * 교체로 발밑에 떨어진 아이템을 곧바로 다시 줍지 않게 하는 잠금.
   *
   * 슬롯 교체는 밀려난 아이템을 플레이어가 선 자리에 놓는다. 잠금이 없으면
   * 다음 프레임에 겹침이 다시 발생해 두 아이템이 끝없이 자리를 바꾼다.
   * 심은 폭탄이 발밑에서 단단해지는 것과 같은 방식이다.
   */
  armAfterDistance(distance: number): void {
    this.armDistance = Math.max(0, distance);
    this.armed = this.armDistance === 0;
  }

  /** 플레이어가 잠금 거리만큼 벗어났는지 확인한다. */
  updateArming(playerX: number, playerY: number): void {
    if (this.armed) {
      return;
    }

    const dx = this.x - playerX;
    const dy = this.y - playerY;

    if (dx * dx + dy * dy >= this.armDistance * this.armDistance) {
      this.armed = true;
    }
  }

  setDroppedActiveItemId(id: number): void {
    this.droppedActiveItemId = id;
  }

  get roomDroppedActiveItemId(): number | undefined {
    return this.droppedActiveItemId;
  }

  get isCollectable(): boolean {
    return this.armed;
  }

  get nameKey(): string {
    return catalogEntryNameKey(this.entry);
  }

  get descriptionKey(): string {
    return catalogEntryDescriptionKey(this.entry);
  }

  /** 패시브일 때의 정의. 액티브면 undefined. */
  get passiveItem(): PassiveItemDefinition | undefined {
    return this.entry.kind === 'passive' ? this.entry.definition : undefined;
  }

  /** 액티브일 때의 정의. 패시브면 undefined. */
  get activeItem(): ActiveItemDefinition | undefined {
    return this.entry.kind === 'active' ? this.entry.definition : undefined;
  }
}
