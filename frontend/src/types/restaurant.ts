/**
 * Restaurant type definitions.
 */

export interface RestaurantCard {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  latitude: number;
  longitude: number;
  distance_km: number | null;
  price_level: number | null; // 1=฿, 2=฿฿, 3=฿฿฿
  rating: number | null;
  address: string | null;
  google_maps_url: string | null;
}

export interface DeckResponse {
  session_id: string | null;
  restaurants: RestaurantCard[];
  total: number;
}

export interface SoloFilterParams {
  latitude: number;
  longitude: number;
  radius_km: number;
  category?: string | null;
  price_level?: number | null;
  min_rating?: number | null;
}
