import express from "express";

const router = express.Router();

const defaultIceServers = [{ urls: "stun:stun.l.google.com:19302" }];

const parseIceServers = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return defaultIceServers;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultIceServers;
    return parsed;
  } catch {
    return defaultIceServers;
  }
};

// Returns ICE servers for WebRTC (STUN/TURN). For cross-network calling, configure TURN.
router.get("/ice", (req, res) => {
  const iceServers = parseIceServers(process.env.WEBRTC_ICE_SERVERS);
  res.json({ iceServers });
});

export default router;

