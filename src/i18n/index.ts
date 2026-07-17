import { en } from './en';
import { ko } from './ko';
import type { Locale, TranslationParams, TranslationTree, TranslationValue } from './types';

const STORAGE_KEY = 'die-al-and-error-locale';
const DEFAULT_LOCALE: Locale = 'ko';
const FALLBACK_LOCALE: Locale = 'en';
const dictionaries: Record<Locale, TranslationTree> = { en, ko };
const KOREAN_FONT_FALLBACK =
  'Galmuri11, DungGeunMo, "NeoDunggeunmo Pro", DOSGothic, DNFBitBitv2, Pretendard, "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", Inter, "Segoe UI", Arial, sans-serif';

export const BOLD_PIXELS_FONT_FAMILY = 'BoldPixels';

let currentLocale: Locale = loadStoredLocale();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  saveLocale(locale);
}

export function toggleLocale(): Locale {
  const nextLocale: Locale = currentLocale === 'ko' ? 'en' : 'ko';
  setLocale(nextLocale);
  return nextLocale;
}

export function t(key: string, params: TranslationParams = {}): string {
  const localized = lookup(dictionaries[currentLocale], key);
  const fallback = lookup(dictionaries[FALLBACK_LOCALE], key);
  const value =
    typeof localized === 'string' ? localized : typeof fallback === 'string' ? fallback : key;
  return interpolate(value, params);
}

export function gameFontStack(): string {
  return `"${BOLD_PIXELS_FONT_FAMILY}", ${KOREAN_FONT_FALLBACK}`;
}

function lookup(tree: TranslationTree, key: string): TranslationValue | undefined {
  return key.split('.').reduce<TranslationValue | undefined>((node, segment) => {
    if (!node || typeof node === 'string') {
      return undefined;
    }

    return node[segment];
  }, tree);
}

function interpolate(value: string, params: TranslationParams): string {
  return value.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? `${params[key]}` : match,
  );
}

function loadStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'ko' ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function saveLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}
