import type {NavigatorScreenParams} from '@react-navigation/native';

/**
 * Navigation type definitions for all navigators.
 */

export type RootStackParamList = {
  Consent: undefined;
  Auth: undefined;
  PermissionGate: undefined;
  Main: undefined;
  Session: NavigatorScreenParams<SessionStackParamList>;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: {token: string};
};

export type MainTabParamList = {
  HomeTab: undefined;
  ExploreTab: undefined;
  LikesTab: undefined;
  HistoryTab: undefined;
  ProfileTab: undefined;
};

export type HomeStackParamList = {
  SoloSwipe: undefined;
  FilterSettings: undefined;
  ExpandRadius: undefined;
};

export type ExploreStackParamList = {
  ExploreCategories: undefined;
  CategoryResults: {category: string};
};

export type SessionStackParamList = {
  CreateSession: undefined;
  JoinSession: {code?: string};
  Lobby: {sessionId: string};
  SessionSwipe: {sessionId: string; endsAt?: string};
  SessionResult: {sessionId: string};
  SpinWheel: {
    sessionId: string;
    /** Restaurants that went on the wheel, in a stable order. */
    candidateIds: string[];
    /** Winner chosen by the server, so every client lands on the same slice. */
    winnerId: string;
    winnerName: string;
  };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  FriendList: undefined;
  Notifications: undefined;
  History: undefined;
};
