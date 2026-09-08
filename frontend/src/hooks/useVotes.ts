/**
 * Vote hooks — swipe, likes (session + solo).
 */

import {useEffect} from 'react';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {voteApi} from '@/services/api/voteApi';
import {useSessionWebSocket} from '@/hooks/useWebSocket';
import {SwipeRequest} from '@/types/api';

export const useSwipe = (sessionId: string) => {
  return useMutation({
    mutationFn: (data: SwipeRequest) => voteApi.swipe(sessionId, data),
  });
};

export const useSessionLikes = (sessionId: string) => {
  const queryClient = useQueryClient();
  // The server broadcasts a "like" event over this same session socket the
  // moment a swipe is recorded (requirement 11.1, 15.5), so refetching on
  // that event is real-time rather than the fixed-interval poll this used to
  // be. The poll stays as a slow fallback in case a broadcast is missed.
  const {lastEvent} = useSessionWebSocket(sessionId);

  const query = useQuery({
    queryKey: ['likes', 'session', sessionId],
    queryFn: () => voteApi.getSessionLikes(sessionId),
    refetchInterval: 15000,
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (lastEvent?.event === 'like') {
      queryClient.invalidateQueries({queryKey: ['likes', 'session', sessionId]});
    }
  }, [lastEvent, queryClient, sessionId]);

  return query;
};

export const useSoloLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {restaurant_id: string}) => voteApi.soloLike(data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['likes', 'solo']});
    },
    // A dropped like is not worth interrupting the swipe flow for; the next
    // like will refresh the list anyway.
    retry: 1,
  });
};

export const useSoloLikes = () => {
  return useQuery({
    queryKey: ['likes', 'solo'],
    queryFn: () => voteApi.getSoloLikes(),
  });
};
