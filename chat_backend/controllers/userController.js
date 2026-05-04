import { randomBytes, randomInt, createHash } from "crypto";
import mongoose from "mongoose";
import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import argon2 from "argon2";
import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary.js";
import { saveBufferToLocalUpload } from "../lib/localUpload.js";
import { isEmailTransportConfigured, sendPasswordResetEmail, sendPasswordResetLinkEmail, sendVerificationEmail } from "../lib/mailer.js";
import { isSmsConfigured, sendVerificationSms } from "../lib/sms.js";
import { getIo, userSocketMap } from "../lib/realtime.js";

const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const truthy = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["1", "true", "yes", "y", "on"].includes(normalized);
};

// Dev OTPs are a security foot-gun. Keep them OFF by default in all environments.
// To explicitly allow them for local development, set SHOW_DEV_OTP=true.
const showDevOtp = truthy(process.env.SHOW_DEV_OTP ?? "false");

// When true, signup/reset flows require real email + SMS delivery (no dev OTP fallback).
// This matches production expectations and prevents "development OTP" from appearing.
const requireOtpDelivery = truthy(process.env.REQUIRE_OTP_DELIVERY ?? "true");

const parseBase64Image = (value = "") => {
    const match = String(value).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;

    const mimeType = match[1];
    const base64 = match[2];
    const ext = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";

    return {
        buffer: Buffer.from(base64, "base64"),
        fileName: `profile.${ext}`,
    };
};

const normalizeMobile = (value = "") => String(value).replace(/\D/g, "").trim();
const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
const createOtp = () => String(randomInt(100000, 1000000));
const hashOtp = (otp) => createHash("sha256").update(String(otp)).digest("hex");

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findUserByEmail = async (email) => {
    // Allow case-insensitive lookup for older records that may have stored mixed-case emails.
    const normalizedEmail = normalizeEmail(email);

    const collationMatch = await User.findOne({ email: normalizedEmail }).collation({ locale: "en", strength: 2 });
    if (collationMatch) return collationMatch;

    // Fallback for environments where collation matching is not behaving as expected.
    const emailRegex = `^${escapeRegex(normalizedEmail)}$`;
    return User.findOne({ email: { $regex: emailRegex, $options: "i" } });
};

const sanitizeUser = (userDoc) => {
    const user = userDoc?.toObject ? userDoc.toObject() : { ...userDoc };
    delete user.password;
    delete user.emailVerificationCode;
    delete user.emailVerificationExpiresAt;
    delete user.mobileVerificationCode;
    delete user.mobileVerificationExpiresAt;
    delete user.resetPasswordCode;
    delete user.resetPasswordExpiresAt;
    delete user.resetPasswordVerifiedAt;
    delete user.resetPasswordTokenHash;
    delete user.resetPasswordTokenExpiresAt;
    return user;
};

const prepareProfilePic = async (profilePic) => {
    if (!profilePic) return "";

    const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:5000";
    const parsedImage = parseBase64Image(profilePic);

    if (isCloudinaryConfigured) {
        try {
            const upload = await cloudinary.uploader.upload(profilePic, {
                resource_type: "image",
                folder: "chat-app/profiles",
                timeout: 60000,
            });
            return upload.secure_url;
        } catch (uploadErr) {
            console.warn("Cloudinary signup upload failed, using local fallback:", uploadErr?.message);
        }
    }

    if (parsedImage) {
        const localPath = await saveBufferToLocalUpload(parsedImage.buffer, parsedImage.fileName, "profiles");
        return `${backendBaseUrl}${localPath}`;
    }

    return "";
};

const issueAndSendEmailOtp = async (user) => {
    const otp = createOtp();
    user.emailVerificationCode = hashOtp(otp);
    user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    await user.save();

    if (requireOtpDelivery && !isEmailTransportConfigured) {
        return { devOtp: null, deliveredByEmail: false, error: "Email service is not configured" };
    }

    if (isEmailTransportConfigured) {
        try {
            await sendVerificationEmail({ email: user.email, name: user.name, otp });
            return { devOtp: null, deliveredByEmail: true };
        } catch (err) {
            console.warn("Email OTP delivery failed:", err?.message || err);
            return { devOtp: showDevOtp ? otp : null, deliveredByEmail: false, error: "Email OTP delivery failed" };
        }
    }

    return { devOtp: showDevOtp ? otp : null, deliveredByEmail: false, error: "Email service is not configured" };
};

