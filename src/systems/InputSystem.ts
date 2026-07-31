import Phaser from 'phaser';
import { snapshotFromKeys, type PlayerControls } from './InputRules';

/**
 * 이동·사격 8키를 보유하고 프레임 스냅샷을 만드는 입력원.
 *
 * 이동(WASD)·사격(방향키)만 담당한다. 폭탄(E)·구매(F)·미니맵(Tab) 같은 기능키와
 * 비밀 코드 리스너는 GameScene.setupActionKeys가 기존대로 관리한다.
 *
 * getControls()는 호출될 때마다 Key.isDown을 새로 읽는다. 스냅샷을 프레임 간
 * 캐시하지 않는 이유: Phaser는 물리 충돌 콜백(예: 밀 수 있는 보상)을
 * GameScene.update보다 먼저 실행하므로, update 초입에 저장해 둔 값을 돌려주면
 * 충돌 콜백이 이전 시점의 입력을 읽게 된다. 매 호출 새로 읽으면 기존
 * `key.isDown` 직접 판정과 시점이 정확히 같다.
 */
export class InputSystem {
  private readonly keys: Record<keyof PlayerControls, Phaser.Input.Keyboard.Key>;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      fireUp: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      fireDown: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      fireLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      fireRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };
  }

  getControls(): PlayerControls {
    return snapshotFromKeys(this.keys);
  }
}
