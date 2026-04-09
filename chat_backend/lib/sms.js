import twilio from "twilio";

const sanitizeEnv = (value = "") => String(value).trim().replace(/^['"]|['"]$/g, "");

const twilioAccountSid = sanitizeEnv(process.env.TWILIO_ACCOUNT_SID);
const twilioAuthToken = sanitizeEnv(process.env.TWILIO_AUTH_TOKEN);
const twilioFromNumber = sanitizeEnv(process.env.TWILIO_FROM_NUMBER);
const smsCountryCode = sanitizeEnv(process.env.SMS_COUNTRY_CODE);

export const isSmsConfigured = Boolean(
  twilioAccountSid &&
  twilioAuthToken &&
  twilioFromNumber &&
  smsCountryCode
);

const buildE164Number = (mobileDigits = "") => {
  const cleaned = String(mobileDigits).replace(/\D/g, "");
  if (!cleaned) return "";
  if (!smsCountryCode) return "";
  return `+${smsCountryCode}${cleaned}`;
};

let smsClient = null;

const getSmsClient = () => {
  if (!smsClient) {
    smsClient = twilio(twilioAccountSid, twilioAuthToken);
  }
  return smsClient;
};

export const sendVerificationSms = async ({ mobile, otp }) => {
  if (!isSmsConfigured) {
    throw new Error("SMS transport is not configured");
  }

  const to = buildE164Number(mobile);
  if (!to) {
    throw new Error("Invalid mobile number for SMS delivery");
  }

  const client = getSmsClient();
  await client.messages.create({
    from: twilioFromNumber,
    to,
    body: `Your Chattrix verification code is ${otp}. It expires in 10 minutes.`,
  });
};
