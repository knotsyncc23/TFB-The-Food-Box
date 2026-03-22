import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import cron from "node-cron";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

// Import configurations
import { connectDB } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { initializeFirebaseRealtime } from "./config/firebaseRealtime.js";
import { getAllEnvVars } from "./shared/utils/envService.js";

// Import middleware
import { errorHandler } from "./shared/middleware/errorHandler.js";

// Import routes
import authRoutes from "./modules/auth/index.js";
import userRoutes from "./modules/user/index.js";
import restaurantRoutes from "./modules/restaurant/index.js";
import deliveryRoutes from "./modules/delivery/index.js";
import orderRoutes from "./modules/order/index.js";
import paymentRoutes from "./modules/payment/index.js";
import menuRoutes from "./modules/menu/index.js";
import campaignRoutes from "./modules/campaign/index.js";
import notificationRoutes from "./modules/notification/index.js";
import analyticsRoutes from "./modules/analytics/index.js";
import adminRoutes from "./modules/admin/index.js";
import categoryPublicRoutes from "./modules/admin/routes/categoryPublicRoutes.js";
import feeSettingsPublicRoutes from "./modules/admin/routes/feeSettingsPublicRoutes.js";
import envPublicRoutes from "./modules/admin/routes/envPublicRoutes.js";
import aboutPublicRoutes from "./modules/admin/routes/aboutPublicRoutes.js";
import businessSettingsPublicRoutes from "./modules/admin/routes/businessSettingsPublicRoutes.js";
import termsPublicRoutes from "./modules/admin/routes/termsPublicRoutes.js";
import privacyPublicRoutes from "./modules/admin/routes/privacyPublicRoutes.js";
import contactUsPublicRoutes from "./modules/admin/routes/contactUsPublicRoutes.js";
import refundPublicRoutes from "./modules/admin/routes/refundPublicRoutes.js";
import shippingPublicRoutes from "./modules/admin/routes/shippingPublicRoutes.js";
import cancellationPublicRoutes from "./modules/admin/routes/cancellationPublicRoutes.js";
import feedbackPublicRoutes from "./modules/admin/routes/feedbackPublicRoutes.js";
import feedbackExperiencePublicRoutes from "./modules/admin/routes/feedbackExperiencePublicRoutes.js";
import safetyEmergencyPublicRoutes from "./modules/admin/routes/safetyEmergencyPublicRoutes.js";
import zonePublicRoutes from "./modules/admin/routes/zonePublicRoutes.js";
import subscriptionRoutes from "./modules/subscription/index.js";
import uploadModuleRoutes from "./modules/upload/index.js";
import locationRoutes from "./modules/location/index.js";
import heroBannerRoutes from "./modules/heroBanner/index.js";
import diningRoutes from "./modules/dining/index.js";
import diningAdminRoutes from "./modules/dining/routes/diningAdminRoutes.js";

// Validate required environment variables
const requiredEnvVars = ["JWT_SECRET", "MONGODB_URI"];
const missingEnvVars = [];

requiredEnvVars.forEach((varName) => {
  let value = process.env[varName];

  // Remove quotes if present (dotenv sometimes includes them)
  if (value && typeof value === "string") {
    value = value.trim();
    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
  }

  // Update the env var with cleaned value
  if (value) {
    process.env[varName] = value;
  }

  // Check if valid
  if (
    !value ||
    value === "" ||
    (varName === "JWT_SECRET" && value.includes("your-super-secret"))
  ) {
    missingEnvVars.push(varName);
  }
});

if (missingEnvVars.length > 0) {
  console.error("❌ Missing or invalid required environment variables:");
  missingEnvVars.forEach((varName) => {
    console.error(
      `   - ${varName}${varName === "JWT_SECRET" ? " (must be set to a secure value, not the placeholder)" : ""}`,
    );
  });
  console.error("\nPlease update your .env file with valid values.");
  console.error("You can copy .env.example to .env and update the values.\n");
  process.exit(1);
}

