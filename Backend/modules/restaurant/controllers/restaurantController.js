import Restaurant from "../models/Restaurant.js";
import Menu from "../models/Menu.js";
import Zone from "../../admin/models/Zone.js";
import DiningCategory from "../../dining/models/DiningCategory.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../../shared/utils/cloudinaryService.js";
import { initializeCloudinary } from "../../../config/cloudinary.js";
import asyncHandler from "../../../shared/middleware/asyncHandler.js";
import mongoose from "mongoose";

/**
 * Check if a point is within a zone polygon using ray casting algorithm
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} zoneCoordinates - Zone coordinates array
 * @returns {boolean}
 */
function isPointInZone(lat, lng, zoneCoordinates) {
  if (!zoneCoordinates || zoneCoordinates.length < 3) return false;

  let inside = false;
  for (
    let i = 0, j = zoneCoordinates.length - 1;
    i < zoneCoordinates.length;
    j = i++
  ) {
    const coordI = zoneCoordinates[i];
    const coordJ = zoneCoordinates[j];

    const xi =
      typeof coordI === "object" ? coordI.latitude || coordI.lat : null;
    const yi =
      typeof coordI === "object" ? coordI.longitude || coordI.lng : null;
    const xj =
      typeof coordJ === "object" ? coordJ.latitude || coordJ.lat : null;
    const yj =
      typeof coordJ === "object" ? coordJ.longitude || coordJ.lng : null;

    if (xi === null || yi === null || xj === null || yj === null) continue;

    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a restaurant's location (pin) is within any active zone
 * @param {number} restaurantLat - Restaurant latitude
 * @param {number} restaurantLng - Restaurant longitude
 * @param {Array} activeZones - Array of active zones (cached)
 * @returns {boolean}
 */
function isRestaurantInAnyZone(restaurantLat, restaurantLng, activeZones) {
  if (!restaurantLat || !restaurantLng) return false;

  for (const zone of activeZones) {
    if (!zone.coordinates || zone.coordinates.length < 3) continue;

    let isInZone = false;
    if (typeof zone.containsPoint === "function") {
      isInZone = zone.containsPoint(restaurantLat, restaurantLng);
    } else {
      isInZone = isPointInZone(restaurantLat, restaurantLng, zone.coordinates);
    }

    if (isInZone) {
      return true;
    }
  }

  return false;
}

/**
 * Get nearby restaurants within a radius using MongoDB geospatial query.
 * Uses GeoJSON Point stored in location.coordinates [lng, lat].
 * GET /api/restaurant/nearby?lat=..&lng=..&radiusKm=5
 */
export const getNearbyRestaurants = async (req, res) => {
  try {
    const { lat, lng, radiusKm = 5, limit = 50, offset = 0 } = req.query;

    if (!lat || !lng) {
      return errorResponse(
        res,
        400,
        "Latitude (lat) and longitude (lng) are required for nearby search",
      );
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusMeters = parseFloat(radiusKm) * 1000 || 5000;

    if (
      Number.isNaN(latNum) ||
      Number.isNaN(lngNum) ||
      Number.isNaN(radiusMeters)
    ) {
      return errorResponse(
        res,
        400,
        "Invalid lat/lng or radiusKm for nearby search",
      );
    }

    const nearby = await Restaurant.find({
      isActive: true,
      "location.coordinates": {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [lngNum, latNum],
          },
          $maxDistance: radiusMeters,
        },
      },
    })
      .select("-owner -createdAt -updatedAt -password")
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    // Visibility filter: only show restaurants that have at least one dish
    // (approved + currently available). Otherwise empty restaurants appear
    // in the user UI.
    let filteredNearby = nearby;
    if (nearby.length > 0) {
      const restaurantIds = nearby.map((r) => r._id).filter(Boolean);

      const restaurantsWithDishes = await Menu.find({
        restaurant: { $in: restaurantIds },
        isActive: true,
        $or: [
          {
            sections: {
              $elemMatch: {
                items: {
                  $elemMatch: { isAvailable: true, approvalStatus: "approved" },
                },
              },
            },
          },
          {
            sections: {
              $elemMatch: {
                subsections: {
                  $elemMatch: {
                    items: {
                      $elemMatch: { isAvailable: true, approvalStatus: "approved" },
                    },
                  },
                },
              },
            },
          },
        ],
      })
        .select("restaurant")
        .lean();

      const hasDishesSet = new Set(
        (restaurantsWithDishes || [])
          .map((m) => m.restaurant?.toString())
          .filter(Boolean),
      );

      filteredNearby = nearby.filter((r) => hasDishesSet.has(r._id?.toString()));
    }

    return successResponse(
      res,
      200,
      "Nearby restaurants retrieved successfully",
      {
        restaurants: filteredNearby,
        total: filteredNearby.length,
        center: { lat: latNum, lng: lngNum },
        radiusKm: radiusMeters / 1000,
      },
    );
  } catch (error) {
    console.error("Error fetching nearby restaurants:", error);
    return errorResponse(res, 500, "Failed to fetch nearby restaurants");
  }
};

/**
 * Get restaurant's zoneId based on location
 * @param {number} restaurantLat - Restaurant latitude
 * @param {number} restaurantLng - Restaurant longitude
 * @param {Array} activeZones - Array of active zones
 * @returns {string|null} Zone ID or null
 */
function getRestaurantZoneId(restaurantLat, restaurantLng, activeZones) {
  if (!restaurantLat || !restaurantLng) return null;

  for (const zone of activeZones) {
    if (!zone.coordinates || zone.coordinates.length < 3) continue;

    let isInZone = false;
    if (typeof zone.containsPoint === "function") {
      isInZone = zone.containsPoint(restaurantLat, restaurantLng);
    } else {
      isInZone = isPointInZone(restaurantLat, restaurantLng, zone.coordinates);
    }

    if (isInZone) {
      return zone._id.toString();
    }
  }

  return null;
}

function isRestaurantInUserZone(restaurant, userZone) {
  if (!userZone?.coordinates || userZone.coordinates.length < 3) return false;

  const coords = restaurant?.location?.coordinates;
  const restaurantLng = Array.isArray(coords) ? Number(coords[0]) : null;
  const restaurantLat = Array.isArray(coords) ? Number(coords[1]) : null;

  if (!restaurantLat || !restaurantLng) return false;

  return isPointInZone(restaurantLat, restaurantLng, userZone.coordinates);
}

async function resolveUserZone({ zoneId, latitude, longitude }) {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude)) {
    const activeZones = await Zone.find({ isActive: true }).lean();
    const matchedZone =
      activeZones.find((zone) =>
        isPointInZone(parsedLatitude, parsedLongitude, zone.coordinates),
      ) || null;

    return {
      zone: matchedZone,
      source: "coordinates",
    };
  }

  if (zoneId) {
    const zone = await Zone.findById(zoneId).lean();
    if (!zone || !zone.isActive) {
      return {
        zone: null,
        error: "Invalid or inactive zone. Please detect your zone again.",
      };
    }

    return {
      zone,
      source: "zoneId",
    };
  }

  return {
    zone: null,
    source: null,
  };
}

