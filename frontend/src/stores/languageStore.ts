import {create} from 'zustand';
import {createMMKV} from 'react-native-mmkv';

export type Language = 'en' | 'th';
const storage = createMMKV({id: 'ginder.preferences'});
const LANGUAGE_KEY = 'language';

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
  hydrate: () => void;
}

export const useLanguageStore = create<LanguageState>(set => ({
  // Deliberately independent of the phone locale. New installations use English.
  language: 'en',
  setLanguage: language => {
    if (language !== 'en' && language !== 'th') return;
    try {
      storage.set(LANGUAGE_KEY, language);
    } catch {
      /* Keep in-memory selection usable. */
    }
    set({language});
  },
  hydrate: () => {
    try {
      const saved = storage.getString(LANGUAGE_KEY);
      set({language: saved === 'th' ? 'th' : 'en'});
    } catch {
      set({language: 'en'});
    }
  },
}));
