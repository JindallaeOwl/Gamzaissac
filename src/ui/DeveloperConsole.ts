import {
  getDeveloperConsoleSuggestions,
  type DeveloperConsoleSuggestion,
} from '../systems/DeveloperConsoleAutocomplete';
import { verifyDeveloperConsolePassword } from '../systems/DeveloperConsoleAccess';
import { DeveloperItemPicker, type DeveloperItemPickerOption } from './DeveloperItemPicker';
import { isItemPickerToggleInput } from './DeveloperItemPickerRules';

export interface DeveloperConsoleCommandResult {
  lines?: readonly string[];
  clear?: boolean;
  openItemPicker?: boolean;
}

interface DeveloperConsoleConfig {
  canOpen: () => boolean;
  onOpenChanged: (open: boolean) => void;
  onCommand: (input: string) => DeveloperConsoleCommandResult;
  getItemOptions: () => readonly DeveloperItemPickerOption[];
}

interface ConsoleWindowInteraction {
  type: 'drag' | 'resize';
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
}

interface StoredConsoleWindowState {
  left: number;
  top: number;
  width: number;
  height: number;
}

const WINDOW_STATE_KEY = 'gamzaissac.developer-console.window.v1';
const WINDOW_MARGIN = 8;
const MIN_WINDOW_WIDTH = 320;
const MIN_WINDOW_HEIGHT = 240;

export class DeveloperConsole {
  private readonly overlay: HTMLElement;
  private readonly output: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly input: HTMLInputElement;
  private readonly dragHandle: HTMLElement;
  private readonly resizeHandle: HTMLElement;
  private readonly suggestionsElement: HTMLElement;
  private readonly itemPickerRoot: HTMLElement;
  private readonly itemPicker: DeveloperItemPicker;
  private readonly history: string[] = [];
  private suggestions: DeveloperConsoleSuggestion[] = [];
  private selectedSuggestionIndex = 0;
  private historyIndex = 0;
  private browsingHistory = false;
  private authenticated = false;
  private authenticationPending = false;
  private windowInteraction: ConsoleWindowInteraction | null = null;
  private openState = false;

  constructor(private readonly config: DeveloperConsoleConfig) {
    const overlay = document.querySelector<HTMLElement>('#developer-console');
    const output = document.querySelector<HTMLElement>('#developer-console-output');
    const form = document.querySelector<HTMLFormElement>('#developer-console-form');
    const input = document.querySelector<HTMLInputElement>('#developer-console-input');
    const dragHandle = document.querySelector<HTMLElement>('#developer-console-drag-handle');
    const resizeHandle = document.querySelector<HTMLElement>('#developer-console-resize-handle');
    const suggestions = document.querySelector<HTMLElement>('#developer-console-suggestions');
    const itemPickerRoot = document.querySelector<HTMLElement>('#developer-console-item-picker');
    const itemPickerGrid = document.querySelector<HTMLElement>('#developer-console-item-grid');
    const itemPickerDragHandle = document.querySelector<HTMLElement>(
      '#developer-item-picker-drag-handle',
    );
    const itemPickerResizeHandle = document.querySelector<HTMLElement>(
      '#developer-item-picker-resize-handle',
    );

    if (
      !overlay ||
      !output ||
      !form ||
      !input ||
      !dragHandle ||
      !resizeHandle ||
      !suggestions ||
      !itemPickerRoot ||
      !itemPickerGrid ||
      !itemPickerDragHandle ||
      !itemPickerResizeHandle
    ) {
      throw new Error('Developer console elements are missing.');
    }

    this.overlay = overlay;
    this.output = output;
    this.form = form;
    this.input = input;
    this.dragHandle = dragHandle;
    this.resizeHandle = resizeHandle;
    this.suggestionsElement = suggestions;
    this.itemPickerRoot = itemPickerRoot;
    this.itemPicker = new DeveloperItemPicker({
      root: itemPickerRoot,
      grid: itemPickerGrid,
      dragHandle: itemPickerDragHandle,
      resizeHandle: itemPickerResizeHandle,
      getOptions: config.getItemOptions,
      onSelect: (option) => {
        this.executeAuthenticatedCommand(`spawn ${option.id}`);
      },
      onClose: () => {
        if (this.openState) {
          this.input.focus();
        }
      },
    });
    this.overlay.hidden = true;
    this.restoreWindowState();
    this.form.addEventListener('submit', this.handleSubmit);
    this.input.addEventListener('keydown', this.handleInputKeyDown);
    this.input.addEventListener('keyup', this.stopInputPropagation);
    this.input.addEventListener('input', this.handleInputChanged);
    this.suggestionsElement.addEventListener('pointerdown', this.handleSuggestionPointerDown);
    this.dragHandle.addEventListener('pointerdown', this.handleDragPointerDown);
    this.resizeHandle.addEventListener('pointerdown', this.handleResizePointerDown);
    document.addEventListener('keydown', this.handleDocumentKeyDown, true);
    document.addEventListener('pointerdown', this.handleDocumentPointerDown, true);
    window.addEventListener('pointermove', this.handleWindowPointerMove);
    window.addEventListener('pointerup', this.handleWindowPointerUp);
    window.addEventListener('pointercancel', this.handleWindowPointerUp);
    window.addEventListener('resize', this.handleWindowResize);
  }

