/**
 * Auth Store (Zustand) — manages authentication state and token persistence.
 */

import {create} from 'zustand';
import {MMKV} from 'react-native-mmkv';
import {useSessionStore} from './sessionStore';

const storage = new MMKV();

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;

  setTokens: (accessToken: string, refreshToken: string, userId: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  userId: null,

  setTokens: (accessToken, refreshToken, userId) => {
    storage.set('access_token', accessToken);
    storage.set('refresh_token', refreshToken);
    storage.set('user_id', userId);
    set({isAuthenticated: true, accessToken, refreshToken, userId});
  },

  logout: () => {
    storage.delete('access_token');
    storage.delete('refresh_token');
    storage.delete('user_id');
    useSessionStore.getState().clearSession();
    set({isAuthenticated: false, accessToken: null, refreshToken: null, userId: null});
  },

  hydrate: () => {
    const accessToken = storage.getString('access_token') || null;
    const refreshToken = storage.getString('refresh_token') || null;
    const userId = storage.getString('user_id') || null;
    if (accessToken && refreshToken) {
      set({isAuthenticated: true, accessToken, refreshToken, userId});
    }
  },
}));