const issueAndSendMobileOtp = async (user) => {
    const otp = createOtp();
    user.mobileVerificationCode = hashOtp(otp);
    user.mobileVerificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    await user.save();

    if (requireOtpDelivery && !isSmsConfigured) {
        return { devOtp: null, deliveredBySms: false, error: "SMS service is not configured" };
    }

    if (isSmsConfigured) {
        try {
            await sendVerificationSms({ mobile: user.mobile, otp });
            return { devOtp: null, deliveredBySms: true };
        } catch (err) {
            console.warn("SMS OTP delivery failed:", err?.message || err);
            return { devOtp: showDevOtp ? otp : null, deliveredBySms: false, error: "SMS OTP delivery failed" };
        }
    }

    return { devOtp: showDevOtp ? otp : null, deliveredBySms: false, error: "SMS service is not configured" };
};

const buildVerificationResponse = ({ emailResult, mobileResult }) => {
    const deliveredByEmail = emailResult?.deliveredByEmail ?? false;
    const deliveredBySms = mobileResult?.deliveredBySms ?? false;
    const attemptedEmail = Boolean(emailResult);
    const attemptedSms = Boolean(mobileResult);

    const messageParts = [];
    if (deliveredByEmail) messageParts.push("email");
    if (deliveredBySms) messageParts.push("phone");

    let message = "";
    if (messageParts.length) {
        message = `Verification code sent to your ${messageParts.join(" and ")}`;
    } else if (attemptedEmail && attemptedSms) {
        message = requireOtpDelivery
            ? "Unable to send verification codes. Please try again later."
            : showDevOtp
                ? "Email/SMS services are not configured, so the development verification codes are shown below"
                : "Email/SMS services are not configured. Please contact support.";
    } else if (attemptedEmail) {
        message = requireOtpDelivery
            ? "Unable to send email verification code. Please try again later."
            : showDevOtp
                ? "Email service is not configured, so the development verification code is shown below"
                : "Email service is not configured. Please contact support.";
    } else if (attemptedSms) {
        message = requireOtpDelivery
            ? "Unable to send SMS verification code. Please try again later."
            : showDevOtp
                ? "SMS service is not configured, so the development verification code is shown below"
                : "SMS service is not configured. Please contact support.";
    } else {
        message = "Verification required";
    }

    return {
        message,
        requiresVerification: true,
        deliveredByEmail,
        deliveredBySms,
        devEmailOtp: showDevOtp && !deliveredByEmail ? emailResult?.devOtp ?? null : null,
        devMobileOtp: showDevOtp && !deliveredBySms ? mobileResult?.devOtp ?? null : null,
    };
};

const finalizeVerificationIfReady = (user) => {
    if (user.isEmailVerified && user.isMobileVerified) {
        const token = generateToken(user._id);
        return { verified: true, token };
    }
    return { verified: false, token: null };
};

const issueAndSendPasswordResetOtp = async (user) => {
    const otp = createOtp();
    user.resetPasswordCode = hashOtp(otp);
    user.resetPasswordExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    user.resetPasswordVerifiedAt = null;
    await user.save();

    if (requireOtpDelivery && !isEmailTransportConfigured) {
        return { devOtp: null, deliveredByEmail: false, error: "Email service is not configured" };
    }

    if (isEmailTransportConfigured) {
        await sendPasswordResetEmail({ email: user.email, name: user.name, otp });
        return { devOtp: null, deliveredByEmail: true };
    }

    return { devOtp: showDevOtp ? otp : null, deliveredByEmail: false, error: "Email service is not configured" };
};

const hasValidResetOtp = (user, otp) => {
    if (!user?.resetPasswordCode || !user?.resetPasswordExpiresAt) return false;
    if (user.resetPasswordExpiresAt < new Date()) return false;
    return hashOtp(otp) === user.resetPasswordCode;
};

