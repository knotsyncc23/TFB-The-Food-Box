import BusinessSettings from "../models/BusinessSettings.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import { uploadToCloudinary } from "../../../shared/utils/cloudinaryService.js";
import { initializeCloudinary } from "../../../config/cloudinary.js";

/**
 * Get Business Settings (Public - for favicon, logo, company name)
 * GET /api/business-settings/public
 */
export const getBusinessSettingsPublic = asyncHandler(async (req, res) => {
  try {
    const settings = await BusinessSettings.getSettings();

    // Return only public-facing data with defaults if not set
    return successResponse(
      res,
      200,
      "Business settings retrieved successfully",
      {
        companyName: settings?.companyName || "Tifunbox",
        logo: settings?.logo || { url: "", publicId: "" },
        favicon: settings?.favicon || { url: "", publicId: "" },
      },
    );
  } catch (error) {
    console.error("Error fetching public business settings:", error);
    // Return default values instead of error
    return successResponse(
      res,
      200,
      "Business settings retrieved successfully",
      {
        companyName: "Tifunbox",
        companyName: "Tifunbox",
        logo: { url: "", publicId: "" },
        favicon: { url: "", publicId: "" },
      },
    );
  }
});

/**
 * Get Business Settings (Admin - full data)
 * GET /api/admin/business-settings
 */
export const getBusinessSettings = asyncHandler(async (req, res) => {
  try {
    const settings = await BusinessSettings.getSettings();
    return successResponse(
      res,
      200,
      "Business settings retrieved successfully",
      settings,
    );
  } catch (error) {
    console.error("Error fetching business settings:", error);
    return errorResponse(res, 500, "Failed to fetch business settings");
  }
});

/**
 * Update Business Settings
 * PUT /api/admin/business-settings
 */
