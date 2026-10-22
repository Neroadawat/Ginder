import {useLanguageStore} from '@/stores/languageStore';
import {english, thai} from './messages';

export type TranslationParams = Record<string, string | number>;

/** Original UI copy is the key; unknown server copy/proper names remain intact. */
export function t(key: string, params: TranslationParams = {}): string {
  const language = useLanguageStore.getState().language;
  const dictionary = language === 'en' ? english : thai;
  const text = Object.prototype.hasOwnProperty.call(dictionary, key)
    ? dictionary[key]
    : key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match,
  );
}

export function useTranslation() {
  const language = useLanguageStore(state => state.language);
  return {t, language};
}

export const dateLocale = () =>
  useLanguageStore.getState().language === 'th' ? 'th-TH' : 'en-GB';
