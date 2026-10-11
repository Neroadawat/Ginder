import apiClient from './client';
import {GoogleUsageResponse} from '@/types/api';

export const usageApi = {
  getGoogleUsage: async (): Promise<GoogleUsageResponse> => {
    const response = await apiClient.get('/usage/google');
    return response.data;
  },
};
