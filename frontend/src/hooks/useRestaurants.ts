/**
 * Restaurant hooks — categories, solo deck, session deck.
 */

import {useQuery} from '@tanstack/react-query';

import {restaurantApi} from '@/services/api/restaurantApi';
import {useLocationStore} from '@/stores/locationStore';

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => restaurantApi.getCategories(),
  });
};

interface SoloDeckFilters {
  category?: string | null;
  priceLevel?: number | null;
  minRating?: number | null;
  radiusKm: number;
  /** Overrides the user's current location. Rarely needed. */
  latitude?: number;
  longitude?: number;
}

export const useSoloDeck = (filters: SoloDeckFilters) => {
  const storeLat = useLocationStore(state => state.latitude);
  const storeLng = useLocationStore(state => state.longitude);

  const latitude = filters.latitude ?? storeLat;
  const longitude = filters.longitude ?? storeLng;
  const hasCoords = latitude !== null && longitude !== null;

  return useQuery({
    queryKey: [
      'deck',
      'solo',
      latitude,
      longitude,
      filters.radiusKm,
      filters.category ?? null,
      filters.priceLevel ?? null,
      filters.minRating ?? null,
    ],
    queryFn: () =>
      restaurantApi.getSoloDeck({
        latitude: latitude as number,
        longitude: longitude as number,
        radius_km: filters.radiusKm,
        category: filters.category ?? undefined,
        price_level: filters.priceLevel ?? undefined,
        min_rating: filters.minRating ?? undefined,
      }),
    enabled: hasCoords,
  });
};

export const useSessionDeck = (sessionId: string) => {
  return useQuery({
    queryKey: ['deck', 'session', sessionId],
    queryFn: () => restaurantApi.getSessionDeck(sessionId),
    enabled: !!sessionId,
    // The deck is fixed for the life of the session — no need to refetch.
    staleTime: Infinity,
  });
};
