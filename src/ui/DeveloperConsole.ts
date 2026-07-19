export interface DeveloperConsoleCommandResult {
  lines?: readonly string[];
  clear?: boolean;
}

interface DeveloperConsoleConfig {
  canOpen: () => boolean;
  onOpenChanged: (open: boolean) => void;
  onCommand: (input: string) => DeveloperConsoleCommandResult;
}

export class DeveloperConsole {
  private readonly overlay: HTMLElement;
  private readonly output: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly input: HTMLInputElement;
  private readonly history: string[] = [];
  private historyIndex = 0;
  private openState = false;

  constructor(private readonly config: DeveloperConsoleConfig) {
    const overlay = document.querySelector<HTMLElement>('#developer-console');
    const output = document.querySelector<HTMLElement>('#developer-console-output');
    const form = document.querySelector<HTMLFormElement>('#developer-console-form');
    const input = document.querySelector<HTMLInputElement>('#developer-console-input');

    if (!overlay || !output || !form || !input) {
      throw new Error('Developer console elements are missing.');
    }

    this.overlay = overlay;
    this.output = output;
    this.form = form;
    this.input = input;
    this.overlay.hidden = true;
    this.form.addEventListener('submit', this.handleSubmit);
    this.input.addEventListener('keydown', this.handleInputKeyDown);
    this.input.addEventListener('keyup', this.stopInputPropagation);
    document.addEventListener('keydown', this.handleDocumentKeyDown, true);
    document.addEventListener('pointerdown', this.handleDocumentPointerDown, true);
  }

  get isOpen(): boolean {
    return this.openState;
  }

  close(): void {
    if (!this.openState) {
      return;
    }

    this.openState = false;
    this.overlay.hidden = true;
    this.input.blur();
    this.config.onOpenChanged(false);
  }

  destroy(): void {
    this.close();
    this.form.removeEventListener('submit', this.handleSubmit);
    this.input.removeEventListener('keydown', this.handleInputKeyDown);
    this.input.removeEventListener('keyup', this.stopInputPropagation);
    document.removeEventListener('keydown', this.handleDocumentKeyDown, true);
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown, true);
    this.overlay.hidden = true;
  }

  private open(): void {
    if (this.openState || !this.config.canOpen()) {
      return;
    }

    this.openState = true;
    this.overlay.hidden = false;
    this.config.onOpenChanged(true);

    if (this.output.childElementCount === 0) {
      this.appendLine('GAMZAISSAC 개발자 콘솔');
      this.appendLine('help를 입력하면 명령어 목록을 볼 수 있습니다.');
    }

    window.requestAnimationFrame(() => this.input.focus());
  }

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    const isToggle = event.code === 'Backquote';
    const isClose = this.openState && event.code === 'Escape';

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

    if (event.code !== 'ArrowUp' && event.code !== 'ArrowDown') {
      return;
    }

    event.preventDefault();

    if (event.code === 'ArrowUp') {
      this.historyIndex = Math.max(0, this.historyIndex - 1);
    } else {
      this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
    }

    this.input.value = this.history[this.historyIndex] ?? '';
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
  };

  private readonly stopInputPropagation = (event: KeyboardEvent): void => {
    event.stopPropagation();
  };

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;

    if (!this.openState || !(target instanceof Node) || this.overlay.contains(target)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.input.focus();
  };

  private readonly handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const command = this.input.value.trim();

    if (!command) {
      return;
    }

    if (this.history[this.history.length - 1] !== command) {
      this.history.push(command);
    }

    this.historyIndex = this.history.length;
    this.appendLine(`> ${command}`, 'command');
    this.input.value = '';

    const result = this.config.onCommand(command);

    if (result.clear) {
      this.output.replaceChildren();
      return;
    }

    for (const line of result.lines ?? []) {
      this.appendLine(line);
    }
  };

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