// Get all restaurants (for user module)
export const getRestaurants = async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      sortBy,
      cuisine,
      minRating,
      maxDeliveryTime,
      maxDistance,
      maxPrice,
      hasOffers,
      zoneId, // User's zone ID (optional - if provided, filters by zone)
      latitude,
      longitude,
      diningCategory, // Dining category slug (optional)
    } = req.query;

    const { zone: userZone, error: zoneError, source: zoneSource } =
      await resolveUserZone({
        zoneId,
        latitude,
        longitude,
      });

    if (zoneError) {
      return errorResponse(res, 400, zoneError);
    }

    if (zoneSource === "coordinates" && !userZone) {
      return successResponse(res, 200, "Restaurants retrieved successfully", {
        restaurants: [],
        total: 0,
        filters: {
          sortBy,
          cuisine,
          minRating,
          maxDeliveryTime,
          maxDistance,
          maxPrice,
          hasOffers,
        },
      });
    }

    // Build query
    const query = { isActive: true };

    // Cuisine filter
    if (cuisine) {
      query.cuisines = { $in: [new RegExp(cuisine, "i")] };
    }

    // Rating filter
    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    // Trust filters (top-rated = 4.5+, trusted = 4.0+ with high totalRatings)
    if (req.query.topRated === "true") {
      query.rating = { $gte: 4.5 };
    } else if (req.query.trusted === "true") {
      query.rating = { $gte: 4.0 };
      query.totalRatings = { $gte: 100 }; // At least 100 ratings to be "trusted"
    }

    // Delivery time filter (estimatedDeliveryTime contains time in format "25-30 mins")
    if (maxDeliveryTime) {
      const maxTime = parseInt(maxDeliveryTime);
      query.$or = [
        {
          estimatedDeliveryTime: {
            $regex: new RegExp(`(\\d+)-?\\d*\\s*mins?`, "i"),
          },
        },
      ];
      // We'll filter this in application logic since it's a string field
    }

    // Distance filter (distance is stored as string like "1.2 km")
    if (maxDistance) {
      const maxDist = parseFloat(maxDistance);
      query.$or = [
        { distance: { $regex: new RegExp(`\\d+\\.?\\d*\\s*km`, "i") } },
      ];
      // We'll filter this in application logic since it's a string field
    }

    // Price range filter
    if (maxPrice) {
      const priceMap = { 200: ["$"], 500: ["$", "$$"] };
      if (priceMap[maxPrice]) {
        query.priceRange = { $in: priceMap[maxPrice] };
      }
    }

    // Offers filter
    if (hasOffers === "true") {
      query.$or = [
        { offer: { $exists: true, $ne: null, $ne: "" } },
        { featuredPrice: { $exists: true } },
      ];
    }

    // Dining category filter
    if (diningCategory) {
      // Find the category ID from slug
      const allCategories = await DiningCategory.find({
        isActive: true,
      }).lean();
      const targetCategory = allCategories.find(
        (c) =>
          c.name.toLowerCase().replace(/\s+/g, "-") ===
          diningCategory.toLowerCase(),
      );

      if (targetCategory) {
        query["diningConfig.categories"] = targetCategory._id;
        query["diningConfig.enabled"] = true;
        // Respect admin-level dining toggle: only show if not explicitly disabled
        query["$or"] = [
          { "diningSettings.isEnabled": { $exists: false } },
          { "diningSettings.isEnabled": { $ne: false } },
        ];
      } else {
        // If category slug doesn't match any active category, return empty results
        query["diningConfig.categories"] = new mongoose.Types.ObjectId(); // Non-existent ID
      }
    } else if (req.query.isDining === "true") {
      // General dining filter if requested
      query["diningConfig.enabled"] = true;
      // Respect admin-level dining toggle as master switch
      query["$or"] = [
        { "diningSettings.isEnabled": { $exists: false } },
        { "diningSettings.isEnabled": { $ne: false } },
      ];
    }

    // Build sort object
    // Default: recently updated first so admin-approved outlets (save() bumps updatedAt) surface on home
    // even when createdAt is old — avoids hiding them behind limit when sorting only by createdAt.
    let sortObj = { updatedAt: -1, createdAt: -1 };

    if (sortBy) {
      switch (sortBy) {
        case "price-low":
          sortObj = { priceRange: 1, rating: -1 }; // $ < $$ < $$$, then by rating
          break;
        case "price-high":
          sortObj = { priceRange: -1, rating: -1 }; // $$$$ > $$$ > $$ > $, then by rating
          break;
        case "rating-high":
          sortObj = { rating: -1, totalRatings: -1 }; // Highest rating first
          break;
        case "rating-low":
          sortObj = { rating: 1, totalRatings: -1 }; // Lowest rating first
          break;
        case "relevance":
        default:
          sortObj = { rating: -1, totalRatings: -1, createdAt: -1 }; // Relevance: high rating + recent
          break;
      }
    }

    // Fetch candidate restaurants first. Zone membership is derived from polygon
    // containment, so we filter after fetch instead of querying by a stored zoneId.
    let restaurants = await Restaurant.find(query)
      .select("-owner -createdAt -updatedAt -password")
      .sort(sortObj)
      .lean();

    if (userZone) {
      restaurants = restaurants.filter((restaurant) =>
        isRestaurantInUserZone(restaurant, userZone),
      );
    }

    // Visibility filter: only show restaurants that have at least one dish
    // (approved + currently available).
    if (restaurants.length > 0) {
      const restaurantIds = restaurants.map((r) => r._id).filter(Boolean);

      const restaurantsWithDishes = await Menu.find({
        restaurant: { $in: restaurantIds },
        isActive: true,
        $or: [
          {
            sections: {
              $elemMatch: {
                items: {
                  $elemMatch: { isAvailable: true, approvalStatus: "approved" },
                },
              },
            },
          },
          {
            sections: {
              $elemMatch: {
                subsections: {
                  $elemMatch: {
                    items: {
                      $elemMatch: { isAvailable: true, approvalStatus: "approved" },
                    },
                  },
                },
              },
            },
          },
        ],
      })
        .select("restaurant")
        .lean();

      const hasDishesSet = new Set(
        (restaurantsWithDishes || [])
          .map((m) => m.restaurant?.toString())
          .filter(Boolean),
      );

      restaurants = restaurants.filter((r) =>
        hasDishesSet.has(r._id?.toString()),
      );
    }

    // Apply string-based filters that can't be done in MongoDB query
    if (maxDeliveryTime) {
      const maxTime = parseInt(maxDeliveryTime);
      restaurants = restaurants.filter((r) => {
        if (!r.estimatedDeliveryTime) return false;
        const timeMatch = r.estimatedDeliveryTime.match(/(\d+)/);
        return timeMatch && parseInt(timeMatch[1]) <= maxTime;
      });
    }

    if (maxDistance) {
      const maxDist = parseFloat(maxDistance);
      restaurants = restaurants.filter((r) => {
        if (!r.distance) return false;
        const distMatch = r.distance.match(/(\d+\.?\d*)/);
        return distMatch && parseFloat(distMatch[1]) <= maxDist;
      });
    }

    const total = restaurants.length;
    const parsedOffset = parseInt(offset);
    const parsedLimit = parseInt(limit);
    restaurants = restaurants.slice(parsedOffset, parsedOffset + parsedLimit);
    return successResponse(res, 200, "Restaurants retrieved successfully", {
      restaurants,
      total,
      filters: {
        sortBy,
        cuisine,
        minRating,
        maxDeliveryTime,
        maxDistance,
        maxPrice,
        hasOffers,
      },
    });
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    return errorResponse(res, 500, "Failed to fetch restaurants");
  }
};

