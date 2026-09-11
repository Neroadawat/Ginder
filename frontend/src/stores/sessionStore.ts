/**
 * Session Store (Zustand) — tracks active session state.
 */

import {create} from 'zustand';
import {MMKV} from 'react-native-mmkv';

const storage = new MMKV();

interface SessionState {
  activeSessionId: string | null;
  isInSession: boolean;

  setActiveSession: (sessionId: string) => void;
  clearSession: () => void;
  hydrate: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSessionId: null,
  isInSession: false,

  setActiveSession: (sessionId) => {
    storage.set('active_session_id', sessionId);
    set({activeSessionId: sessionId, isInSession: true});
  },

  clearSession: () => {
    storage.delete('active_session_id');
    set({activeSessionId: null, isInSession: false});
  },
  hydrate: () => {
    const activeSessionId = storage.getString('active_session_id') ?? null;
    set({activeSessionId, isInSession: Boolean(activeSessionId)});
  },
}));