export const signup = async (req, res) => {
    const { name, password, profilePic, bio } = req.body;
    const email = normalizeEmail(req.body.email);
    const mobile = normalizeMobile(req.body.mobile);

    try {
        if (!name || !email || !password || !mobile) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }
        if (mobile.length !== 10) {
            return res.status(400).json({ message: "Mobile number must be exactly 10 digits" });
        }
        if (requireOtpDelivery) {
            if (!isEmailTransportConfigured) {
                return res.status(503).json({ message: "Email OTP is not configured. Please contact support." });
            }
            if (!isSmsConfigured) {
                return res.status(503).json({ message: "SMS OTP is not configured. Please contact support." });
            }
        }

        const existingMobileUser = await User.findOne({ mobile });
        if (existingMobileUser && normalizeEmail(existingMobileUser.email) !== email) {
            return res.status(400).json({ message: "Mobile number already in use" });
        }

        const existingUser = await findUserByEmail(email);
        if (existingUser?.isEmailVerified && existingUser?.isMobileVerified) {
            return res.status(400).json({ message: "User already exists" });
        }
        if (existingUser && (!existingUser.isEmailVerified || !existingUser.isMobileVerified)) {
            const now = new Date();
            const emailOtpActive = Boolean(
                existingUser.emailVerificationCode &&
                existingUser.emailVerificationExpiresAt &&
                existingUser.emailVerificationExpiresAt > now
            );
            const mobileOtpActive = Boolean(
                existingUser.mobileVerificationCode &&
                existingUser.mobileVerificationExpiresAt &&
                existingUser.mobileVerificationExpiresAt > now
            );

            if (emailOtpActive || mobileOtpActive) {
                return res.status(200).json({
                    message: "Verification already sent. Please check your email/phone or use resend.",
                    requiresVerification: true,
                    deliveredByEmail: false,
                    deliveredBySms: false,
                    devEmailOtp: null,
                    devMobileOtp: null,
                    email: existingUser.email,
                    mobile: existingUser.mobile,
                });
            }
        }

        const hashedPassword = await argon2.hash(password);
        const profilePicUrl = existingUser?.profilePic || await prepareProfilePic(profilePic);

        const user = existingUser || new User({ email });
        const previousEmail = existingUser?.email;
        const previousMobile = existingUser?.mobile;
        user.name = name.trim();
        user.email = email;
        user.mobile = mobile;
        user.password = hashedPassword;
        user.profilePic = profilePicUrl;
        user.bio = bio || existingUser?.bio || "";
        user.isEmailVerified = Boolean(existingUser?.isEmailVerified && normalizeEmail(previousEmail) === email);
        user.isMobileVerified = Boolean(existingUser?.isMobileVerified && normalizeMobile(previousMobile) === mobile);

        const emailResult = user.isEmailVerified ? null : await issueAndSendEmailOtp(user);
        const mobileResult = user.isMobileVerified ? null : await issueAndSendMobileOtp(user);

        if (requireOtpDelivery) {
            const emailOk = user.isEmailVerified || Boolean(emailResult?.deliveredByEmail);
            const smsOk = user.isMobileVerified || Boolean(mobileResult?.deliveredBySms);
            if (!emailOk || !smsOk) {
                return res.status(503).json({
                    message: "Unable to send verification codes right now. Please try again later.",
                    deliveredByEmail: Boolean(emailResult?.deliveredByEmail),
                    deliveredBySms: Boolean(mobileResult?.deliveredBySms),
                    requiresVerification: true,
                });
            }
        }

        return res.status(200).json({
            ...buildVerificationResponse({ emailResult, mobileResult }),
            email: user.email,
            mobile: user.mobile,
        });
    } catch (error) {
        // Common DB error when trying to sign up with an existing email/mobile.
        if (error?.code === 11000) {
            const dupFields = Object.keys(error?.keyPattern || error?.keyValue || {});
            if (dupFields.includes("email")) {
                return res.status(400).json({ message: "Email already in use" });
            }
            if (dupFields.includes("mobile")) {
                return res.status(400).json({ message: "Mobile number already in use" });
            }
            return res.status(400).json({ message: "User already exists" });
        }

        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const verifyEmailOtp = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { otp } = req.body;

    try {
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and verification code are required" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.isEmailVerified) {
            const { verified, token } = finalizeVerificationIfReady(user);
            return res.status(200).json({
                user: sanitizeUser(user),
                token: verified ? token : null,
                requiresVerification: !verified,
                message: verified ? "Email already verified" : "Email already verified. Please verify your phone.",
            });
        }
        if (!user.emailVerificationCode || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
            return res.status(400).json({ message: "Verification code expired. Please request a new one." });
        }
        if (hashOtp(otp) !== user.emailVerificationCode) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        user.isEmailVerified = true;
        user.emailVerificationCode = null;
        user.emailVerificationExpiresAt = null;
        await user.save();

        const { verified, token } = finalizeVerificationIfReady(user);
        return res.status(200).json({
            user: sanitizeUser(user),
            token: verified ? token : null,
            requiresVerification: !verified,
            message: verified ? "Email verified successfully" : "Email verified. Please verify your phone.",
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

const issueAndSendPasswordResetLink = async (user) => {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(String(token)).digest("hex");

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordTokenExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    await user.save();

    if (!isEmailTransportConfigured) {
        return { token: null, deliveredByEmail: false };
    }

    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
    const resetLink = `${frontendBaseUrl}/reset-password?token=${token}`;
    await sendPasswordResetLinkEmail({ email: user.email, name: user.name, resetLink });

    return { token, deliveredByEmail: true };
};

const hasValidResetToken = (user, token) => {
    if (!user?.resetPasswordTokenHash || !user?.resetPasswordTokenExpiresAt) return false;
    if (user.resetPasswordTokenExpiresAt < new Date()) return false;
    const tokenHash = createHash("sha256").update(String(token)).digest("hex");
    return tokenHash === user.resetPasswordTokenHash;
};

export const verifyMobileOtp = async (req, res) => {
    const mobile = normalizeMobile(req.body.mobile);
    const { otp } = req.body;

    try {
        if (!mobile || !otp) {
            return res.status(400).json({ message: "Mobile number and verification code are required" });
        }
        if (mobile.length !== 10) {
            return res.status(400).json({ message: "Mobile number must be exactly 10 digits" });
        }

        const user = await User.findOne({ mobile });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.isMobileVerified) {
            const { verified, token } = finalizeVerificationIfReady(user);
            return res.status(200).json({
                user: sanitizeUser(user),
                token: verified ? token : null,
                requiresVerification: !verified,
                message: verified ? "Phone already verified" : "Phone already verified. Please verify your email.",
            });
        }
        if (!user.mobileVerificationCode || !user.mobileVerificationExpiresAt || user.mobileVerificationExpiresAt < new Date()) {
            return res.status(400).json({ message: "Verification code expired. Please request a new one." });
        }
        if (hashOtp(otp) !== user.mobileVerificationCode) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        user.isMobileVerified = true;
        user.mobileVerificationCode = null;
        user.mobileVerificationExpiresAt = null;
        await user.save();

        const { verified, token } = finalizeVerificationIfReady(user);
        return res.status(200).json({
            user: sanitizeUser(user),
            token: verified ? token : null,
            requiresVerification: !verified,
            message: verified ? "Phone verified successfully" : "Phone verified. Please verify your email.",
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const resendVerificationOtp = async (req, res) => {
    const email = normalizeEmail(req.body.email);

    try {
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }

        if (requireOtpDelivery && !isEmailTransportConfigured) {
            return res.status(503).json({ message: "Email OTP is not configured. Please contact support." });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.isEmailVerified) {
            return res.status(400).json({ message: "Email is already verified" });
        }

        const emailResult = await issueAndSendEmailOtp(user);
        if (requireOtpDelivery && !emailResult.deliveredByEmail) {
            return res.status(503).json({ message: "Unable to send email verification code. Please try again later." });
        }
        return res.status(200).json({
            message: emailResult.deliveredByEmail
                ? "Verification code resent successfully"
                : "Unable to send email verification code. Please try again later.",
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const resendMobileVerificationOtp = async (req, res) => {
    const mobile = normalizeMobile(req.body.mobile);

    try {
        if (!mobile) {
            return res.status(400).json({ message: "Mobile number is required" });
        }
        if (mobile.length !== 10) {
            return res.status(400).json({ message: "Mobile number must be exactly 10 digits" });
        }

        if (requireOtpDelivery && !isSmsConfigured) {
            return res.status(503).json({ message: "SMS OTP is not configured. Please contact support." });
        }

        const user = await User.findOne({ mobile });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.isMobileVerified) {
            return res.status(400).json({ message: "Phone is already verified" });
        }

        const mobileResult = await issueAndSendMobileOtp(user);
        if (requireOtpDelivery && !mobileResult.deliveredBySms) {
            return res.status(503).json({ message: "Unable to send SMS verification code. Please try again later." });
        }
        return res.status(200).json({
            message: mobileResult.deliveredBySms
                ? "Verification code resent successfully"
                : "Unable to send SMS verification code. Please try again later.",
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const requestPasswordResetOtp = async (req, res) => {
    const email = normalizeEmail(req.body.email);

    try {
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }

        if (requireOtpDelivery && !isEmailTransportConfigured) {
            return res.status(503).json({ message: "Email OTP is not configured. Please contact support." });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!user.isEmailVerified) {
            return res.status(400).json({ message: "Please verify your email before resetting the password" });
        }

        const { deliveredByEmail } = await issueAndSendPasswordResetOtp(user);
        if (requireOtpDelivery && !deliveredByEmail) {
            return res.status(503).json({ message: "Unable to send password reset code. Please try again later." });
        }
        return res.status(200).json({
            message: deliveredByEmail
                ? "A password reset code has been sent to your email"
                : "Unable to send password reset code. Please try again later.",
            email: user.email,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const resendPasswordResetOtp = async (req, res) => {
    const email = normalizeEmail(req.body.email);

    try {
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }

        if (requireOtpDelivery && !isEmailTransportConfigured) {
            return res.status(503).json({ message: "Email OTP is not configured. Please contact support." });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!user.isEmailVerified) {
            return res.status(400).json({ message: "Please verify your email before resetting the password" });
        }

        const { deliveredByEmail } = await issueAndSendPasswordResetOtp(user);
        if (requireOtpDelivery && !deliveredByEmail) {
            return res.status(503).json({ message: "Unable to send password reset code. Please try again later." });
        }
        return res.status(200).json({
            message: deliveredByEmail
                ? "Password reset code resent successfully"
                : "Unable to send password reset code. Please try again later.",
            email: user.email,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const verifyPasswordResetOtp = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { otp } = req.body;

    try {
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and verification code are required" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!hasValidResetOtp(user, otp)) {
            return res.status(400).json({ message: "Invalid or expired verification code" });
        }

        user.resetPasswordVerifiedAt = new Date();
        await user.save();

        return res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const resetPassword = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { otp, password } = req.body;

    try {
        if (!email || !otp || !password) {
            return res.status(400).json({ message: "Email, OTP, and new password are required" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!hasValidResetOtp(user, otp)) {
            return res.status(400).json({ message: "Invalid or expired verification code" });
        }
        if (!user.resetPasswordVerifiedAt) {
            return res.status(400).json({ message: "Please verify the OTP first" });
        }

        user.password = await argon2.hash(password);
        user.resetPasswordCode = null;
        user.resetPasswordExpiresAt = null;
        user.resetPasswordVerifiedAt = null;
        await user.save();

        return res.status(200).json({ message: "Password reset successful. Please log in with your new password." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const login = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        let isPasswordValid = false;
        try {
            isPasswordValid = await argon2.verify(user.password, String(password));
        } catch (verifyErr) {
            console.warn("Password verification failed:", verifyErr?.message || verifyErr);
            isPasswordValid = false;
        }
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        if (!user.isEmailVerified || !user.isMobileVerified) {
            const emailResult = user.isEmailVerified ? null : await issueAndSendEmailOtp(user);
            const mobileResult = user.isMobileVerified ? null : await issueAndSendMobileOtp(user);

            return res.status(403).json({
                ...buildVerificationResponse({ emailResult, mobileResult }),
                email: user.email,
                mobile: user.mobile,
                emailVerified: Boolean(user.isEmailVerified),
                mobileVerified: Boolean(user.isMobileVerified),
            });
        }

        const token = generateToken(user._id);
        return res.status(200).json({ user: sanitizeUser(user), token, message: "Login successful" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const checkAuth = async (req, res) => {
    res.json({ user: sanitizeUser(req.user), message: "User is authenticated" });
};

export const updateProfile = async (req, res) => {
    try {
        const { name, bio } = req.body;
        const userId = req.user._id;
        const updates = {};

        if (typeof name === "string" && name.trim()) {
            updates.name = name.trim();
        }
        if (typeof bio === "string") {
            updates.bio = bio;
        }

        const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:5000";

        if (req.file?.buffer) {
            if (isCloudinaryConfigured) {
                try {
                    const uploadBuffer = (buffer, options) =>
                        new Promise((resolve, reject) => {
                            const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
                                if (err) reject(err);
                                else resolve(result);
                            });
                            stream.end(buffer);
                        });

                    const upload = await uploadBuffer(req.file.buffer, {
                        resource_type: "image",
                        folder: "chat-app/profiles",
                        timeout: 60000,
                    });
                    updates.profilePic = upload.secure_url;
                } catch (uploadErr) {
                    console.warn("Cloudinary profile upload failed, using local fallback:", uploadErr?.message);
                }
            }

            if (!updates.profilePic) {
                const localPath = await saveBufferToLocalUpload(req.file.buffer, req.file.originalname, "profiles");
                updates.profilePic = `${backendBaseUrl}${localPath}`;
            }
        } else if (typeof req.body.profilePic === "string" && req.body.profilePic.trim()) {
            if (!isCloudinaryConfigured) {
                return res.status(500).json({ message: "Cloudinary is not configured on server" });
            }
            const upload = await cloudinary.uploader.upload(req.body.profilePic, {
                resource_type: "image",
                folder: "chat-app/profiles",
                timeout: 60000,
            });
            updates.profilePic = upload.secure_url;
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const userToReturn = sanitizeUser(updatedUser);

        const io = getIo();
        io?.emit("userProfileUpdated", {
            _id: String(userToReturn._id),
            name: userToReturn.name,
            bio: userToReturn.bio || "",
            profilePic: userToReturn.profilePic || "",
            mobile: userToReturn.mobile || "",
        });

        return res.status(200).json({ user: userToReturn, message: "Profile updated successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const requestPasswordResetLink = async (req, res) => {
    const email = normalizeEmail(req.body.email);

    try {
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!isEmailTransportConfigured) {
            return res.status(400).json({ message: "Email service is not configured" });
        }

        await issueAndSendPasswordResetLink(user);
        return res.status(200).json({ message: "Password reset link sent to your email" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const resetPasswordWithToken = async (req, res) => {
    const { token, password } = req.body;

    try {
        if (!token || !password) {
            return res.status(400).json({ message: "Token and new password are required" });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        const tokenHash = createHash("sha256").update(String(token)).digest("hex");
        const user = await User.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordTokenExpiresAt: { $gt: new Date() },
        });
        if (!user) {
            return res.status(400).json({ message: "Invalid or expired reset link" });
        }

        user.password = await argon2.hash(password);
        user.resetPasswordTokenHash = null;
        user.resetPasswordTokenExpiresAt = null;
        user.resetPasswordCode = null;
        user.resetPasswordExpiresAt = null;
        user.resetPasswordVerifiedAt = null;
        await user.save();

        return res.status(200).json({ message: "Password reset successful. Please log in with your new password." });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const getCommsHealth = async (req, res) => {
    return res.status(200).json({
        emailConfigured: Boolean(isEmailTransportConfigured),
        smsConfigured: Boolean(isSmsConfigured),
        environment: process.env.NODE_ENV || "development",
    });
};

export const getDbHealth = async (req, res) => {
    const conn = mongoose.connection;
    return res.status(200).json({
        readyState: conn.readyState, // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
        dbName: conn.name || null,
        host: conn.host || null,
    });
};


export const blockUser = async (req, res) => {
    try {
        const userId = req.user._id;
        const targetUserId = req.params.id;

        if (String(userId) === String(targetUserId)) {
            return res.status(400).json({ message: "You cannot block yourself" });
        }

        const targetUser = await User.findById(targetUserId).select("_id name");
        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $addToSet: { blockedUsers: targetUserId } },
            { new: true }
        ).select("-password");

        const requesterSocketId = userSocketMap[String(userId)];
        const targetSocketId = userSocketMap[String(targetUserId)];

        const io = getIo();
        if (requesterSocketId) {
            io?.to(requesterSocketId).emit("blockStatusChanged", {
                userId: String(targetUserId),
                blocked: true,
            });
        }

        if (targetSocketId) {
            io?.to(targetSocketId).emit("blockStatusChanged", {
                userId: String(userId),
                blockedByOther: true,
            });
        }

        return res.status(200).json({
            user: sanitizeUser(updatedUser),
            message: `${targetUser.name} has been blocked`,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};

export const unblockUser = async (req, res) => {
    try {
        const userId = req.user._id;
        const targetUserId = req.params.id;

        const targetUser = await User.findById(targetUserId).select("_id name");
        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $pull: { blockedUsers: targetUserId } },
            { new: true }
        ).select("-password");

        const requesterSocketId = userSocketMap[String(userId)];
        const targetSocketId = userSocketMap[String(targetUserId)];

        const io = getIo();
        if (requesterSocketId) {
            io?.to(requesterSocketId).emit("blockStatusChanged", {
                userId: String(targetUserId),
                blocked: false,
            });
        }

        if (targetSocketId) {
            io?.to(targetSocketId).emit("blockStatusChanged", {
                userId: String(userId),
                blockedByOther: false,
            });
        }

        return res.status(200).json({
            user: sanitizeUser(updatedUser),
            message: `${targetUser.name} has been unblocked`,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error?.message || "Server error" });
    }
};



