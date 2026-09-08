/**
 * Consent Store (Zustand) — Terms of Service and Privacy Policy acceptance.
 *
 * Requirement 2: consent is the very first thing the user sees and gates the
 * rest of the app. It is stored per-device so it is only asked once, and the
 * accepted flag is also sent along at sign-up so the server has a record tied
 * to the account (requirement 2.4).
 */

import {MMKV} from 'react-native-mmkv';
import {create} from 'zustand';

const storage = new MMKV();

const CONSENT_KEY = 'accepted_terms_at';

interface ConsentState {
  hasConsented: boolean;
  /** ISO timestamp of when consent was given, or null. */
  consentedAt: string | null;

  accept: () => void;
  hydrate: () => void;
}

export const useConsentStore = create<ConsentState>(set => ({
  hasConsented: false,
  consentedAt: null,

  accept: () => {
    const timestamp = new Date().toISOString();
    storage.set(CONSENT_KEY, timestamp);
    set({hasConsented: true, consentedAt: timestamp});
  },

  hydrate: () => {
    const stored = storage.getString(CONSENT_KEY) ?? null;
    set({hasConsented: stored !== null, consentedAt: stored});
  },
}));