// Get restaurant by ID or slug
export const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;

    // Build query conditions - only include _id if it's a valid ObjectId
    const queryConditions = {
      isActive: true,
    };

    const orConditions = [{ restaurantId: id }, { slug: id }];

    // Only add _id condition if the id is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(id) });
    }

    queryConditions.$or = orConditions;

    const restaurant = await Restaurant.findOne(queryConditions)
      .select("-owner -createdAt -updatedAt")
      .lean();

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    return successResponse(res, 200, "Restaurant retrieved successfully", {
      restaurant,
    });
  } catch (error) {
    console.error("Error fetching restaurant:", error);
    return errorResponse(res, 500, "Failed to fetch restaurant");
  }
};

// Get restaurant by owner (for restaurant module)
export const getRestaurantByOwner = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;

    const restaurant = await Restaurant.findById(restaurantId).lean();

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    return successResponse(res, 200, "Restaurant retrieved successfully", {
      restaurant,
    });
  } catch (error) {
    console.error("Error fetching restaurant:", error);
    return errorResponse(res, 500, "Failed to fetch restaurant");
  }
};

// Create/Update restaurant from onboarding data
export const createRestaurantFromOnboarding = async (
  onboardingData,
  restaurantId,
) => {
  try {
    const { step1, step2, step4 } = onboardingData;

    if (!step1 || !step2) {
      throw new Error("Incomplete onboarding data: Missing step1 or step2");
    }

    // Validate required fields
    if (!step1.restaurantName) {
      throw new Error("Restaurant name is required");
    }

    // Find existing restaurant
    const existing = await Restaurant.findById(restaurantId);

    if (!existing) {
      throw new Error("Restaurant not found");
    }

    // Generate slug from restaurant name
    let baseSlug = step1.restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Check if slug needs to be unique (if it's different from existing)
    let slug = baseSlug;
    if (existing.slug !== baseSlug) {
      // Check if the new slug already exists for another restaurant
      const existingBySlug = await Restaurant.findOne({
        slug: baseSlug,
        _id: { $ne: existing._id },
      });
      if (existingBySlug) {
        // Make slug unique by appending a number
        let counter = 1;
        let uniqueSlug = `${baseSlug}-${counter}`;
        while (
          await Restaurant.findOne({
            slug: uniqueSlug,
            _id: { $ne: existing._id },
          })
        ) {
          counter++;
          uniqueSlug = `${baseSlug}-${counter}`;
        }
        slug = uniqueSlug;
      }
    } else {
      slug = existing.slug; // Keep existing slug
    }

    // Update existing restaurant with latest onboarding data
    existing.name = step1.restaurantName || existing.name;
    existing.slug = slug;
    existing.ownerName = step1.ownerName || existing.ownerName;
    existing.ownerEmail = step1.ownerEmail || existing.ownerEmail;
    existing.ownerPhone = step1.ownerPhone || existing.ownerPhone;
    existing.primaryContactNumber =
      step1.primaryContactNumber || existing.primaryContactNumber;
    if (step1.location) existing.location = step1.location;

    // Update step2 data - always update even if empty arrays
    if (step2) {
      if (step2.profileImageUrl) {
        existing.profileImage = step2.profileImageUrl;
      }
      if (step2.menuImageUrls) {
        existing.menuImages = step2.menuImageUrls; // Update even if empty array
      }
      if (step2.cuisines) {
        existing.cuisines = step2.cuisines; // Update even if empty array
      }
      if (step2.deliveryTimings) {
        existing.deliveryTimings = step2.deliveryTimings;
      }
      if (step2.openDays) {
        existing.openDays = step2.openDays; // Update even if empty array
      }
    }

    // Update step4 data if available
    if (step4) {
      if (step4.estimatedDeliveryTime)
        existing.estimatedDeliveryTime = step4.estimatedDeliveryTime;
      if (step4.distance) existing.distance = step4.distance;
      if (step4.priceRange) existing.priceRange = step4.priceRange;
      if (step4.featuredDish) existing.featuredDish = step4.featuredDish;
      if (step4.featuredPrice !== undefined)
        existing.featuredPrice = step4.featuredPrice;
      if (step4.offer) existing.offer = step4.offer;
    }

    existing.isActive = true; // Ensure it's active
    existing.isAcceptingOrders = true; // Ensure it's accepting orders

    try {
      await existing.save();
    } catch (saveError) {
      if (
        saveError.code === 11000 &&
        saveError.keyPattern &&
        saveError.keyPattern.slug
      ) {
        // Slug conflict - try to make it unique
        let counter = 1;
        let uniqueSlug = `${slug}-${counter}`;
        while (
          await Restaurant.findOne({
            slug: uniqueSlug,
            _id: { $ne: existing._id },
          })
        ) {
          counter++;
          uniqueSlug = `${slug}-${counter}`;
        }
        existing.slug = uniqueSlug;
        await existing.save();
      } else {
        throw saveError;
      }
    }
    return existing;
  } catch (error) {
    console.error("Error creating restaurant from onboarding:", error);
    console.error("Error stack:", error.stack);
    console.error("Onboarding data received:", {
      hasStep1: !!onboardingData?.step1,
      hasStep2: !!onboardingData?.step2,
      step1Keys: onboardingData?.step1 ? Object.keys(onboardingData.step1) : [],
      step2Keys: onboardingData?.step2 ? Object.keys(onboardingData.step2) : [],
    });
    throw error;
  }
};

/**
 * Update restaurant profile
 * PUT /api/restaurant/profile
 */
export const updateRestaurantProfile = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const {
      profileImage,
      menuImages,
      name,
      cuisines,
      location,
      ownerName,
      ownerEmail,
      ownerPhone,
    } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    const updateData = {};

    // Update profile image if provided
    if (profileImage) {
      updateData.profileImage = profileImage;
    }

    // Update menu images if provided
    if (menuImages !== undefined) {
      updateData.menuImages = menuImages;
    }

    // Update name if provided
    if (name) {
      updateData.name = name;
      // Regenerate slug if name changed
      if (name !== restaurant.name) {
        let baseSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        // Check if slug already exists for another restaurant
        let slug = baseSlug;
        const existingBySlug = await Restaurant.findOne({
          slug: baseSlug,
          _id: { $ne: restaurantId },
        });
        if (existingBySlug) {
          let counter = 1;
          let uniqueSlug = `${baseSlug}-${counter}`;
          while (
            await Restaurant.findOne({
              slug: uniqueSlug,
              _id: { $ne: restaurantId },
            })
          ) {
            counter++;
            uniqueSlug = `${baseSlug}-${counter}`;
          }
          slug = uniqueSlug;
        }
        updateData.slug = slug;
      }
    }

    // Update cuisines if provided
    if (cuisines !== undefined) {
      updateData.cuisines = cuisines;
    }

    // Update location if provided
    if (location) {
      // Ensure coordinates array is set if latitude/longitude exist
      if (location.latitude && location.longitude && !location.coordinates) {
        location.coordinates = [location.longitude, location.latitude]; // GeoJSON format: [lng, lat]
      }

      // If coordinates array exists but no lat/lng, extract them
      if (
        location.coordinates &&
        Array.isArray(location.coordinates) &&
        location.coordinates.length >= 2
      ) {
        if (!location.longitude) location.longitude = location.coordinates[0];
        if (!location.latitude) location.latitude = location.coordinates[1];
      }

      const locationLat = parseFloat(location.latitude);
      const locationLng = parseFloat(location.longitude);
      if (!Number.isNaN(locationLat) && !Number.isNaN(locationLng)) {
        const activeZones = await Zone.find({ isActive: true }).lean();
        if (!activeZones || activeZones.length === 0) {
          return errorResponse(
            res,
            400,
            "No active delivery zones are available. Please contact administrator.",
          );
        }

        const isInAnyZone = isRestaurantInAnyZone(
          locationLat,
          locationLng,
          activeZones,
        );
        if (!isInAnyZone) {
          return errorResponse(
            res,
            400,
            "Selected location is outside all active zones. Please choose a location within a delivery zone.",
          );
        }
      }

      updateData.location = location;
    }

    // Update owner details if provided
    if (ownerName !== undefined) {
      updateData.ownerName = ownerName;
    }
    if (ownerEmail !== undefined) {
      updateData.ownerEmail = ownerEmail;
    }
    if (ownerPhone !== undefined) {
      updateData.ownerPhone = ownerPhone;
    }

    // Update restaurant
    Object.assign(restaurant, updateData);
    await restaurant.save();

    return successResponse(
      res,
      200,
      "Restaurant profile updated successfully",
      {
        restaurant: {
          id: restaurant._id,
          restaurantId: restaurant.restaurantId,
          name: restaurant.name,
          slug: restaurant.slug,
          profileImage: restaurant.profileImage,
          menuImages: restaurant.menuImages,
          cuisines: restaurant.cuisines,
          location: restaurant.location,
          ownerName: restaurant.ownerName,
          ownerEmail: restaurant.ownerEmail,
          ownerPhone: restaurant.ownerPhone,
        },
      },
    );
  } catch (error) {
    console.error("Error updating restaurant profile:", error);
    return errorResponse(res, 500, "Failed to update restaurant profile");
  }
});

