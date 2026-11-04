import {RestaurantCard} from '@/types/restaurant';
import {getPlaceholderImage} from './placeholders';

// Only fully attributed production URLs are displayed; otherwise use artwork
// owned by this project so an unverified restaurant photo can never ship.
export const getRestaurantImageUri = (restaurant: RestaurantCard): string =>
  restaurant.photo_url &&
  restaurant.photo_source &&
  restaurant.photo_attribution
    ? restaurant.photo_url
    : getPlaceholderImage(restaurant.primary_category);
