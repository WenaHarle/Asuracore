import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://devel-ai.ub.ac.id/api/asura';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const listenersRef = useRef(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    wsRef.current = new WebSocket(`${WS_URL}/ws`);

    wsRef.current.onopen = () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
    };

    wsRef.current.onclose = () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
      
      // Attempt reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);

        // Notify listeners based on message type
        if (data.type === 'telemetry' && data.deviceId && data.channel) {
          const key = `telemetry:${data.deviceId}:${data.channel}`;
          const listeners = listenersRef.current.get(key) || [];
          listeners.forEach(callback => callback(data));
        }

        if (data.type === 'status' && data.deviceId) {
          const key = `status:${data.deviceId}`;
          const listeners = listenersRef.current.get(key) || [];
          listeners.forEach(callback => callback(data));
        }
      } catch (e) {
        console.error('[WebSocket] Parse error:', e);
      }
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const subscribe = useCallback((deviceId, channel = null) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        deviceId,
        channel,
      }));
    }
  }, []);

  const unsubscribe = useCallback((deviceId, channel = null) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        deviceId,
        channel,
      }));
    }
  }, []);

  const addListener = useCallback((key, callback) => {
    const listeners = listenersRef.current.get(key) || [];
    listeners.push(callback);
    listenersRef.current.set(key, listeners);

    return () => {
      const current = listenersRef.current.get(key) || [];
      listenersRef.current.set(key, current.filter(cb => cb !== callback));
    };
  }, []);

  const onTelemetry = useCallback((deviceId, channel, callback) => {
    const key = `telemetry:${deviceId}:${channel}`;
    return addListener(key, callback);
  }, [addListener]);

  const onStatus = useCallback((deviceId, callback) => {
    const key = `status:${deviceId}`;
    return addListener(key, callback);
  }, [addListener]);

  return {
    isConnected,
    lastMessage,
    subscribe,
    unsubscribe,
    onTelemetry,
    onStatus,
  };
}
