import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';

/**
 * 시작방 텃밭.
 *
 * 감자가 제 씨눈을 떼어 묻는 자리다. 바닥에 깔린 물건이라 충돌 판정은 두지 않고
 * (플레이어는 밟고 지나갈 수 있다), 상호작용은 상점 진열대처럼 거리로 판정한다.
 * 그림은 심기 전/후 두 장뿐이고, 자란 것은 이 자리에 놓이는 아이템·동전이 맡는다.
 */
export class SeedPlot extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, planted: boolean) {
    super(scene, x, y, planted ? TextureKeys.seedPlotPlanted : TextureKeys.seedPlotEmpty);
    scene.add.existing(this);
    // 바닥 장식보다 위, 플레이어·아이템보다 아래.
    this.setDepth(DEPTH.floor + 3);
  }

  setPlanted(planted: boolean): void {
    this.setTexture(planted ? TextureKeys.seedPlotPlanted : TextureKeys.seedPlotEmpty);
  }
}
