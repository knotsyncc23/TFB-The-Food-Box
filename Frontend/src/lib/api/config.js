/**
 * API Configuration
 * Centralized configuration for API base URL and endpoints
 */

// Get API base URL from environment variable or use default.
// IMPORTANT: in production on app.tifunbox.com, prefer backend.tifunbox.com to avoid
// frontend SPA rewrite/proxy conflicts on /api paths.
const PROD_BACKEND_FALLBACK = "https://backend.tifunbox.com/api";
const DEV_BACKEND_FALLBACK = "http://localhost:5000/api";
const isProd =
  import.meta.env.MODE === "production" ||
  (typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test(window.location.hostname));
const hostLooksLikeAppDomain =
  typeof window !== "undefined" && /(^|\.)app\.tifunbox\.com$/i.test(window.location.hostname);

let rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (!rawApiBaseUrl || String(rawApiBaseUrl).trim() === "") {
  rawApiBaseUrl = isProd && hostLooksLikeAppDomain ? PROD_BACKEND_FALLBACK : DEV_BACKEND_FALLBACK;
}

// Normalize URL - fix common issues like double slashes, missing protocols
if (rawApiBaseUrl && typeof rawApiBaseUrl === "string") {
  // Remove leading/trailing whitespace
  rawApiBaseUrl = rawApiBaseUrl.trim();

  // Fix duplicate protocols (https://https:// becomes https://)
  rawApiBaseUrl = rawApiBaseUrl.replace(
    /^(https?:\/\/)+(https?:\/\/)+/gi,
    (match) => {
      const protocol = match.match(/^(https?):\/\//i)?.[1] || "https";
      return `${protocol}://`;
    },
  );

  // Fix malformed protocol patterns:
  // - https:/ becomes https://
  // - https: becomes https://
  // - https://https becomes https://
  rawApiBaseUrl = rawApiBaseUrl.replace(
    /^(https?):\/?(?=\/|$)/i,
    (match, protocol) => {
      return `${protocol}://`;
    },
  );

  // Fix patterns like https://https:// or http://http://
  rawApiBaseUrl = rawApiBaseUrl.replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");

  // Fix multiple slashes after protocol (https:/// becomes https://)
  rawApiBaseUrl = rawApiBaseUrl.replace(/(https?:\/\/)\/+/g, "$1");

  // Ensure it ends with /api if not already
  if (!rawApiBaseUrl.endsWith("/api")) {
    // Remove trailing slash if exists
    rawApiBaseUrl = rawApiBaseUrl.replace(/\/$/, "");
    // Add /api if not present
    if (!rawApiBaseUrl.endsWith("/api")) {
      rawApiBaseUrl = rawApiBaseUrl + "/api";
    }
  }
}

export let API_BASE_URL = rawApiBaseUrl;

// Safety override for production app domain if env accidentally points to app-domain /api or localhost.
if (isProd && hostLooksLikeAppDomain) {
  const isLocalhostTarget = /localhost|127\.0\.0\.1/.test(API_BASE_URL);
  const pointsToAppDomainApi = /^https?:\/\/app\.tifunbox\.com\/api/i.test(API_BASE_URL);
  if (isLocalhostTarget || pointsToAppDomainApi) {
    console.warn("⚠️ Overriding API base URL to production backend fallback:", PROD_BACKEND_FALLBACK);
    API_BASE_URL = PROD_BACKEND_FALLBACK;
  }
}

// Validate URL format - catch malformed URLs like "https:/" or "https://https://"
try {
  const urlObj = new URL(API_BASE_URL);
  if (!urlObj.protocol || !urlObj.hostname) {
    console.error("❌ Invalid API_BASE_URL format:", API_BASE_URL);
    console.error(
      "💡 Expected format: https://your-domain.com/api or http://localhost:5000/api",
    );
  }
} catch (urlError) {
  console.error("❌ Invalid API_BASE_URL format:", API_BASE_URL);
  console.error("💡 URL validation error:", urlError.message);
  console.error(
    "💡 Raw VITE_API_BASE_URL:",
    import.meta.env.VITE_API_BASE_URL || "Not set",
  );
  console.error(
    "💡 Expected format: https://your-domain.com/api or http://localhost:5000/api",
  );

  // Try to auto-fix common malformed patterns
  let fixedUrl = API_BASE_URL;
  // Fix patterns like "https:/" or "https://https://"
  if (fixedUrl.includes("://https://") || fixedUrl.includes("://http://")) {
    const parts = fixedUrl.split("://");
    fixedUrl = parts[0] + "://" + parts[parts.length - 1]; // Take first protocol and last part
    console.warn("⚠️ Auto-fixing malformed URL pattern, new URL:", fixedUrl);
  }

  // If still invalid, warn but don't change it
  try {
    new URL(fixedUrl);
    console.warn("⚠️ Consider using fixed URL:", fixedUrl);
  } catch {
    // Still invalid, keep original
  }
}

// Validate API base URL
if (API_BASE_URL.includes("5173")) {
  console.error(
    "❌ ERROR: API_BASE_URL is pointing to frontend port (5173) instead of backend port (5000)",
  );
  console.error(
    "💡 Fix: Set VITE_API_BASE_URL=http://localhost:5000/api in .env file",
  );
  console.error(
    "💡 Or remove VITE_API_BASE_URL to use default: http://localhost:5000/api",
  );
}

// Log API base URL in both development and production for debugging
console.log("🌐 API Base URL:", API_BASE_URL);
console.log("🌐 Backend URL:", API_BASE_URL.replace("/api", ""));
console.log("🌐 Frontend URL:", window.location.origin);
console.log("🌐 Environment:", import.meta.env.MODE);
console.log(
  "🌐 VITE_API_BASE_URL:",
  import.meta.env.VITE_API_BASE_URL || "Not set (using default)",
);

// Warn if API_BASE_URL is localhost in production
if (
  import.meta.env.MODE === "production" &&
  API_BASE_URL.includes("localhost")
) {
  console.error("❌ WARNING: API_BASE_URL is set to localhost in production!");
  console.error(
    "💡 Fix: Set VITE_API_BASE_URL environment variable to your production backend URL",
  );
  console.error(
    "💡 Example: VITE_API_BASE_URL=https://your-backend-domain.com/api",
  );
}

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    SEND_OTP: "/auth/send-otp",
    VERIFY_OTP: "/auth/verify-otp",
    REGISTER: "/auth/register",
    LOGIN: "/auth/login",
    FIREBASE_GOOGLE_LOGIN: "/auth/firebase/google-login",
    FIREBASE_SOCIAL_LOGIN: "/auth/firebase/social-login",
    APPLE_CONFIG: "/auth/apple/config",
    APPLE_LOGIN: "/auth/apple",
    REFRESH_TOKEN: "/auth/refresh-token",
    LOGOUT: "/auth/logout",
    ME: "/auth/me",
    FCM_TOKEN: "/auth/fcm-token",
  },
  // User endpoints
  USER: {
    PROFILE: "/user/profile",
    ADDRESSES: "/user/addresses",
    ADDRESS_UPDATE_TYPE: "/address/update-type",
    PREFERENCES: "/user/preferences",
    WALLET: "/user/wallet",
    ORDERS: "/user/orders",
    NOTIFICATIONS: "/user/notifications",
    ORDER_CHAT: "/order/:orderId/chat",
    ORDER_CHAT_MESSAGES: "/order/:orderId/chat/messages",
    LOCATION: "/user/location",
    COMPLAINTS: "/user/complaints",
    COMPLAINT_BY_ID: "/user/complaints/:id",
  },
  // Location endpoints
  LOCATION: {
    REVERSE_GEOCODE: "/location/reverse",
    NEARBY: "/location/nearby",
  },
  // Zone endpoints
  ZONE: {
    DETECT: "/zones/detect", // Public endpoint for zone detection
    ACTIVE: "/zones/active", // Public endpoint to list active zones
  },
  // Restaurant endpoints
  RESTAURANT: {
    AUTH: {
      SEND_OTP: "/restaurant/auth/send-otp",
      VERIFY_OTP: "/restaurant/auth/verify-otp",
      REGISTER: "/restaurant/auth/register",
      LOGIN: "/restaurant/auth/login",
      FIREBASE_GOOGLE_LOGIN: "/restaurant/auth/firebase/google-login",
      FIREBASE_APPLE_LOGIN: "/restaurant/auth/firebase/apple-login",
      REFRESH_TOKEN: "/restaurant/auth/refresh-token",
      LOGOUT: "/restaurant/auth/logout",
      ME: "/restaurant/auth/me",
      REVERIFY: "/restaurant/auth/reverify",
      RESET_PASSWORD: "/restaurant/auth/reset-password",
      FCM_TOKEN: "/restaurant/auth/fcm-token",
    },
    PROFILE: "/restaurant/profile",
    DELIVERY_STATUS: "/restaurant/delivery-status",
    DINING_CONFIG: "/restaurant/dining-config",
    DINING_OFFERS: "/restaurant/dining-offers",
    DINING_OFFER_BY_ID: "/restaurant/dining-offers/:offerId",
    DINING_MENU: "/restaurant/dining-menu",
    DINING_MENU_ITEMS: "/restaurant/dining-menu/items",
    DINING_REQUEST_ENABLE: "/restaurant/dining-config/request-enable",
    STAFF: "/restaurant/staff",
    MENU: "/restaurant/menu",
    MENU_BY_RESTAURANT_ID: "/restaurant/:id/menu",
    ADDONS_BY_RESTAURANT_ID: "/restaurant/:id/addons",
    MENU_ITEM_SCHEDULE: "/restaurant/menu/item/schedule",
    MENU_ITEM_SCHEDULE_BY_ID: "/restaurant/menu/item/schedule/:scheduleId",
    MENU_ITEM_SCHEDULE_BY_ITEM:
      "/restaurant/menu/item/schedule/:sectionId/:itemId",
    ADDONS: "/restaurant/menu/addons",
    ADDON: "/restaurant/menu/addon",
    ADDON_BY_ID: "/restaurant/menu/addon/:id",
    CATEGORIES: "/restaurant/categories",
    CATEGORIES_ALL: "/restaurant/categories/all",
    CATEGORY_BY_ID: "/restaurant/categories/:id",
    CATEGORIES_REORDER: "/restaurant/categories/reorder",
    INVENTORY: "/restaurant/inventory",
    INVENTORY_BY_RESTAURANT_ID: "/restaurant/:id/inventory",
    OFFERS: "/restaurant/offers",
    OFFERS_PUBLIC: "/restaurant/offers/public",
    OFFER_BY_ID: "/restaurant/offers/:id",
    OFFER_STATUS: "/restaurant/offers/:id/status",
    COUPONS_BY_ITEM_ID: "/restaurant/offers/item/:itemId/coupons",
    COUPONS_BY_ITEM_ID_PUBLIC:
      "/restaurant/:restaurantId/offers/item/:itemId/coupons",
    ORDERS: "/restaurant/orders",
    ORDER_BY_ID: "/restaurant/orders/:id",
    ORDER_ACCEPT: "/restaurant/orders/:id/accept",
    ORDER_REJECT: "/restaurant/orders/:id/reject",
    ORDER_PREPARING: "/restaurant/orders/:id/preparing",
    ORDER_READY: "/restaurant/orders/:id/ready",
    ORDER_RESEND_DELIVERY_NOTIFICATION:
      "/restaurant/orders/:id/resend-delivery-notification",
    FINANCE: "/restaurant/finance",
    WALLET: "/restaurant/wallet",
    WALLET_TRANSACTIONS: "/restaurant/wallet/transactions",
    WALLET_STATS: "/restaurant/wallet/stats",
    WITHDRAWAL_REQUEST: "/restaurant/withdrawal/request",
    WITHDRAWAL_REQUESTS: "/restaurant/withdrawal/requests",
    COMPLAINTS: "/restaurant/complaints",
    COMPLAINT_BY_ID: "/restaurant/complaints/:id",
    COMPLAINT_RESPOND: "/restaurant/complaints/:id/respond",
    ANALYTICS: "/restaurant/analytics",
    LIST: "/restaurant/list",
    UNDER_250: "/restaurant/under-250",
    BY_ID: "/restaurant/:id",
    BY_OWNER: "/restaurant/owner/me",
  },
  // Delivery endpoints
  DELIVERY: {
    AUTH: {
      SEND_OTP: "/delivery/auth/send-otp",
      VERIFY_OTP: "/delivery/auth/verify-otp",
      REFRESH_TOKEN: "/delivery/auth/refresh-token",
      LOGOUT: "/delivery/auth/logout",
      ME: "/delivery/auth/me",
      FCM_TOKEN: "/delivery/auth/fcm-token",
    },
    SIGNUP: {
      DETAILS: "/delivery/signup/details",
      DOCUMENTS: "/delivery/signup/documents",
    },
    DASHBOARD: "/delivery/dashboard",
    WALLET: "/delivery/wallet",
    WALLET_TRANSACTIONS: "/delivery/wallet/transactions",
    WALLET_STATS: "/delivery/wallet/stats",
    WALLET_WITHDRAW: "/delivery/wallet/withdraw",
    WALLET_EARNINGS: "/delivery/wallet/earnings",
    WALLET_COLLECT_PAYMENT: "/delivery/wallet/collect-payment",
    CLAIM_JOINING_BONUS: "/delivery/wallet/claim-joining-bonus",
    WALLET_DEPOSIT_CREATE_ORDER: "/delivery/wallet/deposit/create-order",
    WALLET_DEPOSIT_VERIFY: "/delivery/wallet/deposit/verify",
    ORDER_STATS: "/delivery/orders/stats",
    PROFILE: "/delivery/profile",
    ACTIVE_ORDER: "/delivery/active-order",
    ORDERS: "/delivery/orders",
    ORDER_BY_ID: "/delivery/orders/:orderId",
    ORDER_ACCEPT: "/delivery/orders/:orderId/accept",
    ORDER_REJECT: "/delivery/orders/:orderId/reject",
    ORDER_REACHED_PICKUP: "/delivery/orders/:orderId/reached-pickup",
    ORDER_CONFIRM_ID: "/delivery/orders/:orderId/confirm-order-id",
    ORDER_REACHED_DROP: "/delivery/orders/:orderId/reached-drop",
    ORDER_COMPLETE_DELIVERY: "/delivery/orders/:orderId/complete-delivery",
    ORDER_CHAT: "/delivery/orders/:orderId/chat",
    ORDER_CHAT_MESSAGES: "/delivery/orders/:orderId/chat/messages",
    TRIP_HISTORY: "/delivery/trip-history",
    EARNINGS: "/delivery/earnings",
    EARNINGS_ACTIVE_OFFERS: "/delivery/earnings/active-offers",
    EARNINGS_ACTIVE_OFFER_CLAIM: "/delivery/earnings/active-offers/:offerId/claim",
    LOCATION: "/delivery/location",
    ZONES_IN_RADIUS: "/delivery/zones/in-radius",
    REVERIFY: "/delivery/reverify",
    EMERGENCY_HELP: "/delivery/emergency-help",
    SUPPORT_TICKETS: "/delivery/support-tickets",
    SUPPORT_TICKET_BY_ID: "/delivery/support-tickets/:id",
  },
  // Admin endpoints
  ADMIN: {
    AUTH: {
      SIGNUP: "/admin/auth/signup",
      SIGNUP_OTP: "/admin/auth/signup/otp",
      LOGIN: "/admin/auth/login",
      LOGOUT: "/admin/auth/logout",
      ME: "/admin/auth/me",
    },
    PROFILE: "/admin/profile",
    CHANGE_PASSWORD: "/admin/settings/change-password",
    USERS: "/admin/users",
    USER_BY_ID: "/admin/users/:id",
    USER_STATUS: "/admin/users/:id/status",
    RESTAURANTS: "/admin/restaurants",
    RESTAURANT_BY_ID: "/admin/restaurants/:id",
    RESTAURANT_ANALYTICS: "/admin/restaurant-analytics/:restaurantId",
    RESTAURANT_STATUS: "/admin/restaurants/:id/status",
    RESTAURANT_REQUESTS: "/admin/restaurants/requests",
    RESTAURANT_APPROVE: "/admin/restaurants/:id/approve",
    RESTAURANT_REJECT: "/admin/restaurants/:id/reject",
    RESTAURANT_DELETE: "/admin/restaurants/:id",
    RESTAURANT_DINING_SEATING: "/admin/restaurants/:id/dining-seating",
    RESTAURANT_DINING_COMMISSION: "/admin/restaurants/:id/dining-commission",
    DINING_COUPONS: "/admin/dining-coupons",
    DINING_COUPONS_BY_ID: "/admin/dining-coupons/:id",
    DINING_COUPON_STATUS: "/admin/dining-coupons/:id/status",
    DINING_EARNINGS: "/admin/dining-earnings",
    DELIVERY: "/admin/delivery",
    DELIVERY_PARTNERS: "/admin/delivery-partners",
    DELIVERY_PARTNER_CREATE: "/admin/delivery-partners",
    DELIVERY_PARTNERS_REQUESTS: "/admin/delivery-partners/requests",
    DELIVERY_PARTNER_BY_ID: "/admin/delivery-partners/:id",
    DELIVERY_PARTNER_APPROVE: "/admin/delivery-partners/:id/approve",
    DELIVERY_PARTNER_REJECT: "/admin/delivery-partners/:id/reject",
    DELIVERY_PARTNER_REVERIFY: "/admin/delivery-partners/:id/reverify",
    DELIVERY_PARTNER_STATUS: "/admin/delivery-partners/:id/status",
    DELIVERY_PARTNER_DELETE: "/admin/delivery-partners/:id",
    DELIVERY_PARTNER_BONUS: "/admin/delivery-partners/bonus",
    DELIVERY_PARTNER_REVIEWS: "/admin/delivery-partners/reviews",
    DELIVERY_PARTNER_BONUS_TRANSACTIONS:
      "/admin/delivery-partners/bonus/transactions",
    EARNING_ADDON: "/admin/earning-addon",
    EARNING_ADDON_BY_ID: "/admin/earning-addon/:id",
    EARNING_ADDON_STATUS: "/admin/earning-addon/:id/status",
    EARNING_ADDON_CHECK_COMPLETIONS: "/admin/earning-addon/check-completions",
    EARNING_ADDON_HISTORY: "/admin/earning-addon-history",
    EARNING_ADDON_HISTORY_BY_ID: "/admin/earning-addon-history/:id",
    EARNING_ADDON_HISTORY_CREDIT: "/admin/earning-addon-history/:id/credit",
    EARNING_ADDON_HISTORY_CANCEL: "/admin/earning-addon-history/:id/cancel",
    EARNING_ADDON_HISTORY_STATISTICS: "/admin/earning-addon-history/statistics",
    ABOUT: "/admin/about",
    ABOUT_PUBLIC: "/about/public",
    TERMS: "/admin/terms",
    TERMS_PUBLIC: "/terms/public",
    PRIVACY: "/admin/privacy",
    PRIVACY_PUBLIC: "/privacy/public",
    CONTACT_US: "/admin/contact-us",
    CONTACT_US_PUBLIC: "/contact-us/public",
    REFUND: "/admin/refund",
    REFUND_PUBLIC: "/refund/public",
    SHIPPING: "/admin/shipping",
    SHIPPING_PUBLIC: "/shipping/public",
    CANCELLATION: "/admin/cancellation",
    CANCELLATION_PUBLIC: "/cancellation/public",
    FEEDBACK: "/admin/feedback",
    FEEDBACK_CREATE: "/feedback",
    REVIEWS: "/admin/reviews",
    FEEDBACK_EXPERIENCE: "/admin/feedback-experience",
    FEEDBACK_EXPERIENCE_CREATE: "/feedback-experience",
    FEEDBACK_EXPERIENCE_BY_ID: "/admin/feedback-experience/:id",
    SAFETY_EMERGENCY: "/admin/safety-emergency",
    SAFETY_EMERGENCY_CREATE: "/safety-emergency",
    ENV_VARIABLES: "/admin/env-variables",
    ORDERS: "/admin/orders",
    ORDER_MARK_READY: "/admin/orders/:id/mark-ready",
    ORDERS_SEARCHING_DELIVERYMAN: "/admin/orders/searching-deliveryman",
    ORDERS_ONGOING: "/admin/orders/ongoing",
    ORDERS_TRANSACTION_REPORT: "/admin/orders/transaction-report",
    ORDERS_RESTAURANT_REPORT: "/admin/orders/restaurant-report",
    CUSTOMER_WALLET_REPORT: "/admin/customer-wallet-report",
    WITHDRAWAL_REQUESTS: "/admin/withdrawal/requests",
    WITHDRAWAL_APPROVE: "/admin/withdrawal/:id/approve",
    WITHDRAWAL_REJECT: "/admin/withdrawal/:id/reject",
    BUSINESS_SETTINGS: "/admin/business-settings",
    BUSINESS_SETTINGS_PUBLIC: "/business-settings/public",
    ANALYTICS: "/admin/analytics",
    DASHBOARD_STATS: "/admin/dashboard/stats",
    CATEGORIES: "/admin/categories",
    CATEGORIES_PUBLIC: "/categories/public",
    CATEGORY_BY_ID: "/admin/categories/:id",
    CATEGORY_STATUS: "/admin/categories/:id/status",
    CATEGORY_PRIORITY: "/admin/categories/:id/priority",
    FEE_SETTINGS: "/admin/fee-settings",
    FEE_SETTINGS_PUBLIC: "/fee-settings/public",
    FEE_SETTINGS_HISTORY: "/admin/fee-settings/history",
    FEE_SETTINGS_BY_ID: "/admin/fee-settings/:id",
    DELIVERY_BOY_COMMISSION: "/admin/delivery-boy-commission",
    DELIVERY_BOY_COMMISSION_BY_ID: "/admin/delivery-boy-commission/:id",
    DELIVERY_BOY_COMMISSION_STATUS: "/admin/delivery-boy-commission/:id/status",
    DELIVERY_BOY_COMMISSION_CALCULATE:
      "/admin/delivery-boy-commission/calculate",
    DELIVERY_CASH_LIMIT: "/admin/delivery-cash-limit",
    CASH_LIMIT_SETTLEMENT: "/admin/cash-limit-settlement",
    DELIVERY_WITHDRAWAL_REQUESTS: "/admin/delivery-withdrawal/requests",
    DELIVERY_WITHDRAWAL_APPROVE: "/admin/delivery-withdrawal/:id/approve",
    DELIVERY_WITHDRAWAL_REJECT: "/admin/delivery-withdrawal/:id/reject",
    DELIVERY_BOY_WALLET: "/admin/delivery-boy-wallet",
    DELIVERY_BOY_WALLET_ADJUSTMENT: "/admin/delivery-boy-wallet/adjustment",
    DELIVERY_EMERGENCY_HELP: "/admin/delivery-emergency-help",
    DELIVERY_EMERGENCY_HELP_STATUS: "/admin/delivery-emergency-help/status",
    DELIVERY_SUPPORT_TICKETS: "/admin/delivery-support-tickets",
    DELIVERY_SUPPORT_TICKET_BY_ID: "/admin/delivery-support-tickets/:id",
    DELIVERY_SUPPORT_TICKETS_STATS: "/admin/delivery-support-tickets/stats",
    RESTAURANT_COMMISSION: "/admin/restaurant-commission",
    RESTAURANT_COMMISSION_APPROVED_RESTAURANTS:
      "/admin/restaurant-commission/approved-restaurants",
    RESTAURANT_COMMISSION_BY_RESTAURANT_ID:
      "/admin/restaurant-commission/restaurant/:restaurantId",
    RESTAURANT_COMMISSION_BY_ID: "/admin/restaurant-commission/:id",
    RESTAURANT_COMMISSION_STATUS: "/admin/restaurant-commission/:id/status",
    RESTAURANT_COMMISSION_CALCULATE: "/admin/restaurant-commission/calculate",
    RESTAURANT_COMPLAINTS: "/admin/restaurant-complaints",
    RESTAURANT_COMPLAINT_BY_ID: "/admin/restaurant-complaints/:id",
    RESTAURANT_COMPLAINT_STATUS: "/admin/restaurant-complaints/:id/status",
    RESTAURANT_COMPLAINT_NOTES: "/admin/restaurant-complaints/:id/notes",
    FOOD_APPROVALS: "/admin/food-approvals",
    FOOD_APPROVAL_APPROVE: "/admin/food-approvals/:id/approve",
    FOOD_APPROVAL_REJECT: "/admin/food-approvals/:id/reject",
    OFFERS: "/admin/offers",
    ZONES: "/admin/zones",
    ZONE_BY_ID: "/admin/zones/:id",
    ZONE_STATUS: "/admin/zones/:id/status",
    PUSH_NOTIFICATION: "/admin/push-notification",
  },
  // Order endpoints
  ORDER: {
    CREATE: "/order",
    LIST: "/order",
    DETAILS: "/order/:id",
    UPDATE_STATUS: "/order/:id/status",
    UPDATE_DELIVERY_DETAILS: "/order/:id/update-delivery-details",
    VERIFY_PAYMENT: "/order/verify-payment",
    CALCULATE: "/order/calculate",
    CANCEL: "/order/:id/cancel",
  },
  // Payment endpoints
  PAYMENT: {
    METHODS: "/payment/methods",
    PROCESS: "/payment/process",
    WALLET: "/payment/wallet",
  },
  // Menu endpoints
  MENU: {
    CATEGORIES: "/menu/categories",
    ITEMS: "/menu/items",
    SEARCH: "/menu/search",
  },
  // Upload / media endpoints
  UPLOAD: {
    MEDIA: "/upload/media",
  },
  // Hero Banner endpoints
  HERO_BANNER: {
    PUBLIC: "/hero-banners/public",
    LIST: "/hero-banners",
    CREATE: "/hero-banners",
    DELETE: "/hero-banners/:id",
    UPDATE_ORDER: "/hero-banners/:id/order",
    TOGGLE_STATUS: "/hero-banners/:id/status",
    TOP_10_PUBLIC: "/hero-banners/top-10/public",
    GOURMET_PUBLIC: "/hero-banners/gourmet/public",
  },
  // Dining endpoints
  DINING: {
    RESTAURANTS: "/dining/restaurants",
    RESTAURANT_BY_SLUG: "/dining/restaurants/:slug",
    RESTAURANT_OFFERS_BY_SLUG: "/dining/restaurants/:slug/offers",
    CATEGORIES: "/dining/categories",
    LIMELIGHT: "/dining/limelight",
    BANK_OFFERS: "/dining/bank-offers",
    MUST_TRIES: "/dining/must-tries",
    OFFER_BANNERS: "/dining/offer-banners",
    STORIES: "/dining/stories",
    BOOKING_CREATE: "/dining/bookings",
    BOOKING_MY: "/dining/bookings/my",
    BOOKING_RESTAURANT: "/dining/bookings/restaurant/:restaurantId",
    BOOKING_STATUS: "/dining/bookings/:bookingId/status",
    BOOKING_STATUS_RESTAURANT: "/dining/bookings/:bookingId/status/restaurant",
    BOOKING_SEND_BILL: "/dining/bookings/:bookingId/send-bill",
    BOOKING_APPLY_COUPON: "/dining/bookings/:bookingId/apply-coupon",
    BOOKING_CREATE_PAYMENT: "/dining/bookings/:bookingId/create-payment",
    BOOKING_VERIFY_PAYMENT: "/dining/bookings/:bookingId/verify-payment",
    REVIEW_CREATE: "/dining/reviews",
  },
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};
