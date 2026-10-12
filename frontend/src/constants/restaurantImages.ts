import {RestaurantCard} from '@/types/restaurant';
import {getPlaceholderImage} from './placeholders';

// Unverified demo photos are kept as source files but excluded from app bundles.
export const getRestaurantImageUri = (restaurant: RestaurantCard): string =>
  restaurant.photo_url &&
  restaurant.photo_source &&
  restaurant.photo_attribution
    ? restaurant.photo_url
    : getPlaceholderImage(restaurant.primary_category);
