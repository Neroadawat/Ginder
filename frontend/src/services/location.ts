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
import {isLocationFresh} from '@/utils/location';

type Coordinates = {latitude: number; longitude: number};
let inFlightLocationRequest: Promise<Coordinates | null> | null = null;

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
      title: 'Ginder ต้องใช้ตำแหน่งของคุณ',
      message: 'ใช้ตำแหน่งเพื่อค้นหาร้านอาหารใกล้คุณ',
      buttonPositive: 'อนุญาต',
      buttonNegative: 'ไม่อนุญาต',
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
export function getCurrentLocation(): Promise<Coordinates | null> {
  if (inFlightLocationRequest) {
    return inFlightLocationRequest;
  }

  const {setLocation, setLocating, setError, setPermissionStatus} =
    useLocationStore.getState();

  setLocating(true);

  const request = new Promise<Coordinates | null>(resolve => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setLocation(latitude, longitude, position.timestamp || Date.now());
        useFilterStore.getState().setLocation(latitude, longitude);
        resolve({latitude, longitude});
      },
      error => {
        if (error.code === 1) {
          setPermissionStatus('denied');
        }
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

  inFlightLocationRequest = request;
  return request.finally(() => {
    if (inFlightLocationRequest === request) {
      inFlightLocationRequest = null;
    }
  });
}

/** Return the cached fix only while it is recent; otherwise request GPS again. */
export async function ensureFreshLocation(): Promise<Coordinates | null> {
  const {latitude, longitude, capturedAt} = useLocationStore.getState();
  if (latitude !== null && longitude !== null && isLocationFresh(capturedAt)) {
    return {latitude, longitude};
  }

  return getCurrentLocation();
}

/** Open the OS settings page so the user can re-enable a blocked permission. */
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

function describeLocationError(code: number, fallback: string): string {
  // Codes from react-native-geolocation-service
  switch (code) {
    case 1:
      return 'ยังไม่ได้รับสิทธิ์ตำแหน่ง';
    case 2:
      return 'ยังหาตำแหน่งไม่ได้ กรุณาเปิด GPS แล้วลองอีกครั้ง';
    case 3:
      return 'ค้นหาตำแหน่งนานเกินไป กรุณาลองอีกครั้ง';
    default:
      return fallback || 'ยังหาตำแหน่งไม่ได้';
  }
}
