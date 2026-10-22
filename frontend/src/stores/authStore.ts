/**
 * Auth Store (Zustand) — manages authentication state and token persistence.
 */

import {create} from 'zustand';
import * as Keychain from 'react-native-keychain';
import {useSessionStore} from './sessionStore';
import {queryClient} from '@/services/queryClient';
import {clearFCMRegistration} from '@/services/pushRegistration';

const TOKEN_SERVICE = 'com.tamsoot.ginder.auth';
let authRevision = 0;
export const getAuthRevision = () => authRevision;
let credentialQueue: Promise<unknown> = Promise.resolve();

// Serialize secure-storage writes so a slow refresh cannot overwrite logout
// or credentials belonging to the next account.
const updateCredentials = (operation: () => Promise<unknown>) => {
  const pending = credentialQueue.then(operation, operation);
  credentialQueue = pending.catch(() => {});
  return pending;
};

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;

  setTokens: (
    accessToken: string,
    refreshToken: string,
    userId: string,
    expectedRefreshToken?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  userId: null,

  setTokens: async (
    accessToken,
    refreshToken,
    userId,
    expectedRefreshToken,
  ) => {
    if (
      expectedRefreshToken !== undefined &&
      get().refreshToken !== expectedRefreshToken
    ) {
      return;
    }
    if (expectedRefreshToken === undefined) {
      authRevision += 1;
    }
    const revision = authRevision;
    if (get().userId !== userId) {
      queryClient.clear();
      useSessionStore.getState().clearSession();
    }
    await updateCredentials(async () => {
      if (revision !== authRevision) {
        return;
      }
      await Keychain.setGenericPassword(
        userId,
        JSON.stringify({accessToken, refreshToken}),
        {
          service: TOKEN_SERVICE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        },
      );
    });
    if (revision === authRevision) {
      // Old screens may have refetched while secure storage was being written.
      if (get().userId !== userId) {
        queryClient.clear();
      }
      set({isAuthenticated: true, accessToken, refreshToken, userId});
    }
  },

  logout: async () => {
    const {accessToken, userId} = get();
    authRevision += 1;
    queryClient.clear();
    useSessionStore.getState().clearSession();
    set({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      userId: null,
    });
    await Promise.all([
      updateCredentials(() =>
        Keychain.resetGenericPassword({service: TOKEN_SERVICE}),
      ),
      clearFCMRegistration(accessToken, userId, () => get().userId).catch(() => {}),
    ]);
  },

  hydrate: async () => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: TOKEN_SERVICE,
      });
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
