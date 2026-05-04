import express from "express";

const router = express.Router();

const defaultIceServers = [{ urls: "stun:stun.l.google.com:19302" }];

const nonEmpty = (value) => {
  const v = String(value ?? "").trim();
  return v ? v : null;
};

const parseIceServers = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
};

const buildTurnIceServers = () => {
  // Convenience envs so you don't have to hand-write JSON.
  // Example:
  // TURN_HOST=turn.example.com
  // TURN_PORT=3478
  // TURN_USERNAME=turnuser
  // TURN_PASSWORD=turnpass
  const host = nonEmpty(process.env.TURN_HOST);
  const username = nonEmpty(process.env.TURN_USERNAME);
  const credential = nonEmpty(process.env.TURN_PASSWORD);
  if (!host || !username || !credential) return null;

  const port = Number(process.env.TURN_PORT || 3478);
  const scheme = nonEmpty(process.env.TURN_SCHEME) || "turn";

  // Provide both UDP and TCP URLs for better connectivity.
  const urls = [
    `${scheme}:${host}:${port}?transport=udp`,
    `${scheme}:${host}:${port}?transport=tcp`,
  ];

  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls, username, credential },
  ];
};

// Returns ICE servers for WebRTC (STUN/TURN). For cross-network calling, configure TURN.
router.get("/ice", (req, res) => {
  const iceServers =
    parseIceServers(process.env.WEBRTC_ICE_SERVERS) ||
    buildTurnIceServers() ||
    defaultIceServers;
  res.json({ iceServers });
});

export default router;