export const updateBusinessSettings = asyncHandler(async (req, res) => {
  try {
    const {
      companyName,
      email,
      phoneCountryCode,
      phoneNumber,
      address,
      state,
      pincode,
      region,
      maintenanceMode,
    } = req.body;

    const normalizeText = (value) =>
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

    const normalizeEmail = (value) =>
      String(value ?? "")
        .replace(/\s+/g, "")
        .trim()
        .toLowerCase();

    const normalizePhoneNumber = (value) =>
      String(value ?? "").replace(/[^\d]/g, "");

    const normalizePincode = (value, country = "India") => {
      const raw = String(value ?? "").toUpperCase().replace(/\s+/g, "");
      if (country === "India") return raw.replace(/[^\d]/g, "").slice(0, 6);
      if (country === "US") return raw.replace(/[^0-9-]/g, "").slice(0, 10);
      return raw.replace(/[^A-Z0-9]/g, "").slice(0, 10);
    };

    const allowedRegions = new Set(["India", "UK", "US"]);
    const normalizedCompanyName = normalizeText(companyName);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhoneCountryCode = String(phoneCountryCode ?? "").trim();
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const normalizedAddress = normalizeText(address);
    const normalizedState = normalizeText(state);
    const normalizedRegion = allowedRegions.has(region) ? region : "India";
    const normalizedPincode = normalizePincode(pincode, normalizedRegion);

    const companyNameRegex = /^[A-Za-z0-9][A-Za-z0-9 '&().,/-]*$/;
    const stateRegex = /^[A-Za-z][A-Za-z\s.'-]*$/;
    const addressRegex = /^[A-Za-z0-9][A-Za-z0-9\s,.'#&()/-]*$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedCompanyName) {
      return errorResponse(res, 400, "Company name is required");
    }
    if (
      normalizedCompanyName.length < 2 ||
      normalizedCompanyName.length > 120 ||
      !companyNameRegex.test(normalizedCompanyName)
    ) {
      return errorResponse(
        res,
        400,
        "Company name must be 2-120 characters and contain valid text only",
      );
    }

    if (!normalizedEmail) {
      return errorResponse(res, 400, "Email is required");
    }
    if (!emailRegex.test(normalizedEmail)) {
      return errorResponse(res, 400, "Enter a valid email address");
    }

    if (!normalizedPhoneCountryCode.startsWith("+")) {
      return errorResponse(res, 400, "Country code must start with +");
    }
    if (!normalizedPhoneNumber || normalizedPhoneNumber.length < 7 || normalizedPhoneNumber.length > 15) {
      return errorResponse(res, 400, "Phone number must be 7 to 15 digits");
    }

    if (normalizedState && !stateRegex.test(normalizedState)) {
      return errorResponse(res, 400, "State should be in format like 'Maharashtra'");
    }

    if (normalizedAddress && !addressRegex.test(normalizedAddress)) {
      return errorResponse(res, 400, "Address contains invalid characters");
    }

    if (normalizedRegion === "India" && normalizedPincode && !/^\d{6}$/.test(normalizedPincode)) {
      return errorResponse(res, 400, "Indian pincode should be 6 digits");
    }
    if (normalizedRegion === "US" && normalizedPincode && !/^\d{5}(-\d{4})?$/.test(normalizedPincode)) {
      return errorResponse(res, 400, "US ZIP code should be in 12345 or 12345-6789 format");
    }
    if (normalizedRegion === "UK" && normalizedPincode && !/^[A-Z0-9]{5,8}$/.test(normalizedPincode)) {
      return errorResponse(res, 400, "UK postcode should be alphanumeric and 5-8 characters long");
    }

    // Get existing settings
    let settings = await BusinessSettings.findOne();
    if (!settings) {
      settings = new BusinessSettings();
    }

    // Update basic fields
    if (companyName !== undefined) settings.companyName = normalizedCompanyName;
    if (email !== undefined) settings.email = normalizedEmail;

    // Initialize phone object if it doesn't exist
    if (!settings.phone) {
      settings.phone = {
        countryCode: "+91",
        number: "",
      };
    }

    if (phoneCountryCode !== undefined)
      settings.phone.countryCode = normalizedPhoneCountryCode;
    if (phoneNumber !== undefined) settings.phone.number = normalizedPhoneNumber;
    if (address !== undefined) settings.address = normalizedAddress;
    if (state !== undefined) settings.state = normalizedState;
    if (pincode !== undefined) settings.pincode = normalizedPincode;
    if (region !== undefined) settings.region = normalizedRegion;
    if (maintenanceMode !== undefined) {
      settings.maintenanceMode.isEnabled = maintenanceMode.isEnabled || false;
      if (maintenanceMode.startDate) {
        settings.maintenanceMode.startDate = new Date(
          maintenanceMode.startDate,
        );
      }
      if (maintenanceMode.endDate) {
        settings.maintenanceMode.endDate = new Date(maintenanceMode.endDate);
      }
    }

    // Handle logo upload
    if (req.files && req.files.logo && req.files.logo.length > 0) {
      try {
        await initializeCloudinary();
        const logoFile = req.files.logo[0];

        // Validate file type
        const allowedMimeTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
        ];
        if (!allowedMimeTypes.includes(logoFile.mimetype)) {
          return errorResponse(
            res,
            400,
            "Invalid logo file type. Allowed: JPEG, PNG, WEBP",
          );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (logoFile.size > maxSize) {
          return errorResponse(res, 400, "Logo file size exceeds 5MB limit");
        }

        // Delete old logo from Cloudinary if exists
        if (settings.logo.publicId) {
          try {
            const { cloudinary } =
              await import("../../../config/cloudinary.js");
            await cloudinary.uploader.destroy(settings.logo.publicId);
          } catch (deleteError) {
            console.warn("Failed to delete old logo:", deleteError);
          }
        }

        // Upload new logo
        const logoResult = await uploadToCloudinary(logoFile.buffer, {
          folder: "tifunbox/business/logo",
          resource_type: "image",
          transformation: [
            { width: 500, height: 500, crop: "limit" },
            { quality: "auto" },
          ],
        });

        settings.logo = {
          url: logoResult.secure_url,
          publicId: logoResult.public_id,
        };
      } catch (logoError) {
        console.error("Error uploading logo:", logoError);
        return errorResponse(res, 500, "Failed to upload logo");
      }
    }

    // Handle favicon upload
    if (req.files && req.files.favicon && req.files.favicon.length > 0) {
      try {
        await initializeCloudinary();
        const faviconFile = req.files.favicon[0];

        // Validate file type
        const allowedMimeTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
          "image/x-icon",
          "image/vnd.microsoft.icon",
        ];
        if (!allowedMimeTypes.includes(faviconFile.mimetype)) {
          return errorResponse(
            res,
            400,
            "Invalid favicon file type. Allowed: JPEG, PNG, WEBP, ICO",
          );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (faviconFile.size > maxSize) {
          return errorResponse(res, 400, "Favicon file size exceeds 5MB limit");
        }

        // Delete old favicon from Cloudinary if exists
        if (settings.favicon.publicId) {
          try {
            const { cloudinary } =
              await import("../../../config/cloudinary.js");
            await cloudinary.uploader.destroy(settings.favicon.publicId);
          } catch (deleteError) {
            console.warn("Failed to delete old favicon:", deleteError);
          }
        }

        // Upload new favicon
        const faviconResult = await uploadToCloudinary(faviconFile.buffer, {
          folder: "tifunbox/business/favicon",
          resource_type: "image",
          transformation: [
            { width: 64, height: 64, crop: "limit" },
            { quality: "auto" },
          ],
        });

        settings.favicon = {
          url: faviconResult.secure_url,
          publicId: faviconResult.public_id,
        };
      } catch (faviconError) {
        console.error("Error uploading favicon:", faviconError);
        return errorResponse(res, 500, "Failed to upload favicon");
      }
    }

    // Set updated by
    if (req.admin && req.admin._id) {
      settings.updatedBy = req.admin._id;
    }

    await settings.save();

    return successResponse(
      res,
      200,
      "Business settings updated successfully",
      settings,
    );
  } catch (error) {
    console.error("Error updating business settings:", error);
    return errorResponse(res, 500, "Failed to update business settings");
  }
});
