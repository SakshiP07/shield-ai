import { useEffect, useRef, useState } from 'react';
import type { AlertItem } from '../lib/api';

type WsMessage =
  | { type: 'connected'; user_id: string }
  | { type: 'alert'; data: AlertItem }
  | { type: 'error'; message: string }
  | { type: 'pong' };

function wsUrl(): string {
  // Dev: connect straight to uvicorn — avoids Vite /ws proxy EPIPE spam on reconnect/reload.
  if (import.meta.env.DEV) {
    return 'ws://127.0.0.1:8000/ws/alerts';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/alerts`;
}

export function useAlertsWebSocket(
  enabled: boolean,
  onAlert: (alert: AlertItem) => void,
) {
  const onAlertRef = useRef(onAlert);
  const [connected, setConnected] = useState(false);
  onAlertRef.current = onAlert;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const token = localStorage.getItem('shieldai_token');
    if (!token) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let unmounted = false;
    let connectAttempt = 0;

    const clearPing = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    };

    const detachSocket = (socket: WebSocket | null) => {
      if (!socket) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };

    const connect = () => {
      if (unmounted) return;
      clearPing();
      detachSocket(ws);
      const attempt = ++connectAttempt;
      ws = new WebSocket(wsUrl());

      ws.onopen = () => {
        if (unmounted || attempt !== connectAttempt) {
          detachSocket(ws);
          return;
        }
        // Send JWT after connect — never put tokens in the URL (uvicorn logs query strings).
        ws?.send(JSON.stringify({ type: 'auth', token }));
        setConnected(true);
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (unmounted || attempt !== connectAttempt) return;
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          if (msg.type === 'alert') {
            onAlertRef.current(msg.data);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (unmounted || attempt !== connectAttempt) return;
        setConnected(false);
        clearPing();
        if (!unmounted) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        if (unmounted || attempt !== connectAttempt) return;
        detachSocket(ws);
      };
    };

    connect();

    return () => {
      unmounted = true;
      connectAttempt += 1;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearPing();
      detachSocket(ws);
      ws = null;
      setConnected(false);
    };
  }, [enabled]);

  return { connected };
}
