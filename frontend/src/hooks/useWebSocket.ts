/**
 * WebSocket hook — connects to session WebSocket for real-time events.
 */

import {useEffect, useRef, useState, useCallback} from 'react';

import {useAuthStore} from '@/stores/authStore';
import {WS_BASE_URL} from '@/services/config';

interface WSEvent {
  event: string;
  data: Record<string, any>;
}

export const useSessionWebSocket = (sessionId: string) => {
  const accessToken = useAuthStore(state => state.accessToken);
  const wsRef = useRef<WebSocket | null>(null);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!accessToken || !sessionId) return;

    const url = `${WS_BASE_URL}/session/${sessionId}?token=${accessToken}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const parsed: WSEvent = JSON.parse(event.data);
        setLastEvent(parsed);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          connect();
        }
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [accessToken, sessionId]);

  useEffect(() => {
    connect();

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({event: 'ping', data: {}}));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendEvent = useCallback((event: string, data: Record<string, any>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({event, data}));
    }
  }, []);

  return {lastEvent, isConnected, sendEvent};
};
