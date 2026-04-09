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
  firebaseSocialLogin,
  appleLogin,
  appleCallback,
  getAppleConfig,
  registerFcmToken,
  removeFcmToken,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .optional(),
  email: Joi.string().email().optional(),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone', 'verify-email')
    .default('login')
}).or('phone', 'email');

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
  password: Joi.string().min(6).max(100).optional()
}).or('phone', 'email');

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

const appleLoginSchema = Joi.object({
  identityToken: Joi.string().required(),
  name: Joi.string().trim().max(100).allow("", null),
  role: Joi.string().valid('user', 'restaurant', 'delivery').default('user'),
});

const firebaseSocialLoginSchema = Joi.object({
  idToken: Joi.string().required(),
  provider: Joi.string().valid('google', 'apple').required(),
  role: Joi.string().valid('user', 'restaurant', 'delivery').default('user'),
});

const PLATFORM_MAP = { 0: 'web', 1: 'app', 2: 'android', 3: 'ios' };

const fcmRegisterSchema = Joi.object({
  platform: Joi.alternatives()
    .try(
      Joi.string().lowercase().valid('web', 'app', 'android', 'ios'),
      Joi.number().integer().min(0).max(3),
      Joi.string().pattern(/^[0-3]$/)
    )
    .required()
    .custom((v) => {
      if (typeof v === 'number') return PLATFORM_MAP[v];
      if (typeof v === 'string' && /^[0-3]$/.test(v)) return PLATFORM_MAP[Number(v)];
      return v;
    }, 'platform map'),
  fcmToken: Joi.string().required(),
});

const fcmDeleteSchema = Joi.object({
  platform: Joi.alternatives()
    .try(
      Joi.string().lowercase().valid('web', 'app', 'android', 'ios'),
      Joi.number().integer().min(0).max(3),
      Joi.string().pattern(/^[0-3]$/)
    )
    .required()
    .custom((v) => {
      if (typeof v === 'number') return PLATFORM_MAP[v];
      if (typeof v === 'string' && /^[0-3]$/.test(v)) return PLATFORM_MAP[Number(v)];
      return v;
    }, 'platform map'),
});

const mergeFcmQueryForBody = (req, res, next) => {
  if (!req.body) req.body = {};
  if (!req.body.platform && req.query.platform) req.body.platform = req.query.platform;
  if (!req.body.fcmToken && req.query.fcmToken) req.body.fcmToken = req.query.fcmToken;
  next();
};

// Public routes
router.post('/send-otp', validate(sendOTPSchema), sendOTP);
router.post('/verify-otp', validate(verifyOTPSchema), verifyOTP);
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

router.post('/fcm-token', authenticate, mergeFcmQueryForBody, validate(fcmRegisterSchema), registerFcmToken);
router.put('/fcm-token', authenticate, mergeFcmQueryForBody, validate(fcmRegisterSchema), registerFcmToken);
router.patch('/fcm-token', authenticate, mergeFcmQueryForBody, validate(fcmRegisterSchema), registerFcmToken);
router.delete('/fcm-token', authenticate, mergeFcmQueryForBody, validate(fcmDeleteSchema), removeFcmToken);

router.post('/firebase/google-login', firebaseGoogleLogin);
router.post('/firebase/social-login', validate(firebaseSocialLoginSchema), firebaseSocialLogin);
router.get('/apple/config', getAppleConfig);
router.post('/apple', validate(appleLoginSchema), appleLogin);

// Unified Apple Redirect Callback
router.route('/apple/callback')
  .get(appleCallback)
  .post(appleCallback);

// 🍎 SPECIALIZED APPLE REDIRECT FOR RESTAURANT (User Flow)
router.get('/apple/start', (req, res) => {
  const role = req.query.role || "user";
  const clientId = process.env.APPLE_CLIENT_ID || "com.tifunbox.web";
  const redirectUri = process.env.APPLE_REDIRECT_URI || "https://backend.tifunbox.com/api/auth/apple/callback";
  
  const appleAuthUrl =
    "https://appleid.apple.com/auth/authorize?" +
    `response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=name email` +
    `&response_mode=form_post` +
    `&state=${role}`;

  return res.redirect(appleAuthUrl);
});

router.get('/google/:role', googleAuth);
router.get('/google/:role/callback', googleCallback);
router.get('/me', authenticate, getCurrentUser);

export default router;
