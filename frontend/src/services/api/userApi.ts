/**
 * User API — profile, update, delete, FCM token.
 */

import apiClient from './client';
import {UserProfile, MessageResponse} from '@/types/api';

export const userApi = {
  getProfile: async (): Promise<UserProfile> => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  updateProfile: async (data: {display_name?: string}): Promise<UserProfile> => {
    const response = await apiClient.patch('/users/me', data);
    return response.data;
  },

  deleteAccount: async (): Promise<MessageResponse> => {
    const response = await apiClient.delete('/users/me');
    return response.data;
  },

  updateFCMToken: async (fcmToken: string): Promise<MessageResponse> => {
    const response = await apiClient.put('/users/me/fcm-token', {
      fcm_token: fcmToken,
    });
    return response.data;
  },
};
