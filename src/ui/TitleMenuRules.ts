export type TitleMenuMode = 'main' | 'settings';

export function getTitleSubtitle(mode: TitleMenuMode): string {
  return mode === 'main' ? '404% roguelike action' : '';
}

export function getTitleEscapeTarget(mode: TitleMenuMode): TitleMenuMode | null {
  return mode === 'settings' ? 'main' : null;
}

export function isEscapeCode(code: string): boolean {
  return code === 'Escape';
}