/**
 * Upload restaurant profile image
 * POST /api/restaurant/profile/image
 */
export const uploadProfileImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, "No image file provided");
    }

    // Initialize Cloudinary if not already initialized
    await initializeCloudinary();

    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    // Upload to Cloudinary
    const folder = "appzeto/restaurant/profile";
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: "image",
      transformation: [
        { width: 800, height: 800, crop: "fill", gravity: "auto" },
        { quality: "auto" },
      ],
    });

    // Update restaurant profile image
    restaurant.profileImage = {
      url: result.secure_url,
      publicId: result.public_id,
    };
    await restaurant.save();

    return successResponse(res, 200, "Profile image uploaded successfully", {
      profileImage: restaurant.profileImage,
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    return errorResponse(res, 500, "Failed to upload profile image");
  }
});

/**
 * Upload restaurant menu image
 * POST /api/restaurant/profile/menu-image
 */
export const uploadMenuImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, "No image file provided");
    }

    // Validate file buffer
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return errorResponse(res, 400, "File buffer is empty or invalid");
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (req.file.size > maxSize) {
      return errorResponse(
        res,
        400,
        `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
      );
    }

    // Validate file type
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return errorResponse(
        res,
        400,
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(", ")}`,
      );
    }

    // Initialize Cloudinary if not already initialized
    await initializeCloudinary();

    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }
    // Upload to Cloudinary
    const folder = "appzeto/restaurant/menu";
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: "image",
      transformation: [
        { width: 1200, height: 800, crop: "fill", gravity: "auto" },
        { quality: "auto" },
      ],
    });

    // Replace first menu image (main banner) or add if none exists
    if (!restaurant.menuImages) {
      restaurant.menuImages = [];
    }

    // Replace the first menu image (main banner) instead of adding a new one
    const newMenuImage = {
      url: result.secure_url,
      publicId: result.public_id,
    };

    if (restaurant.menuImages.length > 0) {
      // Replace the first image (main banner)
      restaurant.menuImages[0] = newMenuImage;
    } else {
      // Add as first image if array is empty
      restaurant.menuImages.push(newMenuImage);
    }

    await restaurant.save();

    return successResponse(res, 200, "Menu image uploaded successfully", {
      menuImage: {
        url: result.secure_url,
        publicId: result.public_id,
      },
      menuImages: restaurant.menuImages,
    });
  } catch (error) {
    console.error("❌ Error uploading menu image:", {
      message: error.message,
      stack: error.stack,
      errorType: error.constructor.name,
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      bufferSize: req.file?.buffer?.length,
      restaurantId: req.restaurant?._id,
      cloudinaryError:
        error.http_code || error.name === "Error" ? error.message : null,
    });

    // Provide more specific error message
    let errorMessage = "Failed to upload menu image";
    if (error.message) {
      errorMessage += `: ${error.message}`;
    } else if (error.http_code) {
      errorMessage += `: Cloudinary error (${error.http_code})`;
    }

    return errorResponse(res, 500, errorMessage);
  }
});

