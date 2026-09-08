/**
 * App bootstrap — one-time startup work before the UI is usable.
 *
 * Restores persisted state (consent, auth tokens) and finds out whether
 * location was already granted. It deliberately does **not** prompt for
 * location: requirement 3.3 says the system dialog must be preceded by an
 * explanation, which is the gate screen's job.
 */

import {useCallback, useEffect, useState} from 'react';

import {
  checkLocationPermission,
  getCurrentLocation,
  requestLocationPermission,
} from '@/services/location';
import {useAuthStore} from '@/stores/authStore';
import {useConsentStore} from '@/stores/consentStore';

export const useAppBootstrap = () => {
  const [isReady, setIsReady] = useState(false);

  /**
   * Prompt for location and fetch a fix. Called from the gate screen, after
   * the user has read why the app needs it.
   */
  const requestLocation = useCallback(async () => {
    const status = await requestLocationPermission();
    if (status === 'granted') {
      await getCurrentLocation();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Restore persisted state first so the navigator picks the right branch
      // on the very first render.
      useConsentStore.getState().hydrate();
      useAuthStore.getState().hydrate();

      // Only a silent check here. If permission survives from a previous run
      // we can go straight for coordinates and skip the gate entirely.
      const status = await checkLocationPermission();
      if (status === 'granted') {
        await getCurrentLocation();
      }

      if (!cancelled) {
        setIsReady(true);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return {isReady, requestLocation};
};
