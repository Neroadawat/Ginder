/**
 * Restaurant types, mirroring the Google Places-aligned API payload.
 */

export interface RestaurantCard {
  id: string;

  /** Namespaced identifier retained for API compatibility. */
  place_id: string;

  /** Origin of the record; synthetic rows are development-only discovery data. */
  source: 'osm' | 'manual' | 'synthetic' | 'google_live';

  name: string;

  /** Single display category, derived server-side from `types`. */
  primary_category: string;

  /** Raw Google types, most specific first. Not currently rendered. */
  types: string[];

  photo_url: string | null;
  photo_source: string | null;
  photo_attribution: string | null;
  google_photo_name: string | null;
  google_photo_maps_uri?: string | null;
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
  /** False for ephemeral Google previews, which have no database restaurant id. */
  can_like: boolean;
}

export interface GooglePhotoResponse {
  photo_uri: string | null;
  status:
    | 'available'
    | 'disabled'
    | 'rate_limited'
    | 'quota_exhausted'
    | 'failed';
  quota_warning: boolean;
}

export interface DeckResponse {
  session_id: string | null;
  restaurants: RestaurantCard[];
  total: number;
  data_source:
    | 'local'
    | 'osm_cache'
    | 'mixed'
    | 'google_live'
    | 'mixed_live'
    | 'none';
  coverage_status: 'full' | 'partial' | 'unsupported';
  suggested_radius_km: number | null;
  external_status:
    | 'not_needed'
    | 'available'
    | 'disabled'
    | 'filters_unsupported'
    | 'rate_limited'
    | 'quota_exhausted'
    | 'failed';
  quota_warning: boolean;
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
