import { emptyControls, type PlayerControls } from '../systems/InputRules';
import {
  controlsFromSticks,
  shouldEnableTouchControls,
  type FireDirectionName,
  type StickSample,
} from '../systems/TouchStickRules';

export interface TouchControlLabels {
  movement: string;
  fire: string;
  bomb: string;
  purchase: string;
  minimap: string;
  pause: string;
  rotate: string;
}

export interface TouchControlCallbacks {
  onInteraction(): void;
  onBomb(): void;
  onPurchase(): void;
  onMinimap(): void;
  onPause(): void;
}

export interface TouchControlPresentation {
  bombCount: number;
  canPurchase: boolean;
  minimapExpanded: boolean;
}

interface StickState {
  element: HTMLElement;
  knob: HTMLElement;
  pointerId: number | null;
  sample: StickSample | null;
}

interface TouchControlElements {
  root: HTMLElement;
  movementStick: HTMLElement;
  movementKnob: HTMLElement;
  fireStick: HTMLElement;
  fireKnob: HTMLElement;
  bombButton: HTMLButtonElement;
  bombCount: HTMLElement;
  purchaseButton: HTMLButtonElement;
  purchaseLabel: HTMLElement;
  minimapButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  rotateLabel: HTMLElement;
}

/**
 * Phaser 캔버스 위에 놓이는 모바일 DOM 조작기.
 *
 * 포인터 ID를 스틱별로 따로 보유해 이동·사격 멀티터치를 지원한다. 씬이 멈추거나
 * 오버레이가 뜨면 setGameplayEnabled(false)가 모든 포인터·방향 상태를 즉시 비운다.
 */
export class TouchControls {
  private readonly abortController = new AbortController();
  private readonly movement: StickState;
  private readonly fire: StickState;
  private enabled = false;
  private previousFireDirection: FireDirectionName | null = null;

  static createIfSupported(callbacks: TouchControlCallbacks): TouchControls | null {
    const supported = shouldEnableTouchControls({
      coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      touchEventAvailable: 'ontouchstart' in window,
    });

    if (!supported) {
      return null;
    }

    const elements = findTouchControlElements();

    if (!elements) {
      console.warn('Touch controls are unavailable because their DOM elements are missing.');
      return null;
    }

    return new TouchControls(elements, callbacks);
  }

