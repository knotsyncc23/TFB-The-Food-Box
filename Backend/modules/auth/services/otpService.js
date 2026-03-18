import Otp from '../models/Otp.js';
import smsIndiaHubService from './smsIndiaHubService.js';
import emailService from './emailService.js';
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

// Test phone numbers that should use default OTP
const TEST_PHONE_NUMBERS = [
  '7610416911',
  '7691810506',
  '9009925021',
  '6375095971',
];

// Default OTP for test phone numbers
const DEFAULT_TEST_OTP = '110211';

/**
 * Extract phone number digits (without country code)
 * @param {string} phone - Phone number in format like "+91 9098569620" or "+91-9098569620"
 * @returns {string} - Phone number digits only (e.g., "9098569620")
 */
const extractPhoneDigits = (phone) => {
  if (!phone) return '';
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // If starts with country code (like 91), remove it to get last 10 digits
  // For Indian numbers, country code is 91, so we take last 10 digits
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  // If exactly 10 digits or less, return as is
  return digits.length <= 10 ? digits : digits.slice(-10);
};

/**
 * Check if a phone number is a test number
 * @param {string} phone - Phone number in any format
 * @returns {boolean} - True if phone number is a test number
 */
const isTestPhoneNumber = (phone) => {
  const phoneDigits = extractPhoneDigits(phone);
  return TEST_PHONE_NUMBERS.includes(phoneDigits);
};

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * OTP Service
 * Handles OTP generation, storage, and verification
 * Supports both phone and email OTP
 */
