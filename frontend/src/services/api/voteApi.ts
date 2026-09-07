/**
 * Vote API — swipe, session likes, solo likes.
 */

import apiClient from './client';
import {
  SwipeRequest,
  SwipeResponse,
  SessionLikesResponse,
  SoloLikeResponse,
} from '@/types/api';

export const voteApi = {
  swipe: async (sessionId: string, data: SwipeRequest): Promise<SwipeResponse> => {
    const response = await apiClient.post(
      `/votes/sessions/${sessionId}/swipe`,
      data,
    );
    return response.data;
  },

  getSessionLikes: async (sessionId: string): Promise<SessionLikesResponse> => {
    const response = await apiClient.get(
      `/votes/sessions/${sessionId}/likes`,
    );
    return response.data;
  },

  soloLike: async (data: {restaurant_id: string}): Promise<SoloLikeResponse> => {
    const response = await apiClient.post('/votes/solo/like', data);
    return response.data;
  },

  getSoloLikes: async (): Promise<SoloLikeResponse[]> => {
    const response = await apiClient.get('/votes/solo/likes');
    return response.data;
  },
};