/**
 * Update restaurant delivery status (isAcceptingOrders)
 * PUT /api/restaurant/delivery-status
 */
export const updateDeliveryStatus = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { isAcceptingOrders } = req.body;

    if (typeof isAcceptingOrders !== "boolean") {
      return errorResponse(
        res,
        400,
        "isAcceptingOrders must be a boolean value",
      );
    }

    // Verification guard: prevent unverified restaurants from turning
    // "online/accepting orders" on.
    if (isAcceptingOrders === true) {
      const currentRestaurant = await Restaurant.findById(restaurantId).select(
        "approvedAt phoneVerified",
      );
      if (!currentRestaurant) {
        return errorResponse(res, 404, "Restaurant not found");
      }

      if (!currentRestaurant.approvedAt) {
        return errorResponse(
          res,
          403,
          "You cannot take orders until your restaurant is verified by admin.",
        );
      }
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { isAcceptingOrders },
      { new: true },
    ).select("-password");

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    return successResponse(res, 200, "Delivery status updated successfully", {
      restaurant: {
        id: restaurant._id,
        isAcceptingOrders: restaurant.isAcceptingOrders,
      },
    });
  } catch (error) {
    console.error("Error updating delivery status:", error);
    return errorResponse(res, 500, "Failed to update delivery status");
  }
});

