/**
 * API Client
 * Centralized API client for all modules (user, restaurant, delivery, admin)
 *
 * Usage:
 * import api from '@/lib/api'
 *
 * // GET request
 * const response = await api.get('/user/profile')
 *
 * // POST request
 * const response = await api.post('/auth/login', { email, password })
 *
 * // PUT request
 * const response = await api.put('/user/profile', { name, email })
 *
 * // DELETE request
 * const response = await api.delete('/user/addresses/:id')
 */

import apiClient from "./axios.js";
import { API_ENDPOINTS } from "./config.js";

const buildFcmTokenUrl = (basePath, platform, fcmToken) => {
  const params = new URLSearchParams();
  if (platform) params.set("platform", String(platform));
  if (fcmToken) params.set("fcmToken", String(fcmToken));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
};

// Export the configured axios instance
export default apiClient;

// Export API endpoints for convenience
export { API_ENDPOINTS };

// Export helper functions for common operations
export const api = {
  // GET request
  get: (url, config = {}) => {
    return apiClient.get(url, config);
  },

  // POST request
  post: (url, data = {}, config = {}) => {
    return apiClient.post(url, data, config);
  },

  // PUT request
  put: (url, data = {}, config = {}) => {
    return apiClient.put(url, data, config);
  },

  // PATCH request
  patch: (url, data = {}, config = {}) => {
    return apiClient.patch(url, data, config);
  },

  // DELETE request
  delete: (url, config = {}) => {
    return apiClient.delete(url, config);
  },
};

// Export auth helper functions
export const authAPI = {
  // Send OTP (supports both phone and email)
  sendOTP: (phone = null, purpose = "login", email = null) => {
    const payload = { purpose };
    if (phone) payload.phone = phone;
    if (email) payload.email = email;
    return apiClient.post(API_ENDPOINTS.AUTH.SEND_OTP, payload);
  },

  // Verify OTP (supports both phone and email)
  // 'password' is used only for email/password registrations (e.g. admin signup)
  verifyOTP: (
    phone = null,
    otp,
    purpose = "login",
    name = null,
    email = null,
    role = "user",
    password = null,
  ) => {
    const payload = {
      otp,
      purpose,
      role,
    };
    if (phone != null) payload.phone = phone;
    if (email != null) payload.email = email;
    if (name != null) payload.name = name;
    if (password != null) payload.password = password; // don't send null, Joi expects string
    return apiClient.post(API_ENDPOINTS.AUTH.VERIFY_OTP, payload);
  },

  // Register with email/password
  register: (name, email, password, phone = null, role = "user") => {
    return apiClient.post(API_ENDPOINTS.AUTH.REGISTER, {
      name,
      email,
      password,
      phone,
      role,
    });
  },

  // Login with email/password
  login: (email, password, role = null) => {
    const payload = { email, password };
    if (role) payload.role = role;
    return apiClient.post(API_ENDPOINTS.AUTH.LOGIN, payload);
  },

  // Login/Register via Firebase Google ID token
  firebaseGoogleLogin: (idToken, role = "restaurant") => {
    return apiClient.post(API_ENDPOINTS.AUTH.FIREBASE_GOOGLE_LOGIN, {
      idToken,
      role,
    });
  },
  firebaseSocialLogin: (idToken, role = "user", provider = "google") => {
    return apiClient.post(API_ENDPOINTS.AUTH.FIREBASE_SOCIAL_LOGIN, {
      idToken,
      role,
      provider,
    });
  },
  getAppleConfig: () => {
    return apiClient.get(API_ENDPOINTS.AUTH.APPLE_CONFIG);
  },
  // Login/Register via Apple identity token
  appleLogin: (identityToken, role = "user", name = null) => {
    const payload = { identityToken, role };
    if (name) payload.name = name;
    return apiClient.post(API_ENDPOINTS.AUTH.APPLE_LOGIN, payload);
  },

  // Refresh token
  refreshToken: () => {
    return apiClient.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN);
  },

  // Logout
  logout: () => {
    return apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  },

  // Register / refresh FCM token for authenticated user
  registerFcmToken: (platform, fcmToken) => {
    console.log("[FCM] Sending token to backend", {
      platform,
      hasToken: !!fcmToken,
    });
    return apiClient.post(buildFcmTokenUrl(API_ENDPOINTS.AUTH.FCM_TOKEN, platform, fcmToken), {
      platform,
      fcmToken,
    });
  },

  // Remove FCM token for this platform on logout
  removeFcmToken: (platform = "web") => {
    console.log("[FCM] Removing token on backend for platform", platform);
    return apiClient.delete(buildFcmTokenUrl(API_ENDPOINTS.AUTH.FCM_TOKEN, platform), {
      data: { platform },
    });
  },

  // Get current user
  getCurrentUser: () => {
    return apiClient.get(API_ENDPOINTS.AUTH.ME);
  },
};

// Export user API helper functions
export const userAPI = {
  // Get user profile
  getProfile: () => {
    return apiClient.get(API_ENDPOINTS.USER.PROFILE);
  },

  // Delete user account
  deleteAccount: () => {
    return apiClient.delete(API_ENDPOINTS.USER.PROFILE);
  },

  // Get user notifications
  getNotifications: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.USER.NOTIFICATIONS, { params });
  },

  // Update user profile
  updateProfile: (data) => {
    return apiClient.put(API_ENDPOINTS.USER.PROFILE, data);
  },

  // Upload profile image
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return apiClient.post("/user/profile/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Remove profile image (clears profileImage url)
  removeProfileImage: () => {
    return apiClient.delete("/user/profile/avatar");
  },

  // Get user addresses
  getAddresses: () => {
    return apiClient.get(API_ENDPOINTS.USER.ADDRESSES);
  },

  // Add address
  addAddress: (address) => {
    return apiClient.post(API_ENDPOINTS.USER.ADDRESSES, address);
  },

  // Update address
  updateAddress: (addressId, address) => {
    return apiClient.put(
      `${API_ENDPOINTS.USER.ADDRESSES}/${addressId}`,
      address,
    );
  },

  // Update address type (Home | Office | Other)
  updateAddressType: (addressId, type) => {
    return apiClient.patch(API_ENDPOINTS.USER.ADDRESS_UPDATE_TYPE, {
      addressId,
      type,
    });
  },

  // Delete address
  deleteAddress: (addressId) => {
    return apiClient.delete(`${API_ENDPOINTS.USER.ADDRESSES}/${addressId}`);
  },

  // Get user preferences
  getPreferences: () => {
    return apiClient.get(API_ENDPOINTS.USER.PREFERENCES);
  },

  // Update preferences
  updatePreferences: (preferences) => {
    return apiClient.put(API_ENDPOINTS.USER.PREFERENCES, preferences);
  },

  // Get wallet
  getWallet: () => {
    return apiClient.get(API_ENDPOINTS.USER.WALLET);
  },

  // Get wallet transactions
  getWalletTransactions: (params = {}) => {
    return apiClient.get(`${API_ENDPOINTS.USER.WALLET}/transactions`, {
      params,
    });
  },

  // Create Razorpay order for wallet top-up
  createWalletTopupOrder: (amount) => {
    return apiClient.post(`${API_ENDPOINTS.USER.WALLET}/create-topup-order`, {
      amount,
    });
  },

  // Verify payment and add money to wallet
  verifyWalletTopupPayment: (data) => {
    return apiClient.post(
      `${API_ENDPOINTS.USER.WALLET}/verify-topup-payment`,
      data,
    );
  },

  // Add money to wallet (direct - internal use)
  addMoneyToWallet: (data) => {
    return apiClient.post(`${API_ENDPOINTS.USER.WALLET}/add-money`, data);
  },

  // Get user orders
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.USER.ORDERS, { params });
  },

  // Order chat (Track Order live chat with delivery partner)
  getOrderChat: (orderId) => {
    return apiClient.get(
      API_ENDPOINTS.USER.ORDER_CHAT.replace(":orderId", orderId),
    );
  },
  sendOrderChatMessage: (orderId, message) => {
    return apiClient.post(
      API_ENDPOINTS.USER.ORDER_CHAT_MESSAGES.replace(":orderId", orderId),
      { message },
    );
  },

  // Get user location
  getLocation: () => {
    return apiClient.get(API_ENDPOINTS.USER.LOCATION);
  },

  // Update user location
  updateLocation: (locationData) => {
    return apiClient.put(API_ENDPOINTS.USER.LOCATION, locationData);
  },
};

