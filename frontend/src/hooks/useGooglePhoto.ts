import {useQuery} from '@tanstack/react-query';

import {restaurantApi} from '@/services/api/restaurantApi';
import {RestaurantCard} from '@/types/restaurant';

/** Resolve a Google photo only while its live card is mounted. */
export const useGooglePhoto = (restaurant: RestaurantCard) => {
  const photoName = restaurant.google_photo_name;
  const canDisplayGooglePhoto =
    restaurant.source === 'google_live' &&
    Boolean(photoName) &&
    Boolean(restaurant.google_photo_maps_uri);

  return useQuery({
    queryKey: ['google-photo', photoName],
    queryFn: () => restaurantApi.getGooglePhoto(photoName!),
    enabled: canDisplayGooglePhoto,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
};
