/**
 * Notification API — list and mark as read.
 */

import apiClient from './client';
import {NotificationListResponse, MessageResponse} from '@/types/api';

export const notificationApi = {
  getNotifications: async (): Promise<NotificationListResponse> => {
    const response = await apiClient.get('/notifications/');
    return response.data;
  },

  markAsRead: async (notificationId: string): Promise<MessageResponse> => {
    const response = await apiClient.put(
      `/notifications/${notificationId}/read`,
    );
    return response.data;
  },
};
