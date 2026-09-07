/**
 * Vote hooks — swipe, likes (session + solo).
 */

import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {voteApi} from '@/services/api/voteApi';
import {SwipeRequest} from '@/types/api';

export const useSwipe = (sessionId: string) => {
  return useMutation({
    mutationFn: (data: SwipeRequest) => voteApi.swipe(sessionId, data),
  });
};

export const useSessionLikes = (sessionId: string) => {
  return useQuery({
    queryKey: ['likes', 'session', sessionId],
    queryFn: () => voteApi.getSessionLikes(sessionId),
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
    enabled: !!sessionId,
  });
};

export const useSoloLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {restaurant_id: string}) => voteApi.soloLike(data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['likes', 'solo']});
    },
  });
};

export const useSoloLikes = () => {
  return useQuery({
    queryKey: ['likes', 'solo'],
    queryFn: () => voteApi.getSoloLikes(),
  });
};
