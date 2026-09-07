/**
 * Shared API type definitions.
 */

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
  price_filter?: number | null;
  rating_filter?: number | null;
}

export interface SessionResponse {
  id: string;
  host_id: string;
  status: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  duration_seconds: number;
  invite_code: string;
  category_filter: string | null;
  price_filter: number | null;
  rating_filter: number | null;
  started_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface ParticipantResponse {
  user_id: string;
  display_name: string;
  status: string;
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
  restaurant_id: string;
  restaurant_name: string;
}

export interface SessionLikesResponse {
  session_id: string;
  likes: LikeEntry[];
}

export interface SoloLikeResponse {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
}

// ─── History ───
export interface MatchHistoryEntry {
  session_id: string;
  restaurant_name: string;
  restaurant_image_url: string | null;
  resolution_type: string;
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
