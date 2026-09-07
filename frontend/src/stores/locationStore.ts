/**
 * Location Store (Zustand) — GPS coordinates and permission state.
 *
 * Location is mandatory for Ginder (requirement 2.8): the app cannot be used
 * without it, so we track enough detail to show the right recovery action.
 */

import {create} from 'zustand';

export type PermissionStatus =
  | 'unknown' // Not asked yet
  | 'granted' // User allowed
  | 'denied' // User denied, but we can ask again
  | 'blocked'; // User chose "never ask again" — must go to Settings

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  permissionStatus: PermissionStatus;
  isLocating: boolean;
  error: string | null;

  setLocation: (latitude: number, longitude: number) => void;
  setPermissionStatus: (status: PermissionStatus) => void;
  setLocating: (isLocating: boolean) => void;
  setError: (error: string | null) => void;
}

export const useLocationStore = create<LocationState>(set => ({
  latitude: null,
  longitude: null,
  permissionStatus: 'unknown',
  isLocating: false,
  error: null,

  setLocation: (latitude, longitude) =>
    set({latitude, longitude, error: null, isLocating: false}),

  setPermissionStatus: permissionStatus => set({permissionStatus}),

  setLocating: isLocating => set({isLocating}),

  setError: error => set({error, isLocating: false}),
}));

/** True once we have both permission and a real fix. */
export const selectHasLocation = (state: LocationState): boolean =>
  state.permissionStatus === 'granted' &&
  state.latitude !== null &&
  state.longitude !== null;
