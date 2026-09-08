/**
 * Filter Store (Zustand) — search preferences shared by Solo Mode and Explore.
 *
 * The same filter set is reused when creating a party session
 * (requirement 5.5).
 */

import {create} from 'zustand';

import {DEFAULT_RADIUS_KM} from '@/constants/filters';

interface FilterState {
  category: string | null;
  /** Display tier 1-3 (฿ / ฿฿ / ฿฿฿), expanded server-side to Google's 0-4. */
  priceLevel: number | null;
  minRating: number | null;
  radiusKm: number;
  /** Keep only places open at the current local time (requirement 5.3). */
  openNow: boolean;

  // Latest known coordinates, mirrored from the location store so deck queries
  // have a single place to read filters from.
  latitude: number;
  longitude: number;

  setCategory: (category: string | null) => void;
  setPriceLevel: (priceLevel: number | null) => void;
  setMinRating: (minRating: number | null) => void;
  setRadiusKm: (radiusKm: number) => void;
  setOpenNow: (openNow: boolean) => void;
  setLocation: (latitude: number, longitude: number) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>(set => ({
  category: null,
  priceLevel: null,
  minRating: null,
  radiusKm: DEFAULT_RADIUS_KM,
  openNow: false,
  latitude: 0,
  longitude: 0,

  setCategory: category => set({category}),
  setPriceLevel: priceLevel => set({priceLevel}),
  setMinRating: minRating => set({minRating}),
  setRadiusKm: radiusKm => set({radiusKm}),
  setOpenNow: openNow => set({openNow}),
  setLocation: (latitude, longitude) => set({latitude, longitude}),

  reset: () =>
    set({
      category: null,
      priceLevel: null,
      minRating: null,
      radiusKm: DEFAULT_RADIUS_KM,
      openNow: false,
    }),
}));
