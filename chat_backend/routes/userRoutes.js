import express from 'express';
import multer from "multer";
import {
  blockUser,
  checkAuth,
  login,
  requestPasswordResetOtp,
  requestPasswordResetLink,
  resendPasswordResetOtp,
  resendVerificationOtp,
  resendMobileVerificationOtp,
  sendTestOtps,
  getCommsHealth,
  getDbHealth,
  resetPassword,
  resetPasswordWithToken,
  signup,
  unblockUser,
  updateProfile,
  verifyEmailOtp,
  verifyMobileOtp,
  verifyPasswordResetOtp,
} from '../controllers/userController.js';
import { protectRoute } from '../middleware/auth.js';

const userRouter = express.Router();
const upload = multer();

userRouter.post('/signup', signup);
userRouter.post('/verify-email', verifyEmailOtp);
userRouter.post('/verify-mobile', verifyMobileOtp);
userRouter.post('/resend-verification', resendVerificationOtp);
userRouter.post('/resend-mobile-verification', resendMobileVerificationOtp);
userRouter.post('/forgot-password', requestPasswordResetOtp);
userRouter.post('/forgot-password/link', requestPasswordResetLink);
userRouter.post('/forgot-password/resend', resendPasswordResetOtp);
userRouter.post('/verify-reset-otp', verifyPasswordResetOtp);
userRouter.post('/test-otp', sendTestOtps);
userRouter.get('/comms-health', getCommsHealth);
userRouter.get('/db-health', getDbHealth);
userRouter.post('/reset-password', resetPassword);
userRouter.post('/reset-password-link', resetPasswordWithToken);
userRouter.post('/login', login);
userRouter.put('/update-profile', protectRoute, upload.single("profilePic"), updateProfile);
userRouter.get('/check', protectRoute, checkAuth);
userRouter.post('/block/:id', protectRoute, blockUser);
userRouter.delete('/block/:id', protectRoute, unblockUser);

export default userRouter;


