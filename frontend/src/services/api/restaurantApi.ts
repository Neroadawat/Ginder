/**
 * Restaurant API — categories, solo deck, session deck, single restaurant.
 */

import apiClient from './client';
import {DeckResponse, RestaurantCard, SoloFilterParams} from '@/types/restaurant';

export const restaurantApi = {
  getCategories: async (): Promise<string[]> => {
    const response = await apiClient.get('/restaurants/categories');
    return response.data;
  },

  getSoloDeck: async (filters: SoloFilterParams): Promise<DeckResponse> => {
    const response = await apiClient.post('/restaurants/deck', filters);
    return response.data;
  },

  getSessionDeck: async (sessionId: string): Promise<DeckResponse> => {
    const response = await apiClient.get(`/sessions/${sessionId}/deck`);
    return response.data;
  },

  getRestaurant: async (restaurantId: string): Promise<RestaurantCard> => {
    const response = await apiClient.get(`/restaurants/${restaurantId}`);
    return response.data;
  },
};
