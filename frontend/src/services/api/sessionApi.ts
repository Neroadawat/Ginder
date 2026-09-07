/**
 * Session API — create, join, start, kick, invite, get.
 */

import apiClient from './client';
import {
  CreateSessionRequest,
  SessionResponse,
  LobbyResponse,
  StartSessionResponse,
  MessageResponse,
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

  inviteFriend: async (
    sessionId: string,
    friendId: string,
  ): Promise<MessageResponse> => {
    const response = await apiClient.post(`/sessions/${sessionId}/invite`, {
      friend_id: friendId,
    });
    return response.data;
  },
};
