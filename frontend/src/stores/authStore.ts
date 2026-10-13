/**
 * Auth Store (Zustand) — manages authentication state and token persistence.
 */

import {create} from 'zustand';
import * as Keychain from 'react-native-keychain';
import {useSessionStore} from './sessionStore';

const TOKEN_SERVICE = 'com.neroadawat.ginder.auth';

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;

  setTokens: (
    accessToken: string,
    refreshToken: string,
    userId: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  userId: null,

  setTokens: async (accessToken, refreshToken, userId) => {
    await Keychain.setGenericPassword(
      userId,
      JSON.stringify({accessToken, refreshToken}),
      {
        service: TOKEN_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );
    set({isAuthenticated: true, accessToken, refreshToken, userId});
  },

  logout: async () => {
    useSessionStore.getState().clearSession();
    set({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      userId: null,
    });
    await Keychain.resetGenericPassword({service: TOKEN_SERVICE});
  },

  hydrate: async () => {
    try {
      const credentials = await Keychain.getGenericPassword({service: TOKEN_SERVICE});
      if (!credentials) {
        return;
      }
      const {accessToken, refreshToken} = JSON.parse(credentials.password) as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (accessToken && refreshToken) {
        set({
          isAuthenticated: true,
          accessToken,
          refreshToken,
          userId: credentials.username,
        });
      }
    } catch {
      await Keychain.resetGenericPassword({service: TOKEN_SERVICE});
    }
  },
}));
