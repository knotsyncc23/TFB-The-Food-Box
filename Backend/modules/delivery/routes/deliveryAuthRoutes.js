import express from "express";
import {
  sendOTP,
  verifyOTP,
  refreshToken,
  logout,
  getCurrentDelivery,
  registerFcmToken,
  removeFcmToken,
} from "../controllers/deliveryAuthController.js";
import { authenticate } from "../middleware/deliveryAuth.js";
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
  next();
};

// Validation schemas
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
    )
    .required(),
  purpose: Joi.string()
    .valid("login", "register", "reset-password", "verify-phone")
    .default("login"),
});

const verifyOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
    )
    .required(),
  otp: Joi.string().required().length(6),
  purpose: Joi.string()
    .valid("login", "register", "reset-password", "verify-phone")
    .default("login"),
  name: Joi.string().allow(null, "").optional(),
});

// Public routes
router.post("/send-otp", validate(sendOTPSchema), sendOTP);
router.post("/verify-otp", validate(verifyOTPSchema), verifyOTP);
router.post("/refresh-token", refreshToken);

// Protected routes (require authentication)
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, getCurrentDelivery);
router.post(
  "/fcm-token",
  authenticate,
  mergeFcmQueryForBody,
  validate(fcmRegisterSchema),
  registerFcmToken,
);
router.put(
  "/fcm-token",
  authenticate,
  mergeFcmQueryForBody,
  validate(fcmRegisterSchema),
  registerFcmToken,
);
router.patch(
  "/fcm-token",
  authenticate,
  mergeFcmQueryForBody,
  validate(fcmRegisterSchema),
  registerFcmToken,
);
router.delete(
  "/fcm-token",
  authenticate,
  mergeFcmQueryForBody,
  validate(fcmDeleteSchema),
  removeFcmToken,
);

export default router;
