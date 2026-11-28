import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

let heartbeatInterval: NodeJS.Timeout | null = null;

// Remembered so a reconnect rejoins the event room by itself
let currentJudgeId: number | string | null = null;
let currentEventId: number | string | null = null;

// Listeners are attached once per socket, never again
let handlersBound = false;

function rejoinEventRoom() {
  if (socket && currentEventId) {
    console.log("Rejoining event room:", currentEventId);
    socket.emit("join-event", currentEventId);
  }
}

export function connectJudgeSocket(judgeId: number | string) {
  currentJudgeId = judgeId;

  if (!socket) {
    const isProduction = window.location.protocol === 'https:';
    socket = io({
      path: "/tabulation/ws",
      transports: ["polling"],  // Use polling only to avoid WebSocket 400 errors
      secure: isProduction,
      timeout: 15000,          // Reduced timeout for faster detection
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 10, // Increased attempts
      reconnectionDelay: 2000,  // Increased delay between attempts
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      upgrade: false           // Disable WebSocket upgrades entirely
    });
    handlersBound = false;
  }

  const activeSocket = socket;

  // Attach the listeners only once: attaching them again on every call
  // left the page with dead handlers on the previous socket.
  if (handlersBound) return activeSocket;

  activeSocket.on("connect", () => {
    console.log("Judge socket connected:", currentJudgeId, "Transport:", activeSocket.io.engine.transport.name);
    activeSocket.emit("judge-online", currentJudgeId);
    // A reconnect creates a fresh connection on the server, so the room
    // membership is gone: join it again to keep receiving the admin's changes.
    rejoinEventRoom();
    startHeartbeat();
  });

  activeSocket.on("connect_error", (error) => {
    console.error("Judge socket connection error:", error);
    stopHeartbeat();
  });

  activeSocket.on("disconnect", (reason) => {
    console.log("Judge socket disconnected:", reason);
    stopHeartbeat();
    if (reason === "transport close" || reason === "transport error") {
      console.log("Network-related disconnect, will attempt to reconnect...");
    } else if (reason === "io client disconnect") {
      console.log("Client-initiated disconnect, no reconnection needed");
    }
  });

  activeSocket.on("reconnect", (attemptNumber) => {
    console.log("Judge socket reconnected after", attemptNumber, "attempts");
    activeSocket.emit("judge-online", currentJudgeId);
    rejoinEventRoom();
    startHeartbeat();
  });

  activeSocket.on("reconnect_error", (error) => {
    console.error("Judge socket reconnection error:", error);
  });

  activeSocket.on("reconnect_failed", () => {
    console.error("Judge socket failed to reconnect after all attempts");
    stopHeartbeat();
  });

  handlersBound = true;

  return activeSocket;
}

function startHeartbeat() {
  stopHeartbeat(); // Clear any existing heartbeat

  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit("judge-heartbeat", currentJudgeId);
      console.log("Heartbeat sent for judge:", currentJudgeId);
    }
  }, 30000); // Send heartbeat every 30 seconds
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export function joinEventRoom(eventId: number | string) {
  currentEventId = eventId;

  if (socket) {
    console.log("Joining event room:", eventId);
    socket.emit("join-event", eventId);
  } else {
    // The room is remembered and joined as soon as the socket connects
    console.log("Socket not ready yet, will join event room on connect:", eventId);
  }
}

export function disconnectJudgeSocket() {
  stopHeartbeat();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  handlersBound = false;
}
