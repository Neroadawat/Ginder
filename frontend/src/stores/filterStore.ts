/**
 * Filter Store (Zustand) — manages filter preferences for solo mode / explore.
 */

import {create} from 'zustand';

import {DEFAULT_RADIUS_KM} from '@/constants/filters';

interface FilterState {
  category: string | null;
  priceLevel: number | null;
  minRating: number | null;
  radiusKm: number;

  // Computed getter for API calls
  latitude: number;
  longitude: number;

  setCategory: (category: string | null) => void;
  setPriceLevel: (priceLevel: number | null) => void;
  setMinRating: (minRating: number | null) => void;
  setRadiusKm: (radiusKm: number) => void;
  setLocation: (latitude: number, longitude: number) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  category: null,
  priceLevel: null,
  minRating: null,
  radiusKm: DEFAULT_RADIUS_KM,
  latitude: 0,
  longitude: 0,

  setCategory: (category) => set({category}),
  setPriceLevel: (priceLevel) => set({priceLevel}),
  setMinRating: (minRating) => set({minRating}),
  setRadiusKm: (radiusKm) => set({radiusKm}),
  setLocation: (latitude, longitude) => set({latitude, longitude}),
  reset: () =>
    set({
      category: null,
      priceLevel: null,
      minRating: null,
      radiusKm: DEFAULT_RADIUS_KM,
    }),
}));
