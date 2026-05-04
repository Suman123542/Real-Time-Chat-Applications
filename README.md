# Real-Time-Chat-Applications

## Multi-device (two laptops) real-time + calls
If chat works only on the same laptop but not across two laptops, it usually means each laptop is connecting to its own `localhost` backend, so Socket.IO presence/messages and WebRTC signaling never reach the other device.

Fix: run **one** backend instance that both laptops can reach (LAN/public IP), and point both frontends to that backend:

- Copy `chat_frontend/.env.example` to `chat_frontend/.env`
- Set `REACT_APP_BACKEND_ORIGIN` to your backend host, e.g. `http://192.168.1.10:5000`
- Restart the frontend dev server after changing `.env`

### Audio/Video calls across different networks (different places)
For WebRTC calls to work reliably across different networks/NATs, you typically need:

- A **TURN server** (coturn) reachable on the public internet
- The frontend opened on **HTTPS** (camera/mic access is blocked on non-secure origins)

If you **do not** use TURN, calls often work on the **same Wi‑Fi/LAN**, but may fail when users are on **different networks** (mobile data, different ISPs, strict NAT/firewalls).

This project reads ICE server config from backend env `WEBRTC_ICE_SERVERS` and exposes it at `GET /api/webrtc/ice`.

## Production deployment (recommended)
Minimum setup for stable real-time chat + calling:

- Deploy `chat_backend` on a public VPS (port `5000` behind a reverse proxy is fine)
- Enable HTTPS for the frontend (and ideally for the backend)
- Run a TURN server (coturn) on the VPS and set `WEBRTC_ICE_SERVERS` in `chat_backend/.env`

### TURN (coturn) quick notes
- Open firewall ports: `3478` UDP/TCP (+ optional `5349` TCP/TLS) and a UDP relay range (example `49152-65535`).
- Example `WEBRTC_ICE_SERVERS`:
  - `WEBRTC_ICE_SERVERS=[{\"urls\":[\"stun:stun.l.google.com:19302\"]},{\"urls\":[\"turn:YOUR_VPS_IP:3478\"],\"username\":\"TURN_USER\",\"credential\":\"TURN_PASS\"}]`

### Frontend env
- `chat_frontend/.env`:
  - `REACT_APP_BACKEND_ORIGIN=https://YOUR_DOMAIN_OR_IP:5000` (or your reverse-proxy URL)
  - Restart frontend after changing `.env`

## OTP delivery (email + phone)
OTP is sent from the backend during signup/login verification:

- Email OTP needs SMTP configured in `chat_backend/.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
- Phone OTP needs Twilio configured in `chat_backend/.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `SMS_COUNTRY_CODE`).

Use `chat_backend/.env.example` as a template.

## Database (MongoDB)
Backend requires MongoDB. Set `MONGODB_URL` (or `MONGODB_URI` / `MONGO_URI`) in `chat_backend/.env`.

Optional: set `MONGODB_CONNECT_TIMEOUT_MS=6000` to control how fast the server fails when Mongo is unreachable.

### Quick health check
- `GET http://localhost:5000/api/auth/db-health` -> shows Mongo connection status + DB name.
- `POST /api/auth/test-otp` was removed (no development OTP endpoint).

### Start fresh (delete all users/messages)
Backend includes a safe reset script that drops the configured database.

- In `chat_backend/.env`, set `MONGODB_DB` to the exact database name you want to use (case-sensitive).
- Run from `chat_backend/`: `CONFIRM_DB_RESET=<your-db-name> npm run db:reset`

The script refuses to run unless `CONFIRM_DB_RESET` matches `MONGODB_DB`.
- `GET http://localhost:5000/api/auth/comms-health` → shows whether email/SMS is configured.
- `POST http://localhost:5000/api/auth/test-otp` (development only) → sends a test OTP to an email/mobile you provide.
