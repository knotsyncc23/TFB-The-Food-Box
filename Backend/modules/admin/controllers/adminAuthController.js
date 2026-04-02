import Admin from '../models/Admin.js';
import jwtService from '../../auth/services/jwtService.js';
import otpService from '../../auth/services/otpService.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import {
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from '../../../config/refreshCookie.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Admin Signup
 * POST /api/admin/auth/signup
 */
export const adminSignup = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  // Validation
  if (!name || !email || !password) {
    return errorResponse(res, 400, 'Name, email, and password are required');
  }

  if (password.length < 6) {
    return errorResponse(res, 400, 'Password must be at least 6 characters long');
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return errorResponse(res, 400, 'Invalid email format');
  }

  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return errorResponse(res, 400, 'Admin already exists with this email');
    }

    // Create new admin
    const adminData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phoneVerified: false
    };

    if (phone) {
      adminData.phone = phone.trim();
    }

    const admin = await Admin.create(adminData);

    // Generate tokens
    const tokens = jwtService.generateTokens({
      userId: admin._id.toString(),
      role: 'admin',
      email: admin.email,
      adminRole: admin.role
    });

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, getRefreshTokenCookieOptions());

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    logger.info(`Admin registered: ${admin._id}`, { email: admin.email });

    return successResponse(res, 201, 'Admin registered successfully', {
      accessToken: tokens.accessToken,
      admin: adminResponse
    });
  } catch (error) {
    logger.error(`Error in admin signup: ${error.message}`);
    
    if (error.code === 11000) {
      return errorResponse(res, 400, 'Admin with this email already exists');
    }
    
    return errorResponse(res, 500, 'Failed to register admin');
  }
});

/**
 * Admin Login
 * POST /api/admin/auth/login
 */
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, 'Email and password are required');
  }

  // Find admin by email (including password for comparison)
  const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');

  if (!admin) {
    return errorResponse(res, 401, 'Invalid email or password');
  }

  if (!admin.isActive) {
    return errorResponse(res, 401, 'Admin account is inactive. Please contact super admin.');
  }

  // Verify password
  const isPasswordValid = await admin.comparePassword(password);

  if (!isPasswordValid) {
    return errorResponse(res, 401, 'Invalid email or password');
  }

  // Update last login
  await admin.updateLastLogin();

  // Generate tokens
  const tokens = jwtService.generateTokens({
    userId: admin._id.toString(),
    role: 'admin',
    email: admin.email,
    adminRole: admin.role
  });

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, getRefreshTokenCookieOptions());

  // Remove password from response
  const adminResponse = admin.toObject();
  delete adminResponse.password;

  logger.info(`Admin logged in: ${admin._id}`, { email: admin.email });

  return successResponse(res, 200, 'Login successful', {
    accessToken: tokens.accessToken,
    admin: adminResponse
  });
});

/**
 * Admin Signup with OTP
 * POST /api/admin/auth/signup/otp
 */
export const adminSignupWithOTP = asyncHandler(async (req, res) => {
  const { name, email, password, otp, phone } = req.body;

  // Validation
  if (!name || !email || !password || !otp) {
    return errorResponse(res, 400, 'Name, email, password, and OTP are required');
  }

  if (password.length < 6) {
    return errorResponse(res, 400, 'Password must be at least 6 characters long');
  }

  try {
    // Verify OTP - pass phone and email separately as per otpService signature
    let otpResult;
    try {
      otpResult = await otpService.verifyOTP(phone || null, otp, 'register', email || null);
    } catch (otpError) {
      logger.error(`OTP verification error: ${otpError.message}`);
      return errorResponse(res, 400, otpError.message || 'Invalid or expired OTP');
    }

    if (!otpResult || !otpResult.success) {
      return errorResponse(res, 400, otpResult?.message || 'Invalid or expired OTP');
    }

    const identifierType = phone ? 'phone' : 'email';

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return errorResponse(res, 400, 'Admin already exists with this email');
    }

    // Create new admin
    const adminData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phoneVerified: identifierType === 'phone'
    };

    if (phone) {
      adminData.phone = phone.trim();
      adminData.phoneVerified = true;
    }

    const admin = await Admin.create(adminData);

    // Generate tokens
    const tokens = jwtService.generateTokens({
      userId: admin._id.toString(),
      role: 'admin',
      email: admin.email,
      adminRole: admin.role
    });

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, getRefreshTokenCookieOptions());

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    logger.info(`Admin registered with OTP: ${admin._id}`, { email: admin.email });

    return successResponse(res, 201, 'Admin registered successfully', {
      accessToken: tokens.accessToken,
      admin: adminResponse
    });
  } catch (error) {
    logger.error(`Error in admin signup with OTP: ${error.message}`);
    
    if (error.code === 11000) {
      return errorResponse(res, 400, 'Admin with this email already exists');
    }
    
    return errorResponse(res, 500, 'Failed to register admin');
  }
});

/**
 * Get Current Admin
 * GET /api/admin/auth/me
 */
export const getCurrentAdmin = asyncHandler(async (req, res) => {
  try {
    // req.user should be set by admin authentication middleware
    const admin = await Admin.findById(req.user._id || req.user.userId)
      .select('-password')
      .lean();

    if (!admin) {
      return errorResponse(res, 404, 'Admin not found');
    }

    return successResponse(res, 200, 'Admin retrieved successfully', {
      admin
    });
  } catch (error) {
    logger.error(`Error fetching current admin: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch admin');
  }
});

/**
 * Logout Admin
 * POST /api/admin/auth/logout
 */
export const adminLogout = asyncHandler(async (req, res) => {
  // Clear refresh token cookie
  res.clearCookie('refreshToken', getClearRefreshTokenCookieOptions());

  logger.info(`Admin logged out: ${req.user?._id || req.user?.userId}`);

  return successResponse(res, 200, 'Logout successful');
});

