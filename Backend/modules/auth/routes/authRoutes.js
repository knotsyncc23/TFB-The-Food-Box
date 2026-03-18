import express from 'express';
import {
  sendOTP,
  verifyOTP,
  register,
  login,
  resetPassword,
  refreshToken,
  logout,
  getCurrentUser,
  googleAuth,
  googleCallback,
  firebaseGoogleLogin,
  registerFcmToken,
  removeFcmToken,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
// Note: we keep validation simple here and enforce "at least phone or email" with .or()
// to avoid Joi dependency group conflicts.
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .optional(),
  email: Joi.string().email().optional(),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone', 'verify-email')
    .default('login')
}).or('phone', 'email'); // At least one of phone or email must be provided

const verifyOTPSchema = Joi.object({
  phone: Joi.string().optional(),
  email: Joi.string().email().optional(),
  otp: Joi.string().required().length(6),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone', 'verify-email')
    .default('login'),
  name: Joi.string().when('purpose', {
    is: 'register',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  role: Joi.string().valid('user', 'restaurant', 'delivery', 'admin').default('user'),
  // Password is only used for email-based registrations (e.g. admin signup)
  password: Joi.string().min(6).max(100).optional()
}).or('phone', 'email'); // At least one of phone or email must be provided

const registerSchema = Joi.object({
  name: Joi.string().required().min(2).max(50),
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required().min(6).max(100),
  phone: Joi.string().optional().pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/),
  role: Joi.string().valid('user', 'restaurant', 'delivery', 'admin').default('user')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required(),
  role: Joi.string().valid('user', 'restaurant', 'delivery', 'admin').optional()
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  otp: Joi.string().required().length(6),
  newPassword: Joi.string().required().min(6).max(100),
  role: Joi.string().valid('user', 'restaurant', 'delivery', 'admin').optional()
});

const fcmRegisterSchema = Joi.object({
  platform: Joi.string().valid('web', 'app', 'android', 'ios').required(),
  fcmToken: Joi.string().required(),
});

const fcmDeleteSchema = Joi.object({
  platform: Joi.string().valid('web', 'app', 'android', 'ios').required(),
});

// Public routes
// OTP-based authentication
router.post('/send-otp', validate(sendOTPSchema), sendOTP);
router.post('/verify-otp', validate(verifyOTPSchema), verifyOTP);

// Email/Password authentication
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// Token management
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

// FCM device token registration (authenticated)
router.post('/fcm-token', authenticate, validate(fcmRegisterSchema), registerFcmToken);
router.delete('/fcm-token', authenticate, validate(fcmDeleteSchema), removeFcmToken);

// Firebase Google login (using Firebase Auth ID token)
router.post('/firebase/google-login', firebaseGoogleLogin);

// Google OAuth routes
router.get('/google/:role', googleAuth);
router.get('/google/:role/callback', googleCallback);

// Protected routes
router.get('/me', authenticate, getCurrentUser);

export default router;