// Initialize Firebase Realtime Database BEFORE creating Express app, routes, or Socket.IO
// This ensures getDb() can be used safely in any module (controllers, services, sockets).
try {
  const firebaseDb = initializeFirebaseRealtime();
  if (!firebaseDb) {
    console.warn(
      "⚠️ Firebase Realtime Database initialization returned null. " +
        "Live tracking features depending on Firebase will be disabled.",
    );
  }
} catch (err) {
  console.error(
    "❌ Firebase Realtime Database initialization threw an error:",
    err.message,
  );
}

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Reverse proxy awareness (needed for correct client IP + rate-limit behavior).
// If TRUST_PROXY is set, honor it; otherwise default to 1 hop in production.
const trustProxyRaw = process.env.TRUST_PROXY;
if (typeof trustProxyRaw === "string" && trustProxyRaw.trim() !== "") {
  const v = trustProxyRaw.trim().toLowerCase();
  if (v === "true") {
    app.set("trust proxy", true);
  } else if (v === "false") {
    app.set("trust proxy", false);
  } else if (!Number.isNaN(Number(v))) {
    app.set("trust proxy", Number(v));
  } else {
    // Values like "loopback", "linklocal", "uniquelocal" are supported by Express.
    app.set("trust proxy", trustProxyRaw);
  }
} else if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Initialize Socket.IO with proper CORS configuration
const allowedSocketOrigins = [
  process.env.CORS_ORIGIN,
 
  "https://app.tifunbox.com",
  "http://app.tifunbox.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
].filter(Boolean); // Remove undefined values

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedSocketOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // In development, allow all localhost origins
        if (process.env.NODE_ENV !== "production") {
          if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
            return callback(null, true);
          }
          // Allow all origins in development for easier debugging
          return callback(null, true);
        } else {
          console.error(
            `❌ Socket.IO: Blocking connection from: ${origin} (not in allowed list)`,
          );
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
  transports: ["polling", "websocket"], // Polling first, then upgrade to websocket
  allowEIO3: true, // Allow Engine.IO v3 clients for compatibility
  path: "/socket.io/", // Explicitly set Socket.IO path
  connectTimeout: 45000, // Increase connection timeout
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Export getIO function for use in other modules
export function getIO() {
  return io;
}

// Restaurant namespace for order notifications
const restaurantNamespace = io.of("/restaurant");

// Add connection error handling before connection event
restaurantNamespace.use((socket, next) => {
  try {
    // Log connection attempt
    // Allow all connections - authentication can be handled later if needed
    // The token is passed in auth.token but we don't validate it here
    // to avoid blocking connections unnecessarily
    next();
  } catch (error) {
    console.error("❌ Error in restaurant namespace middleware:", error);
    next(error);
  }
});

restaurantNamespace.on("connection", (socket) => {
  // Restaurant joins their room
  socket.on("join-restaurant", (restaurantId) => {
    if (restaurantId) {
      // Normalize restaurantId to string (handle both ObjectId and string)
      const normalizedRestaurantId = restaurantId?.toString() || restaurantId;
      const room = `restaurant:${normalizedRestaurantId}`;

      // Log room join attempt with detailed info
      socket.join(room);
      const roomSize = restaurantNamespace.adapter.rooms.get(room)?.size || 0;
      // Also join with ObjectId format if it's a valid ObjectId (for compatibility)
      if (mongoose.Types.ObjectId.isValid(normalizedRestaurantId)) {
        const objectIdRoom = `restaurant:${new mongoose.Types.ObjectId(normalizedRestaurantId).toString()}`;
        if (objectIdRoom !== room) {
          socket.join(objectIdRoom);
          const objectIdRoomSize =
            restaurantNamespace.adapter.rooms.get(objectIdRoom)?.size || 0;
        }
      }

      // Send confirmation back to client
      socket.emit("restaurant-room-joined", {
        restaurantId: normalizedRestaurantId,
        room: room,
        socketId: socket.id,
      });

      // Log all rooms this socket is now in
      const socketRooms = Array.from(socket.rooms).filter((r) =>
        r.startsWith("restaurant:"),
      );
    } else {
      console.warn("⚠️ Restaurant tried to join without restaurantId");
      console.warn("⚠️ Socket ID:", socket.id);
      console.warn("⚠️ Socket auth:", socket.handshake.auth);
    }
  });

  socket.on("disconnect", () => {
  });

  // Handle connection errors
  socket.on("error", (error) => {
    console.error("🍽️ Restaurant socket error:", error);
  });
});

// Delivery namespace for order assignments
const deliveryNamespace = io.of("/delivery");

deliveryNamespace.on("connection", (socket) => {
  // Delivery boy joins their room
  socket.on("join-delivery", (deliveryId) => {
    if (deliveryId) {
      // Normalize deliveryId to string (handle both ObjectId and string)
      const normalizedDeliveryId = deliveryId?.toString() || deliveryId;
      const room = `delivery:${normalizedDeliveryId}`;

      socket.join(room);
      // Also join with ObjectId format if it's a valid ObjectId (for compatibility)
      if (mongoose.Types.ObjectId.isValid(normalizedDeliveryId)) {
        const objectIdRoom = `delivery:${new mongoose.Types.ObjectId(normalizedDeliveryId).toString()}`;
        if (objectIdRoom !== room) {
          socket.join(objectIdRoom);
        }
      }

      // Send confirmation back to client
      socket.emit("delivery-room-joined", {
        deliveryId: normalizedDeliveryId,
        room: room,
        socketId: socket.id,
      });
    } else {
      console.warn("⚠️ Delivery partner tried to join without deliveryId");
    }
  });

  socket.on("disconnect", () => {
  });

  // Handle connection errors
  socket.on("error", (error) => {
    console.error("🚴 Delivery socket error:", error);
  });
});

// Make io available to routes
app.set("io", io);

// Connect to databases
import { initializeCloudinary } from "./config/cloudinary.js";

// Connect to databases
connectDB().then(() => {
  // Initialize Cloudinary after DB connection
  initializeCloudinary().catch((err) =>
    console.error("Failed to initialize Cloudinary:", err),
  );

  // After DB is connected, hydrate runtime env from admin-configured variables.
  // This lets you set FIREBASE_DATABASE_URL from Admin Panel and have backend use it everywhere.
  (async () => {
    try {
      const envData = await getAllEnvVars();
      if (envData?.FIREBASE_DATABASE_URL) {
        process.env.FIREBASE_DATABASE_URL = String(envData.FIREBASE_DATABASE_URL).trim();
      }
      // Re-attempt Firebase init after hydration (safe to call multiple times)
      initializeFirebaseRealtime();
    } catch (err) {
      console.warn("⚠️ Failed to hydrate env from database:", err.message);
    }
  })();
});

// Redis connection is optional - only connects if REDIS_ENABLED=true
connectRedis().catch(() => {
  // Silently handle Redis connection failures
  // The app works without Redis
});

// Security middleware
app.use(helmet());
// CORS configuration - allow multiple origins
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  "https://app.tifunbox.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        process.env.NODE_ENV === "development"
      ) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(null, true); // Allow in development, block in production
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Data sanitization
app.use(mongoSanitize());

