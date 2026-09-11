/**
 * Session API — create, join, start, kick, invite, get.
 */

import apiClient from './client';
import {
  CreateSessionRequest,
  DeckFinishedResponse,
  LobbyResponse,
  MessageResponse,
  ResolutionResponse,
  SessionResponse,
  StartSessionResponse,
  CurrentSessionResponse,
} from '@/types/api';

export const sessionApi = {
  create: async (data: CreateSessionRequest): Promise<SessionResponse> => {
    const response = await apiClient.post('/sessions/', data);
    return response.data;
  },

  join: async (inviteCode: string): Promise<LobbyResponse> => {
    const response = await apiClient.post('/sessions/join', {
      invite_code: inviteCode,
    });
    return response.data;
  },

  getCurrent: async (): Promise<CurrentSessionResponse> => {
    const response = await apiClient.get('/sessions/current');
    return response.data;
  },

  getSession: async (sessionId: string): Promise<LobbyResponse> => {
    const response = await apiClient.get(`/sessions/${sessionId}`);
    return response.data;
  },

  start: async (sessionId: string): Promise<StartSessionResponse> => {
    const response = await apiClient.post(`/sessions/${sessionId}/start`);
    return response.data;
  },

  kick: async (sessionId: string, userId: string): Promise<MessageResponse> => {
    const response = await apiClient.post(
      `/sessions/${sessionId}/kick/${userId}`,
    );
    return response.data;
  },

  leave: async (sessionId: string): Promise<MessageResponse> => {
    const response = await apiClient.post(`/sessions/${sessionId}/leave`);
    return response.data;
  },

  inviteFriend: async (
    sessionId: string,
    friendId: string,
  ): Promise<MessageResponse> => {
    const response = await apiClient.post(`/sessions/${sessionId}/invite`, {
      friend_id: friendId,
    });
    return response.data;
  },

  /** Report that the caller has swiped their whole deck (requirement 12.1). */
  reportDeckFinished: async (sessionId: string): Promise<DeckFinishedResponse> => {
    const response = await apiClient.post(`/sessions/${sessionId}/deck/finished`);
    return response.data;
  },

  getResult: async (sessionId: string): Promise<ResolutionResponse> => {
    const response = await apiClient.get(`/sessions/${sessionId}/result`);
    return response.data;
  },
};
