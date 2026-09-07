/**
 * Shared filter options.
 *
 * Kept in one place so the solo, session and expand-radius screens can never
 * drift apart.
 */

/**
 * Search radius choices in kilometres, in 0.5 km steps up to 3 km.
 *
 * Scoped deliberately tight for the Thammasat Rangsit launch: students walk or
 * ride to eat, so a wider radius would fill the deck with places nobody visits.
 */
export const RADIUS_OPTIONS_KM = [0.5, 1, 1.5, 2, 2.5, 3] as const;

export const MIN_RADIUS_KM = RADIUS_OPTIONS_KM[0];
export const MAX_RADIUS_KM = RADIUS_OPTIONS_KM[RADIUS_OPTIONS_KM.length - 1];
export const DEFAULT_RADIUS_KM = 1.5;

/** Step used when widening the radius after the deck runs out. */
export const RADIUS_STEP_KM = 0.5;

export const PRICE_LEVELS = [
  {label: 'Any', value: null},
  {label: '฿', value: 1},
  {label: '฿฿', value: 2},
  {label: '฿฿฿', value: 3},
] as const;

export const SESSION_DURATION_OPTIONS = [
  {label: '1 min', value: 60},
  {label: '3 min', value: 180},
  {label: '5 min', value: 300},
  {label: '10 min', value: 600},
] as const;

/** Formats a radius for display, dropping the trailing ".0" on whole numbers. */
export const formatRadius = (km: number): string =>
  `${Number.isInteger(km) ? km : km.toFixed(1)} km`;

/** Radius choices larger than the current one, for the expand-radius screen. */
export const getWiderRadiusOptions = (currentKm: number): number[] =>
  RADIUS_OPTIONS_KM.filter(r => r > currentKm);
