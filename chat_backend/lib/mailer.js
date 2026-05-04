import nodemailer from "nodemailer";

const sanitizeEnv = (value = "") => String(value).trim().replace(/^['"]|['"]$/g, "");

const smtpHost = sanitizeEnv(process.env.SMTP_HOST);
const smtpPort = Number(sanitizeEnv(process.env.SMTP_PORT) || 587);
const smtpUser = sanitizeEnv(process.env.SMTP_USER);
const smtpPass = sanitizeEnv(process.env.SMTP_PASS);
const configuredSmtpFrom = sanitizeEnv(process.env.SMTP_FROM || "");
const hasEmailAddress = (value = "") => /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/.test(String(value));
const smtpFrom = hasEmailAddress(configuredSmtpFrom)
  ? configuredSmtpFrom
  : `Chattrix <${smtpUser}>`;
const smtpTimeoutMs = Number(sanitizeEnv(process.env.SMTP_TIMEOUT_MS) || 8000);

export const isEmailTransportConfigured = Boolean(smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom);

let transporter = null;

const getTransporter = () => {
  if (!isEmailTransportConfigured) {
    throw new Error("Email transport is not configured");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      connectionTimeout: smtpTimeoutMs,
      greetingTimeout: smtpTimeoutMs,
      socketTimeout: smtpTimeoutMs,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  return transporter;
};

export const sendVerificationEmail = async ({ email, name, otp }) => {
  const transport = getTransporter();

  await transport.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Your Chattrix verification code",
    text: `Hi ${name || "there"}, your Chattrix verification code is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">Verify your email</h2>
        <p>Hi ${name || "there"},</p>
        <p>Your Chattrix verification code is:</p>
        <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; margin: 18px 0; color: #2563eb;">${otp}</div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async ({ email, name, otp }) => {
  const transport = getTransporter();

  await transport.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Your Chattrix password reset code",
    text: `Hi ${name || "there"}, your Chattrix password reset code is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">Reset your password</h2>
        <p>Hi ${name || "there"},</p>
        <p>Use this code to reset your Chattrix password:</p>
        <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; margin: 18px 0; color: #dc2626;">${otp}</div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
};

export const verifyEmailTransport = async () => {
  const transport = getTransporter();
  await transport.verify();
  return true;
};

export const sendPasswordResetLinkEmail = async ({ email, name, resetLink }) => {
  const transport = getTransporter();

  await transport.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Reset your Chattrix password",
    text: `Hi ${name || "there"}, reset your Chattrix password using this link: ${resetLink}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">Reset your password</h2>
        <p>Hi ${name || "there"},</p>
        <p>Click the button below to reset your Chattrix password. This link expires in 10 minutes.</p>
        <div style="margin: 18px 0;">
          <a href="${resetLink}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a>
        </div>
        <p>If the button doesn’t work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${resetLink}</p>
      </div>
    `,
  });
};
