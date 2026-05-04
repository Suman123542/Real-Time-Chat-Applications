const getDefaultBackendOrigin = () => {
  return "https://real-time-chat-applications-nyjr.onrender.com"
};

export const BACKEND_ORIGIN =
  (process.env.REACT_APP_BACKEND_ORIGIN || "").trim() || getDefaultBackendOrigin();

export const API_BASE =
  (process.env.REACT_APP_API_URL || "").trim() || `${BACKEND_ORIGIN}/api`;

export const SOCKET_URL =
  (process.env.REACT_APP_SOCKET_URL || "").trim() || BACKEND_ORIGIN;

export const resolveBackendUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;

  if (raw.startsWith("/")) {
    return `${BACKEND_ORIGIN}${raw}`;
  }

  try {
    const parsed = new URL(raw);
    const isLocalBackend =
      ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) &&
      (!parsed.port || parsed.port === "5000");

    if (isLocalBackend) {
      return `${BACKEND_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return raw;
  }

  return raw;
};

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