class OTPService {
  /**
   * Generate and send OTP via phone or email
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} email - Email address (optional if phone provided)
   * @param {string} purpose - Purpose of OTP (login, register, etc.)
   * @param {Object} [options]
   * @param {number} [options.maxPerHour] - Override OTP rate limit for this call (production only)
   * @returns {Promise<Object>}
   */
  async generateAndSendOTP(phone = null, purpose = 'login', email = null, options = {}) {
    try {
      // Validate that either phone or email is provided
      if (!phone && !email) {
        throw new Error('Either phone or email must be provided');
      }

      const identifier = phone || email;
      const identifierType = phone ? 'phone' : 'email';

      // Check rate limiting (default max 3 OTPs per identifier per hour) - using MongoDB
      if (process.env.NODE_ENV === 'production') {
        const configuredMax = parseInt(process.env.OTP_RATE_LIMIT_MAX_PER_HOUR || '', 10);
        const maxPerHour =
          typeof options?.maxPerHour === 'number' && Number.isFinite(options.maxPerHour)
            ? options.maxPerHour
            : (Number.isFinite(configuredMax) ? configuredMax : 3);

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const rateLimitQuery = {
          [identifierType]: identifier,
          purpose,
          createdAt: { $gte: oneHourAgo }
        };
        
        const recentOtpCount = await Otp.countDocuments(rateLimitQuery);
        if (recentOtpCount >= maxPerHour) {
          throw new Error('Too many OTP requests. Please try again after some time.');
        }
      }

      // Generate OTP (use default for test phone numbers)
      const otp = (phone && isTestPhoneNumber(phone)) ? DEFAULT_TEST_OTP : generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Build query for invalidating previous OTPs
      const invalidateQuery = { purpose, verified: false };
      if (phone) invalidateQuery.phone = phone;
      if (email) invalidateQuery.email = email;

      // Invalidate previous OTPs for this identifier and purpose
      await Otp.updateMany(
        invalidateQuery,
        { verified: true } // Mark as used
      );

      // Store OTP in database
      const otpData = {
        otp,
        purpose,
        expiresAt
      };
      if (phone) otpData.phone = phone;
      if (email) otpData.email = email;

      const otpRecord = await Otp.create(otpData);

      // Send OTP via SMS or Email
      if (phone) {
        // Skip actual SMS sending for test phone numbers
        if (!isTestPhoneNumber(phone)) {
          // Use SMSIndia Hub for phone OTP
          await smsIndiaHubService.sendOTP(phone, otp, purpose);
        } else {
          logger.info(`Skipping SMS for test phone number: ${phone}`, {
            phone,
            purpose,
            otp
          });
        }
      } else if (email) {
        // Keep email service as is
        await emailService.sendOTP(email, otp, purpose);
      }

      logger.info(`OTP generated and sent to ${identifier} (${identifierType})`, {
        [identifierType]: identifier,
        purpose,
        otpId: otpRecord._id
      });

      return {
        success: true,
        message: `OTP sent successfully to ${identifierType === 'phone' ? 'phone' : 'email'}`,
        expiresIn: 300, // 5 minutes in seconds
        identifierType
      };
    } catch (error) {
      logger.error(`Error generating OTP: ${error.message}`, {
        phone,
        email,
        purpose,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verify OTP
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} otp - OTP code
   * @param {string} purpose - Purpose of OTP
   * @param {string} email - Email address (optional if phone provided)
   * @returns {Promise<Object>}
   */
  async verifyOTP(phone = null, otp, purpose = 'login', email = null) {
    try {
      // Validate that either phone or email is provided
      if (!phone && !email) {
        throw new Error('Either phone or email must be provided');
      }

      const identifier = phone || email;
      const identifierType = phone ? 'phone' : 'email';

      // Check if this is a test phone number and OTP matches default test OTP
      if (phone && isTestPhoneNumber(phone) && otp === DEFAULT_TEST_OTP) {
        logger.info(`Test OTP verified for ${phone}`, {
          phone,
          purpose
        });
        return {
          success: true,
          message: 'OTP verified successfully'
        };
      }

      // Verify OTP from database
      // For reset-password purpose, allow already-verified OTPs within 10 minutes
      let otpRecord;
      
      if (purpose === 'reset-password') {
        // First try to find unverified OTP
        const unverifiedQuery = {
          otp,
          purpose,
          verified: false,
          expiresAt: { $gt: new Date() }
        };
        if (phone) unverifiedQuery.phone = phone;
        if (email) unverifiedQuery.email = email;
        
        otpRecord = await Otp.findOne(unverifiedQuery);
        
        // If not found, check for already-verified OTP within last 10 minutes
        if (!otpRecord) {
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          const verifiedQuery = {
            otp,
            purpose,
            verified: true,
            expiresAt: { $gt: new Date() },
            updatedAt: { $gt: tenMinutesAgo }
          };
          if (phone) verifiedQuery.phone = phone;
          if (email) verifiedQuery.email = email;
          
          otpRecord = await Otp.findOne(verifiedQuery);
          
          if (otpRecord) {
            // OTP already verified and still valid (within 10 minutes)
            return {
              success: true,
              message: 'OTP verified successfully'
            };
          }
        }
      } else {
        // For other purposes, only check unverified OTPs
        const query = {
          otp,
          purpose,
          verified: false,
          expiresAt: { $gt: new Date() }
        };
        if (phone) query.phone = phone;
        if (email) query.email = email;
        
        otpRecord = await Otp.findOne(query);
      }

      if (!otpRecord) {
        // Increment attempts for security (only for unverified OTPs)
        const incrementQuery = { purpose, verified: false };
        if (phone) incrementQuery.phone = phone;
        if (email) incrementQuery.email = email;

        await Otp.updateMany(
          incrementQuery,
          { $inc: { attempts: 1 } }
        );

        throw new Error('Invalid or expired OTP');
      }

      // Check attempts
      if (otpRecord.attempts >= 5) {
        throw new Error('Too many failed attempts. Please request a new OTP.');
      }

      // Mark as verified
      otpRecord.verified = true;
      await otpRecord.save();

      logger.info(`OTP verified successfully for ${identifier} (${identifierType})`, {
        [identifierType]: identifier,
        purpose
      });

      return {
        success: true,
        message: 'OTP verified successfully'
      };
    } catch (error) {
      logger.error(`Error verifying OTP: ${error.message}`, {
        phone,
        email,
        purpose,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Resend OTP
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} purpose - Purpose of OTP
   * @param {string} email - Email address (optional if phone provided)
   * @returns {Promise<Object>}
   */
  async resendOTP(phone = null, purpose = 'login', email = null) {
    return await this.generateAndSendOTP(phone, purpose, email);
  }
}

export default new OTPService();

