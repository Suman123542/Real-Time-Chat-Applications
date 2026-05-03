const getDefaultBackendOrigin = () => {
  if (typeof window === "undefined") return "http://localhost:5000";
  const protocol = window.location.protocol || "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:5000`;
};

export const BACKEND_ORIGIN =
  (process.env.REACT_APP_BACKEND_ORIGIN || "").trim() || getDefaultBackendOrigin();

export const API_BASE =
  (process.env.REACT_APP_API_URL || "").trim() || `${BACKEND_ORIGIN}/api`;

export const SOCKET_URL =
  (process.env.REACT_APP_SOCKET_URL || "").trim() || BACKEND_ORIGIN;

const defaultIceServers = [{ urls: "stun:stun.l.google.com:19302" }];

const parseIceServers = (raw) => {
  const value = (raw || "").trim();
  if (!value) return defaultIceServers;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultIceServers;
    return parsed;
  } catch {
    return defaultIceServers;
  }
};

// Expect JSON array, e.g.
// REACT_APP_WEBRTC_ICE_SERVERS='[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:turn.example.com:3478"],"username":"u","credential":"p"}]'
export const WEBRTC_ICE_SERVERS = parseIceServers(
  process.env.REACT_APP_WEBRTC_ICE_SERVERS
);

