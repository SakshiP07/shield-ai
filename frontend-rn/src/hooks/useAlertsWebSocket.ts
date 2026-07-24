import { useEffect, useRef, useState } from 'react';
import type { AlertItem } from '../lib/api';
import { getApiBase } from '../lib/api';
import { getToken } from '../lib/storage';

type WsMessage =
  | { type: 'connected'; user_id: string }
  | { type: 'alert'; data: AlertItem }
  | { type: 'error'; message: string }
  | { type: 'pong' };

function wsUrl(): string {
  if (process.env.EXPO_PUBLIC_WS_URL?.trim()) {
    return process.env.EXPO_PUBLIC_WS_URL.trim();
  }
  // Derive from the same API base (http://HOST:8000/api/v1 → ws://HOST:8000/ws/alerts)
  const base = getApiBase().replace(/\/api\/v1\/?$/, '');
  if (base.startsWith('https://')) return `${base.replace(/^https/, 'wss')}/ws/alerts`;
  if (base.startsWith('http://')) return `${base.replace(/^http/, 'ws')}/ws/alerts`;
  return 'ws://10.0.2.2:8000/ws/alerts';
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

    const connect = async () => {
      if (unmounted) return;

      // Token retrieval is async in RN
      const token = await getToken();
      if (!token || unmounted) return;

      clearPing();
      detachSocket(ws);
      const attempt = ++connectAttempt;
      ws = new WebSocket(wsUrl());

      ws.onopen = () => {
        if (unmounted || attempt !== connectAttempt) {
          detachSocket(ws);
          return;
        }
        // Send JWT after connect — never put tokens in the URL.
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
          reconnectTimer = setTimeout(() => void connect(), 3000);
        }
      };

      ws.onerror = () => {
        if (unmounted || attempt !== connectAttempt) return;
        detachSocket(ws);
      };
    };

    void connect();

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
