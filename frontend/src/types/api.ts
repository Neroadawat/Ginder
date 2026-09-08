/**
 * Shared API type definitions.
 */

import {RestaurantCard} from './restaurant';

// ─── Auth ───
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  display_name: string;
  accepted_terms: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface MessageResponse {
  message: string;
}

// ─── User ───
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

// ─── Friend ───
export interface Friend {
  id: string;
  display_name: string;
  email: string;
}

export interface FriendListResponse {
  friends: Friend[];
  total: number;
}

// ─── Session ───
export interface CreateSessionRequest {
  latitude: number;
  longitude: number;
  radius_km: number;
  duration_seconds: number;
  category_filter?: string | null;
  /** Display tier 1-3, expanded server-side to Google's 0-4. */
  price_filter?: number | null;
  rating_filter?: number | null;
  open_now_filter?: boolean;
}

export interface SessionResponse {
  id: string;
  status: 'lobby' | 'active' | 'finished';
  host_id: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  duration_seconds: number;
  invite_code: string;
  category_filter: string | null;
  price_filter: number | null;
  rating_filter: number | null;
  open_now_filter: boolean;
  started_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export type ParticipantStatus = 'in_lobby' | 'swiping' | 'waiting' | 'disconnected';

export interface ParticipantResponse {
  user_id: string;
  display_name: string;
  status: ParticipantStatus;
}

export interface LobbyResponse {
  session: SessionResponse;
  participants: ParticipantResponse[];
}

export interface StartSessionResponse {
  session_id: string;
  status: string;
  started_at: string;
  ends_at: string;
  deck_size: number;
}

// ─── Vote ───
export interface SwipeRequest {
  restaurant_id: string;
  liked: boolean;
}

export interface SwipeResponse {
  success: boolean;
  unanimous_match: boolean;
  matched_restaurant_id: string | null;
}

export interface LikeEntry {
  user_id: string;
  display_name: string;
  restaurant: RestaurantCard;
}

export interface SessionLikesResponse {
  session_id: string;
  likes: LikeEntry[];
}

export interface SoloLikeResponse {
  id: string;
  restaurant: RestaurantCard;
}

// ─── Session resolution ───
export type ResolutionType =
  | 'unanimous'
  | 'majority'
  | 'spin_wheel_tie'
  | 'spin_wheel_no_match';

export interface ResolutionResponse {
  session_id: string;
  restaurant_id: string | null;
  restaurant_name: string;
  resolution_type: ResolutionType;
  google_maps_url: string | null;
  /** Restaurants that went on the wheel. Empty when no wheel was needed. */
  wheel_candidate_ids: string[];
}

export interface DeckFinishedResponse {
  session_finished: boolean;
  resolution: ResolutionResponse | null;
}

// ─── History ───
export interface MatchHistoryEntry {
  session_id: string;
  restaurant_name: string;
  photo_url: string | null;
  resolution_type: ResolutionType;
  google_maps_url: string | null;
  created_at: string;
}

export interface MatchHistoryResponse {
  history: MatchHistoryEntry[];
  total: number;
}

// ─── Notification ───
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unread_count: number;
}
