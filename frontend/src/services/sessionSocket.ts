export interface SessionEvent {
  event: string;
  data: Record<string, any>;
}

type Listener = {
  onEvent: (event: SessionEvent) => void;
  onConnection: (connected: boolean) => void;
};

// Tabs and session screens share one connection: the server allows one socket
// per user/session, so independent connections continually replace each other.
const connections = new Map<
  string,
  {
    listeners: Set<Listener>;
    socket: WebSocket | null;
    reconnect?: ReturnType<typeof setTimeout>;
    heartbeat?: ReturnType<typeof setInterval>;
  }
>();

export const subscribeSessionSocket = (
  url: string,
  token: string,
  listener: Listener,
): (() => void) => {
  const key = `${url}|${token}`;
  let connection = connections.get(key);
  if (!connection) {
    connection = {listeners: new Set(), socket: null};
    connections.set(key, connection);
  }
  const entry = connection;
  entry.listeners.add(listener);

  const connect = () => {
    entry.reconnect = undefined;
    if (!entry.listeners.size) return;
    const ws = new WebSocket(url, null, {
      headers: {Authorization: `Bearer ${token}`},
    });
    entry.socket = ws;
    ws.onopen = () => {
      if (entry.socket !== ws) return;
      entry.listeners.forEach(item => item.onConnection(true));
    };
    ws.onmessage = message => {
      if (entry.socket !== ws) return;
      let event: SessionEvent;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }
      if (typeof event?.event !== 'string' || !event.data) return;
      // Deliver every event before React can batch away intermediate updates.
      entry.listeners.forEach(item => item.onEvent(event));
    };
    ws.onclose = event => {
      if (entry.socket !== ws) return;
      entry.socket = null;
      entry.listeners.forEach(item => item.onConnection(false));
      if (entry.listeners.size && event.code !== 4001 && event.code !== 4003) {
        entry.reconnect = setTimeout(connect, 1000);
      }
    };
    ws.onerror = () => ws.close();
  };

  if (!entry.socket && !entry.reconnect) connect();
  listener.onConnection(entry.socket?.readyState === WebSocket.OPEN);
  if (!entry.heartbeat) {
    entry.heartbeat = setInterval(() => {
      if (entry.socket?.readyState === WebSocket.OPEN) {
        entry.socket.send(JSON.stringify({event: 'ping', data: {}}));
      }
    }, 20000);
  }

  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size) return;
    clearTimeout(entry.reconnect);
    clearInterval(entry.heartbeat);
    const ws = entry.socket;
    entry.socket = null;
    connections.delete(key);
    ws?.close();
  };
};
