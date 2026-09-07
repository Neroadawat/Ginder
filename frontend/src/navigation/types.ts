/**
 * Navigation type definitions for all navigators.
 */

export type RootStackParamList = {
  Auth: undefined;
  PermissionGate: undefined;
  Main: undefined;
  Session: {sessionId?: string; inviteCode?: string};
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
  Lobby: {sessionId: string};
  SessionSwipe: {sessionId: string};
  SessionResult: {sessionId: string};
  SpinWheel: {sessionId: string};
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  FriendList: undefined;
  Notifications: undefined;
};
