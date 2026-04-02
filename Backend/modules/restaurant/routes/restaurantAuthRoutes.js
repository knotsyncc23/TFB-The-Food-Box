import express from "express";
import {
  sendOTP,
  verifyOTP,
  register,
  login,
  resetPassword,
  refreshToken,
  logout,
  getCurrentRestaurant,
  reverifyRestaurant,
  firebaseGoogleLogin,
  firebaseAppleLogin,
} from "../controllers/restaurantAuthController.js";
import {
  registerRestaurantFcmToken,
  removeRestaurantFcmToken,
} from "../controllers/restaurantAuthFcmController.js";
import { authenticate } from "../middleware/restaurantAuth.js";
import { validate } from "../../../shared/middleware/validate.js";
import Joi from "joi";

const router = express.Router();

// Shared FCM validation + query support (same behavior as user auth routes)
const PLATFORM_MAP = { 0: "web", 1: "app", 2: "android", 3: "ios" };
const fcmRegisterSchema = Joi.object({
  platform: Joi.alternatives()
    .try(
      Joi.string().lowercase().valid("web", "app", "android", "ios"),
      Joi.number().integer().min(0).max(3),
      Joi.string().pattern(/^[0-3]$/),
    )
    .required()
    .custom((v) => {
      if (typeof v === "number") return PLATFORM_MAP[v];
      if (typeof v === "string" && /^[0-3]$/.test(v)) return PLATFORM_MAP[Number(v)];
      return v;
    }, "platform map"),
  fcmToken: Joi.string().required(),
});
const fcmDeleteSchema = Joi.object({
  platform: Joi.alternatives()
    .try(
      Joi.string().lowercase().valid("web", "app", "android", "ios"),
      Joi.number().integer().min(0).max(3),
      Joi.string().pattern(/^[0-3]$/),
    )
    .required()
    .custom((v) => {
      if (typeof v === "number") return PLATFORM_MAP[v];
      if (typeof v === "string" && /^[0-3]$/.test(v)) return PLATFORM_MAP[Number(v)];
      return v;
    }, "platform map"),
});
const mergeFcmQueryForBody = (req, res, next) => {
  if (!req.body) req.body = {};
  if (req.body.platform == null && req.query.platform != null) req.body.platform = req.query.platform;
  if (req.body.fcmToken == null && req.query.fcmToken != null) req.body.fcmToken = req.query.fcmToken;
  if (req.body.fcmToken == null && req.body.token != null) req.body.fcmToken = req.body.token;
  if (req.body.fcmToken == null && req.body.fcm_token != null) req.body.fcmToken = req.body.fcm_token;
  if (req.body.fcmToken == null && req.body.deviceToken != null) req.body.fcmToken = req.body.deviceToken;
  if (req.body.fcmToken == null && req.query.token != null) req.body.fcmToken = req.query.token;
  if (req.body.fcmToken == null && req.query.fcm_token != null) req.body.fcmToken = req.query.fcm_token;
  if (req.body.fcmToken == null && req.query.deviceToken != null) req.body.fcmToken = req.query.deviceToken;
  next();
};

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
  password: Joi.string().min(6).max(100).optional()
}).or('phone', 'email');

const registerSchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  phone: Joi.string().optional(),
  ownerName: Joi.string().optional(),
  ownerEmail: Joi.string().email().optional(),
  ownerPhone: Joi.string().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().required().length(6),
  newPassword: Joi.string().min(6).max(100).required()
});

const firebaseGoogleLoginSchema = Joi.object({
  idToken: Joi.string().required()
});
const firebaseAppleLoginSchema = Joi.object({
  idToken: Joi.string().required()
});

// Public routes
router.post("/send-otp", validate(sendOTPSchema), sendOTP);
router.post("/verify-otp", validate(verifyOTPSchema), verifyOTP);
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.post(
  "/firebase/google-login",
  validate(firebaseGoogleLoginSchema),
  firebaseGoogleLogin,
);
router.post(
  "/firebase/apple-login",
  validate(firebaseAppleLoginSchema),
  firebaseAppleLogin,
);

// Protected routes
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.get("/me", authenticate, getCurrentRestaurant);
router.post("/reverify", authenticate, reverifyRestaurant);
router.post(
  "/fcm-token",
  authenticate,
  mergeFcmQueryForBody,
  validate(fcmRegisterSchema),
  registerRestaurantFcmToken,
);
router.put(
  "/fcm-token",
  authenticate,
  mergeFcmQueryForBody,
  validate(fcmRegisterSchema),
  registerRestaurantFcmToken,
);
router.patch(
  "/fcm-token",
  authenticate,
  mergeFcmQueryForBody,
  validate(fcmRegisterSchema),
  registerRestaurantFcmToken,
);
router.delete(
  "/fcm-token",
  authenticate,
  mergeFcmQueryForBody,
  validate(fcmDeleteSchema),
  removeRestaurantFcmToken,
);

export default router;