/**
 * Delete restaurant account
 * DELETE /api/restaurant/profile
 */
export const deleteRestaurantAccount = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    // Delete Cloudinary images if they exist
    try {
      // Delete profile image
      if (restaurant.profileImage?.publicId) {
        try {
          await deleteFromCloudinary(restaurant.profileImage.publicId);
        } catch (error) {
          console.error("Error deleting profile image from Cloudinary:", error);
          // Continue with account deletion even if image deletion fails
        }
      }

      // Delete menu images
      if (restaurant.menuImages && Array.isArray(restaurant.menuImages)) {
        for (const menuImage of restaurant.menuImages) {
          if (menuImage?.publicId) {
            try {
              await deleteFromCloudinary(menuImage.publicId);
            } catch (error) {
              console.error(
                "Error deleting menu image from Cloudinary:",
                error,
              );
              // Continue with account deletion even if image deletion fails
            }
          }
        }
      }
    } catch (error) {
      console.error("Error deleting images from Cloudinary:", error);
      // Continue with account deletion even if image deletion fails
    }

    // Delete the restaurant from database
    await Restaurant.findByIdAndDelete(restaurantId);
    return successResponse(res, 200, "Restaurant account deleted successfully");
  } catch (error) {
    console.error("Error deleting restaurant account:", error);
    return errorResponse(res, 500, "Failed to delete restaurant account");
  }
});

