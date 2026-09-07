/**
 * Session Store (Zustand) — tracks active session state.
 */

import {create} from 'zustand';

interface SessionState {
  activeSessionId: string | null;
  isInSession: boolean;

  setActiveSession: (sessionId: string) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSessionId: null,
  isInSession: false,

  setActiveSession: (sessionId) =>
    set({activeSessionId: sessionId, isInSession: true}),

  clearSession: () =>
    set({activeSessionId: null, isInSession: false}),
}));
