import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import Delivery from "../models/Delivery.js";
import { deleteFromCloudinary } from "../../../shared/utils/cloudinaryService.js";
import { validate } from "../../../shared/middleware/validate.js";
import Joi from "joi";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

/**
 * Get Delivery Partner Profile
 * GET /api/delivery/profile
 */
export const getProfile = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery; // From authenticate middleware

    // Populate related fields if needed
    const profile = await Delivery.findById(delivery._id)
      .select("-password -refreshToken")
      .lean();

    if (!profile) {
      return errorResponse(res, 404, "Delivery partner not found");
    }

    return successResponse(res, 200, "Profile retrieved successfully", {
      profile,
    });
  } catch (error) {
    logger.error(`Error fetching delivery profile: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch profile");
  }
});

/**
 * Update Delivery Partner Profile
 * PUT /api/delivery/profile
 */
const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().lowercase().trim().optional().allow(null, ""),
  dateOfBirth: Joi.date().optional().allow(null),
  gender: Joi.string()
    .valid("male", "female", "other", "prefer-not-to-say")
    .optional(),
  vehicle: Joi.object({
    type: Joi.string().valid("bike", "scooter", "bicycle", "car").optional(),
    number: Joi.string()
      .trim()
      .uppercase()
      .pattern(/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/)
      .message("Vehicle number must be in format MH12AB1234")
      .optional()
      .allow(null, ""),
    model: Joi.string().trim().optional().allow(null, ""),
    brand: Joi.string().trim().optional().allow(null, ""),
  }).optional(),
  location: Joi.object({
    addressLine1: Joi.string().trim().optional().allow(null, ""),
    addressLine2: Joi.string().trim().optional().allow(null, ""),
    area: Joi.string().trim().optional().allow(null, ""),
    city: Joi.string()
      .trim()
      .pattern(/^[A-Za-z\s]+$/)
      .message("City should only contain letters and spaces")
      .optional()
      .allow(null, ""),
    state: Joi.string().trim().optional().allow(null, ""),
    zipCode: Joi.string().trim().optional().allow(null, ""),
  }).optional(),
  profileImage: Joi.object({
    url: Joi.string().uri().optional().allow(null, ""),
    publicId: Joi.string().trim().optional().allow(null, ""),
  }).optional(),
  documents: Joi.object({
    bankDetails: Joi.object({
      accountHolderName: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .optional()
        .allow(null, ""),
      accountNumber: Joi.string()
        .trim()
        .min(9)
        .max(18)
        .optional()
        .allow(null, ""),
      ifscCode: Joi.string()
        .trim()
        .length(11)
        .uppercase()
        .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .message("IFSC code must be 11 characters (e.g., HDFC0001234)")
        .optional()
        .allow(null, ""),
      bankName: Joi.string().trim().min(2).max(100).optional().allow(null, ""),
    }).optional(),
  }).optional(),
});

export const updateProfile = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const updateData = req.body;

    // Validate input
    const { error } = updateProfileSchema.validate(updateData);
    if (error) {
      return errorResponse(res, 400, error.details[0].message);
    }

    // Handle nested documents.bankDetails update properly
    const setData = { ...updateData };
    if (updateData.documents?.bankDetails) {
      // Merge bankDetails with existing documents
      setData["documents.bankDetails"] = {
        ...delivery.documents?.bankDetails,
        ...updateData.documents.bankDetails,
      };
      // Remove the nested documents object to avoid conflicts
      delete setData.documents;
    }

    // Update profile
    const updatedDelivery = await Delivery.findByIdAndUpdate(
      delivery._id,
      { $set: setData },
      { new: true, runValidators: true },
    ).select("-password -refreshToken");

    if (!updatedDelivery) {
      return errorResponse(res, 404, "Delivery partner not found");
    }

    logger.info("Profile updated successfully", {
      deliveryId: updatedDelivery.deliveryId || updatedDelivery._id,
      updatedFields: Object.keys(updateData),
    });

    return successResponse(res, 200, "Profile updated successfully", {
      profile: updatedDelivery,
    });
  } catch (error) {
    logger.error(`Error updating delivery profile: ${error.message}`);

    // Handle duplicate email error
    if (error.code === 11000) {
      return errorResponse(res, 400, "Email already exists");
    }

    return errorResponse(res, 500, "Failed to update profile");
  }
});

/**
 * Reverify Delivery Partner (Resubmit for approval)
 * POST /api/delivery/reverify
 */
export const reverify = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;

    if (delivery.status !== "blocked") {
      return errorResponse(
        res,
        400,
        "Only rejected delivery partners can resubmit for verification",
      );
    }

    // Reset to pending status and clear rejection details
    delivery.status = "pending";
    delivery.isActive = true; // Allow login to see verification message
    delivery.rejectionReason = undefined;
    delivery.rejectedAt = undefined;
    delivery.rejectedBy = undefined;

    await delivery.save();

    logger.info(
      `Delivery partner resubmitted for verification: ${delivery._id}`,
      {
        deliveryId: delivery.deliveryId,
      },
    );

    return successResponse(
      res,
      200,
      "Request resubmitted for verification successfully",
      {
        profile: {
          _id: delivery._id.toString(),
          name: delivery.name,
          status: delivery.status,
        },
      },
    );
  } catch (error) {
    logger.error(`Error reverifying delivery partner: ${error.message}`);
    return errorResponse(res, 500, "Failed to resubmit for verification");
  }
});

/**
 * Delete Delivery Partner Account
 * DELETE /api/delivery/profile
 */
export const deleteProfile = asyncHandler(async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.delivery._id);

    if (!delivery) {
      return errorResponse(res, 404, "Delivery partner not found");
    }

    if (delivery.profileImage?.publicId) {
      try {
        await deleteFromCloudinary(delivery.profileImage.publicId);
      } catch (cloudinaryError) {
        logger.warn(
          `Failed to delete delivery profile image from Cloudinary: ${cloudinaryError.message}`,
        );
      }
    }

    await Delivery.findByIdAndDelete(delivery._id);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    logger.info(`Delivery account deleted: ${delivery._id}`, {
      deliveryId: delivery.deliveryId,
    });

    return successResponse(res, 200, "Delivery account deleted successfully");
  } catch (error) {
    logger.error(`Error deleting delivery account: ${error.message}`);
    return errorResponse(res, 500, "Failed to delete delivery account");
  }
});