  private constructor(
    private readonly elements: TouchControlElements,
    private readonly callbacks: TouchControlCallbacks,
  ) {
    this.movement = {
      element: elements.movementStick,
      knob: elements.movementKnob,
      pointerId: null,
      sample: null,
    };
    this.fire = {
      element: elements.fireStick,
      knob: elements.fireKnob,
      pointerId: null,
      sample: null,
    };

    this.bindStick(this.movement);
    this.bindStick(this.fire);
    this.bindAction(elements.bombButton, () => callbacks.onBomb());
    this.bindAction(elements.purchaseButton, () => callbacks.onPurchase());
    this.bindAction(elements.minimapButton, () => callbacks.onMinimap());
    this.bindAction(elements.pauseButton, () => {
      // 일시정지 직전 모든 방향을 놓아 해제 후 이동이 남지 않게 한다.
      this.resetSticks();
      callbacks.onPause();
    });

    const reset = (): void => this.resetSticks();
    window.addEventListener('blur', reset, { signal: this.abortController.signal });
    window.addEventListener('resize', reset, { signal: this.abortController.signal });
    window.addEventListener('orientationchange', reset, {
      signal: this.abortController.signal,
    });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          this.resetSticks();
        }
      },
      { signal: this.abortController.signal },
    );
    elements.root.addEventListener('contextmenu', (event) => event.preventDefault(), {
      signal: this.abortController.signal,
    });
  }

  getControls(): PlayerControls {
    if (!this.enabled) {
      return emptyControls();
    }

    const result = controlsFromSticks({
      movement: this.movement.sample,
      fire: this.fire.sample,
      previousFireDirection: this.previousFireDirection,
    });
    this.previousFireDirection = result.fireDirection;
    return result.controls;
  }

  setGameplayEnabled(enabled: boolean): void {
    if (!enabled) {
      this.resetSticks();
    }

    this.enabled = enabled;
    this.elements.root.hidden = !enabled;
    this.elements.root.setAttribute('aria-hidden', String(!enabled));
  }

  setLabels(labels: TouchControlLabels): void {
    this.elements.movementStick.setAttribute('aria-label', labels.movement);
    this.elements.fireStick.setAttribute('aria-label', labels.fire);
    this.elements.bombButton.setAttribute('aria-label', labels.bomb);
    this.elements.purchaseButton.setAttribute('aria-label', labels.purchase);
    this.elements.minimapButton.setAttribute('aria-label', labels.minimap);
    this.elements.pauseButton.setAttribute('aria-label', labels.pause);
    this.elements.purchaseLabel.textContent = labels.purchase;
    this.elements.rotateLabel.textContent = labels.rotate;
  }

  updatePresentation(presentation: TouchControlPresentation): void {
    this.elements.bombCount.textContent = String(Math.max(0, presentation.bombCount));
    this.elements.bombButton.classList.toggle('is-empty', presentation.bombCount <= 0);
    this.elements.purchaseButton.hidden = !presentation.canPurchase;
    this.elements.minimapButton.classList.toggle('is-selected', presentation.minimapExpanded);
  }

  destroy(): void {
    this.setGameplayEnabled(false);
    this.abortController.abort();
  }

  private bindStick(state: StickState): void {
    const signal = this.abortController.signal;

    state.element.addEventListener(
      'pointerdown',
      (event) => {
        if (
          !this.enabled ||
          state.pointerId !== null ||
          (event.pointerType === 'mouse' && event.button !== 0)
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.callbacks.onInteraction();
        state.pointerId = event.pointerId;
        state.element.classList.add('is-active');

        try {
          state.element.setPointerCapture(event.pointerId);
        } catch {
          // 포인터가 이미 취소된 극단적인 경우에도 window blur/visibility 정리가 남아 있다.
        }

        this.updateStick(state, event.clientX, event.clientY);
      },
      { signal },
    );

    state.element.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerId !== state.pointerId) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.updateStick(state, event.clientX, event.clientY);
      },
      { signal },
    );

    const release = (event: PointerEvent): void => {
      if (event.pointerId !== state.pointerId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.resetStick(state);
    };

    state.element.addEventListener('pointerup', release, { signal });
    state.element.addEventListener('pointercancel', release, { signal });
    state.element.addEventListener('lostpointercapture', release, { signal });
  }

  private bindAction(button: HTMLButtonElement, action: () => void): void {
    button.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.enabled || (event.pointerType === 'mouse' && event.button !== 0)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.callbacks.onInteraction();
        action();
      },
      { signal: this.abortController.signal },
    );
  }

  private updateStick(state: StickState, clientX: number, clientY: number): void {
    const bounds = state.element.getBoundingClientRect();
    const radius = Math.min(bounds.width, bounds.height) / 2;

    if (radius <= 0) {
      this.resetStick(state);
      return;
    }

    const rawX = clientX - (bounds.left + bounds.width / 2);
    const rawY = clientY - (bounds.top + bounds.height / 2);
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const vector = {
      x: rawX * scale,
      y: rawY * scale,
    };
    state.sample = { vector, radius };

    // 노브 가장자리가 받침 밖으로 과도하게 벗어나지 않도록 표시 이동량만 한 번 더 줄인다.
    const knobBounds = state.knob.getBoundingClientRect();
    const visualRadius = Math.max(0, radius - Math.max(knobBounds.width, knobBounds.height) / 2);
    const visualScale = radius > 0 ? visualRadius / radius : 0;
    state.element.style.setProperty('--stick-x', `${vector.x * visualScale}px`);
    state.element.style.setProperty('--stick-y', `${vector.y * visualScale}px`);
  }

  private resetSticks(): void {
    this.resetStick(this.movement);
    this.resetStick(this.fire);
    this.previousFireDirection = null;
  }

  private resetStick(state: StickState): void {
    const pointerId = state.pointerId;
    state.pointerId = null;
    state.sample = null;

    if (pointerId !== null && state.element.hasPointerCapture(pointerId)) {
      state.element.releasePointerCapture(pointerId);
    }

    state.element.classList.remove('is-active');
    state.element.style.setProperty('--stick-x', '0px');
    state.element.style.setProperty('--stick-y', '0px');

    if (state === this.fire) {
      this.previousFireDirection = null;
    }
  }
}

function findTouchControlElements(): TouchControlElements | null {
  const root = document.querySelector<HTMLElement>('#touch-controls');
  const movementStick = document.querySelector<HTMLElement>('#touch-movement-stick');
  const movementKnob = document.querySelector<HTMLElement>('#touch-movement-knob');
  const fireStick = document.querySelector<HTMLElement>('#touch-fire-stick');
  const fireKnob = document.querySelector<HTMLElement>('#touch-fire-knob');
  const bombButton = document.querySelector<HTMLButtonElement>('#touch-bomb');
  const bombCount = document.querySelector<HTMLElement>('#touch-bomb-count');
  const purchaseButton = document.querySelector<HTMLButtonElement>('#touch-purchase');
  const purchaseLabel = document.querySelector<HTMLElement>('#touch-purchase-label');
  const minimapButton = document.querySelector<HTMLButtonElement>('#touch-minimap');
  const pauseButton = document.querySelector<HTMLButtonElement>('#touch-pause');
  const rotateLabel = document.querySelector<HTMLElement>('#touch-rotate-label');

  if (
    !root ||
    !movementStick ||
    !movementKnob ||
    !fireStick ||
    !fireKnob ||
    !bombButton ||
    !bombCount ||
    !purchaseButton ||
    !purchaseLabel ||
    !minimapButton ||
    !pauseButton ||
    !rotateLabel
  ) {
    return null;
  }

  return {
    root,
    movementStick,
    movementKnob,
    fireStick,
    fireKnob,
    bombButton,
    bombCount,
    purchaseButton,
    purchaseLabel,
    minimapButton,
    pauseButton,
    rotateLabel,
  };
}
