/**
 * Restaurant types, mirroring the Google Places-aligned API payload.
 */

export interface RestaurantCard {
  id: string;

  /** Namespaced identifier retained for API compatibility. */
  place_id: string;

  /** Origin of the record; synthetic rows are development-only discovery data. */
  source: 'osm' | 'manual' | 'synthetic';

  name: string;

  /** Single display category, derived server-side from `types`. */
  primary_category: string;

  /** Raw Google types, most specific first. Not currently rendered. */
  types: string[];

  photo_url: string | null;
  photo_source: string | null;
  photo_attribution: string | null;
  latitude: number;
  longitude: number;
  distance_km: number | null;

  /** Google's raw 0-4 scale. */
  price_level: number | null;

  /** Pre-rendered ฿ symbols, so the client never remaps the scale itself. */
  price_symbol: string | null;

  rating: number | null;
  user_ratings_total: number | null;
  address: string | null;
  google_maps_url: string | null;
}

export interface DeckResponse {
  session_id: string | null;
  restaurants: RestaurantCard[];
  total: number;
  data_source: 'local' | 'osm_cache' | 'mixed' | 'none';
  coverage_status: 'full' | 'partial' | 'unsupported';
  suggested_radius_km: number | null;
}

export interface SoloFilterParams {
  latitude: number;
  longitude: number;
  radius_km: number;
  category?: string | null;
  /** Display tier 1-3, expanded server-side to Google's 0-4. */
  price_level?: number | null;
  min_rating?: number | null;
  open_now?: boolean;
}