// Get restaurants with dishes under ₹250
export const getRestaurantsWithDishesUnder250 = async (req, res) => {
  try {
    const { zoneId, latitude, longitude } = req.query; // User zone or selected coordinates

    const { zone: userZone, error: zoneError, source: zoneSource } =
      await resolveUserZone({
        zoneId,
        latitude,
        longitude,
      });

    if (zoneError) {
      return errorResponse(res, 400, zoneError);
    }

    if (zoneSource === "coordinates" && !userZone) {
      return successResponse(
        res,
        200,
        "Restaurants with dishes under ₹250 retrieved successfully",
        {
          restaurants: [],
          total: 0,
        },
      );
    }

    const MAX_PRICE = 250;

    // Helper function to calculate final price after discount
    const getFinalPrice = (item) => {
      // price is typically the current/discounted price
      // If discount exists, calculate from originalPrice, otherwise use price directly
      if (
        item.originalPrice &&
        item.discountAmount &&
        item.discountAmount > 0
      ) {
        // Calculate discounted price from originalPrice
        let discountedPrice = item.originalPrice;
        if (item.discountType === "Percent") {
          discountedPrice =
            item.originalPrice -
            (item.originalPrice * item.discountAmount) / 100;
        } else if (item.discountType === "Fixed") {
          discountedPrice = item.originalPrice - item.discountAmount;
        }
        return Math.max(0, discountedPrice);
      }
      // Otherwise, use price as the final price
      return Math.max(0, item.price || 0);
    };

    // Helper function to filter items under ₹250
    const filterItemsUnder250 = (items) => {
      return items.filter((item) => {
        if (item.isAvailable === false) return false;
        const finalPrice = getFinalPrice(item);
        return finalPrice <= MAX_PRICE;
      });
    };

    // Helper function to process a single restaurant
    const processRestaurant = async (restaurant) => {
      try {
        // Get menu for this restaurant
        const menu = await Menu.findOne({
          restaurant: restaurant._id,
          isActive: true,
        }).lean();

        if (!menu || !menu.sections || menu.sections.length === 0) {
          return null; // Skip restaurants without menus
        }

        // Collect all dishes under ₹250 from all sections
        const dishesUnder250 = [];

        menu.sections.forEach((section) => {
          if (section.isEnabled === false) return;

          // Filter direct items in section
          const sectionItems = filterItemsUnder250(section.items || []);
          dishesUnder250.push(
            ...sectionItems.map((item) => ({
              ...item,
              sectionName: section.name,
            })),
          );

          // Filter items in subsections
          (section.subsections || []).forEach((subsection) => {
            const subsectionItems = filterItemsUnder250(subsection.items || []);
            dishesUnder250.push(
              ...subsectionItems.map((item) => ({
                ...item,
                sectionName: section.name,
                subsectionName: subsection.name,
              })),
            );
          });
        });

        // Only include restaurant if it has at least one dish under ₹250
        if (dishesUnder250.length > 0) {
          return {
            id: restaurant._id.toString(),
            restaurantId: restaurant.restaurantId,
            name: restaurant.name,
            slug: restaurant.slug,
            rating: restaurant.rating || 0,
            totalRatings: restaurant.totalRatings || 0,
            deliveryTime: restaurant.estimatedDeliveryTime || "25-30 mins",
            distance: restaurant.distance || "1.2 km",
            cuisine:
              restaurant.cuisines && restaurant.cuisines.length > 0
                ? restaurant.cuisines.join(" • ")
                : "Multi-cuisine",
            price: restaurant.priceRange || "$$",
            image:
              restaurant.profileImage?.url ||
              restaurant.menuImages?.[0]?.url ||
              "",
            menuItems: dishesUnder250.map((item) => ({
              id: item.id,
              name: item.name,
              price: getFinalPrice(item),
              originalPrice: item.originalPrice || item.price,
              image:
                item.image ||
                (item.images && item.images.length > 0 ? item.images[0] : ""),
              isVeg: item.foodType === "Veg",
              bestPrice:
                item.discountAmount > 0 ||
                (item.originalPrice &&
                  item.originalPrice > getFinalPrice(item)),
              description: item.description || "",
              category: item.category || item.sectionName || "",
              variations: Array.isArray(item.variations) ? item.variations.map((v) => ({
                id: String(v.id || v._id),
                name: v.name || "",
                price: v.price != null ? Number(v.price) : getFinalPrice(item),
              })) : [],
            })),
          };
        }
        return null;
      } catch (error) {
        console.error(`Error processing restaurant ${restaurant._id}:`, error);
        return null;
      }
    };

    // Get active restaurants first, then apply polygon-based zone filtering when needed.
    let restaurants = await Restaurant.find({ isActive: true })
      .select("-owner -createdAt -updatedAt")
      .lean()
      .limit(100); // Limit to first 100 restaurants for performance

    if (userZone) {
      restaurants = restaurants.filter((restaurant) =>
        isRestaurantInUserZone(restaurant, userZone),
      );
    }

    // Process restaurants in parallel (batch processing for better performance)
    const batchSize = 10; // Process 10 restaurants at a time
    const restaurantsWithDishes = [];

    for (let i = 0; i < restaurants.length; i += batchSize) {
      const batch = restaurants.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(processRestaurant));
      restaurantsWithDishes.push(...results.filter((r) => r !== null));
    }

    // Sort by rating (highest first) or by number of dishes
    restaurantsWithDishes.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.menuItems.length - a.menuItems.length;
    });

    return successResponse(
      res,
      200,
      "Restaurants with dishes under ₹250 retrieved successfully",
      {
        restaurants: restaurantsWithDishes,
        total: restaurantsWithDishes.length,
      },
    );
  } catch (error) {
    console.error("Error fetching restaurants with dishes under ₹250:", error);
    return errorResponse(
      res,
      500,
      "Failed to fetch restaurants with dishes under ₹250",
    );
  }
};
