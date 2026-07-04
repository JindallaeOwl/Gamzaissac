export type Locale = 'en' | 'ko';

export type TranslationValue = string | TranslationTree;

export interface TranslationTree {
  [key: string]: TranslationValue;
}

export type TranslationParams = Record<string, string | number>;
