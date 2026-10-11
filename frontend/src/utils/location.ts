/** Maximum age accepted for a location used to build a new deck. */
export const MAX_LOCATION_AGE_MS = 2 * 60 * 1000;

/** Whether a captured GPS fix is recent enough for restaurant discovery. */
export const isLocationFresh = (
  capturedAt: number | null,
  now: number = Date.now(),
): boolean => capturedAt !== null && now - capturedAt <= MAX_LOCATION_AGE_MS;