// Export location API helper functions
export const locationAPI = {
  // Reverse geocode coordinates to address
  reverseGeocode: (lat, lng) => {
    return apiClient.get(API_ENDPOINTS.LOCATION.REVERSE_GEOCODE, {
      params: { lat, lng },
    });
  },
  // Get nearby locations
  getNearbyLocations: (lat, lng, radius = 100, query = "") => {
    return apiClient.get(API_ENDPOINTS.LOCATION.NEARBY, {
      params: { lat, lng, radius, query },
    });
  },
};

// Export zone API helper functions
export const zoneAPI = {
  // Detect user's zone based on location
  detectZone: (lat, lng) => {
    return apiClient.get(API_ENDPOINTS.ZONE.DETECT, {
      params: { lat, lng },
    });
  },
  // Get all active zones (public)
  getActiveZones: () => {
    return apiClient.get(API_ENDPOINTS.ZONE.ACTIVE);
  },
};

// Export restaurant API helper functions
export const restaurantAPI = {
  // Restaurant Authentication
  sendOTP: (phone = null, purpose = "login", email = null) => {
    const payload = { purpose };
    if (phone) payload.phone = phone;
    if (email) payload.email = email;
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.SEND_OTP, payload);
  },

  verifyOTP: (
    phone = null,
    otp,
    purpose = "login",
    name = null,
    email = null,
    password = null,
  ) => {
    const payload = {
      otp,
      purpose,
    };
    if (phone != null) payload.phone = phone;
    if (email != null) payload.email = email;
    if (name != null) payload.name = name;
    if (password != null) payload.password = password;
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.VERIFY_OTP, payload);
  },

  register: (
    name,
    email,
    password,
    phone = null,
    ownerName = null,
    ownerEmail = null,
    ownerPhone = null,
  ) => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.REGISTER, {
      name,
      email,
      password,
      phone,
      ownerName,
      ownerEmail,
      ownerPhone,
    });
  },

  login: (email, password) => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.LOGIN, {
      email,
      password,
    });
  },

  firebaseGoogleLogin: (idToken) => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.FIREBASE_GOOGLE_LOGIN, {
      idToken,
    });
  },
  firebaseAppleLogin: (idToken) => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.FIREBASE_APPLE_LOGIN, {
      idToken,
    });
  },

  refreshToken: () => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.REFRESH_TOKEN);
  },

  logout: () => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.LOGOUT);
  },

  getCurrentRestaurant: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.AUTH.ME);
  },

  reverify: () => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.REVERIFY);
  },

  resetPassword: (email, otp, newPassword) => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.AUTH.RESET_PASSWORD, {
      email,
      otp,
      newPassword,
    });
  },

  // Register / refresh FCM token for authenticated restaurant
  registerFcmToken: (platform, fcmToken) => {
    console.log("[FCM][Restaurant] Sending token to backend", {
      platform,
      hasToken: !!fcmToken,
    });
    return apiClient.post(buildFcmTokenUrl(API_ENDPOINTS.RESTAURANT.AUTH.FCM_TOKEN, platform, fcmToken), {
      platform,
      fcmToken,
    });
  },

  // Remove FCM token for this restaurant platform on logout
  removeFcmToken: (platform = "web") => {
    console.log(
      "[FCM][Restaurant] Removing token on backend for platform",
      platform,
    );
    return apiClient.delete(buildFcmTokenUrl(API_ENDPOINTS.RESTAURANT.AUTH.FCM_TOKEN, platform), {
      data: { platform },
    });
  },

  // Get restaurant profile
  getProfile: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.PROFILE);
  },

  // Update restaurant profile
  updateProfile: (data) => {
    return apiClient.put(API_ENDPOINTS.RESTAURANT.PROFILE, data);
  },

  // Delete restaurant account
  deleteAccount: () => {
    return apiClient.delete(API_ENDPOINTS.RESTAURANT.PROFILE);
  },

  // Update delivery status (isAcceptingOrders)
  updateDeliveryStatus: (isAcceptingOrders) => {
    return apiClient.put(API_ENDPOINTS.RESTAURANT.DELIVERY_STATUS, {
      isAcceptingOrders,
    });
  },

  // Dining Management
  getDiningConfig: () => apiClient.get(API_ENDPOINTS.RESTAURANT.DINING_CONFIG),
  updateDiningConfig: (data) =>
    apiClient.patch(API_ENDPOINTS.RESTAURANT.DINING_CONFIG, data),
  requestDiningEnable: () =>
    apiClient.post(API_ENDPOINTS.RESTAURANT.DINING_REQUEST_ENABLE),
  getDiningOffers: () => apiClient.get(API_ENDPOINTS.RESTAURANT.DINING_OFFERS),
  createDiningOffer: (data) =>
    apiClient.post(API_ENDPOINTS.RESTAURANT.DINING_OFFERS, data),
  updateDiningOffer: (offerId, data) =>
    apiClient.patch(
      API_ENDPOINTS.RESTAURANT.DINING_OFFER_BY_ID.replace(":offerId", offerId),
      data,
    ),
  deleteDiningOffer: (offerId) =>
    apiClient.delete(
      API_ENDPOINTS.RESTAURANT.DINING_OFFER_BY_ID.replace(":offerId", offerId),
    ),
  getDiningMenu: () => apiClient.get(API_ENDPOINTS.RESTAURANT.DINING_MENU),
  updateDiningMenuItem: (data) =>
    apiClient.patch(API_ENDPOINTS.RESTAURANT.DINING_MENU_ITEMS, data),

  // Upload profile image
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post(
      `${API_ENDPOINTS.RESTAURANT.PROFILE}/image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
  },

  // Upload menu image
  uploadMenuImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post(
      `${API_ENDPOINTS.RESTAURANT.PROFILE}/menu-image`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
  },

  // Staff Management
  addStaff: (data) => {
    // If data is FormData, set appropriate headers
    const config =
      data instanceof FormData
        ? {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        : {};
    return apiClient.post(API_ENDPOINTS.RESTAURANT.STAFF, data, config);
  },
  getStaff: (role) => {
    const url = role
      ? `${API_ENDPOINTS.RESTAURANT.STAFF}?role=${role}`
      : API_ENDPOINTS.RESTAURANT.STAFF;
    return apiClient.get(url);
  },
  getStaffById: (id) => {
    return apiClient.get(`${API_ENDPOINTS.RESTAURANT.STAFF}/${id}`);
  },
  updateStaff: (id, data) => {
    return apiClient.put(`${API_ENDPOINTS.RESTAURANT.STAFF}/${id}`, data);
  },
  deleteStaff: (id) => {
    return apiClient.delete(`${API_ENDPOINTS.RESTAURANT.STAFF}/${id}`);
  },

  // Menu operations
  getMenu: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.MENU);
  },
  updateMenu: (menuData) => {
    return apiClient.put(API_ENDPOINTS.RESTAURANT.MENU, menuData);
  },
  addSection: (name) => {
    return apiClient.post(`${API_ENDPOINTS.RESTAURANT.MENU}/section`, { name });
  },
  addItemToSection: (sectionId, item) => {
    return apiClient.post(`${API_ENDPOINTS.RESTAURANT.MENU}/section/item`, {
      sectionId,
      item,
    });
  },
  addSubsectionToSection: (sectionId, name) => {
    return apiClient.post(
      `${API_ENDPOINTS.RESTAURANT.MENU}/section/subsection`,
      { sectionId, name },
    );
  },
  addItemToSubsection: (sectionId, subsectionId, item) => {
    return apiClient.post(`${API_ENDPOINTS.RESTAURANT.MENU}/subsection/item`, {
      sectionId,
      subsectionId,
      item,
    });
  },
  getMenuByRestaurantId: (restaurantId) => {
    return apiClient.get(
      API_ENDPOINTS.RESTAURANT.MENU_BY_RESTAURANT_ID.replace(
        ":id",
        restaurantId,
      ),
    );
  },

  // Get orders
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.ORDERS, { params });
  },

  // Get restaurant review summary/list
  getReviews: (params = {}) => {
    return apiClient.get("/restaurant/reviews", { params });
  },

  // Get order by ID
  getOrderById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.RESTAURANT.ORDER_BY_ID.replace(":id", id),
    );
  },

  // Accept order
  acceptOrder: (id, preparationTime = null) => {
    return apiClient.patch(
      API_ENDPOINTS.RESTAURANT.ORDER_ACCEPT.replace(":id", id),
      {
        preparationTime,
      },
    );
  },

  // Reject order
  rejectOrder: (id, reason = "") => {
    return apiClient.patch(
      API_ENDPOINTS.RESTAURANT.ORDER_REJECT.replace(":id", id),
      {
        reason,
      },
    );
  },

  // Mark order as preparing
  markOrderPreparing: (id, options = {}) => {
    const url = API_ENDPOINTS.RESTAURANT.ORDER_PREPARING.replace(":id", id);
    // Add resend query parameter if provided
    if (options.resend) {
      return apiClient.patch(`${url}?resend=true`);
    }
    return apiClient.patch(url);
  },

  // Mark order as ready
  markOrderReady: (id) => {
    return apiClient.patch(
      API_ENDPOINTS.RESTAURANT.ORDER_READY.replace(":id", id),
    );
  },

  // Resend delivery notification for unassigned order
  resendDeliveryNotification: (id) => {
    return apiClient.post(
      API_ENDPOINTS.RESTAURANT.ORDER_RESEND_DELIVERY_NOTIFICATION.replace(
        ":id",
        id,
      ),
    );
  },

  // Get wallet
  getWallet: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.WALLET);
  },
  getWalletTransactions: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.WALLET_TRANSACTIONS, {
      params,
    });
  },
  getWalletStats: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.WALLET_STATS, { params });
  },
  // Withdrawal
  createWithdrawalRequest: (amount) => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.WITHDRAWAL_REQUEST, {
      amount,
    });
  },
  getWithdrawalRequests: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.WITHDRAWAL_REQUESTS, {
      params,
    });
  },

  // Get analytics
  getAnalytics: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.ANALYTICS, { params });
  },

  // Get all restaurants (for user module)
  getRestaurants: (params = {}) => {
    let enrichedParams = { ...params };

    try {
      const rawStoredLocation = localStorage.getItem("userLocation");
      if (rawStoredLocation) {
        const storedLocation = JSON.parse(rawStoredLocation);
        const latitude = Number(
          enrichedParams.latitude ?? enrichedParams.lat ?? storedLocation?.latitude,
        );
        const longitude = Number(
          enrichedParams.longitude ?? enrichedParams.lng ?? storedLocation?.longitude,
        );

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          enrichedParams = {
            ...enrichedParams,
            latitude,
            longitude,
          };
        }
      }
    } catch {
      // Ignore malformed cached location and fall back to explicit params only.
    }

    return apiClient.get(API_ENDPOINTS.RESTAURANT.LIST, {
      params: enrichedParams,
    });
  },

  // Get restaurants with dishes under ₹250
  getRestaurantsUnder250: (zoneIdOrParams) => {
    let params =
      zoneIdOrParams && typeof zoneIdOrParams === "object"
        ? { ...zoneIdOrParams }
        : zoneIdOrParams
          ? { zoneId: zoneIdOrParams }
          : {};

    try {
      const rawStoredLocation = localStorage.getItem("userLocation");
      if (rawStoredLocation) {
        const storedLocation = JSON.parse(rawStoredLocation);
        const latitude = Number(
          params.latitude ?? params.lat ?? storedLocation?.latitude,
        );
        const longitude = Number(
          params.longitude ?? params.lng ?? storedLocation?.longitude,
        );

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          params = {
            ...params,
            latitude,
            longitude,
          };
        }
      }
    } catch {
      // Ignore malformed cached location and fall back to explicit params only.
    }

    return apiClient.get(API_ENDPOINTS.RESTAURANT.UNDER_250, { params });
  },

  // Get restaurant by ID or slug
  getRestaurantById: (id) => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.BY_ID.replace(":id", id));
  },
  // Get coupons for item (public - for user cart)
  getCouponsByItemIdPublic: (restaurantId, itemId) => {
    return apiClient.get(
      API_ENDPOINTS.RESTAURANT.COUPONS_BY_ITEM_ID_PUBLIC.replace(
        ":restaurantId",
        restaurantId,
      ).replace(":itemId", itemId),
    );
  },
  // Get public offers (for user offers page)
  getPublicOffers: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.OFFERS_PUBLIC);
  },

  // Get restaurant by owner (for restaurant module)
  getRestaurantByOwner: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.BY_OWNER);
  },

  // Add-on operations
  addAddon: (addonData) => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.ADDON, addonData);
  },
  getAddons: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.ADDONS);
  },
  updateAddon: (id, addonData) => {
    return apiClient.put(
      API_ENDPOINTS.RESTAURANT.ADDON_BY_ID.replace(":id", id),
      addonData,
    );
  },
  deleteAddon: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.RESTAURANT.ADDON_BY_ID.replace(":id", id),
    );
  },
  getAddonsByRestaurantId: (restaurantId) => {
    return apiClient.get(
      API_ENDPOINTS.RESTAURANT.ADDONS_BY_RESTAURANT_ID.replace(
        ":id",
        restaurantId,
      ),
    );
  },

  // Menu item scheduling operations
  scheduleItemAvailability: (scheduleData) => {
    return apiClient.post(
      API_ENDPOINTS.RESTAURANT.MENU_ITEM_SCHEDULE,
      scheduleData,
    );
  },
  cancelScheduledAvailability: (scheduleId) => {
    return apiClient.delete(
      API_ENDPOINTS.RESTAURANT.MENU_ITEM_SCHEDULE_BY_ID.replace(
        ":scheduleId",
        scheduleId,
      ),
    );
  },
  getItemSchedule: (sectionId, itemId) => {
    return apiClient.get(
      API_ENDPOINTS.RESTAURANT.MENU_ITEM_SCHEDULE_BY_ITEM.replace(
        ":sectionId",
        sectionId,
      ).replace(":itemId", itemId),
    );
  },

  // Category operations (for restaurant module)
  getCategories: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.CATEGORIES);
  },
  getAllCategories: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.CATEGORIES_ALL);
  },
  createCategory: (categoryData) => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.CATEGORIES, categoryData);
  },
  updateCategory: (id, categoryData) => {
    return apiClient.put(
      API_ENDPOINTS.RESTAURANT.CATEGORY_BY_ID.replace(":id", id),
      categoryData,
    );
  },
  deleteCategory: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.RESTAURANT.CATEGORY_BY_ID.replace(":id", id),
    );
  },
  reorderCategories: (categories) => {
    return apiClient.put(API_ENDPOINTS.RESTAURANT.CATEGORIES_REORDER, {
      categories,
    });
  },

  // Inventory operations (for restaurant module)
  getInventory: () => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.INVENTORY);
  },
  updateInventory: (inventoryData) => {
    return apiClient.put(API_ENDPOINTS.RESTAURANT.INVENTORY, inventoryData);
  },
  getInventoryByRestaurantId: (restaurantId) => {
    return apiClient.get(
      API_ENDPOINTS.RESTAURANT.INVENTORY_BY_RESTAURANT_ID.replace(
        ":id",
        restaurantId,
      ),
    );
  },

  // Offer operations (for restaurant module)
  createOffer: (offerData) => {
    return apiClient.post(API_ENDPOINTS.RESTAURANT.OFFERS, offerData);
  },
  getOffers: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.OFFERS, { params });
  },
  getOfferById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.RESTAURANT.OFFER_BY_ID.replace(":id", id),
    );
  },
  updateOfferStatus: (id, status) => {
    return apiClient.put(
      API_ENDPOINTS.RESTAURANT.OFFER_STATUS.replace(":id", id),
      { status },
    );
  },
  deleteOffer: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.RESTAURANT.OFFER_BY_ID.replace(":id", id),
    );
  },
  getCouponsByItemId: (itemId) => {
    return apiClient.get(
      API_ENDPOINTS.RESTAURANT.COUPONS_BY_ITEM_ID.replace(":itemId", itemId),
    );
  },

  // Finance operations (for restaurant module)
  getFinance: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.FINANCE, { params });
  },

  // Complaint operations
  getComplaints: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.RESTAURANT.COMPLAINTS, { params });
  },
  getComplaintById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.RESTAURANT.COMPLAINT_BY_ID.replace(":id", id),
    );
  },
  respondToComplaint: (id, response) => {
    return apiClient.put(
      API_ENDPOINTS.RESTAURANT.COMPLAINT_RESPOND.replace(":id", id),
      { response },
    );
  },
};

// Export delivery API helper functions
export const deliveryAPI = {
  // Delivery Authentication
  sendOTP: (phone, purpose = "login") => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.AUTH.SEND_OTP, {
      phone,
      purpose,
    });
  },
  verifyOTP: (phone, otp, purpose = "login", name = null) => {
    const payload = { phone, otp, purpose };
    // Only include name if it's provided and is a string
    if (name && typeof name === "string" && name.trim()) {
      payload.name = name.trim();
    }
    return apiClient.post(API_ENDPOINTS.DELIVERY.AUTH.VERIFY_OTP, payload);
  },
  refreshToken: () => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.AUTH.REFRESH_TOKEN);
  },
  logout: () => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.AUTH.LOGOUT);
  },
  getCurrentDelivery: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.AUTH.ME);
  },

  deleteAccount: () => {
    return apiClient.delete(API_ENDPOINTS.DELIVERY.PROFILE);
  },

  // Register / refresh FCM token for authenticated delivery partner
  registerFcmToken: (platform, fcmToken) => {
    console.log("[FCM][Delivery] Sending token to backend", {
      platform,
      hasToken: !!fcmToken,
    });
    return apiClient.post(buildFcmTokenUrl(API_ENDPOINTS.DELIVERY.AUTH.FCM_TOKEN, platform, fcmToken), {
      platform,
      fcmToken,
    });
  },

  // Remove FCM token for this delivery platform on logout
  removeFcmToken: (platform = "web") => {
    console.log("[FCM][Delivery] Removing token on backend for platform", platform);
    return apiClient.delete(buildFcmTokenUrl(API_ENDPOINTS.DELIVERY.AUTH.FCM_TOKEN, platform), {
      data: { platform },
    });
  },

  // Dashboard
  getDashboard: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.DASHBOARD);
  },

  // Wallet
  getWallet: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.WALLET);
  },
  getWalletBalance: () => {
    // Backward compatibility - use getWallet instead
    return apiClient.get(API_ENDPOINTS.DELIVERY.WALLET);
  },
  getWalletTransactions: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.WALLET_TRANSACTIONS, {
      params,
    });
  },
  getWalletStats: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.WALLET_STATS, { params });
  },
  createWithdrawalRequest: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_WITHDRAW, data);
  },
  addEarning: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_EARNINGS, data);
  },
  collectPayment: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_COLLECT_PAYMENT, data);
  },
  claimJoiningBonus: () => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.CLAIM_JOINING_BONUS);
  },
  createDepositOrder: (amount) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_DEPOSIT_CREATE_ORDER, {
      amount,
    });
  },
  verifyDepositPayment: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.WALLET_DEPOSIT_VERIFY, data);
  },
  getOrderStats: (period = "all") => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.ORDER_STATS, {
      params: { period },
    });
  },

  // Get emergency help numbers
  getEmergencyHelp: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.EMERGENCY_HELP);
  },

  // Support Tickets
  getSupportTickets: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.SUPPORT_TICKETS, { params });
  },

  getSupportTicketById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.DELIVERY.SUPPORT_TICKET_BY_ID.replace(":id", id),
    );
  },

  createSupportTicket: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.SUPPORT_TICKETS, data);
  },

  // Get delivery profile
  getProfile: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.PROFILE);
  },

  // Update delivery profile
  updateProfile: (data) => {
    return apiClient.put(API_ENDPOINTS.DELIVERY.PROFILE, data);
  },

  // Get orders
  getActiveOrder: () => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.ACTIVE_ORDER);
  },
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.ORDERS, { params });
  },
  getOrderDetails: (orderId) => {
    return apiClient.get(
      API_ENDPOINTS.DELIVERY.ORDER_BY_ID.replace(":orderId", orderId),
    );
  },
  getOrderChat: (orderId) => {
    return apiClient.get(
      API_ENDPOINTS.DELIVERY.ORDER_CHAT.replace(":orderId", orderId),
    );
  },
  sendOrderChatMessage: (orderId, message) => {
    return apiClient.post(
      API_ENDPOINTS.DELIVERY.ORDER_CHAT_MESSAGES.replace(":orderId", orderId),
      { message },
    );
  },
  acceptOrder: (orderId, currentLocation = {}) => {
    const payload = {};
    if (currentLocation.lat !== undefined && currentLocation.lat !== null) {
      payload.currentLat = currentLocation.lat;
    }
    if (currentLocation.lng !== undefined && currentLocation.lng !== null) {
      payload.currentLng = currentLocation.lng;
    }
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_ACCEPT.replace(":orderId", orderId),
      payload,
    );
  },
  rejectOrder: (orderId, reason = "") => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_REJECT.replace(":orderId", orderId),
      { reason },
    );
  },
  confirmReachedPickup: (orderId) => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_REACHED_PICKUP.replace(":orderId", orderId),
    );
  },
  confirmOrderId: (
    orderId,
    confirmedOrderId,
    currentLocation = {},
    additionalData = {},
  ) => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_CONFIRM_ID.replace(":orderId", orderId),
      {
        confirmedOrderId,
        currentLat: currentLocation.lat,
        currentLng: currentLocation.lng,
        ...additionalData,
      },
    );
  },
  confirmReachedDrop: (orderId) => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_REACHED_DROP.replace(":orderId", orderId),
    );
  },
  completeDelivery: (orderId, rating = null, review = "") => {
    return apiClient.patch(
      API_ENDPOINTS.DELIVERY.ORDER_COMPLETE_DELIVERY.replace(
        ":orderId",
        orderId,
      ),
      {
        rating,
        review,
      },
    );
  },

  // Get trip history
  getTripHistory: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.TRIP_HISTORY, { params });
  },

  // Get earnings
  getEarnings: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.EARNINGS, { params });
  },

  // Get active earning addon offers
  getActiveEarningAddons: () => {
    const endpoint = API_ENDPOINTS.DELIVERY.EARNINGS_ACTIVE_OFFERS;
    if (import.meta.env.DEV) {
      console.log("📡 Fetching active earning addons from:", endpoint);
    }
    return apiClient.get(endpoint);
  },

  // Claim earning addon bonus (Earnings Guarantee) to add amount into Pocket balance
  claimEarningAddon: (offerId) => {
    const endpoint = API_ENDPOINTS.DELIVERY.EARNINGS_ACTIVE_OFFER_CLAIM.replace(
      ":offerId",
      offerId,
    );
    if (import.meta.env.DEV) {
      console.log("📡 Claiming earning addon bonus from:", endpoint);
    }
    return apiClient.post(endpoint);
  },

  // Update location
  updateLocation: (latitude, longitude, isOnline = null) => {
    const payload = {
      latitude,
      longitude,
    };
    if (typeof isOnline === "boolean") {
      payload.isOnline = isOnline;
    }
    return apiClient.post(API_ENDPOINTS.DELIVERY.LOCATION, payload);
  },

  // Update online status
  updateOnlineStatus: (isOnline) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.LOCATION, {
      isOnline,
    });
  },

  // Signup
  submitSignupDetails: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.SIGNUP.DETAILS, data);
  },
  submitSignupDocuments: (data) => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.SIGNUP.DOCUMENTS, data);
  },

  // Reverify (resubmit for approval)
  reverify: () => {
    return apiClient.post(API_ENDPOINTS.DELIVERY.REVERIFY);
  },

  // Get zones within radius (for delivery boy to see nearby zones)
  getZonesInRadius: (latitude, longitude, radius = 70) => {
    return apiClient.get(API_ENDPOINTS.DELIVERY.ZONES_IN_RADIUS, {
      params: { latitude, longitude, radius },
    });
  },
};

// Export admin API helper functions
export const adminAPI = {
  // Admin Auth
  signup: (name, email, password, phone = null) => {
    const payload = { name, email, password };
    if (phone) payload.phone = phone;
    return apiClient.post(API_ENDPOINTS.ADMIN.AUTH.SIGNUP, payload);
  },

  signupWithOTP: (name, email, password, otp, phone = null) => {
    const payload = { name, email, password, otp };
    if (phone) payload.phone = phone;
    return apiClient.post(API_ENDPOINTS.ADMIN.AUTH.SIGNUP_OTP, payload);
  },

  login: (email, password) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.AUTH.LOGIN, { email, password });
  },

  logout: () => {
    return apiClient.post(API_ENDPOINTS.ADMIN.AUTH.LOGOUT);
  },

  getCurrentAdmin: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.AUTH.ME);
  },

  // Get admin profile
  getAdminProfile: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.PROFILE);
  },

  // Update admin profile
  updateAdminProfile: (profileData) => {
    return apiClient.put(API_ENDPOINTS.ADMIN.PROFILE, profileData);
  },

  // Change admin password
  changePassword: (currentPassword, newPassword) => {
    return apiClient.put(API_ENDPOINTS.ADMIN.CHANGE_PASSWORD, {
      currentPassword,
      newPassword,
    });
  },

  // Get dashboard stats (params: zone, period for filtering)
  getDashboardStats: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DASHBOARD_STATS, { params });
  },

  // Send push notification
  sendPushNotification: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.PUSH_NOTIFICATION, data);
  },

  // Get push notification history (admin)
  getPushNotifications: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.PUSH_NOTIFICATION, { params });
  },

  // Get users
  getUsers: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.USERS, { params });
  },

  // Get user by ID
  getUserById: (id) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.USER_BY_ID.replace(":id", id));
  },

  // Update user status
  updateUserStatus: (id, isActive) => {
    return apiClient.put(API_ENDPOINTS.ADMIN.USER_STATUS.replace(":id", id), {
      isActive,
    });
  },

  // Get restaurants
  getRestaurants: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.RESTAURANTS, { params });
  },

  // Create restaurant
  createRestaurant: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.RESTAURANTS, data);
  },

  // Update restaurant
  updateRestaurant: (id, data) => {
    return apiClient.put(API_ENDPOINTS.ADMIN.RESTAURANT_BY_ID.replace(":id", id), data);
  },

  // Get restaurant by ID
  getRestaurantById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.RESTAURANT_BY_ID.replace(":id", id),
    );
  },

  // Get restaurant analytics
  getRestaurantAnalytics: (restaurantId) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.RESTAURANT_ANALYTICS.replace(
        ":restaurantId",
        restaurantId,
      ),
    );
  },

  // Update restaurant status
  updateRestaurantStatus: (id, isActive) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.RESTAURANT_STATUS.replace(":id", id),
      { isActive },
    );
  },

  // Update restaurant dining settings
  updateRestaurantDiningSettings: (id, diningSettings) => {
    return apiClient.put(`/admin/restaurants/${id}/dining-settings`, {
      diningSettings,
    });
  },

  updateRestaurantDiningCommission: (id, diningCommissionPercentage) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.RESTAURANT_DINING_COMMISSION.replace(":id", id),
      { diningCommissionPercentage },
    );
  },

  // Dining coupons (admin)
  getDiningCoupons: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DINING_COUPONS, { params });
  },
  getDiningCouponById: (id) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DINING_COUPONS_BY_ID.replace(":id", id));
  },
  createDiningCoupon: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DINING_COUPONS, data);
  },
  updateDiningCoupon: (id, data) => {
    return apiClient.put(API_ENDPOINTS.ADMIN.DINING_COUPONS_BY_ID.replace(":id", id), data);
  },
  deleteDiningCoupon: (id) => {
    return apiClient.delete(API_ENDPOINTS.ADMIN.DINING_COUPONS_BY_ID.replace(":id", id));
  },
  toggleDiningCouponStatus: (id) => {
    return apiClient.patch(API_ENDPOINTS.ADMIN.DINING_COUPON_STATUS.replace(":id", id));
  },

  // Dining earnings (admin)
  getDiningEarnings: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DINING_EARNINGS, { params });
  },

  // Get dining categories
  getDiningCategories: () => {
    return apiClient.get("/admin/dining/categories");
  },

  // Get restaurant join requests
  getRestaurantJoinRequests: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.RESTAURANT_REQUESTS, { params });
  },

  // Approve restaurant
  approveRestaurant: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.RESTAURANT_APPROVE.replace(":id", id),
    );
  },

  // Reject restaurant
  rejectRestaurant: (id, reason) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.RESTAURANT_REJECT.replace(":id", id),
      { reason },
    );
  },

  // Delete restaurant
  deleteRestaurant: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.RESTAURANT_DELETE.replace(":id", id),
    );
  },

  updateRestaurantDiningSeating: (id, seatingCapacity) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.RESTAURANT_DINING_SEATING.replace(":id", id),
      { seatingCapacity },
    );
  },

  // Get all offers (with restaurant and dish details)
  getAllOffers: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.OFFERS, { params });
  },

  // Restaurant Commission Management
  getRestaurantCommissions: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.RESTAURANT_COMMISSION, { params });
  },

  getApprovedRestaurants: (params = {}) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.RESTAURANT_COMMISSION_APPROVED_RESTAURANTS,
      { params },
    );
  },

  getRestaurantCommissionById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.RESTAURANT_COMMISSION_BY_ID.replace(":id", id),
    );
  },

  getCommissionByRestaurantId: (restaurantId) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.RESTAURANT_COMMISSION_BY_RESTAURANT_ID.replace(
        ":restaurantId",
        restaurantId,
      ),
    );
  },

  createRestaurantCommission: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.RESTAURANT_COMMISSION, data);
  },

  updateRestaurantCommission: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.RESTAURANT_COMMISSION_BY_ID.replace(":id", id),
      data,
    );
  },

  deleteRestaurantCommission: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.RESTAURANT_COMMISSION_BY_ID.replace(":id", id),
    );
  },

  toggleRestaurantCommissionStatus: (id) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.RESTAURANT_COMMISSION_STATUS.replace(":id", id),
    );
  },

  calculateRestaurantCommission: (restaurantId, orderAmount) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.RESTAURANT_COMMISSION_CALCULATE, {
      restaurantId,
      orderAmount,
    });
  },

  // Restaurant Complaint Management
  getRestaurantComplaints: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.RESTAURANT_COMPLAINTS, { params });
  },
  getRestaurantComplaintById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.RESTAURANT_COMPLAINT_BY_ID.replace(":id", id),
    );
  },
  updateRestaurantComplaintStatus: (
    id,
    status,
    adminResponse,
    internalNotes,
  ) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.RESTAURANT_COMPLAINT_STATUS.replace(":id", id),
      {
        status,
        adminResponse,
        internalNotes,
      },
    );
  },
  updateRestaurantComplaintNotes: (id, internalNotes) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.RESTAURANT_COMPLAINT_NOTES.replace(":id", id),
      {
        internalNotes,
      },
    );
  },

  // Get delivery partners
  getDelivery: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY, { params });
  },

  // Get delivery partner join requests
  getDeliveryPartnerJoinRequests: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_PARTNERS_REQUESTS, {
      params,
    });
  },

  // Get delivery partner by ID
  getDeliveryPartnerById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_BY_ID.replace(":id", id),
    );
  },

  // Approve delivery partner
  approveDeliveryPartner: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_APPROVE.replace(":id", id),
    );
  },

  // Reject delivery partner
  rejectDeliveryPartner: (id, reason) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_REJECT.replace(":id", id),
      { reason },
    );
  },

  // Reverify delivery partner
  reverifyDeliveryPartner: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_REVERIFY.replace(":id", id),
    );
  },

  // Get all delivery partners
  getDeliveryEarnings: (params = {}) => {
    return apiClient.get("/admin/delivery-partners/earnings", { params });
  },

  getDeliveryPartners: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_PARTNERS, { params });
  },

  // Create delivery partner (add delivery boy)
  createDeliveryPartner: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_CREATE, data);
  },

  // Update delivery partner status
  updateDeliveryPartnerStatus: (id, status, isActive = null) => {
    const payload = {};
    if (status) payload.status = status;
    if (isActive !== null) payload.isActive = isActive;
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_STATUS.replace(":id", id),
      payload,
    );
  },

  // Delete delivery partner
  deleteDeliveryPartner: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_DELETE.replace(":id", id),
    );
  },

  // Add bonus to delivery partner
  addDeliveryPartnerBonus: (deliveryPartnerId, amount, reference = "") => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_BONUS, {
      deliveryPartnerId,
      amount: parseFloat(amount),
      reference,
    });
  },

  // Get bonus transactions
  getDeliveryPartnerBonusTransactions: (params = {}) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_BONUS_TRANSACTIONS,
      { params },
    );
  },

  // Get orders
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS, { params });
  },

  // Mark order as ready (admin) – order will show on delivery partner side
  markOrderReady: (id) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.ORDER_MARK_READY.replace(":id", id),
    );
  },

  // Get orders searching for deliveryman
  getSearchingDeliverymanOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS_SEARCHING_DELIVERYMAN, {
      params,
    });
  },

  // Get ongoing orders
  getOngoingOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS_ONGOING, { params });
  },

  // Get transaction report
  getTransactionReport: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS_TRANSACTION_REPORT, {
      params,
    });
  },

  // Get restaurant report
  getRestaurantReport: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ORDERS_RESTAURANT_REPORT, {
      params,
    });
  },

  // Get refund requests
  getRefundRequests: (params = {}) => {
    return apiClient.get("/api/admin/refund-requests", { params });
  },

  // Process refund (supports both old and new endpoints)
  processRefund: (orderId, data = {}) => {
    // Backend accepts either MongoDB ObjectId (24 chars) or orderId string
    // Note: Don't include /api prefix - apiClient baseURL already includes it
    if (!orderId) {
      return Promise.reject(new Error("Order ID is required"));
    }
    // Use the working endpoint: /admin/refund-requests/:orderId/process
    // apiClient baseURL is already /api, so this becomes /api/admin/refund-requests/:orderId/process
    return apiClient.post(
      `/admin/refund-requests/${encodeURIComponent(orderId)}/process`,
      data,
    );
  },

  // Withdrawal Request Management
  getWithdrawalRequests: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.WITHDRAWAL_REQUESTS, { params });
  },
  approveWithdrawalRequest: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.WITHDRAWAL_APPROVE.replace(":id", id),
    );
  },
  rejectWithdrawalRequest: (id, rejectionReason = "") => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.WITHDRAWAL_REJECT.replace(":id", id),
      { rejectionReason },
    );
  },

  // Get customer wallet report
  getCustomerWalletReport: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CUSTOMER_WALLET_REPORT, {
      params,
    });
  },

  // Business Settings Management
  getBusinessSettings: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS);
  },

  updateBusinessSettings: (data, files = {}) => {
    const formData = new FormData();

    // Add text fields
    Object.keys(data).forEach((key) => {
      if (key !== "logo" && key !== "favicon") {
        formData.append(key, data[key]);
      }
    });

    // Add files
    if (files.logo) {
      formData.append("logo", files.logo);
    }
    if (files.favicon) {
      formData.append("favicon", files.favicon);
    }

    return apiClient.put(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Get analytics
  getAnalytics: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ANALYTICS, { params });
  },

  // Category Management
  getCategories: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CATEGORIES, { params });
  },

  // Get public categories (for user frontend)
  getPublicCategories: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CATEGORIES_PUBLIC);
  },

  getCategoryById: (id) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CATEGORY_BY_ID.replace(":id", id));
  },

  createCategory: (data) => {
    // Axios will automatically handle FormData headers (including boundary)
    // No need to manually set Content-Type for FormData
    return apiClient.post(API_ENDPOINTS.ADMIN.CATEGORIES, data);
  },

  updateCategory: (id, data) => {
    // Axios will automatically handle FormData headers (including boundary)
    // No need to manually set Content-Type for FormData
    return apiClient.put(
      API_ENDPOINTS.ADMIN.CATEGORY_BY_ID.replace(":id", id),
      data,
    );
  },

  deleteCategory: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.CATEGORY_BY_ID.replace(":id", id),
    );
  },

  toggleCategoryStatus: (id) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.CATEGORY_STATUS.replace(":id", id),
    );
  },

  updateCategoryPriority: (id, priority) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.CATEGORY_PRIORITY.replace(":id", id),
      { priority },
    );
  },

  // Fee Settings Management (Delivery & Platform Fee)
  getFeeSettings: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FEE_SETTINGS);
  },

  getPublicFeeSettings: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FEE_SETTINGS_PUBLIC);
  },

  getFeeSettingsHistory: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FEE_SETTINGS_HISTORY, { params });
  },

  createOrUpdateFeeSettings: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.FEE_SETTINGS, data);
  },

  updateFeeSettings: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.FEE_SETTINGS_BY_ID.replace(":id", id),
      data,
    );
  },

  // Zone Management
  getZones: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ZONES, { params });
  },

  getZoneById: (id) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ZONE_BY_ID.replace(":id", id));
  },

  createZone: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.ZONES, data);
  },

  updateZone: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.ZONE_BY_ID.replace(":id", id),
      data,
    );
  },

  deleteZone: (id) => {
    return apiClient.delete(API_ENDPOINTS.ADMIN.ZONE_BY_ID.replace(":id", id));
  },

  toggleZoneStatus: (id) => {
    return apiClient.patch(API_ENDPOINTS.ADMIN.ZONE_STATUS.replace(":id", id));
  },

  // Earning Addon Management
  createEarningAddon: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.EARNING_ADDON, data);
  },

  getEarningAddons: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.EARNING_ADDON, { params });
  },

  getEarningAddonById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_BY_ID.replace(":id", id),
    );
  },

  updateEarningAddon: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_BY_ID.replace(":id", id),
      data,
    );
  },

  deleteEarningAddon: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_BY_ID.replace(":id", id),
    );
  },

  toggleEarningAddonStatus: (id, status) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_STATUS.replace(":id", id),
      { status },
    );
  },

  checkEarningAddonCompletions: (deliveryPartnerId, debug = false) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.EARNING_ADDON_CHECK_COMPLETIONS, {
      deliveryPartnerId,
      debug,
    });
  },

  // Earning Addon History Management
  getEarningAddonHistory: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY, { params });
  },

  getEarningAddonHistoryById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY_BY_ID.replace(":id", id),
    );
  },

  creditEarningToWallet: (id, notes = "") => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY_CREDIT.replace(":id", id),
      { notes },
    );
  },

  cancelEarningAddonHistory: (id, reason = "") => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY_CANCEL.replace(":id", id),
      { reason },
    );
  },

  getEarningAddonHistoryStatistics: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.EARNING_ADDON_HISTORY_STATISTICS, {
      params,
    });
  },

  // Environment Variables Management
  getEnvVariables: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.ENV_VARIABLES);
  },

  saveEnvVariables: (envData) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.ENV_VARIABLES, envData);
  },

  // Public Environment Variables (for frontend use)
  getPublicEnvVariables: () => {
    return apiClient.get("/env/public");
  },

  // Delivery Boy Commission Management
  getCommissionRules: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_BOY_COMMISSION, {
      params,
    });
  },

  getCommissionRuleById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.DELIVERY_BOY_COMMISSION_BY_ID.replace(":id", id),
    );
  },

  createCommissionRule: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DELIVERY_BOY_COMMISSION, data);
  },

  updateCommissionRule: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.DELIVERY_BOY_COMMISSION_BY_ID.replace(":id", id),
      data,
    );
  },

  deleteCommissionRule: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.DELIVERY_BOY_COMMISSION_BY_ID.replace(":id", id),
    );
  },

  toggleCommissionRuleStatus: (id, status) => {
    return apiClient.patch(
      API_ENDPOINTS.ADMIN.DELIVERY_BOY_COMMISSION_STATUS.replace(":id", id),
      { status },
    );
  },

  calculateCommission: (distance) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_BOY_COMMISSION_CALCULATE,
      { distance },
    );
  },

  // Delivery Partner global cash limit
  getDeliveryCashLimit: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_CASH_LIMIT);
  },

  updateDeliveryCashLimit: (data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.DELIVERY_CASH_LIMIT,
      typeof data === "object" ? data : { deliveryCashLimit: data },
    );
  },

  // Deliveryman Reviews
  getDeliverymanReviews: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_PARTNER_REVIEWS, {
      params,
    });
  },

  getCashLimitSettlements: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.CASH_LIMIT_SETTLEMENT, { params });
  },

  getDeliveryWithdrawalRequests: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_WITHDRAWAL_REQUESTS, {
      params,
    });
  },
  approveDeliveryWithdrawal: (id) => {
    const sid = id != null ? String(id) : "";
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_WITHDRAWAL_APPROVE.replace(":id", sid),
    );
  },
  rejectDeliveryWithdrawal: (id, rejectionReason = "") => {
    const sid = id != null ? String(id) : "";
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_WITHDRAWAL_REJECT.replace(":id", sid),
      { rejectionReason },
    );
  },

  getDeliveryBoyWallets: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_BOY_WALLET, { params });
  },
  addDeliveryBoyWalletAdjustment: (data) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.DELIVERY_BOY_WALLET_ADJUSTMENT,
      data,
    );
  },

  // Delivery Emergency Help Management
  getEmergencyHelp: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_EMERGENCY_HELP);
  },

  createOrUpdateEmergencyHelp: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.DELIVERY_EMERGENCY_HELP, data);
  },

  toggleEmergencyHelpStatus: () => {
    return apiClient.patch(API_ENDPOINTS.ADMIN.DELIVERY_EMERGENCY_HELP_STATUS);
  },

  // Delivery Support Tickets Management
  getDeliverySupportTickets: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_SUPPORT_TICKETS, {
      params,
    });
  },

  getDeliverySupportTicketById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.DELIVERY_SUPPORT_TICKET_BY_ID.replace(":id", id),
    );
  },

  updateDeliverySupportTicket: (id, data) => {
    return apiClient.put(
      API_ENDPOINTS.ADMIN.DELIVERY_SUPPORT_TICKET_BY_ID.replace(":id", id),
      data,
    );
  },

  getDeliverySupportTicketStats: () => {
    return apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_SUPPORT_TICKETS_STATS);
  },

  // Food Approval
  getPendingFoodApprovals: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FOOD_APPROVALS, { params });
  },

  approveFoodItem: (id) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.FOOD_APPROVAL_APPROVE.replace(":id", id),
    );
  },

  rejectFoodItem: (id, reason) => {
    return apiClient.post(
      API_ENDPOINTS.ADMIN.FOOD_APPROVAL_REJECT.replace(":id", id),
      { reason },
    );
  },

  // Feedback Experience Management
  createFeedbackExperience: (data) => {
    return apiClient.post(API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE, data);
  },

  getFeedbackExperiences: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE, { params });
  },

  getFeedbackExperienceById: (id) => {
    return apiClient.get(
      API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE_BY_ID.replace(":id", id),
    );
  },

  deleteFeedbackExperience: (id) => {
    return apiClient.delete(
      API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE_BY_ID.replace(":id", id),
    );
  },
};

// Upload / media helper functions
export const uploadAPI = {
  /**
   * Upload a single image/video file to Cloudinary via backend
   * @param {File} file - Browser File object
   * @param {Object} options - Optional { folder }
   */
  uploadMedia: (file, options = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    if (options.folder) {
      formData.append("folder", options.folder);
    }

    return apiClient.post(API_ENDPOINTS.UPLOAD.MEDIA, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

// Export order API helper functions
export const orderAPI = {
  // Calculate order pricing
  calculateOrder: (orderData) => {
    return apiClient.post(API_ENDPOINTS.ORDER.CALCULATE, orderData);
  },

  // Create order and get Razorpay order
  createOrder: (orderData) => {
    return apiClient.post(API_ENDPOINTS.ORDER.CREATE, orderData);
  },

  // Verify payment
  verifyPayment: (paymentData) => {
    return apiClient.post(API_ENDPOINTS.ORDER.VERIFY_PAYMENT, paymentData);
  },

  // Get user orders
  getOrders: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.ORDER.LIST, { params });
  },

  // Order chat (Track Order live chat with delivery partner)
  getOrderChat: (orderId) => {
    return apiClient.get(
      API_ENDPOINTS.USER.ORDER_CHAT.replace(":orderId", orderId),
    );
  },
  sendOrderChatMessage: (orderId, message) => {
    return apiClient.post(
      API_ENDPOINTS.USER.ORDER_CHAT_MESSAGES.replace(":orderId", orderId),
      { message },
    );
  },

  // Complaint operations
  submitComplaint: (data) => {
    return apiClient.post(API_ENDPOINTS.USER.COMPLAINTS, data);
  },
  getUserComplaints: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.USER.COMPLAINTS, { params });
  },
  getComplaintDetails: (id) => {
    return apiClient.get(API_ENDPOINTS.USER.COMPLAINT_BY_ID.replace(":id", id));
  },

  // Get order details
  getOrderDetails: (orderId) => {
    return apiClient.get(API_ENDPOINTS.ORDER.DETAILS.replace(":id", orderId));
  },

  // Update delivery details (address, phone, delivery instructions)
  updateDeliveryDetails: (orderId, data) => {
    return apiClient.put(
      API_ENDPOINTS.ORDER.UPDATE_DELIVERY_DETAILS.replace(":id", orderId),
      data,
    );
  },

  // Cancel order
  cancelOrder: (orderId, reason) => {
    return apiClient.patch(API_ENDPOINTS.ORDER.CANCEL.replace(":id", orderId), {
      reason,
    });
  },
  // Submit order review
  submitOrderReview: (orderId, reviewData) => {
    return apiClient.patch(
      API_ENDPOINTS.ORDER.DETAILS.replace(":id", orderId) + "/review",
      reviewData,
    );
  },
};

// Export dining API helper functions
export const diningAPI = {
  // Get dining restaurants (with optional filters)
  getRestaurants: (params = {}) => {
    return apiClient.get(API_ENDPOINTS.DINING.RESTAURANTS, { params });
  },

  // Get restaurant by slug
  getRestaurantBySlug: (slug) => {
    return apiClient.get(
      API_ENDPOINTS.DINING.RESTAURANT_BY_SLUG.replace(":slug", slug),
    );
  },

  // Get dining categories
  getCategories: () => {
    return apiClient.get(API_ENDPOINTS.DINING.CATEGORIES);
  },

  // Get limelight features
  getLimelight: () => {
    return apiClient.get(API_ENDPOINTS.DINING.LIMELIGHT);
  },

  // Get bank offers
  getBankOffers: () => {
    return apiClient.get(API_ENDPOINTS.DINING.BANK_OFFERS);
  },

  // Get must tries
  getMustTries: () => {
    return apiClient.get(API_ENDPOINTS.DINING.MUST_TRIES);
  },

  // Get offer banners (used as limelight in Dining.jsx)
  getOfferBanners: () => {
    return apiClient.get(API_ENDPOINTS.DINING.OFFER_BANNERS);
  },
  // Get pre-book & walk-in offers for a restaurant by slug (public)
  getRestaurantOffersBySlug: (slug) => {
    return apiClient.get(
      API_ENDPOINTS.DINING.RESTAURANT_OFFERS_BY_SLUG.replace(":slug", slug),
    );
  },

  // Get dining stories
  getStories: () => {
    return apiClient.get(API_ENDPOINTS.DINING.STORIES);
  },
  // Create a new table booking
  createBooking: (bookingData) => {
    return apiClient.post(API_ENDPOINTS.DINING.BOOKING_CREATE, bookingData);
  },
  // Get current user's bookings
  getBookings: () => {
    return apiClient.get(API_ENDPOINTS.DINING.BOOKING_MY);
  },
  // Get bookings for a specific restaurant (for owners)
  getRestaurantBookings: (restaurantId) => {
    return apiClient.get(
      API_ENDPOINTS.DINING.BOOKING_RESTAURANT.replace(
        ":restaurantId",
        restaurantId,
      ),
    );
  },
  // Update booking status
  updateBookingStatus: (bookingId, status) => {
    return apiClient.patch(
      API_ENDPOINTS.DINING.BOOKING_STATUS.replace(":bookingId", bookingId),
      { status },
    );
  },
  // Update booking status (for restaurant owners)
  updateBookingStatusRestaurant: (bookingId, status) => {
    return apiClient.patch(
      API_ENDPOINTS.DINING.BOOKING_STATUS_RESTAURANT.replace(
        ":bookingId",
        bookingId,
      ),
      { status },
    );
  },
  // Send bill (restaurant)
  sendBill: (bookingId, data) => {
    return apiClient.post(
      API_ENDPOINTS.DINING.BOOKING_SEND_BILL.replace(":bookingId", bookingId),
      data,
    );
  },
  // Apply coupon (user)
  applyCoupon: (bookingId, code) => {
    return apiClient.post(
      API_ENDPOINTS.DINING.BOOKING_APPLY_COUPON.replace(":bookingId", bookingId),
      { code },
    );
  },
  // Create payment order for dining bill (user)
  createDiningPaymentOrder: (bookingId) => {
    return apiClient.post(
      API_ENDPOINTS.DINING.BOOKING_CREATE_PAYMENT.replace(":bookingId", bookingId),
    );
  },
  // Verify dining payment (user)
  verifyDiningPayment: (bookingId, payload) => {
    return apiClient.post(
      API_ENDPOINTS.DINING.BOOKING_VERIFY_PAYMENT.replace(":bookingId", bookingId),
      payload,
    );
  },
  // Create review
  createReview: (reviewData) => {
    return apiClient.post(API_ENDPOINTS.DINING.REVIEW_CREATE, reviewData);
  },
};

// Export hero banner API helper functions
export const heroBannerAPI = {
  // Get Top 10 restaurants (public)
  getTop10Restaurants: () => {
    return apiClient.get(API_ENDPOINTS.HERO_BANNER.TOP_10_PUBLIC);
  },

  // Get Gourmet restaurants (public)
  getGourmetRestaurants: () => {
    return apiClient.get(API_ENDPOINTS.HERO_BANNER.GOURMET_PUBLIC);
  },
};
