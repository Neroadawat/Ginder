import {useEffect, useRef, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {useAuthStore} from '@/stores/authStore';
import {WS_BASE_URL} from '@/services/config';
import {SessionEvent, subscribeSessionSocket} from '@/services/sessionSocket';
import {DeckResponse} from '@/types/restaurant';

export const useSessionWebSocket = (
  sessionId: string,
  onEvent?: (event: SessionEvent) => void,
) => {
  const accessToken = useAuthStore(state => state.accessToken);
  const queryClient = useQueryClient();
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [lastEvent, setLastEvent] = useState<SessionEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setIsConnected(false);
    setLastEvent(null);
    if (!accessToken || !sessionId) return;
    return subscribeSessionSocket(
      `${WS_BASE_URL}/session/${sessionId}`,
      accessToken,
      {
        onConnection: connected => {
          setIsConnected(connected);
          if (connected) {
            queryClient.invalidateQueries(
              {queryKey: ['session', sessionId], exact: true},
              {cancelRefetch: false},
            );
          }
        },
        onEvent: event => {
          if (event.event === 'session_started' && event.data.deck) {
            queryClient.setQueryData(
              ['deck', 'session', sessionId],
              event.data.deck as DeckResponse,
            );
          }
          handler.current?.(event);
          setLastEvent(event);
          if (
            [
              'session_started',
              'result',
              'spin_wheel',
              'unanimous_match',
              'user_joined',
              'user_left',
            ].includes(event.event)
          ) {
            queryClient.invalidateQueries(
              {queryKey: ['session', sessionId], exact: true},
              {cancelRefetch: false},
            );
          }
        },
      },
    );
  }, [accessToken, sessionId, queryClient]);

  return {lastEvent, isConnected};
};
