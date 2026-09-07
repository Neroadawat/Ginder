/**
 * App bootstrap — one-time startup work before the UI is usable.
 *
 * Restores the saved session from storage and acquires a location fix. Without
 * this, tokens persisted in MMKV are never read back (forcing a login on every
 * launch) and the deck queries stay disabled because coordinates are null.
 */

import {useCallback, useEffect, useState} from 'react';

import {getCurrentLocation, requestLocationPermission} from '@/services/location';
import {useAuthStore} from '@/stores/authStore';

export const useAppBootstrap = () => {
  const [isReady, setIsReady] = useState(false);

  const acquireLocation = useCallback(async () => {
    const status = await requestLocationPermission();
    if (status === 'granted') {
      await getCurrentLocation();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Restore tokens first so authenticated requests work straight away.
      useAuthStore.getState().hydrate();

      await acquireLocation();

      if (!cancelled) {
        setIsReady(true);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [acquireLocation]);

  return {isReady, retryLocation: acquireLocation};
};