  get isOpen(): boolean {
    return this.openState;
  }

  close(): void {
    if (!this.openState) {
      return;
    }

    this.openState = false;
    this.hideSuggestions();
    this.overlay.hidden = true;
    this.input.blur();
    this.config.onOpenChanged(false);
  }

  destroy(): void {
    this.close();
    this.itemPicker.destroy();
    this.form.removeEventListener('submit', this.handleSubmit);
    this.input.removeEventListener('keydown', this.handleInputKeyDown);
    this.input.removeEventListener('keyup', this.stopInputPropagation);
    this.input.removeEventListener('input', this.handleInputChanged);
    this.suggestionsElement.removeEventListener('pointerdown', this.handleSuggestionPointerDown);
    this.dragHandle.removeEventListener('pointerdown', this.handleDragPointerDown);
    this.resizeHandle.removeEventListener('pointerdown', this.handleResizePointerDown);
    document.removeEventListener('keydown', this.handleDocumentKeyDown, true);
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown, true);
    window.removeEventListener('pointermove', this.handleWindowPointerMove);
    window.removeEventListener('pointerup', this.handleWindowPointerUp);
    window.removeEventListener('pointercancel', this.handleWindowPointerUp);
    window.removeEventListener('resize', this.handleWindowResize);
    this.overlay.hidden = true;
  }

  private open(): void {
    if (this.openState || !this.config.canOpen()) {
      return;
    }

    this.openState = true;
    this.overlay.hidden = false;
    this.config.onOpenChanged(true);
    this.updateAuthenticationInputMode();

    if (this.output.childElementCount === 0) {
      this.appendLine('GAMZAISSAC 개발자 콘솔');
      this.appendLine('명령어를 사용하려면 비밀번호를 입력해주세요.');
    }

    window.requestAnimationFrame(() => {
      this.clampWindowToViewport();
      this.updateSuggestions();
      this.input.focus();
    });
  }

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (isItemPickerToggleInput(this.authenticated, event.code, event.repeat)) {
      if (!this.itemPicker.isOpen && !this.config.canOpen()) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (this.itemPicker.isOpen) {
        this.itemPicker.close();
      } else {
        this.itemPicker.open();
      }

      return;
    }

    const isToggle = event.code === 'Backquote';
    const isClose = this.openState && event.code === 'Escape';
    const isPickerClose = !this.openState && this.itemPicker.isOpen && event.code === 'Escape';

    if (isPickerClose && !event.repeat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.itemPicker.close();
      return;
    }

    if ((!isToggle && !isClose) || event.repeat) {
      return;
    }

    if (!this.openState && isToggle && !this.config.canOpen()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (this.openState) {
      this.close();
    } else {
      this.open();
    }
  };

  private readonly handleInputKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();

    if (!this.authenticated && event.code === 'Tab') {
      event.preventDefault();
      return;
    }

    if (event.code === 'Tab' && this.suggestions.length > 0) {
      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      this.selectSuggestion(direction);
      return;
    }

    if ((event.code === 'Enter' || event.code === 'Space') && this.suggestions.length > 0) {
      event.preventDefault();
      this.applySuggestion(this.selectedSuggestionIndex);
      return;
    }

    if (event.code !== 'ArrowUp' && event.code !== 'ArrowDown') {
      return;
    }

    event.preventDefault();

    if (this.suggestions.length > 0 && !this.browsingHistory) {
      const direction = event.code === 'ArrowUp' ? -1 : 1;
      this.selectSuggestion(direction);
      return;
    }

    this.browsingHistory = true;

    if (event.code === 'ArrowUp') {
      this.historyIndex = Math.max(0, this.historyIndex - 1);
    } else {
      this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
    }

    this.input.value = this.history[this.historyIndex] ?? '';
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    this.updateSuggestions();
  };

  private readonly handleInputChanged = (): void => {
    this.browsingHistory = false;

    if (!this.authenticated) {
      this.hideSuggestions();
      return;
    }

    this.updateSuggestions();
  };

  private readonly stopInputPropagation = (event: KeyboardEvent): void => {
    event.stopPropagation();
  };

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;

    if (
      !this.openState ||
      !(target instanceof Node) ||
      this.overlay.contains(target) ||
      this.itemPickerRoot.contains(target)
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.input.focus();
  };

  private readonly handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    void this.submitInput();
  };

  private async submitInput(): Promise<void> {
    const command = this.input.value.trim();

    if (!command || this.authenticationPending) {
      return;
    }

    if (!this.authenticated) {
      this.input.value = '';
      this.hideSuggestions();
      this.authenticationPending = true;

      let authenticated: boolean;

      try {
        authenticated = await verifyDeveloperConsolePassword(command);
      } catch {
        authenticated = false;
      } finally {
        this.authenticationPending = false;
      }

      if (authenticated) {
        this.authenticated = true;
        this.updateAuthenticationInputMode();
        this.appendLine('확인되었습니다.', 'success');
        this.appendLine('help를 입력하면 명령어 목록을 볼 수 있습니다.');
        this.appendLine('F2로 아이템 생성 창을 열고 닫을 수 있습니다.');
      } else {
        this.appendLine('알 수 없는 명령어입니다.');
      }

      this.input.focus();
      return;
    }

    this.executeAuthenticatedCommand(command);
  }

  private executeAuthenticatedCommand(command: string): void {
    if (this.history[this.history.length - 1] !== command) {
      this.history.push(command);
    }

    this.historyIndex = this.history.length;
    this.browsingHistory = false;
    this.appendLine(`> ${command}`, 'command');
    this.input.value = '';
    this.hideSuggestions();

    const result = this.config.onCommand(command);

    if (result.openItemPicker) {
      this.itemPicker.open();
      return;
    }

    if (result.clear) {
      this.output.replaceChildren();
      return;
    }

    for (const line of result.lines ?? []) {
      this.appendLine(line);
    }
  }

  private readonly handleSuggestionPointerDown = (event: PointerEvent): void => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const option = target.closest<HTMLElement>('[data-suggestion-index]');

    if (!option) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.selectedSuggestionIndex = Number(option.dataset.suggestionIndex);
    this.renderSuggestions();
    this.input.focus();
  };

  private readonly handleDragPointerDown = (event: PointerEvent): void => {
    this.startWindowInteraction(event, 'drag');
  };

  private readonly handleResizePointerDown = (event: PointerEvent): void => {
    this.startWindowInteraction(event, 'resize');
  };

  private readonly handleWindowPointerMove = (event: PointerEvent): void => {
    const interaction = this.windowInteraction;

    if (!interaction || event.pointerId !== interaction.pointerId) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - interaction.startPointerX;
    const deltaY = event.clientY - interaction.startPointerY;

    if (interaction.type === 'drag') {
      const maxLeft = Math.max(
        WINDOW_MARGIN,
        window.innerWidth - interaction.startWidth - WINDOW_MARGIN,
      );
      const maxTop = Math.max(
        WINDOW_MARGIN,
        window.innerHeight - interaction.startHeight - WINDOW_MARGIN,
      );
      this.overlay.style.left = `${clamp(interaction.startLeft + deltaX, WINDOW_MARGIN, maxLeft)}px`;
      this.overlay.style.top = `${clamp(interaction.startTop + deltaY, WINDOW_MARGIN, maxTop)}px`;
      return;
    }

    const maxWidth = Math.max(1, window.innerWidth - interaction.startLeft - WINDOW_MARGIN);
    const maxHeight = Math.max(1, window.innerHeight - interaction.startTop - WINDOW_MARGIN);
    const minWidth = Math.min(MIN_WINDOW_WIDTH, maxWidth);
    const minHeight = Math.min(MIN_WINDOW_HEIGHT, maxHeight);
    this.overlay.style.width = `${clamp(interaction.startWidth + deltaX, minWidth, maxWidth)}px`;
    this.overlay.style.height = `${clamp(interaction.startHeight + deltaY, minHeight, maxHeight)}px`;
  };

  private readonly handleWindowPointerUp = (event: PointerEvent): void => {
    if (!this.windowInteraction || event.pointerId !== this.windowInteraction.pointerId) {
      return;
    }

    this.windowInteraction = null;
    document.body.classList.remove('developer-console-adjusting');
    this.saveWindowState();
    this.input.focus();
  };

  private readonly handleWindowResize = (): void => {
    if (this.openState) {
      this.clampWindowToViewport();
      this.saveWindowState();
    }
  };

  private startWindowInteraction(event: PointerEvent, type: 'drag' | 'resize'): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const rect = this.overlay.getBoundingClientRect();
    this.windowInteraction = {
      type,
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    document.body.classList.add('developer-console-adjusting');
  }

  private updateSuggestions(): void {
    if (!this.authenticated) {
      this.hideSuggestions();
      return;
    }

    this.suggestions = getDeveloperConsoleSuggestions(this.input.value);
    this.selectedSuggestionIndex = 0;
    this.renderSuggestions();
  }

  private renderSuggestions(): void {
    if (this.suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    const options = this.suggestions.map((suggestion, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.dataset.suggestionIndex = `${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', `${index === this.selectedSuggestionIndex}`);
      option.textContent = suggestion.label;

      if (index === this.selectedSuggestionIndex) {
        option.classList.add('selected');
      }

      return option;
    });

    this.suggestionsElement.replaceChildren(...options);
    this.suggestionsElement.hidden = false;
    options[this.selectedSuggestionIndex]?.scrollIntoView({ block: 'nearest' });
  }

  private hideSuggestions(): void {
    this.suggestions = [];
    this.selectedSuggestionIndex = 0;
    this.suggestionsElement.hidden = true;
    this.suggestionsElement.replaceChildren();
  }

  private applySuggestion(index: number): void {
    const suggestion = this.suggestions[index];

    if (!suggestion) {
      return;
    }

    this.input.value = suggestion.completion;
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    this.browsingHistory = false;
    this.updateSuggestions();
    this.input.focus();
  }

  private selectSuggestion(direction: number): void {
    this.selectedSuggestionIndex =
      (this.selectedSuggestionIndex + direction + this.suggestions.length) %
      this.suggestions.length;
    this.renderSuggestions();
  }

  private clampWindowToViewport(): void {
    const rect = this.overlay.getBoundingClientRect();
    const maxWidth = Math.max(1, window.innerWidth - WINDOW_MARGIN * 2);
    const maxHeight = Math.max(1, window.innerHeight - WINDOW_MARGIN * 2);
    const width = clamp(rect.width, Math.min(MIN_WINDOW_WIDTH, maxWidth), maxWidth);
    const height = clamp(rect.height, Math.min(MIN_WINDOW_HEIGHT, maxHeight), maxHeight);
    const maxLeft = Math.max(WINDOW_MARGIN, window.innerWidth - width - WINDOW_MARGIN);
    const maxTop = Math.max(WINDOW_MARGIN, window.innerHeight - height - WINDOW_MARGIN);

    this.overlay.style.width = `${width}px`;
    this.overlay.style.height = `${height}px`;
    this.overlay.style.left = `${clamp(rect.left, WINDOW_MARGIN, maxLeft)}px`;
    this.overlay.style.top = `${clamp(rect.top, WINDOW_MARGIN, maxTop)}px`;
  }

  private restoreWindowState(): void {
    try {
      const rawState = window.localStorage.getItem(WINDOW_STATE_KEY);

      if (!rawState) {
        return;
      }

      const state = JSON.parse(rawState) as Partial<StoredConsoleWindowState>;

      if (![state.left, state.top, state.width, state.height].every(Number.isFinite)) {
        return;
      }

      this.overlay.style.left = `${state.left}px`;
      this.overlay.style.top = `${state.top}px`;
      this.overlay.style.width = `${state.width}px`;
      this.overlay.style.height = `${state.height}px`;
    } catch {
      // Storage can be disabled by browser privacy settings. The default layout still works.
    }
  }

  private saveWindowState(): void {
    const rect = this.overlay.getBoundingClientRect();

    try {
      window.localStorage.setItem(
        WINDOW_STATE_KEY,
        JSON.stringify({
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        } satisfies StoredConsoleWindowState),
      );
    } catch {
      // Console movement and resizing still work when storage is unavailable.
    }
  }

  private updateAuthenticationInputMode(): void {
    this.input.type = this.authenticated ? 'text' : 'password';
    this.input.setAttribute(
      'aria-label',
      this.authenticated ? '개발자 명령어' : '개발자 콘솔 비밀번호',
    );
  }

  private appendLine(text: string, className?: string): void {
    const line = document.createElement('div');
    line.textContent = text;

    if (className) {
      line.className = className;
    }

    this.output.append(line);
    this.output.scrollTop = this.output.scrollHeight;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
