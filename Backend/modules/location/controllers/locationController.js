import axios from "axios";
import winston from "winston";
import { getGoogleMapsApiKey } from "../../../shared/utils/envService.js";
import GeocodeCache from "../models/GeocodeCache.js";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const buildMinimalGeocodeData = (latNum, lngNum) => {
  return {
    results: [
      {
        formatted_address: `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`,
        address_components: {
          city: "",
          state: "",
          country: "",
          area: "",
        },
        geometry: {
          location: {
            lat: latNum,
            lng: lngNum,
          },
        },
      },
    ],
  };
};

/**
 * Reverse geocode coordinates to address using Google Maps API + Database Caching.
 * Saves ~90% of Google Maps API cost.
 */
export const reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude",
      });
    }

    // --- STEP 1: CHECK CACHE (100% FREE) ---
    // 4 decimal places gives an ~11m grid precision. Anyone dropping a pin within the
    // same 11m building block shares the same cached address and saves us an API call.
    const geoKey = `${latNum.toFixed(4)},${lngNum.toFixed(4)}`;

    try {
      const cachedRecord = await GeocodeCache.findOne({ geoKey });
      if (cachedRecord) {
        logger.info(`✅ Geocode Cache HIT for: ${geoKey}`);
        return res.json({
          success: true,
          data: {
            results: [
              {
                formatted_address: cachedRecord.formatted_address,
                address_components: cachedRecord.address_components,
                geometry: {
                  location: {
                    lat: latNum,
                    lng: lngNum,
                  },
                },
              },
            ],
          },
          source: "database_cache", // Tells the frontend we saved money!
        });
      }
    } catch (dbError) {
      logger.error("Error reading from geocode cache:", dbError.message);
      // If our MongoDB cache fails for some reason, don't crash. Just continue to API.
    }

    logger.info(`❌ Geocode Cache MISS for: ${geoKey}. Attempting APIs...`);

    let formattedAddress = "";
    let city = "", state = "", country = "", area = "", road = "", building = "", postcode = "";
    let sourceUsed = "";

    // --- STEP 2: TRY PREAMBLE GOOGLE MAPS API ($$$) ---
    const googleApiKey = await getGoogleMapsApiKey() || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

    if (googleApiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latNum},${lngNum}&key=${googleApiKey}&result_type=street_address|premise|point_of_interest|establishment`;
        const response = await axios.get(url, { timeout: 8000 });
        const data = response.data;

        if (data.status === "OK" && data.results && data.results.length > 0) {
          sourceUsed = "google_maps_api";

          // Find the most detailed result (one that includes building/business names if possible)
          let bestResult = data.results[0];
          for (const result of data.results.slice(0, 5)) {
            const hasPOI = result.address_components?.some((c) => c.types.includes("point_of_interest"));
            const hasPremise = result.address_components?.some((c) => c.types.includes("premise"));
            if (hasPOI || hasPremise) {
              bestResult = result;
              break;
            }
          }

          formattedAddress = bestResult.formatted_address || "";
          const components = bestResult.address_components || [];

          for (const component of components) {
            const types = component.types || [];
            if (types.includes("point_of_interest") || types.includes("premise")) {
              building = building || component.long_name;
            }
            if (types.includes("route")) road = component.long_name;
            if (types.includes("sublocality_level_1") || types.includes("sublocality") || types.includes("neighborhood")) {
              area = area || component.long_name;
            }
            if (types.includes("locality")) city = component.long_name;
            if (types.includes("administrative_area_level_1")) state = component.long_name;
            if (types.includes("country")) country = component.long_name;
            if (types.includes("postal_code")) postcode = component.long_name;
          }
        }
      } catch (googleError) {
        logger.error("Google Maps API request failed, falling back to Nominatim", { error: googleError.message });
      }
    }

    // --- STEP 3: FALLBACK TO OPENSTREETMAP (FREE) ---
    if (!sourceUsed) {
      try {
        const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
          params: {
            format: "json",
            lat: latNum,
            lon: lngNum,
            addressdetails: 1,
            "accept-language": "en",
            zoom: 18,
          },
          headers: {
            "User-Agent": "Tifunbox-App/1.0",
          },
          timeout: 8000,
        });

        const data = response.data;

        if (data && !data.error) {
          sourceUsed = "nominatim_api";
          const addr = data.address || {};

          city = addr.city || addr.town || addr.village || addr.municipality || addr.county || city;
          state = addr.state || state;
          country = addr.country || country;
          area = addr.suburb || addr.neighbourhood || addr.quarter || addr.hamlet || addr.residential || area;
          road = addr.road || road;
          building = addr.building || addr.amenity || addr.shop || building;
          postcode = addr.postcode || postcode;

          formattedAddress = data.display_name || "";

          // Clean up an empty area field
          if (!area && formattedAddress) {
            const parts = formattedAddress.split(",").map((p) => p.trim());
            if (parts.length >= 3 && parts[0].toLowerCase() !== city.toLowerCase() && parts[0].length > 2) {
              area = parts[0];
            }
          }
        }
      } catch (nominatimError) {
        logger.error("Nominatim OpenStreetMap fallback failed", { error: nominatimError.message });
      }
    }

    // --- FINAL STEP: IF ALL FAILS -> JUST COORDINATES ---
    const hasFineGrainedDetail = Boolean(road || building || area || formattedAddress);
    if (!hasFineGrainedDetail) {
      formattedAddress = `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`;
      sourceUsed = "coordinates_only";
    }

    const processedComponent = {
      city: city || "",
      state: state || "",
      country: country || "",
      area: area || "",
      road: road || "",
      building: building || "",
      postcode: postcode || "",
    };

    // --- STEP 4: SAVE NEW LOCATION TO CACHE FOR FREE FUTURE USE ---
    if (sourceUsed === "google_maps_api" || sourceUsed === "nominatim_api") {
      try {
        await GeocodeCache.create({
          geoKey,
          latitude: latNum,
          longitude: lngNum,
          address_components: processedComponent,
          formatted_address: formattedAddress,
        });
        logger.info(`💾 Saved undiscovered location to cache: ${geoKey}`);
      } catch (cacheStoreError) {
        // High concurrency might create duplicate attempts at the exact same time
        // Mongodb throws 11000 for unique key duplicate, we safely ignore it.
        if (cacheStoreError.code !== 11000) {
          logger.error("Failed to save to Geocode cache:", cacheStoreError.message);
        }
      }
    }

    return res.json({
      success: true,
      data: {
        results: [
          {
            formatted_address: formattedAddress,
            address_components: processedComponent,
            geometry: {
              location: {
                lat: latNum,
                lng: lngNum,
              },
            },
          },
        ],
      },
      source: sourceUsed, // Tells UI where this came from!
    });
  } catch (error) {
    logger.error("Reverse geocode fatal error", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get nearby locations/places using free Nominatim search API.
 * Zero Google Maps API cost.
 * GET /location/nearby?lat=...&lng=...&radius=...
 */
export const getNearbyLocations = async (req, res) => {
  try {
    const { lat, lng, radius = 100, query = "" } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude",
      });
    }

    // Clamp requested radius to 100m (max 100m nearby as requested)
    let radiusNum = parseFloat(radius);
    if (Number.isNaN(radiusNum) || radiusNum <= 0) radiusNum = 100;
    radiusNum = Math.min(radiusNum, 100);

    // Use Nominatim search with viewbox for nearby results
    const degreeOffset = radiusNum / 111000; // rough meter-to-degree
    const viewbox = [
      lngNum - degreeOffset,
      latNum - degreeOffset,
      lngNum + degreeOffset,
      latNum + degreeOffset,
    ].join(",");

    let results = [];
    try {
      const response = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          format: "json",
          q: query || "*",
          viewbox: viewbox,
          bounded: 1,
          addressdetails: 1,
          limit: 10,
          "accept-language": "en",
        },
        headers: {
          "User-Agent": "Tifunbox-App/1.0",
        },
        timeout: 8000,
      });
      results = response.data || [];
    } catch (apiError) {
      logger.error("Nominatim nearby search failed", {
        error: apiError.message,
      });
      return res.json({
        success: true,
        data: {
          exactLocation: { lat: latNum, lng: lngNum },
          nearestWithinRadius: null,
          locations: [],
        },
        source: "none",
      });
    }

    const exactLocation = { lat: latNum, lng: lngNum };

    if (!Array.isArray(results) || results.length === 0) {
      return res.json({
        success: true,
        data: {
          exactLocation,
          nearestWithinRadius: null,
          locations: [],
        },
        source: "nominatim",
      });
    }

    const nearbyPlaces = results.map((place, index) => {
      const placeLat = parseFloat(place.lat);
      const placeLng = parseFloat(place.lon);
      const distance = calculateDistance(latNum, lngNum, placeLat, placeLng);

      return {
        id: place.place_id ? String(place.place_id) : `place_${index}`,
        name: place.display_name ? place.display_name.split(",")[0] : "",
        address: place.display_name || "",
        distance:
          distance < 1000
            ? `${Math.round(distance)} m`
            : `${(distance / 1000).toFixed(2)} km`,
        distanceMeters: Math.round(distance),
        latitude: placeLat,
        longitude: placeLng,
      };
    });

    // Filter to max 100m and pick only the nearest place.
    const nearbyPlacesInRadius = nearbyPlaces
      .filter((p) => typeof p.distanceMeters === "number" && p.distanceMeters <= radiusNum)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    const nearestWithinRadius = nearbyPlacesInRadius[0] || null;

    return res.json({
      success: true,
      data: {
        exactLocation,
        nearestWithinRadius,
        locations: nearestWithinRadius ? [nearestWithinRadius] : [],
        source: "nominatim",
      },
    });
  } catch (error) {
    logger.error("Get nearby locations error", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
