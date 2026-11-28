"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

/**
 * Admin-side live refresh.
 *
 * Returns a number that grows every time a judge saves scores, or an admin
 * changes contestants / judges / criteria, for this event. Put it in the
 * dependency list of a fetch effect and the data is pulled again without
 * a page refresh.
 *
 * When the live connection is down it falls back to asking the server every
 * 10 seconds, so the screen never freezes on old numbers.
 */
export function useRealtimeData(eventId?: number | string | null) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const targetEvent = eventId ? Number(eventId) : null;
    let cancelled = false;
    let socket: Socket | null = null;
    let pollTimer: NodeJS.Timeout | null = null;

    const bump = () => {
      if (!cancelled) setVersion((v) => v + 1);
    };

    const startPolling = () => {
      if (!pollTimer) pollTimer = setInterval(bump, 10000);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const isProduction = window.location.protocol === "https:";
    socket = io({
      path: "/tabulation/ws",
      transports: ["polling"],
      secure: isProduction,
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
      upgrade: false,
    });

    const handleConnect = () => {
      stopPolling();
      // Admin screens need the judge's score updates, which are sent to the
      // event's room - so this socket joins the same room.
      if (targetEvent) socket?.emit("join-event", targetEvent);
      bump();
    };

    const handleDataChanged = (data: { eventId: number; type: string }) => {
      if (!data) return;
      if (targetEvent === null || Number(data.eventId) === targetEvent) bump();
    };

    const handleDisconnect = () => startPolling();
    const handleConnectError = () => startPolling();

    socket.on("connect", handleConnect);
    socket.on("data-changed", handleDataChanged);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) handleConnect();
    else startPolling();

    return () => {
      cancelled = true;
      stopPolling();
      socket?.off("connect", handleConnect);
      socket?.off("data-changed", handleDataChanged);
      socket?.off("disconnect", handleDisconnect);
      socket?.off("connect_error", handleConnectError);
      socket?.disconnect();
    };
  }, [eventId]);

  return version;
}
