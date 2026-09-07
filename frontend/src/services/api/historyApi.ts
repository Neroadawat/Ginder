/**
 * History API — match history.
 */

import apiClient from './client';
import {MatchHistoryResponse} from '@/types/api';

export const historyApi = {
  getHistory: async (): Promise<MatchHistoryResponse> => {
    const response = await apiClient.get('/history/');
    return response.data;
  },
};
