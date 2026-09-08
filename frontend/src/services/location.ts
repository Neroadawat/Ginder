/**
 * Location service — permission handling and GPS fixes.
 *
 * Location is a hard requirement for Ginder (requirement 2.8), so these
 * helpers report precise failure reasons rather than a plain boolean.
 */

import {Linking, PermissionsAndroid, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';

import {PermissionStatus, useLocationStore} from '@/stores/locationStore';
import {useFilterStore} from '@/stores/filterStore';

/**
 * Check whether location access has already been granted, without prompting.
 *
 * Used at startup: showing a bare system dialog before the user has seen any
 * explanation is poor practice, so the prompt is deferred to the gate screen
 * (requirement 3.3).
 */
export async function checkLocationPermission(): Promise<PermissionStatus> {
  const {setPermissionStatus} = useLocationStore.getState();

  if (Platform.OS !== 'android') {
    // iOS is out of scope for this phase.
    setPermissionStatus('blocked');
    return 'blocked';
  }

  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );

  const status: PermissionStatus = granted ? 'granted' : 'unknown';
  setPermissionStatus(status);
  return status;
}

/**
 * Ask for foreground location permission and record the outcome.
 *
 * Distinguishes "denied" (can ask again) from "blocked" (user selected
 * "never ask again", so the only path forward is the system settings screen).
 */
export async function requestLocationPermission(): Promise<PermissionStatus> {
  const {setPermissionStatus} = useLocationStore.getState();

  if (Platform.OS !== 'android') {
    setPermissionStatus('blocked');
    return 'blocked';
  }

  // If it was granted previously, don't prompt again.
  const alreadyGranted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  if (alreadyGranted) {
    setPermissionStatus('granted');
    return 'granted';
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Ginder needs your location',
      message: 'Ginder uses your location to find restaurants near you.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  let status: PermissionStatus;
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    status = 'granted';
  } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    status = 'blocked';
  } else {
    status = 'denied';
  }

  setPermissionStatus(status);
  return status;
}

/**
 * Get a GPS fix and push it into the location and filter stores.
 *
 * Resolves to null on failure (GPS disabled, timeout) and records the reason
 * in the store so the UI can show it.
 */
export async function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  const {setLocation, setLocating, setError} = useLocationStore.getState();

  setLocating(true);

  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setLocation(latitude, longitude);
        useFilterStore.getState().setLocation(latitude, longitude);
        resolve({latitude, longitude});
      },
      error => {
        setError(describeLocationError(error.code, error.message));
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  });
}

/** Open the OS settings page so the user can re-enable a blocked permission. */
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

function describeLocationError(code: number, fallback: string): string {
  // Codes from react-native-geolocation-service
  switch (code) {
    case 1:
      return 'Location permission was denied.';
    case 2:
      return 'Location is unavailable. Please turn on GPS and try again.';
    case 3:
      return 'Finding your location timed out. Please try again.';
    default:
      return fallback || 'Could not determine your location.';
  }
}
