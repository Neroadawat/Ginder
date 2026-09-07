/**
 * Friend API — list, search, unfriend.
 */

import apiClient from './client';
import {FriendListResponse, MessageResponse} from '@/types/api';

export const friendApi = {
  listFriends: async (): Promise<FriendListResponse> => {
    const response = await apiClient.get('/friends/');
    return response.data;
  },

  searchFriends: async (query: string): Promise<FriendListResponse> => {
    const response = await apiClient.get('/friends/search', {
      params: {q: query},
    });
    return response.data;
  },

  unfriend: async (friendId: string): Promise<MessageResponse> => {
    const response = await apiClient.delete(`/friends/${friendId}`);
    return response.data;
  },
};