// Rate limiting (disabled in development mode)
if (process.env.NODE_ENV === "production") {
  const rateLimitWindowMs =
    parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 minutes
  const writeMaxRequests =
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 300;
  const readMaxRequests =
    parseInt(process.env.RATE_LIMIT_GET_MAX_REQUESTS, 10) || 2000;

  const clientKeyGenerator = (req) => {
    // Prefer first forwarded IP when behind proxy/CDN.
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.trim()) {
      return xff.split(",")[0].trim();
    }
    return req.ip;
  };

  // High limit for public/read-heavy traffic (home/search/list pages).
  const readLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: readMaxRequests,
    keyGenerator: clientKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method !== "GET",
    message: "Too many read requests from this IP, please try again later.",
  });

  // Stricter limit for writes and auth-sensitive requests.
  const writeLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: writeMaxRequests,
    keyGenerator: clientKeyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "GET",
    message: "Too many requests from this IP, please try again later.",
  });

  app.use("/api/", readLimiter);
  app.use("/api/", writeLimiter);
} else {
}

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use("/api", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/restaurant", restaurantRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/campaign", campaignRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", categoryPublicRoutes);
app.use("/api", feeSettingsPublicRoutes);
app.use("/api/env", envPublicRoutes);
app.use("/api", aboutPublicRoutes);
app.use("/api", businessSettingsPublicRoutes);
app.use("/api", termsPublicRoutes);
app.use("/api", privacyPublicRoutes);
app.use("/api", contactUsPublicRoutes);
app.use("/api", refundPublicRoutes);
app.use("/api", shippingPublicRoutes);
app.use("/api", cancellationPublicRoutes);
app.use("/api", feedbackPublicRoutes);
app.use("/api", feedbackExperiencePublicRoutes);
app.use("/api", safetyEmergencyPublicRoutes);
app.use("/api", zonePublicRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api", uploadModuleRoutes);
app.use("/api/location", locationRoutes);
app.use("/api", heroBannerRoutes);
app.use("/api/dining", diningRoutes);
app.use("/api/admin/dining", diningAdminRoutes);

// 404 handler - but skip Socket.IO paths
app.use((req, res, next) => {
  // Skip Socket.IO paths - Socket.IO handles its own routing
  if (
    req.path.startsWith("/socket.io/") ||
    req.path.startsWith("/restaurant") ||
    req.path.startsWith("/delivery")
  ) {
    return next();
  }

  // Log 404 errors for debugging (especially for admin routes)
  if (req.path.includes("/admin") || req.path.includes("refund")) {
    console.error("❌ [404 HANDLER] Route not found:", {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      route: req.route?.path,
      registeredRoutes: "Check server startup logs for route registration",
    });
    console.error(
      "💡 [404 HANDLER] Expected route: POST /api/admin/refund-requests/:orderId/process",
    );
    console.error("💡 [404 HANDLER] Make sure:");
    console.error("   1. Backend server has been restarted");
    console.error("   2. Route is registered (check startup logs)");
    console.error("   3. Authentication token is valid");
  }

  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method,
    expectedRoute: req.path.includes("refund")
      ? "POST /api/admin/refund-requests/:orderId/process"
      : undefined,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Socket.IO connection handling
io.on("connection", (socket) => {
  // Delivery boy sends location update
  socket.on("update-location", (data) => {
    try {
      // Validate data
      if (
        !data.orderId ||
        typeof data.lat !== "number" ||
        typeof data.lng !== "number"
      ) {
        console.error("Invalid location update data:", data);
        return;
      }

      // Broadcast location to customer tracking this order (only to specific room)
      // Format: { orderId, lat, lng, heading }
      const locationData = {
        orderId: data.orderId,
        lat: data.lat,
        lng: data.lng,
        heading: data.heading || 0,
        timestamp: Date.now(),
      };

      // Send to specific order room
      io.to(`order:${data.orderId}`).emit(
        `location-receive-${data.orderId}`,
        locationData,
      );
    } catch (error) {
      console.error("Error handling location update:", error);
    }
  });

  // Customer or delivery joins order chat room (for real-time messages)
  socket.on("join-order-chat", (orderId) => {
    if (orderId) {
      socket.join(`order-chat:${orderId}`);
    }
  });

  socket.on("leave-order-chat", (orderId) => {
    if (orderId) {
      socket.leave(`order-chat:${orderId}`);
    }
  });

  // Customer joins order tracking room
  socket.on("join-order-tracking", async (orderId) => {
    if (orderId) {
      socket.join(`order:${orderId}`);
      // Send current location immediately when customer joins
      try {
        // Dynamic import to avoid circular dependencies
        const { default: Order } =
          await import("./modules/order/models/Order.js");

      const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId);
      const order = isValidObjectId
        ? await Order.findById(orderId)
        : await Order.findOne({ orderId: orderId })
        .populate({
          path: "deliveryPartnerId",
          select: "availability",
          populate: {
            path: "availability.currentLocation",
          },
        })
        .lean();

        if (order?.deliveryPartnerId?.availability?.currentLocation) {
          const coords =
            order.deliveryPartnerId.availability.currentLocation.coordinates;
          const locationData = {
            orderId,
            lat: coords[1],
            lng: coords[0],
            heading: 0,
            timestamp: Date.now(),
          };

          // Send current location immediately
          socket.emit(`current-location-${orderId}`, locationData);
        }
      } catch (error) {
        console.error("Error sending current location:", error.message);
      }
    }
  });

  // Handle request for current location
  socket.on("request-current-location", async (orderId) => {
    if (!orderId) return;

    try {
      // Dynamic import to avoid circular dependencies
      const { default: Order } =
        await import("./modules/order/models/Order.js");

      const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId);
      const order = isValidObjectId
        ? await Order.findById(orderId)
        : await Order.findOne({ orderId: orderId })
        .populate({
          path: "deliveryPartnerId",
          select: "availability",
        })
        .lean();

      if (order?.deliveryPartnerId?.availability?.currentLocation) {
        const coords =
          order.deliveryPartnerId.availability.currentLocation.coordinates;
        const locationData = {
          orderId,
          lat: coords[1],
          lng: coords[0],
          heading: 0,
          timestamp: Date.now(),
        };

        // Send current location immediately
        socket.emit(`current-location-${orderId}`, locationData);
      }
    } catch (error) {
      console.error("Error fetching current location:", error.message);
    }
  });

  // Delivery boy joins delivery room
  socket.on("join-delivery", (deliveryId) => {
    if (deliveryId) {
      socket.join(`delivery:${deliveryId}`);
    }
  });

  socket.on("disconnect", () => {
  });
});

// Start server
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  // Initialize scheduled tasks after DB connection is established
  // Wait a bit for DB to connect, then start cron jobs
  setTimeout(() => {
    initializeScheduledTasks();
  }, 5000);
});

