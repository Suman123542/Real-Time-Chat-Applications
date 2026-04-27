# Real-Time-Chat-Applications

## OTP delivery (email + phone)
OTP is sent from the backend during signup/login verification:

- Email OTP needs SMTP configured in `chat_backend/.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
- Phone OTP needs Twilio configured in `chat_backend/.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `SMS_COUNTRY_CODE`).

Use `chat_backend/.env.example` as a template.

## Database (MongoDB)
Backend requires MongoDB. Set `MONGODB_URL` (or `MONGODB_URI` / `MONGO_URI`) in `chat_backend/.env`.

Optional: set `MONGODB_CONNECT_TIMEOUT_MS=6000` to control how fast the server fails when Mongo is unreachable.

### Quick health check
- `GET http://localhost:5000/api/auth/comms-health` → shows whether email/SMS is configured.
- `POST http://localhost:5000/api/auth/test-otp` (development only) → sends a test OTP to an email/mobile you provide.
