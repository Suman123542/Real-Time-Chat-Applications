import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    mobile: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    profilePic: {
        type: String,
        default: "",
    },
    bio: {
        type: String,
    },
    blockedUsers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    isMobileVerified: {
        type: Boolean,
        default: false,
    },
    emailVerificationCode: {
        type: String,
        default: null,
    },
    emailVerificationExpiresAt: {
        type: Date,
        default: null,
    },
    mobileVerificationCode: {
        type: String,
        default: null,
    },
    mobileVerificationExpiresAt: {
        type: Date,
        default: null,
    },
    resetPasswordCode: {
        type: String,
        default: null,
    },
    resetPasswordExpiresAt: {
        type: Date,
        default: null,
    },
    resetPasswordVerifiedAt: {
        type: Date,
        default: null,
    },
    resetPasswordTokenHash: {
        type: String,
        default: null,
    },
    resetPasswordTokenExpiresAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export default User;