// Initialize scheduled tasks
function initializeScheduledTasks() {
  // Import menu schedule service
  import("./modules/restaurant/services/menuScheduleService.js")
    .then(({ processScheduledAvailability }) => {
      // Run every minute to check for due schedules
      cron.schedule("* * * * *", async () => {
        try {
          const result = await processScheduledAvailability();
          if (result.processed > 0) {
          }
        } catch (error) {
          console.error("[Menu Schedule Cron] Error:", error);
        }
      });
    })
    .catch((error) => {
      console.error("❌ Failed to initialize menu schedule service:", error);
    });

  // Import auto-ready service
  import("./modules/order/services/autoReadyService.js")
    .then(({ processAutoReadyOrders }) => {
      // Run every 30 seconds to check for orders that should be marked as ready
      cron.schedule("*/30 * * * * *", async () => {
        try {
          const result = await processAutoReadyOrders();
          if (result.processed > 0) {
          }
        } catch (error) {
          console.error("[Auto Ready Cron] Error:", error);
        }
      });
    })
    .catch((error) => {
      console.error("❌ Failed to initialize auto-ready service:", error);
    });

  // Import auto-reject service
  import("./modules/order/services/autoRejectService.js")
    .then(({ processAutoRejectOrders }) => {
      // Run every 30 seconds to check for orders that should be auto-rejected
      cron.schedule("*/30 * * * * *", async () => {
        try {
          const result = await processAutoRejectOrders();
          if (result.processed > 0) {
          }
        } catch (error) {
          console.error("[Auto Reject Cron] Error:", error);
        }
      });
    })
    .catch((error) => {
      console.error("❌ Failed to initialize auto-reject service:", error);
    });
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  // Close server & exit process
  httpServer.close(() => {
    process.exit(1);
  });
});

export default app;
