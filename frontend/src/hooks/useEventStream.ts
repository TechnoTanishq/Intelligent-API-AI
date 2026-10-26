import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectionStatus, EventRecord } from "../types";
import { wsUrl } from "../services/api";

const MAX_EVENTS = 500;

/**
 * Live event stream over WebSocket. Reconnects with backoff and exposes the
 * buffered events plus connection status. The dashboard reads from this.
 */
export function useEventStream(apiBase: string, paused: boolean) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const pausedRef = useRef(paused);
  const reconnectRef = useRef<number | null>(null);
  const manualCloseRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const connect = useCallback(() => {
    if (manualCloseRef.current) return;
    setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl(apiBase));
    } catch {
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");
    ws.onmessage = (ev) => {
      // Always buffer events even when display is paused; the App decides
      // whether to render them. This keeps the backend processing live.
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "event" && msg?.data) {
          setEvents((prev) => {
            const next = [msg.data as EventRecord, ...prev];
            return next.slice(0, MAX_EVENTS);
          });
        }
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onerror = () => setStatus("disconnected");
    ws.onclose = () => {
      setStatus("disconnected");
      scheduleReconnect();
    };
  }, [apiBase]);

  const scheduleReconnect = useCallback(() => {
    if (manualCloseRef.current) return;
    if (reconnectRef.current !== null) return;
    reconnectRef.current = window.setTimeout(() => {
      reconnectRef.current = null;
      connect();
    }, 2000);
  }, [connect]);

  useEffect(() => {
    manualCloseRef.current = false;
    connect();
    return () => {
      manualCloseRef.current = true;
      if (reconnectRef.current !== null) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const clear = useCallback(() => setEvents([]), []);

  const seed = useCallback((initial: EventRecord[]) => {
    setEvents((prev) => {
      const seen = new Set(prev.map((e) => e.event_id));
      const add = initial.filter((e) => !seen.has(e.event_id));
      // prev holds newer (WS) events; append older historical ones after.
      return [...prev, ...add].slice(0, MAX_EVENTS);
    });
  }, []);

  return { events, status, clear, seed };
}
