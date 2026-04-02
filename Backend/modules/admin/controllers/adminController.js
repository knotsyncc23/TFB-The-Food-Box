import Admin from "../models/Admin.js";
import Order from "../../order/models/Order.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import Offer from "../../restaurant/models/Offer.js";
import AdminCommission from "../models/AdminCommission.js";
import OrderSettlement from "../../order/models/OrderSettlement.js";
import AdminWallet from "../models/AdminWallet.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import { normalizePhoneNumber } from "../../../shared/utils/phoneUtils.js";
import winston from "winston";
import mongoose from "mongoose";
import { uploadToCloudinary } from "../../../shared/utils/cloudinaryService.js";
import { initializeCloudinary } from "../../../config/cloudinary.js";

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
 * Get Admin Dashboard Statistics
 * GET /api/admin/dashboard/stats
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const { period = "overall", zone } = req.query;
    const now = new Date();

    // Resolve zone to zoneId for filtering (when zone is not "all")
    let zoneIdFilter = null;
    let zoneMatch = {}; // Applied to order queries when zone filter is active
    const Zone = (await import("../models/Zone.js")).default;

    if (zone && zone !== "all") {
      if (mongoose.Types.ObjectId.isValid(zone) && String(new mongoose.Types.ObjectId(zone)) === zone) {
        zoneIdFilter = zone;
      } else {
        const zoneDoc = await Zone.findOne({
          $or: [
            { name: { $regex: new RegExp(`^${String(zone).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
            { zoneName: { $regex: new RegExp(`^${String(zone).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
          ],
          isActive: true,
        })
          .select("_id")
          .lean();
        if (zoneDoc) zoneIdFilter = zoneDoc._id.toString();
      }

      if (zoneIdFilter) {
        const totalZones = await Zone.countDocuments({ isActive: true });
        // When only one zone exists, include orders without zoneId (legacy orders belong to that zone)
        if (totalZones === 1) {
          zoneMatch.$or = [
            { "assignmentInfo.zoneId": zoneIdFilter },
            { "assignmentInfo.zoneId": { $in: [null, ""] } },
            { "assignmentInfo.zoneId": { $exists: false } },
          ];
        } else {
          zoneMatch["assignmentInfo.zoneId"] = zoneIdFilter;
        }
      }
    }
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Date range based on period filter
    let dateFilter = {};
    if (period === "today") {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { $gte: dayStart, $lte: now };
    } else if (period === "week") {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { $gte: weekStart, $lte: now };
    } else if (period === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { $gte: monthStart, $lte: now };
    } else if (period === "year") {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      dateFilter = { $gte: yearStart, $lte: now };
    }

    // Base match for delivered orders
    const revenueMatch = {
      status: "delivered",
      "pricing.total": { $exists: true },
    };
    if (Object.keys(dateFilter).length > 0) {
      revenueMatch.deliveredAt = dateFilter;
    }
    if (Object.keys(zoneMatch).length > 0) {
      Object.assign(revenueMatch, zoneMatch);
    }

    // Get total revenue (sum of all completed orders)
    const revenueStats = await Order.aggregate([
      {
        $match: revenueMatch,
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$pricing.total" },
          last30DaysRevenue: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", last30Days] },
                "$pricing.total",
                0,
              ],
            },
          },
        },
      },
    ]);

    // Get revenue data from aggregation result
    const revenueData = revenueStats[0] || {
      totalRevenue: 0,
      last30DaysRevenue: 0,
    };

    // Get all settlements for delivered orders only (with period and zone filter)
    const deliveredOrderMatch = { status: "delivered" };
    if (Object.keys(dateFilter).length > 0) {
      deliveredOrderMatch.deliveredAt = dateFilter;
    }
    if (Object.keys(zoneMatch).length > 0) {
      Object.assign(deliveredOrderMatch, zoneMatch);
    }
    const deliveredOrderIds = await Order.find(deliveredOrderMatch)
      .select("_id")
      .lean();
    const deliveredOrderIdArray = deliveredOrderIds.map((o) => o._id);

    // Get settlements only for delivered orders
    const allSettlements = await OrderSettlement.find({
      orderId: { $in: deliveredOrderIdArray },
    }).lean();
    // Debug: Log first settlement to see actual structure
    if (allSettlements.length > 0) {
      const firstSettlement = allSettlements[0];
    }

    // Calculate totals from all settlements - use adminEarning fields
    let totalCommission = 0;
    let totalPlatformFee = 0;
    let totalDeliveryFee = 0;
    let totalGST = 0;

    allSettlements.forEach((s, index) => {
      const commission = s.adminEarning?.commission || 0;
      const platformFee = s.adminEarning?.platformFee || 0;
      const deliveryFee = s.adminEarning?.deliveryFee || 0;
      const gst = s.adminEarning?.gst || 0;

      totalCommission += commission;
      totalPlatformFee += platformFee;
      totalDeliveryFee += deliveryFee;
      totalGST += gst;

      // Log each settlement for debugging
      if (index < 5) {
        // Log first 5 settlements
      }
    });

    totalCommission = Math.round(totalCommission * 100) / 100;
    totalPlatformFee = Math.round(totalPlatformFee * 100) / 100;
    totalDeliveryFee = Math.round(totalDeliveryFee * 100) / 100;
    totalGST = Math.round(totalGST * 100) / 100;
    // Get settlements for period (or last 30 days for overall)
    const settlementsDateRange = Object.keys(dateFilter).length > 0
      ? dateFilter
      : { $gte: last30Days, $lte: now };
    const last30DaysSettlements = await OrderSettlement.find({
      createdAt: settlementsDateRange,
    }).lean();
    const last30DaysCommission = last30DaysSettlements.reduce(
      (sum, s) => sum + (s.adminEarning?.commission || 0),
      0,
    );
    const last30DaysPlatformFee = last30DaysSettlements.reduce(
      (sum, s) => sum + (s.adminEarning?.platformFee || 0),
      0,
    );
    const last30DaysDeliveryFee = last30DaysSettlements.reduce(
      (sum, s) => sum + (s.adminEarning?.deliveryFee || 0),
      0,
    );
    const last30DaysGST = last30DaysSettlements.reduce(
      (sum, s) => sum + (s.adminEarning?.gst || 0),
      0,
    );

    // Get order statistics (with period and zone filter)
    const orderStatsMatch = {};
    if (Object.keys(dateFilter).length > 0) {
      orderStatsMatch.createdAt = dateFilter;
    }
    if (Object.keys(zoneMatch).length > 0) {
      Object.assign(orderStatsMatch, zoneMatch);
    }
    const orderStats = await Order.aggregate([
      ...(Object.keys(orderStatsMatch).length > 0 ? [{ $match: orderStatsMatch }] : []),
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const orderStatusMap = {};
    orderStats.forEach((stat) => {
      orderStatusMap[stat._id] = stat.count;
    });

    // Get total orders processed (with period and zone filter)
    const totalOrdersMatch = { status: "delivered" };
    if (Object.keys(dateFilter).length > 0) {
      totalOrdersMatch.deliveredAt = dateFilter;
    }
    if (Object.keys(zoneMatch).length > 0) {
      Object.assign(totalOrdersMatch, zoneMatch);
    }
    const totalOrders = await Order.countDocuments(totalOrdersMatch);

    // Get active partners count
    const activeRestaurants = await Restaurant.countDocuments({
      isActive: true,
    });
    // Note: Delivery partners are stored in User model
    const User = (await import("../../auth/models/User.js")).default;
    const activeDeliveryPartners = await User.countDocuments({
      role: "delivery",
      isActive: true,
    });
    const activePartners = activeRestaurants + activeDeliveryPartners;

    // Get additional stats
    // Total restaurants (only active/approved restaurants)
    // This matches the admin restaurants list which shows only active restaurants by default
    const totalRestaurants = await Restaurant.countDocuments({
      isActive: true,
    });

    // Restaurant requests pending (inactive restaurants with completed onboarding, no rejection)
    const pendingRestaurantRequestsQuery = {
      isActive: false,
      $and: [
        {
          $or: [
            { "onboarding.completedSteps": 4 },
            {
              $and: [
                { name: { $exists: true, $ne: null, $ne: "" } },
                { cuisines: { $exists: true, $ne: null, $not: { $size: 0 } } },
                { openDays: { $exists: true, $ne: null, $not: { $size: 0 } } },
                {
                  estimatedDeliveryTime: { $exists: true, $ne: null, $ne: "" },
                },
                { featuredDish: { $exists: true, $ne: null, $ne: "" } },
              ],
            },
          ],
        },
        {
          $or: [
            { rejectionReason: { $exists: false } },
            { rejectionReason: null },
          ],
        },
      ],
    };
    const pendingRestaurantRequests = await Restaurant.countDocuments(
      pendingRestaurantRequestsQuery,
    );

    // Total delivery boys (all delivery users)
    const totalDeliveryBoys = await User.countDocuments({ role: "delivery" });

    // Delivery boy requests pending (delivery users with isActive: false or verification pending)
    // Assuming deliveryStatus field exists, if not we'll use isActive: false
    const pendingDeliveryBoyRequests = await User.countDocuments({
      role: "delivery",
      $or: [{ isActive: false }, { deliveryStatus: "pending" }],
    });

    // Total foods (Menu items) - Count all individual menu items from active menus
    // Count ALL items (including disabled sections, unavailable items, pending/approved, excluding only rejected)
    const Menu = (await import("../../restaurant/models/Menu.js")).default;
    // Get all active menus and count items in sections and subsections
    const activeMenus = await Menu.find({ isActive: true })
      .select("sections")
      .lean();
    let totalFoods = 0;
    activeMenus.forEach((menu) => {
      if (menu.sections && Array.isArray(menu.sections)) {
        menu.sections.forEach((section) => {
          // Count items from ALL sections (enabled and disabled)

          // Count items directly in section (all items, excluding only rejected)
          if (section.items && Array.isArray(section.items)) {
            totalFoods += section.items.filter((item) => {
              // Must have required fields
              if (!item || !item.id || !item.name) return false;
              // Exclude only rejected items (include all others: pending, approved, available, unavailable)
              if (item.approvalStatus === "rejected") return false;
              // Count all other items regardless of availability or approval status
              return true;
            }).length;
          }
          // Count items in subsections (all items, excluding only rejected)
          if (section.subsections && Array.isArray(section.subsections)) {
            section.subsections.forEach((subsection) => {
              if (subsection.items && Array.isArray(subsection.items)) {
                totalFoods += subsection.items.filter((item) => {
                  // Must have required fields
                  if (!item || !item.id || !item.name) return false;
                  // Exclude only rejected items (include all others: pending, approved, available, unavailable)
                  if (item.approvalStatus === "rejected") return false;
                  // Count all other items regardless of availability or approval status
                  return true;
                }).length;
              }
            });
          }
        });
      }
    });

    // Total addons - Count all addons from active menus
    // Count ALL addons (including unavailable, pending/approved, excluding only rejected)
    let totalAddons = 0;
    const menusWithAddons = await Menu.find({ isActive: true })
      .select("addons")
      .lean();
    menusWithAddons.forEach((menu) => {
      // Only process if menu has addons array and it's not empty
      if (
        !menu.addons ||
        !Array.isArray(menu.addons) ||
        menu.addons.length === 0
      ) {
        return;
      }

      totalAddons += menu.addons.filter((addon) => {
        // Only count if addon exists and has required fields (id and name are mandatory)
        if (!addon || typeof addon !== "object") return false;
        if (!addon.id || typeof addon.id !== "string" || addon.id.trim() === "")
          return false;
        if (
          !addon.name ||
          typeof addon.name !== "string" ||
          addon.name.trim() === ""
        )
          return false;
        // Exclude only rejected addons (include all others: pending, approved, available, unavailable)
        if (addon.approvalStatus === "rejected") return false;
        // Count all other addons regardless of availability or approval status
        return true;
      }).length;
    });

    // Total customers (users with role 'user' or no role specified)
    // When period filter is applied, count customers created in that period
    const customerMatch = {
      $or: [{ role: "user" }, { role: { $exists: false } }, { role: null }],
    };
    if (Object.keys(dateFilter).length > 0) {
      customerMatch.createdAt = dateFilter;
    }
    const totalCustomers = await User.countDocuments(customerMatch);

    // Pending orders (already in orderStatusMap)
    const pendingOrders = orderStatusMap.pending || 0;

    // Completed orders (delivered orders)
    const completedOrders = orderStatusMap.delivered || 0;

    // Filter for recent activity (last 24 hours) - used for "Live signals"
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentOrdersMatch = { createdAt: { $gte: last24Hours } };
    if (Object.keys(zoneMatch).length > 0) {
      Object.assign(recentOrdersMatch, zoneMatch);
    }
    const recentOrders = await Order.countDocuments(recentOrdersMatch);

    // For service readiness, count restaurants that were modified in the last 24h
    const recentRestaurantsMatch = { updatedAt: { $gte: last24Hours } };
    if (zoneIdFilter) {
      // Assuming restaurants have a zoneId or location based zone filtering
      // Adding it if restaurant model has zoneId or area/city mapping
      // For now, if zone filter is active, only count those in the selected zone if field exists
      // Check if zoneId exists in model first, or fallback to name/area filtering if needed
      // (Using zoneId as it's the most common mapping)
      recentRestaurantsMatch.$or = [
        { zoneId: zoneIdFilter },
        { "location.zoneId": zoneIdFilter }, // Alternative mapping
        { "location.area": new RegExp(`^${zoneIdFilter}$`, "i") } // Fallback
      ];
    }
    const recentRestaurantsUpdated = await Restaurant.countDocuments(
      recentRestaurantsMatch,
    );

    // Also get pending orders for the signals
    const pendingOrdersMatch = { status: "pending" };
    if (Object.keys(zoneMatch).length > 0) {
      Object.assign(pendingOrdersMatch, zoneMatch);
    }
    const pendingOrdersCount = await Order.countDocuments(pendingOrdersMatch);

    // Get monthly data for last 12 months
    // Use aggregation to match orders with settlements by orderId and use order's deliveredAt
    const monthlyData = [];
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999,
      );

      // Get orders delivered in this month (with zone filter if applied)
      const monthOrderMatch = {
        status: "delivered",
        deliveredAt: { $gte: monthStart, $lte: monthEnd },
      };
      if (Object.keys(zoneMatch).length > 0) {
        Object.assign(monthOrderMatch, zoneMatch);
      }
      const monthOrders = await Order.find(monthOrderMatch)
        .select("_id pricing deliveredAt")
        .lean();

      // Get order IDs for this month
      const monthOrderIds = monthOrders.map((o) => o._id);

      // Get settlements for these orders (match by orderId, not by createdAt)
      const monthSettlements = await OrderSettlement.find({
        orderId: { $in: monthOrderIds },
      })
        .select("orderId adminEarning")
        .lean();

      // Create a map of orderId to settlement for quick lookup
      const settlementMap = new Map();
      monthSettlements.forEach((s) => {
        settlementMap.set(s.orderId.toString(), s);
      });

      // Calculate revenue and commission from orders and their settlements
      let monthRevenue = 0;
      let monthCommission = 0;

      monthOrders.forEach((order) => {
        // Add revenue from order
        monthRevenue += order.pricing?.total || 0;

        // Get commission from matching settlement
        const settlement = settlementMap.get(order._id.toString());
        if (settlement && settlement.adminEarning) {
          // Only add commission (restaurant commission), not totalEarning
          monthCommission += settlement.adminEarning.commission || 0;
        }
      });

      const monthOrdersCount = monthOrders.length;

      monthlyData.push({
        month: monthNames[monthStart.getMonth()],
        revenue: Math.round(monthRevenue * 100) / 100,
        commission: Math.round(monthCommission * 100) / 100,
        orders: monthOrdersCount,
      });
    }

    return successResponse(res, 200, "Dashboard stats retrieved successfully", {
      revenue: {
        total: revenueData.totalRevenue || 0,
        last30Days: revenueData.last30DaysRevenue || 0,
        currency: "INR",
      },
      commission: {
        total: totalCommission,
        last30Days: last30DaysCommission,
        currency: "INR",
      },
      platformFee: {
        total: totalPlatformFee,
        last30Days: last30DaysPlatformFee,
        currency: "INR",
      },
      deliveryFee: {
        total: totalDeliveryFee,
        last30Days: last30DaysDeliveryFee,
        currency: "INR",
      },
      gst: {
        total: totalGST,
        last30Days: last30DaysGST,
        currency: "INR",
      },
      totalAdminEarnings: {
        total: totalCommission + totalPlatformFee + totalDeliveryFee + totalGST,
        last30Days:
          last30DaysCommission +
          last30DaysPlatformFee +
          last30DaysDeliveryFee +
          last30DaysGST,
        currency: "INR",
      },
      orders: {
        total: totalOrders,
        byStatus: {
          pending: orderStatusMap.pending || 0,
          confirmed: orderStatusMap.confirmed || 0,
          preparing: orderStatusMap.preparing || 0,
          ready: orderStatusMap.ready || 0,
          out_for_delivery: orderStatusMap.out_for_delivery || 0,
          delivered: orderStatusMap.delivered || 0,
          cancelled: orderStatusMap.cancelled || 0,
        },
      },
      partners: {
        total: activePartners,
        restaurants: activeRestaurants,
        delivery: activeDeliveryPartners,
      },
      recentActivity: {
        orders: recentOrders,
        restaurants: recentRestaurantsUpdated,
        pendingOrders: pendingOrdersCount,
        period: "last24Hours",
      },
      monthlyData: monthlyData, // Add monthly data for graphs
      // Additional stats
      restaurants: {
        total: totalRestaurants,
        active: activeRestaurants,
        pendingRequests: pendingRestaurantRequests,
      },
      deliveryBoys: {
        total: totalDeliveryBoys,
        active: activeDeliveryPartners,
        pendingRequests: pendingDeliveryBoyRequests,
      },
      foods: {
        total: totalFoods,
      },
      addons: {
        total: totalAddons,
      },
      customers: {
        total: totalCustomers,
      },
      orderStats: {
        pending: pendingOrders,
        completed: completedOrders,
      },
    });
  } catch (error) {
    logger.error(`Error fetching dashboard stats: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch dashboard statistics");
  }
});

/**
 * Get All Admins
 * GET /api/admin/admins
 */
export const getAdmins = asyncHandler(async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const admins = await Admin.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await Admin.countDocuments(query);

    return successResponse(res, 200, "Admins retrieved successfully", {
      admins,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error(`Error fetching admins: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch admins");
  }
});

/**
 * Get Admin by ID
 * GET /api/admin/admins/:id
 */
export const getAdminById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await Admin.findById(id).select("-password").lean();

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    return successResponse(res, 200, "Admin retrieved successfully", { admin });
  } catch (error) {
    logger.error(`Error fetching admin: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch admin");
  }
});

/**
 * Create Admin (only by existing admin)
 * POST /api/admin/admins
 */
export const createAdmin = asyncHandler(async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validation
    if (!name || !email || !password) {
      return errorResponse(res, 400, "Name, email, and password are required");
    }

    if (password.length < 6) {
      return errorResponse(
        res,
        400,
        "Password must be at least 6 characters long",
      );
    }

    // Check if admin already exists with this email
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return errorResponse(res, 400, "Admin already exists with this email");
    }

    // Create new admin
    const adminData = {
      name,
      email: email.toLowerCase(),
      password,
      isActive: true,
      phoneVerified: false,
    };

    if (phone) {
      adminData.phone = phone;
    }

    const admin = await Admin.create(adminData);

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    logger.info(`Admin created: ${admin._id}`, {
      email,
      createdBy: req.user._id,
    });

    return successResponse(res, 201, "Admin created successfully", {
      admin: adminResponse,
    });
  } catch (error) {
    logger.error(`Error creating admin: ${error.message}`);

    if (error.code === 11000) {
      return errorResponse(res, 400, "Admin with this email already exists");
    }

    return errorResponse(res, 500, "Failed to create admin");
  }
});

/**
 * Update Admin
 * PUT /api/admin/admins/:id
 */
export const updateAdmin = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, isActive } = req.body;

    const admin = await Admin.findById(id);

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    // Prevent updating own account's isActive status
    if (id === req.user._id.toString() && isActive === false) {
      return errorResponse(res, 400, "You cannot deactivate your own account");
    }

    // Update fields
    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase();
    if (phone !== undefined) admin.phone = phone;
    if (isActive !== undefined) admin.isActive = isActive;

    await admin.save();

    const adminResponse = admin.toObject();
    delete adminResponse.password;

    logger.info(`Admin updated: ${id}`, { updatedBy: req.user._id });

    return successResponse(res, 200, "Admin updated successfully", {
      admin: adminResponse,
    });
  } catch (error) {
    logger.error(`Error updating admin: ${error.message}`);

    if (error.code === 11000) {
      return errorResponse(res, 400, "Admin with this email already exists");
    }

    return errorResponse(res, 500, "Failed to update admin");
  }
});

/**
 * Delete Admin
 * DELETE /api/admin/admins/:id
 */
export const deleteAdmin = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (id === req.user._id.toString()) {
      return errorResponse(res, 400, "You cannot delete your own account");
    }

    const admin = await Admin.findById(id);

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    await Admin.deleteOne({ _id: id });

    logger.info(`Admin deleted: ${id}`, { deletedBy: req.user._id });

    return successResponse(res, 200, "Admin deleted successfully");
  } catch (error) {
    logger.error(`Error deleting admin: ${error.message}`);
    return errorResponse(res, 500, "Failed to delete admin");
  }
});

/**
 * Get Current Admin Profile
 * GET /api/admin/profile
 */
export const getAdminProfile = asyncHandler(async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id).select("-password").lean();

    if (!admin) {
      return errorResponse(res, 404, "Admin profile not found");
    }

    return successResponse(res, 200, "Admin profile retrieved successfully", {
      admin,
    });
  } catch (error) {
    logger.error(`Error fetching admin profile: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch admin profile");
  }
});

/**
 * Update Current Admin Profile
 * PUT /api/admin/profile
 */
export const updateAdminProfile = asyncHandler(async (req, res) => {
  try {
    const { name, phone, profileImage } = req.body;

    const admin = await Admin.findById(req.user._id);

    if (!admin) {
      return errorResponse(res, 404, "Admin profile not found");
    }

    // Update fields (email cannot be changed via profile update)
    if (name !== undefined && name !== null) {
      admin.name = name.trim();
    }

    if (phone !== undefined) {
      // Allow empty string to clear phone number
      admin.phone = phone ? phone.trim() : null;
    }

    if (profileImage !== undefined) {
      // Allow empty string to clear profile image
      admin.profileImage = profileImage || null;
    }

    // Save to database
    await admin.save();

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    logger.info(`Admin profile updated: ${admin._id}`, {
      updatedFields: {
        name,
        phone,
        profileImage: profileImage ? "updated" : "not changed",
      },
    });

    return successResponse(res, 200, "Profile updated successfully", {
      admin: adminResponse,
    });
  } catch (error) {
    logger.error(`Error updating admin profile: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to update profile");
  }
});

/**
 * Change Admin Password
 * PUT /api/admin/settings/change-password
 */
export const changeAdminPassword = asyncHandler(async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return errorResponse(
        res,
        400,
        "Current password and new password are required",
      );
    }

    if (newPassword.length < 6) {
      return errorResponse(
        res,
        400,
        "New password must be at least 6 characters long",
      );
    }

    // Get admin with password field
    const admin = await Admin.findById(req.user._id).select("+password");

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return errorResponse(res, 401, "Current password is incorrect");
    }

    // Check if new password is same as current
    const isSamePassword = await admin.comparePassword(newPassword);
    if (isSamePassword) {
      return errorResponse(
        res,
        400,
        "New password must be different from current password",
      );
    }

    // Update password (pre-save hook will hash it)
    admin.password = newPassword;
    await admin.save();

    logger.info(`Admin password changed: ${admin._id}`);

    return successResponse(res, 200, "Password changed successfully");
  } catch (error) {
    logger.error(`Error changing admin password: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to change password");
  }
});

/**
 * Get All Users (Customers) with Order Statistics
 * GET /api/admin/users
 */
export const getUsers = asyncHandler(async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      search,
      status,
      sortBy,
      orderDate,
      joiningDate,
    } = req.query;
    const User = (await import("../../auth/models/User.js")).default;

    // Build query
    const query = { role: "user" }; // Only get users, not restaurants/delivery/admins

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    // Joining date filter
    if (joiningDate) {
      const startDate = new Date(joiningDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(joiningDate);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Get users
    const users = await User.find(query)
      .select("-password -__v")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    // Get user IDs
    const userIds = users.map((user) => user._id);

    // Get order statistics for each user
    const orderStats = await Order.aggregate([
      {
        $match: {
          userId: { $in: userIds },
        },
      },
      {
        $group: {
          _id: "$userId",
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$pricing.total" },
        },
      },
    ]);

    // Create a map of userId -> stats
    const statsMap = {};
    orderStats.forEach((stat) => {
      statsMap[stat._id.toString()] = {
        totalOrder: stat.totalOrders || 0,
        totalOrderAmount: stat.totalAmount || 0,
      };
    });

    // Format users with order statistics
    const formattedUsers = users.map((user, index) => {
      const stats = statsMap[user._id.toString()] || {
        totalOrder: 0,
        totalOrderAmount: 0,
      };

      // Format joining date
      const joiningDate = new Date(user.createdAt);
      const formattedDate = joiningDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      return {
        sl: parseInt(offset) + index + 1,
        id: user._id.toString(),
        name: user.name || "N/A",
        email: user.email || "N/A",
        phone: user.phone || "N/A",
        totalOrder: stats.totalOrder,
        totalOrderAmount: stats.totalOrderAmount,
        joiningDate: formattedDate,
        status: user.isActive !== false, // Default to true if not set
        createdAt: user.createdAt,
      };
    });

    // Apply sorting
    if (sortBy) {
      if (sortBy === "name-asc") {
        formattedUsers.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === "name-desc") {
        formattedUsers.sort((a, b) => b.name.localeCompare(a.name));
      } else if (sortBy === "orders-asc") {
        formattedUsers.sort((a, b) => a.totalOrder - b.totalOrder);
      } else if (sortBy === "orders-desc") {
        formattedUsers.sort((a, b) => b.totalOrder - a.totalOrder);
      }
    }

    // Order date filter (filter by order date after aggregation)
    let filteredUsers = formattedUsers;
    if (orderDate) {
      // This would require additional query to filter by order date
      // For now, we'll skip this as it's complex and may require different approach
    }

    const total = await User.countDocuments(query);

    return successResponse(res, 200, "Users retrieved successfully", {
      users: filteredUsers,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch users");
  }
});

/**
 * Get User by ID with Full Details
 * GET /api/admin/users/:id
 */
export const getUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const User = (await import("../../auth/models/User.js")).default;

    const user = await User.findById(id).select("-password -__v").lean();

    if (!user) {
      return errorResponse(res, 404, "User not found");
    }

    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $match: { userId: user._id },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$pricing.total" },
          orders: {
            $push: {
              orderId: "$orderId",
              status: "$status",
              total: "$pricing.total",
              createdAt: "$createdAt",
              restaurantName: "$restaurantName",
            },
          },
        },
      },
    ]);

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalAmount: 0,
      orders: [],
    };

    // Format joining date
    const joiningDate = new Date(user.createdAt);
    const formattedDate = joiningDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return successResponse(res, 200, "User retrieved successfully", {
      user: {
        id: user._id.toString(),
        name: user.name || "N/A",
        email: user.email || "N/A",
        phone: user.phone || "N/A",
        phoneVerified: user.phoneVerified || false,
        profileImage: user.profileImage || null,
        role: user.role,
        signupMethod: user.signupMethod,
        isActive: user.isActive !== false,
        addresses: user.addresses || [],
        preferences: user.preferences || {},
        wallet: user.wallet || {},
        dateOfBirth: user.dateOfBirth || null,
        anniversary: user.anniversary || null,
        gender: user.gender || null,
        joiningDate: formattedDate,
        createdAt: user.createdAt,
        totalOrders: stats.totalOrders,
        totalOrderAmount: stats.totalAmount,
        orders: stats.orders.slice(0, 10), // Last 10 orders
      },
    });
  } catch (error) {
    logger.error(`Error fetching user: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch user");
  }
});

/**
 * Update User Status (Active/Inactive)
 * PUT /api/admin/users/:id/status
 */
export const updateUserStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const User = (await import("../../auth/models/User.js")).default;

    if (typeof isActive !== "boolean") {
      return errorResponse(res, 400, "isActive must be a boolean value");
    }

    const user = await User.findById(id);

    if (!user) {
      return errorResponse(res, 404, "User not found");
    }

    user.isActive = isActive;
    await user.save();

    logger.info(`User status updated: ${id}`, {
      isActive,
      updatedBy: req.user._id,
    });

    return successResponse(res, 200, "User status updated successfully", {
      user: {
        id: user._id.toString(),
        name: user.name,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    logger.error(`Error updating user status: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to update user status");
  }
});

/**
 * Get All Restaurants
 * GET /api/admin/restaurants
 * Query params: page, limit, search, status, cuisine, zone
 */
export const getRestaurants = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, cuisine, zone } = req.query;

    // Build query
    const query = {};

    // Status filter - Default to active only (approved restaurants)
    // Only show inactive if explicitly requested via status filter
    // status=all shows both active and inactive
    if (status === "inactive") {
      query.isActive = false;
    } else if (status === "all") {
      // No isActive filter - show all
    } else {
      query.isActive = true;
    }
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { ownerName: { $regex: search, $options: "i" } },
        { ownerPhone: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Cuisine filter
    if (cuisine) {
      query.cuisines = { $in: [new RegExp(cuisine, "i")] };
    }

    // Zone filter
    if (zone && zone !== "All over the World") {
      query.$or = [
        { "location.area": { $regex: zone, $options: "i" } },
        { "location.city": { $regex: zone, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch restaurants
    const restaurants = await Restaurant.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Restaurant.countDocuments(query);

    return successResponse(res, 200, "Restaurants retrieved successfully", {
      restaurants: restaurants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error(`Error fetching restaurants: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch restaurants");
  }
});

/**
 * Update Restaurant Status (Active/Inactive/Ban)
 * PUT /api/admin/restaurants/:id/status
 */
export const updateRestaurantStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return errorResponse(res, 400, "isActive must be a boolean value");
    }

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    restaurant.isActive = isActive;
    await restaurant.save();

    logger.info(`Restaurant status updated: ${id}`, {
      isActive,
      updatedBy: req.user._id,
    });

    return successResponse(res, 200, "Restaurant status updated successfully", {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        isActive: restaurant.isActive,
      },
    });
  } catch (error) {
    logger.error(`Error updating restaurant status: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to update restaurant status");
  }
});

/**
 * Get Restaurant Join Requests
 * GET /api/admin/restaurants/requests
 * Query params: status (pending, rejected), page, limit, search
 */
export const getRestaurantJoinRequests = asyncHandler(async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 50, search } = req.query;

    // Build query
    const query = {};

    // Status filter
    // Pending = restaurants with ALL onboarding steps completed (step 4) but not yet active
    // Rejected = restaurants that have rejectionReason
    if (status === "pending") {
      // Build conditions array for $and - ensures all conditions are met
      // Check for rejectionReason: either doesn't exist OR is null
      const conditions = [
        { isActive: false },
        {
          $or: [
            { rejectionReason: { $exists: false } },
            { rejectionReason: null },
          ],
        },
      ];

      // Only show restaurants that have completed ALL onboarding steps (all 4 steps)
      // Check if onboarding.completedSteps is 4, OR if restaurant has all required data filled
      // This handles both cases: restaurants with proper tracking AND restaurants that completed onboarding before tracking was added
      const completionCheck = {
        $or: [
          { "onboarding.completedSteps": { $gte: 0 } },
          // Check for at least a restaurant name - this catches almost all new registrations
          { name: { $exists: true, $ne: null, $ne: "" } },
        ],
      };

      conditions.push(completionCheck);
      query.$and = conditions;
    } else if (status === "rejected") {
      query["rejectionReason"] = { $exists: true, $ne: null };
      // For rejected, also check if onboarding has started (has name)
      query.$or = [
        { "onboarding.completedSteps": { $gte: 0 } },
        { name: { $exists: true, $ne: null, $ne: "" } },
      ];
    }

    // Search filter - combine with $and if search is provided
    if (search && search.trim()) {
      const searchConditions = {
        $or: [
          { name: { $regex: search.trim(), $options: "i" } },
          { ownerName: { $regex: search.trim(), $options: "i" } },
          { ownerPhone: { $regex: search.trim(), $options: "i" } },
          { phone: { $regex: search.trim(), $options: "i" } },
          { email: { $regex: search.trim(), $options: "i" } },
        ],
      };

      // If query already has $and, add search to it; otherwise create new $and
      if (query.$and) {
        query.$and.push(searchConditions);
      } else {
        // Convert existing query conditions to $and format
        const baseConditions = { ...query };
        query = {
          $and: [baseConditions, searchConditions],
        };
      }
    }
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch restaurants
    const restaurants = await Restaurant.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Debug: Log found restaurants with detailed info
    // Get total count
    const total = await Restaurant.countDocuments(query);
    // Also log a sample of ALL inactive restaurants (for debugging)
    if (status === "pending" && restaurants.length === 0) {
      const allInactive = await Restaurant.find({
        isActive: false,
        $or: [
          { rejectionReason: { $exists: false } },
          { rejectionReason: null },
        ],
      })
        .select(
          "name isActive onboarding.completedSteps cuisines openDays estimatedDeliveryTime featuredDish",
        )
        .limit(10)
        .lean();

      const totalInactive = await Restaurant.countDocuments({
        isActive: false,
        $or: [
          { rejectionReason: { $exists: false } },
          { rejectionReason: null },
        ],
      });
    }

    // Format response to match frontend expectations
    const formattedRequests = restaurants.map((restaurant, index) => {
      // Get zone from location
      let zone = "All over the World";
      if (restaurant.location?.area) {
        zone = restaurant.location.area;
      } else if (restaurant.location?.city) {
        zone = restaurant.location.city;
      }

      // Get business model (could be from subscription or commission - defaulting for now)
      const businessModel = restaurant.businessModel || "Commission Base";

      // Get status
      const requestStatus = restaurant.rejectionReason ? "Rejected" : "Pending";

      return {
        _id: restaurant._id.toString(),
        sl: skip + index + 1,
        restaurantName: restaurant.name || "N/A",
        restaurantImage:
          restaurant.profileImage?.url ||
          restaurant.onboarding?.step2?.profileImageUrl?.url ||
          "https://via.placeholder.com/40",
        ownerName: restaurant.ownerName || "N/A",
        ownerPhone: restaurant.ownerPhone || restaurant.phone || "N/A",
        zone: zone,
        businessModel: businessModel,
        status: requestStatus,
        rejectionReason: restaurant.rejectionReason || null,
        createdAt: restaurant.createdAt,
        // Include full data for view/details
        fullData: {
          ...restaurant,
          _id: restaurant._id.toString(),
        },
      };
    });

    return successResponse(
      res,
      200,
      "Restaurant join requests retrieved successfully",
      {
        requests: formattedRequests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    );
  } catch (error) {
    logger.error(`Error fetching restaurant join requests: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch restaurant join requests");
  }
});

/**
 * Approve Restaurant Join Request
 * POST /api/admin/restaurants/:id/approve
 */
export const approveRestaurant = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    if (restaurant.isActive) {
      return errorResponse(res, 400, "Restaurant is already approved");
    }

    if (restaurant.rejectionReason) {
      return errorResponse(
        res,
        400,
        "Cannot approve a rejected restaurant. Please remove rejection reason first.",
      );
    }

    // Activate restaurant
    restaurant.isActive = true;
    restaurant.approvedAt = new Date();
    restaurant.approvedBy = adminId;
    restaurant.rejectionReason = undefined; // Clear any previous rejection

    await restaurant.save();

    logger.info(`Restaurant approved: ${id}`, {
      approvedBy: adminId,
      restaurantName: restaurant.name,
    });

    return successResponse(res, 200, "Restaurant approved successfully", {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        isActive: restaurant.isActive,
        approvedAt: restaurant.approvedAt,
      },
    });
  } catch (error) {
    logger.error(`Error approving restaurant: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to approve restaurant");
  }
});

/**
 * Update Restaurant Dining Settings
 * PUT /api/admin/restaurants/:id/dining-settings
 */
export const updateRestaurantDiningSettings = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { diningSettings } = req.body;

    if (!diningSettings) {
      return errorResponse(res, 400, "Dining settings are required");
    }

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    const updateData = {};

    if (Object.prototype.hasOwnProperty.call(diningSettings, "isEnabled")) {
      updateData["diningSettings.isEnabled"] = !!diningSettings.isEnabled;
      updateData["diningSettings.requestStatus"] = "none";
      updateData["diningSettings.lastDecisionAt"] = new Date();
      updateData["diningSettings.lastDecisionBy"] = req.user._id;
    }

    if (Object.prototype.hasOwnProperty.call(diningSettings, "maxGuests")) {
      const maxGuests = Number(diningSettings.maxGuests);
      if (!Number.isFinite(maxGuests) || maxGuests < 1) {
        return errorResponse(res, 400, "Max guests must be a number greater than 0");
      }
      updateData["diningSettings.maxGuests"] = Math.max(1, Math.floor(maxGuests));
    }

    if (Object.prototype.hasOwnProperty.call(diningSettings, "diningType")) {
      const diningType =
        typeof diningSettings.diningType === "string"
          ? diningSettings.diningType.trim()
          : "";
      if (diningType) {
        updateData["diningSettings.diningType"] = diningType;
      }
    }

    if (Object.prototype.hasOwnProperty.call(diningSettings, "requestStatus")) {
      updateData["diningSettings.requestStatus"] =
        diningSettings.requestStatus === "pending" ? "pending" : "none";
    }

    if (Object.prototype.hasOwnProperty.call(diningSettings, "lastRequestAt")) {
      const parsedDate = new Date(diningSettings.lastRequestAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        updateData["diningSettings.lastRequestAt"] = parsedDate;
      }
    }

    if (Object.prototype.hasOwnProperty.call(diningSettings, "lastDecisionAt")) {
      const parsedDate = new Date(diningSettings.lastDecisionAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        updateData["diningSettings.lastDecisionAt"] = parsedDate;
      }
    }

    if (Object.prototype.hasOwnProperty.call(diningSettings, "lastDecisionBy")) {
      if (mongoose.Types.ObjectId.isValid(diningSettings.lastDecisionBy)) {
        updateData["diningSettings.lastDecisionBy"] = diningSettings.lastDecisionBy;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, 400, "No valid dining settings were provided");
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select("-password");

    if (!updatedRestaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    logger.info(`Restaurant dining settings updated: ${id}`, {
      updatedBy: req.user._id,
      diningSettings: updateData,
    });

    return successResponse(res, 200, "Dining settings updated successfully", {
      restaurant: {
        id: updatedRestaurant._id,
        diningSettings: updatedRestaurant.diningSettings,
      },
    });
  } catch (error) {
    logger.error(`Error updating dining settings: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to update dining settings");
  }
});

/**
 * Update Restaurant Dining Commission (%)
 * PATCH /api/admin/restaurants/:id/dining-commission
 */
export const updateRestaurantDiningCommission = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { diningCommissionPercentage } = req.body;

    if (typeof diningCommissionPercentage !== "number" || diningCommissionPercentage < 0 || diningCommissionPercentage > 100) {
      return errorResponse(res, 400, "Dining commission must be a number between 0 and 100");
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    restaurant.diningCommissionPercentage = diningCommissionPercentage;
    await restaurant.save();

    logger.info(`Restaurant dining commission updated: ${id}`, {
      diningCommissionPercentage,
      updatedBy: req.user._id,
    });

    return successResponse(res, 200, "Dining commission updated successfully", {
      restaurant: {
        id: restaurant._id,
        diningCommissionPercentage: restaurant.diningCommissionPercentage,
      },
    });
  } catch (error) {
    logger.error(`Error updating dining commission: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, "Failed to update dining commission");
  }
});

/**
 * Reject Restaurant Join Request
 * POST /api/admin/restaurants/:id/reject
 */
export const rejectRestaurant = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    // Validate reason is provided
    if (!reason || !reason.trim()) {
      return errorResponse(res, 400, "Rejection reason is required");
    }

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    // Set rejection details (allow updating if already rejected)
    restaurant.rejectionReason = reason.trim();
    restaurant.rejectedAt = new Date();
    restaurant.rejectedBy = adminId;
    restaurant.isActive = false; // Ensure it's inactive

    await restaurant.save();

    logger.info(`Restaurant rejected: ${id}`, {
      rejectedBy: adminId,
      reason: reason,
      restaurantName: restaurant.name,
    });

    return successResponse(res, 200, "Restaurant rejected successfully", {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        rejectionReason: restaurant.rejectionReason,
      },
    });
  } catch (error) {
    logger.error(`Error rejecting restaurant: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to reject restaurant");
  }
});

/**
 * Reverify Restaurant (Resubmit for approval)
 * POST /api/admin/restaurants/:id/reverify
 */
export const reverifyRestaurant = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    // Check if restaurant was rejected
    if (!restaurant.rejectionReason) {
      return errorResponse(
        res,
        400,
        "Restaurant is not rejected. Only rejected restaurants can be reverified.",
      );
    }

    // Clear rejection details and mark as pending again
    restaurant.rejectionReason = null;
    restaurant.rejectedAt = undefined;
    restaurant.rejectedBy = undefined;
    restaurant.isActive = false; // Keep inactive until approved

    await restaurant.save();

    logger.info(`Restaurant reverified: ${id}`, {
      reverifiedBy: adminId,
      restaurantName: restaurant.name,
    });

    return successResponse(
      res,
      200,
      "Restaurant reverified successfully. Waiting for admin approval.",
      {
        restaurant: {
          id: restaurant._id.toString(),
          name: restaurant.name,
          isActive: restaurant.isActive,
          rejectionReason: null,
        },
      },
    );
  } catch (error) {
    logger.error(`Error reverifying restaurant: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to reverify restaurant");
  }
});

/**
 * Create Restaurant by Admin
 * POST /api/admin/restaurants
 */
export const createRestaurant = asyncHandler(async (req, res) => {
  try {
    const adminId = req.user._id;
    const {
      // Step 1: Basic Info
      restaurantName,
      ownerName,
      ownerEmail,
      ownerPhone,
      primaryContactNumber,
      location,
      // Step 2: Images & Operational
      menuImages, // Array of image URLs or base64
      profileImage, // Image URL or base64
      cuisines,
      openingTime,
      closingTime,
      openDays,
      // Step 3: Documents
      panNumber,
      nameOnPan,
      panImage, // Image URL or base64
      gstRegistered,
      gstNumber,
      gstLegalName,
      gstAddress,
      gstImage, // Image URL or base64
      fssaiNumber,
      fssaiExpiry,
      fssaiImage, // Image URL or base64
      accountNumber,
      ifscCode,
      accountHolderName,
      accountType,
      // Step 4: Display Info
      estimatedDeliveryTime,
      featuredDish,
      featuredPrice,
      offer,
      // Authentication
      email,
      phone,
      password,
      signupMethod = "email",
    } = req.body;

    // Validation
    if (!restaurantName || !ownerName || !ownerEmail) {
      return errorResponse(
        res,
        400,
        "Restaurant name, owner name, and owner email are required",
      );
    }

    if (!email && !phone) {
      return errorResponse(res, 400, "Either email or phone is required");
    }

    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
    if (phone && !normalizedPhone) {
      return errorResponse(res, 400, "Invalid phone number format");
    }

    // Generate random password if email is provided but password is not
    let finalPassword = password;
    if (email && !password) {
      // Generate a random 12-character password
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      finalPassword = Array.from(
        { length: 12 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join("");
    }

    // Check if restaurant already exists with same email or phone
    const existingRestaurant = await Restaurant.findOne({
      $or: [
        ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    });

    if (existingRestaurant) {
      if (email && existingRestaurant.email === email.toLowerCase().trim()) {
        return errorResponse(
          res,
          400,
          "Restaurant with this email already exists",
        );
      }
      if (normalizedPhone && existingRestaurant.phone === normalizedPhone) {
        return errorResponse(
          res,
          400,
          "Restaurant with this phone number already exists. Please use a different phone number.",
        );
      }
    }

    // Initialize Cloudinary
    await initializeCloudinary();

    // Upload images if provided as base64 or files
    let profileImageData = null;
    if (profileImage) {
      if (
        typeof profileImage === "string" &&
        profileImage.startsWith("data:")
      ) {
        // Base64 image - convert to buffer and upload
        const base64Data = profileImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/restaurant/profile",
          resource_type: "image",
        });
        profileImageData = {
          url: result.secure_url,
          publicId: result.public_id,
        };
      } else if (
        typeof profileImage === "string" &&
        profileImage.startsWith("http")
      ) {
        // Already a URL
        profileImageData = { url: profileImage };
      } else if (profileImage.url) {
        // Already an object with url
        profileImageData = profileImage;
      }
    }

    let menuImagesData = [];
    if (menuImages && Array.isArray(menuImages) && menuImages.length > 0) {
      for (const img of menuImages) {
        if (typeof img === "string" && img.startsWith("data:")) {
          const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const result = await uploadToCloudinary(buffer, {
            folder: "appzeto/restaurant/menu",
            resource_type: "image",
          });
          menuImagesData.push({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else if (typeof img === "string" && img.startsWith("http")) {
          menuImagesData.push({ url: img });
        } else if (img.url) {
          menuImagesData.push(img);
        }
      }
    }

    // Upload document images
    let panImageData = null;
    if (panImage) {
      if (typeof panImage === "string" && panImage.startsWith("data:")) {
        const base64Data = panImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/restaurant/pan",
          resource_type: "image",
        });
        panImageData = { url: result.secure_url, publicId: result.public_id };
      } else if (typeof panImage === "string" && panImage.startsWith("http")) {
        panImageData = { url: panImage };
      } else if (panImage.url) {
        panImageData = panImage;
      }
    }

    let gstImageData = null;
    if (gstRegistered && gstImage) {
      if (typeof gstImage === "string" && gstImage.startsWith("data:")) {
        const base64Data = gstImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/restaurant/gst",
          resource_type: "image",
        });
        gstImageData = { url: result.secure_url, publicId: result.public_id };
      } else if (typeof gstImage === "string" && gstImage.startsWith("http")) {
        gstImageData = { url: gstImage };
      } else if (gstImage.url) {
        gstImageData = gstImage;
      }
    }

    let fssaiImageData = null;
    if (fssaiImage) {
      if (typeof fssaiImage === "string" && fssaiImage.startsWith("data:")) {
        const base64Data = fssaiImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/restaurant/fssai",
          resource_type: "image",
        });
        fssaiImageData = { url: result.secure_url, publicId: result.public_id };
      } else if (
        typeof fssaiImage === "string" &&
        fssaiImage.startsWith("http")
      ) {
        fssaiImageData = { url: fssaiImage };
      } else if (fssaiImage.url) {
        fssaiImageData = fssaiImage;
      }
    }

    // Create restaurant data
    const restaurantData = {
      name: restaurantName,
      ownerName,
      ownerEmail,
      ownerPhone: ownerPhone
        ? normalizePhoneNumber(ownerPhone) || normalizedPhone
        : normalizedPhone,
      primaryContactNumber: primaryContactNumber
        ? normalizePhoneNumber(primaryContactNumber) || normalizedPhone
        : normalizedPhone,
      location: location || {},
      profileImage: profileImageData,
      menuImages: menuImagesData,
      cuisines: cuisines || [],
      deliveryTimings: {
        openingTime: openingTime || "09:00",
        closingTime: closingTime || "22:00",
      },
      openDays: openDays || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      estimatedDeliveryTime: estimatedDeliveryTime || "25-30 mins",
      featuredDish: featuredDish || "",
      featuredPrice: featuredPrice || 249,
      offer: offer || "",
      signupMethod,
      // Admin created restaurants are active by default
      isActive: true,
      isAcceptingOrders: true,
      approvedAt: new Date(),
      approvedBy: adminId,
    };

    // Add authentication fields
    if (email) {
      restaurantData.email = email.toLowerCase().trim();
      restaurantData.password = finalPassword; // Will be hashed by pre-save hook
    }
    if (normalizedPhone) {
      restaurantData.phone = normalizedPhone;
      restaurantData.phoneVerified = true; // Admin created, so verified
    }

    // Add onboarding data
    restaurantData.onboarding = {
      step1: {
        restaurantName,
        ownerName,
        ownerEmail,
        ownerPhone: ownerPhone
          ? normalizePhoneNumber(ownerPhone) || normalizedPhone
          : normalizedPhone,
        primaryContactNumber: primaryContactNumber
          ? normalizePhoneNumber(primaryContactNumber) || normalizedPhone
          : normalizedPhone,
        location: location || {},
      },
      step2: {
        menuImageUrls: menuImagesData,
        profileImageUrl: profileImageData,
        cuisines: cuisines || [],
        deliveryTimings: {
          openingTime: openingTime || "09:00",
          closingTime: closingTime || "22:00",
        },
        openDays: openDays || [],
      },
      step3: {
        pan: {
          panNumber: panNumber || "",
          nameOnPan: nameOnPan || "",
          image: panImageData,
        },
        gst: {
          isRegistered: gstRegistered || false,
          gstNumber: gstNumber || "",
          legalName: gstLegalName || "",
          address: gstAddress || "",
          image: gstImageData,
        },
        fssai: {
          registrationNumber: fssaiNumber || "",
          expiryDate: fssaiExpiry || null,
          image: fssaiImageData,
        },
        bank: {
          accountNumber: accountNumber || "",
          ifscCode: ifscCode || "",
          accountHolderName: accountHolderName || "",
          accountType: accountType || "",
        },
      },
      step4: {
        estimatedDeliveryTime: estimatedDeliveryTime || "25-30 mins",
        featuredDish: featuredDish || "",
        featuredPrice: featuredPrice || 249,
        offer: offer || "",
      },
      completedSteps: 4,
    };

    // Create restaurant
    const restaurant = await Restaurant.create(restaurantData);

    logger.info(`Restaurant created by admin: ${restaurant._id}`, {
      createdBy: adminId,
      restaurantName: restaurant.name,
      email: restaurant.email,
      phone: restaurant.phone,
    });

    // Prepare response data
    const responseData = {
      restaurant: {
        id: restaurant._id,
        restaurantId: restaurant.restaurantId,
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
        isActive: restaurant.isActive,
        slug: restaurant.slug,
      },
    };

    // Include generated password in response if email was provided and password was auto-generated
    // This allows admin to share the password with the restaurant
    if (email && !password && finalPassword) {
      responseData.generatedPassword = finalPassword;
      responseData.message =
        "Restaurant created successfully. Please share the generated password with the restaurant.";
    }

    return successResponse(
      res,
      201,
      "Restaurant created successfully",
      responseData,
    );
  } catch (error) {
    logger.error(`Error creating restaurant: ${error.message}`, {
      error: error.stack,
    });

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return errorResponse(
        res,
        400,
        `Restaurant with this ${field} already exists`,
      );
    }

    return errorResponse(
      res,
      500,
      `Failed to create restaurant: ${error.message}`,
    );
  }
});

/**
 * Delete Restaurant
 * DELETE /api/admin/restaurants/:id
 */
export const deleteRestaurant = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    // Delete restaurant
    await Restaurant.findByIdAndDelete(id);

    logger.info(`Restaurant deleted: ${id}`, {
      deletedBy: adminId,
      restaurantName: restaurant.name,
    });

    return successResponse(res, 200, "Restaurant deleted successfully", {
      restaurant: {
        id: id,
        name: restaurant.name,
      },
    });
  } catch (error) {
    logger.error(`Error deleting restaurant: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to delete restaurant");
  }
});

/**
 * Get Restaurant by ID (Admin - includes inactive)
 * GET /api/admin/restaurants/:id
 */
export const getRestaurantById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id).select("-password").lean();
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }
    return successResponse(res, 200, "Restaurant retrieved successfully", {
      restaurant,
    });
  } catch (error) {
    logger.error(`Error fetching restaurant: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, "Failed to fetch restaurant");
  }
});

/**
 * Update Restaurant (Admin)
 * PUT /api/admin/restaurants/:id
 */
export const updateRestaurant = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }
    const allowed = [
      "name", "ownerName", "ownerEmail", "ownerPhone", "primaryContactNumber",
      "profileImage", "menuImages", "cuisines", "openDays",
      "estimatedDeliveryTime", "featuredDish", "featuredPrice", "offer",
      "deliveryTimings", "isActive", "diningSettings", "diningCommissionPercentage",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        restaurant[key] = req.body[key];
      }
    }
    if (req.body.location && typeof req.body.location === "object") {
      const loc = restaurant.location ? restaurant.location.toObject ? restaurant.location.toObject() : { ...restaurant.location } : {};
      Object.assign(loc, req.body.location);
      restaurant.set("location", loc);
    }
    await restaurant.save();
    return successResponse(res, 200, "Restaurant updated successfully", {
      restaurant: await Restaurant.findById(id).select("-password").lean(),
    });
  } catch (error) {
    logger.error(`Error updating restaurant: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, "Failed to update restaurant");
  }
});

/**
 * Get All Offers with Restaurant and Dish Details
 * GET /api/admin/offers
 * Query params: page, limit, search, status, restaurantId
 */
export const getAllOffers = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, restaurantId } = req.query;

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (restaurantId) {
      query.restaurant = restaurantId;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch offers with restaurant details
    const offers = await Offer.find(query)
      .populate("restaurant", "name restaurantId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Offer.countDocuments(query);

    // Flatten offers to show each item separately
    const offerItems = [];
    offers.forEach((offer, offerIndex) => {
      if (offer.items && offer.items.length > 0) {
        offer.items.forEach((item, itemIndex) => {
          // Apply search filter if provided
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesSearch =
              offer.restaurant?.name?.toLowerCase().includes(searchLower) ||
              item.itemName?.toLowerCase().includes(searchLower) ||
              item.couponCode?.toLowerCase().includes(searchLower);

            if (!matchesSearch) {
              return; // Skip this item if it doesn't match search
            }
          }

          offerItems.push({
            sl: skip + offerItems.length + 1,
            offerId: offer._id.toString(),
            restaurantName: offer.restaurant?.name || "Unknown Restaurant",
            restaurantId:
              offer.restaurant?.restaurantId ||
              offer.restaurant?._id?.toString() ||
              "N/A",
            dishName: item.itemName || "Unknown Dish",
            dishId: item.itemId || "N/A",
            couponCode: item.couponCode || "N/A",
            discountType: offer.discountType || "percentage",
            discountPercentage: item.discountPercentage || 0,
            originalPrice: item.originalPrice || 0,
            discountedPrice: item.discountedPrice || 0,
            status: offer.status || "active",
            startDate: offer.startDate || null,
            endDate: offer.endDate || null,
            createdAt: offer.createdAt || new Date(),
          });
        });
      }
    });

    // If search was applied, we need to recalculate total
    let filteredTotal = offerItems.length;
    if (!search) {
      // Count all items across all offers
      const allOffers = await Offer.find(query).lean();
      filteredTotal = allOffers.reduce(
        (sum, offer) => sum + (offer.items?.length || 0),
        0,
      );
    }

    return successResponse(res, 200, "Offers retrieved successfully", {
      offers: offerItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error(`Error fetching offers: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch offers");
  }
});

/**
 * Get Restaurant Analytics for POS
 * GET /api/admin/restaurant-analytics/:restaurantId
 */
export const getRestaurantAnalytics = asyncHandler(async (req, res) => {
  try {
    const { restaurantId } = req.params;

    logger.info(`Fetching restaurant analytics for: ${restaurantId}`);

    if (!restaurantId) {
      return errorResponse(res, 400, "Restaurant ID is required");
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      logger.warn(`Invalid restaurant ID format: ${restaurantId}`);
      return errorResponse(res, 400, "Invalid restaurant ID format");
    }

    // Get restaurant details
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      logger.warn(`Restaurant not found: ${restaurantId}`);
      return errorResponse(res, 404, "Restaurant not found");
    }

    logger.info(
      `Restaurant found: ${restaurant.name} (${restaurant.restaurantId})`,
    );

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    // Get order statistics - restaurantId can be _id or restaurantId field (both as String in Order model)
    // Match by both restaurant._id and restaurant.restaurantId
    const restaurantIdString = restaurantId.toString();
    const restaurantIdField = restaurant?.restaurantId || restaurantIdString;
    const restaurantObjectIdString = restaurant._id.toString();

    logger.info(`📊 Fetching order statistics for restaurant:`, {
      restaurantId: restaurantId,
      restaurantIdString: restaurantIdString,
      restaurantIdField: restaurantIdField,
      restaurantObjectIdString: restaurantObjectIdString,
      restaurantName: restaurant.name,
    });

    // Build query to match restaurantId in multiple formats
    const orderMatchQuery = {
      $or: [
        { restaurantId: restaurantIdString },
        { restaurantId: restaurantIdField },
        { restaurantId: restaurantObjectIdString },
      ],
    };

    logger.info(`🔍 Order query:`, orderMatchQuery);

    const orderStats = await Order.aggregate([
      {
        $match: orderMatchQuery,
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$status", "delivered"] },
                { $ifNull: ["$pricing.total", 0] },
                0,
              ],
            },
          },
        },
      },
    ]);

    logger.info(`📊 Order stats found:`, orderStats);

    const orderStatusMap = {};
    let totalRevenue = 0;
    orderStats.forEach((stat) => {
      orderStatusMap[stat._id] = stat.count;
      if (stat._id === "delivered") {
        totalRevenue += stat.totalRevenue || 0;
      }
    });

    const totalOrders =
      (orderStatusMap.delivered || 0) +
      (orderStatusMap.cancelled || 0) +
      (orderStatusMap.pending || 0) +
      (orderStatusMap.confirmed || 0) +
      (orderStatusMap.preparing || 0) +
      (orderStatusMap.ready || 0) +
      (orderStatusMap.out_for_delivery || 0);
    const completedOrders = orderStatusMap.delivered || 0;
    const cancelledOrders = orderStatusMap.cancelled || 0;

    logger.info(`📊 Calculated order statistics:`, {
      totalOrders,
      completedOrders,
      cancelledOrders,
      orderStatusMap,
    });

    // Get monthly orders and revenue
    const monthlyStats = await Order.aggregate([
      {
        $match: {
          $or: [
            { restaurantId: restaurantIdString },
            { restaurantId: restaurantIdField },
          ],
          status: "delivered",
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
        },
      },
    ]);

    const monthlyOrders = monthlyStats[0]?.count || 0;
    const monthlyRevenue = monthlyStats[0]?.revenue || 0;

    // Get yearly orders and revenue
    const yearlyStats = await Order.aggregate([
      {
        $match: {
          $or: [
            { restaurantId: restaurantIdString },
            { restaurantId: restaurantIdField },
          ],
          status: "delivered",
          createdAt: { $gte: startOfYear },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$pricing.total", 0] } },
        },
      },
    ]);

    const yearlyOrders = yearlyStats[0]?.count || 0;
    const yearlyRevenue = yearlyStats[0]?.revenue || 0;

    // Get commission and earnings data from OrderSettlement (more accurate)
    // Match settlements by restaurantId (ObjectId in OrderSettlement)
    const restaurantIdForSettlement =
      restaurant._id instanceof mongoose.Types.ObjectId
        ? restaurant._id
        : new mongoose.Types.ObjectId(restaurant._id);

    // Get all settlements for this restaurant
    const allSettlements = await OrderSettlement.find({
      restaurantId: restaurantIdForSettlement,
    }).lean();

    // Calculate totals from settlements
    let totalCommission = 0;
    let totalRestaurantEarning = 0;
    let totalFoodPrice = 0;

    allSettlements.forEach((s) => {
      totalCommission += s.restaurantEarning?.commission || 0;
      totalRestaurantEarning += s.restaurantEarning?.netEarning || 0;
      totalFoodPrice += s.restaurantEarning?.foodPrice || 0;
    });

    totalCommission = Math.round(totalCommission * 100) / 100;
    totalRestaurantEarning = Math.round(totalRestaurantEarning * 100) / 100;
    totalFoodPrice = Math.round(totalFoodPrice * 100) / 100;

    // Get monthly settlements
    const monthlySettlements = await OrderSettlement.find({
      restaurantId: restaurantIdForSettlement,
      createdAt: { $gte: startOfMonth },
    }).lean();

    let monthlyCommission = 0;
    let monthlyRestaurantEarning = 0;
    monthlySettlements.forEach((s) => {
      monthlyCommission += s.restaurantEarning?.commission || 0;
      monthlyRestaurantEarning += s.restaurantEarning?.netEarning || 0;
    });

    monthlyCommission = Math.round(monthlyCommission * 100) / 100;
    monthlyRestaurantEarning = Math.round(monthlyRestaurantEarning * 100) / 100;
    const monthlyProfit = monthlyRestaurantEarning; // Restaurant profit = net earning

    // Get yearly settlements
    const yearlySettlements = await OrderSettlement.find({
      restaurantId: restaurantIdForSettlement,
      createdAt: { $gte: startOfYear },
    }).lean();

    let yearlyCommission = 0;
    let yearlyRestaurantEarning = 0;
    yearlySettlements.forEach((s) => {
      yearlyCommission += s.restaurantEarning?.commission || 0;
      yearlyRestaurantEarning += s.restaurantEarning?.netEarning || 0;
    });

    yearlyCommission = Math.round(yearlyCommission * 100) / 100;
    yearlyRestaurantEarning = Math.round(yearlyRestaurantEarning * 100) / 100;
    const yearlyProfit = yearlyRestaurantEarning; // Restaurant profit = net earning

    // Get average monthly profit (last 12 months)
    const last12MonthsStart = new Date(
      now.getFullYear(),
      now.getMonth() - 12,
      1,
    );
    const last12MonthsSettlements = await OrderSettlement.find({
      restaurantId: restaurantIdForSettlement,
      createdAt: { $gte: last12MonthsStart },
    }).lean();

    // Group by month
    const monthlyEarningsMap = new Map();
    last12MonthsSettlements.forEach((s) => {
      const monthKey = `${new Date(s.createdAt).getFullYear()}-${new Date(s.createdAt).getMonth()}`;
      const current = monthlyEarningsMap.get(monthKey) || 0;
      monthlyEarningsMap.set(
        monthKey,
        current + (s.restaurantEarning?.netEarning || 0),
      );
    });

    const avgMonthlyProfit =
      monthlyEarningsMap.size > 0
        ? Array.from(monthlyEarningsMap.values()).reduce(
            (sum, val) => sum + val,
            0,
          ) / monthlyEarningsMap.size
        : 0;

    // Get commission percentage from RestaurantCommission
    const RestaurantCommission = (
      await import("../models/RestaurantCommission.js")
    ).default;

    // Use restaurant._id directly - ensure it's an ObjectId
    const restaurantIdForQuery =
      restaurant._id instanceof mongoose.Types.ObjectId
        ? restaurant._id
        : new mongoose.Types.ObjectId(restaurant._id);

    logger.info(`🔍 Looking for commission config:`, {
      restaurantId: restaurantId,
      restaurantObjectId: restaurantIdForQuery.toString(),
      restaurantName: restaurant.name,
      restaurantIdString: restaurant.restaurantId,
    });

    // Try using the static method first
    let commissionConfig =
      await RestaurantCommission.getCommissionForRestaurant(
        restaurantIdForQuery,
      );

    if (commissionConfig) {
      // Convert to plain object if needed
      commissionConfig = commissionConfig.toObject
        ? commissionConfig.toObject()
        : commissionConfig;
      logger.info(`✅ Found commission using static method`);
    }

    // If not found, try direct query
    if (!commissionConfig) {
      logger.info(
        `⚠️ Static method didn't find commission, trying direct query`,
      );
      commissionConfig = await RestaurantCommission.findOne({
        restaurant: restaurantIdForQuery,
        status: true,
      });

      if (commissionConfig) {
        commissionConfig = commissionConfig.toObject
          ? commissionConfig.toObject()
          : commissionConfig;
      }
    }

    // If still not found, try without status filter
    if (!commissionConfig) {
      logger.info(`⚠️ Trying without status filter`);
      commissionConfig = await RestaurantCommission.findOne({
        restaurant: restaurantIdForQuery,
      });

      if (commissionConfig) {
        commissionConfig = commissionConfig.toObject
          ? commissionConfig.toObject()
          : commissionConfig;
      }
    }

    // Also try by restaurantId string field
    if (!commissionConfig && restaurant?.restaurantId) {
      logger.info(
        `🔄 Trying by restaurantId string: ${restaurant.restaurantId}`,
      );
      commissionConfig = await RestaurantCommission.findOne({
        restaurantId: restaurant.restaurantId,
      });

      if (commissionConfig) {
        commissionConfig = commissionConfig.toObject
          ? commissionConfig.toObject()
          : commissionConfig;
      }
    }

    // Final debug: List all commissions to see what's in DB
    if (!commissionConfig) {
      const allCommissions = await RestaurantCommission.find({}).lean();
      logger.warn(
        `❌ No commission found. Total commissions in DB: ${allCommissions.length}`,
      );
      logger.info(
        `📋 All commissions:`,
        allCommissions.map((c) => ({
          _id: c._id,
          restaurant: c.restaurant?.toString
            ? c.restaurant.toString()
            : String(c.restaurant),
          restaurantId: c.restaurantId,
          restaurantName: c.restaurantName,
          status: c.status,
          defaultCommission: c.defaultCommission,
        })),
      );

      // Check if restaurant ObjectId matches any commission
      const matching = allCommissions.filter((c) => {
        const cRestaurantId = c.restaurant?.toString
          ? c.restaurant.toString()
          : String(c.restaurant);
        return cRestaurantId === restaurantIdForQuery.toString();
      });
      logger.info(`🔍 Matching commissions: ${matching.length}`, matching);
    }

    let commissionPercentage = 0;
    if (commissionConfig) {
      logger.info(`✅ Commission config found for restaurant ${restaurantId}`);
      logger.info(`Commission config details:`, {
        _id: commissionConfig._id,
        restaurant: commissionConfig.restaurant?.toString
          ? commissionConfig.restaurant.toString()
          : String(commissionConfig.restaurant),
        restaurantId: commissionConfig.restaurantId,
        restaurantName: commissionConfig.restaurantName,
        status: commissionConfig.status,
        hasDefaultCommission: !!commissionConfig.defaultCommission,
        defaultCommissionType: commissionConfig.defaultCommission?.type,
        defaultCommissionValue: commissionConfig.defaultCommission?.value,
      });

      if (commissionConfig.defaultCommission) {
        // Get default commission value - if type is percentage, show the percentage value
        logger.info(`📊 Processing defaultCommission:`, {
          type: commissionConfig.defaultCommission.type,
          value: commissionConfig.defaultCommission.value,
          valueType: typeof commissionConfig.defaultCommission.value,
        });

        if (commissionConfig.defaultCommission.type === "percentage") {
          const rawValue = commissionConfig.defaultCommission.value;
          commissionPercentage =
            typeof rawValue === "number" ? rawValue : parseFloat(rawValue) || 0;
          logger.info(
            `✅ Found commission percentage: ${commissionPercentage}% for restaurant ${restaurantId} (raw value: ${rawValue})`,
          );
        } else if (commissionConfig.defaultCommission.type === "amount") {
          // For amount type, we can't show a percentage, so keep it as 0
          commissionPercentage = 0;
          logger.info(
            `⚠️ Commission type is 'amount', not 'percentage' for restaurant ${restaurantId}`,
          );
        }
      } else {
        logger.warn(
          `⚠️ Commission config found but no defaultCommission for restaurant ${restaurantId}`,
        );
      }
    } else {
      logger.warn(
        `❌ No commission config found for restaurant ${restaurantId} (restaurant._id: ${restaurantIdForQuery.toString()})`,
      );
      logger.warn(
        `⚠️ This restaurant may not have a commission configuration set up.`,
      );
      logger.warn(
        `💡 To set up commission, go to Restaurant Commission page and add commission for this restaurant.`,
      );
    }

    // Log the final commission percentage being returned
    logger.info(
      `📊 Final commission percentage being returned: ${commissionPercentage}%`,
    );
    logger.info(
      `📤 Sending response with commissionPercentage: ${commissionPercentage}`,
    );

    // Get ratings from FeedbackExperience (restaurantId is ObjectId in FeedbackExperience)
    const FeedbackExperience = (await import("../models/FeedbackExperience.js"))
      .default;

    const restaurantIdForRating =
      restaurant._id instanceof mongoose.Types.ObjectId
        ? restaurant._id
        : new mongoose.Types.ObjectId(restaurant._id);

    logger.info(`⭐ Fetching ratings for restaurant:`, {
      restaurantId: restaurantId,
      restaurantObjectId: restaurantIdForRating.toString(),
    });

    const ratingStats = await FeedbackExperience.aggregate([
      {
        $match: {
          restaurantId: restaurantIdForRating,
          rating: { $exists: true, $ne: null, $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
        },
      },
    ]);

    logger.info(`⭐ Rating stats found:`, ratingStats);

    const averageRating = ratingStats[0]?.averageRating || 0;
    const totalRatings = ratingStats[0]?.totalRatings || 0;

    logger.info(`⭐ Calculated ratings:`, {
      averageRating,
      totalRatings,
    });

    // Get unique customers
    const customerStats = await Order.aggregate([
      {
        $match: {
          $or: [
            { restaurantId: restaurantIdString },
            { restaurantId: restaurantIdField },
          ],
          status: "delivered",
        },
      },
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const totalCustomers = customerStats.length;
    const repeatCustomers = customerStats.filter(
      (c) => c.orderCount > 1,
    ).length;

    // Calculate average order value
    const averageOrderValue =
      completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Calculate rates
    const cancellationRate =
      totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const completionRate =
      totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Calculate average yearly profit (if restaurant has been active for multiple years)
    const restaurantCreatedAt = restaurant.createdAt || new Date();
    const yearsActive = Math.max(
      1,
      (now - restaurantCreatedAt) / (365 * 24 * 60 * 60 * 1000),
    );
    const averageYearlyProfit =
      yearsActive > 0
        ? yearlyRestaurantEarning / yearsActive
        : yearlyRestaurantEarning;

    return successResponse(
      res,
      200,
      "Restaurant analytics retrieved successfully",
      {
        restaurant: {
          _id: restaurant._id,
          name: restaurant.name,
          restaurantId: restaurant.restaurantId,
          isActive: restaurant.isActive,
          createdAt: restaurant.createdAt,
        },
        analytics: {
          totalOrders: Number(totalOrders) || 0,
          cancelledOrders: Number(cancelledOrders) || 0,
          completedOrders: Number(completedOrders) || 0,
          averageRating: averageRating
            ? parseFloat(averageRating.toFixed(1))
            : 0,
          totalRatings: Number(totalRatings) || 0,
          commissionPercentage: Number(commissionPercentage) || 0,
          monthlyProfit: parseFloat(monthlyRestaurantEarning.toFixed(2)),
          yearlyProfit: parseFloat(yearlyRestaurantEarning.toFixed(2)),
          averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalCommission: parseFloat(totalCommission.toFixed(2)),
          restaurantEarning: parseFloat(totalRestaurantEarning.toFixed(2)),
          monthlyOrders,
          yearlyOrders,
          averageMonthlyProfit: parseFloat(avgMonthlyProfit.toFixed(2)),
          averageYearlyProfit: parseFloat(averageYearlyProfit.toFixed(2)),
          status: restaurant.isActive ? "active" : "inactive",
          joinDate: restaurant.createdAt,
          totalCustomers,
          repeatCustomers,
          cancellationRate: parseFloat(cancellationRate.toFixed(2)),
          completionRate: parseFloat(completionRate.toFixed(2)),
        },
      },
    );
  } catch (error) {
    logger.error(`Error fetching restaurant analytics: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch restaurant analytics");
  }
});

/**
 * Get Customer Wallet Report
 * GET /api/admin/customer-wallet-report
 * Query params: fromDate, toDate, all (Credit/Debit), customer, search
 */
export const getCustomerWalletReport = asyncHandler(async (req, res) => {
  try {
    const { fromDate, toDate, all, customer, search } = req.query;
    const UserWallet = (await import("../../user/models/UserWallet.js"))
      .default;
    const User = (await import("../../auth/models/User.js")).default;

    // Build date filter
    let dateFilter = {};
    if (fromDate || toDate) {
      dateFilter["transactions.createdAt"] = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        dateFilter["transactions.createdAt"].$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        dateFilter["transactions.createdAt"].$lte = endDate;
      }
    }

    // Get all wallets with transactions
    const wallets = await UserWallet.find({
      ...dateFilter,
      "transactions.0": { $exists: true }, // Only wallets with transactions
    })
      .populate("userId", "name email phone")
      .lean();

    // Flatten transactions with user info
    let allTransactions = [];
    wallets.forEach((wallet) => {
      if (!wallet.userId) return;

      // Sort transactions by date (oldest first for balance calculation)
      const sortedTransactions = [...wallet.transactions].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );

      let runningBalance = 0;

      sortedTransactions.forEach((transaction) => {
        // Update running balance if transaction is completed (before date filter)
        let balance = runningBalance;
        if (transaction.status === "Completed") {
          if (
            transaction.type === "addition" ||
            transaction.type === "refund"
          ) {
            runningBalance += transaction.amount;
            balance = runningBalance;
          } else if (transaction.type === "deduction") {
            runningBalance -= transaction.amount;
            balance = runningBalance;
          }
        }

        // Apply date filter if provided
        if (fromDate || toDate) {
          const transDate = new Date(transaction.createdAt);
          if (fromDate && transDate < new Date(fromDate)) return;
          if (toDate) {
            const toDateObj = new Date(toDate);
            toDateObj.setHours(23, 59, 59, 999);
            if (transDate > toDateObj) return;
          }
        }

        // Map transaction type to frontend format
        let transactionType = "CashBack";
        if (transaction.type === "addition") {
          if (
            transaction.description?.includes("Admin") ||
            transaction.description?.includes("admin")
          ) {
            transactionType = "Add Fund By Admin";
          } else {
            transactionType = "Add Fund";
          }
        } else if (transaction.type === "deduction") {
          transactionType = "Order Payment";
        } else if (transaction.type === "refund") {
          transactionType = "Refund";
        }

        // Get reference
        let reference = "N/A";
        if (transaction.orderId) {
          reference = transaction.orderId.toString();
        } else if (transaction.paymentGateway) {
          reference = transaction.paymentGateway;
        } else if (transaction.description) {
          reference = transaction.description;
        }

        allTransactions.push({
          _id: transaction._id,
          transactionId: transaction._id.toString(),
          customer: wallet.userId.name || "Unknown",
          customerId: wallet.userId._id.toString(),
          credit:
            transaction.type === "addition" || transaction.type === "refund"
              ? transaction.amount
              : 0,
          debit: transaction.type === "deduction" ? transaction.amount : 0,
          balance: balance,
          transactionType: transactionType,
          reference: reference,
          createdAt: transaction.createdAt,
          status: transaction.status,
          type: transaction.type,
        });
      });
    });

    // Filter by transaction type (Credit/Debit)
    if (all && all !== "All") {
      if (all === "Credit") {
        allTransactions = allTransactions.filter((t) => t.credit > 0);
      } else if (all === "Debit") {
        allTransactions = allTransactions.filter((t) => t.debit > 0);
      }
    }

    // Filter by customer
    if (customer && customer !== "Select Customer") {
      allTransactions = allTransactions.filter((t) =>
        t.customer.toLowerCase().includes(customer.toLowerCase()),
      );
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allTransactions = allTransactions.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(searchLower) ||
          t.customer.toLowerCase().includes(searchLower) ||
          t.reference.toLowerCase().includes(searchLower),
      );
    }

    // Sort by date (newest first)
    allTransactions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    // Format currency
    const formatCurrency = (amount) => {
      return `₹${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Format date
    const formatDate = (date) => {
      const d = new Date(date);
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
    };

    // Transform transactions for frontend
    const transformedTransactions = allTransactions.map(
      (transaction, index) => ({
        sl: index + 1,
        transactionId: transaction.transactionId,
        customer: transaction.customer,
        credit: formatCurrency(transaction.credit),
        debit: formatCurrency(transaction.debit),
        balance: formatCurrency(transaction.balance),
        transactionType: transaction.transactionType,
        reference: transaction.reference,
        createdAt: formatDate(transaction.createdAt),
      }),
    );

    // Calculate summary statistics
    const totalDebit = allTransactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = allTransactions.reduce((sum, t) => sum + t.credit, 0);
    const totalBalance = totalCredit - totalDebit;

    // Get unique customers for dropdown
    const uniqueCustomers = [
      ...new Set(allTransactions.map((t) => t.customer)),
    ].sort();

    return successResponse(
      res,
      200,
      "Customer wallet report retrieved successfully",
      {
        transactions: transformedTransactions,
        stats: {
          debit: formatCurrency(totalDebit),
          credit: formatCurrency(totalCredit),
          balance: formatCurrency(totalBalance),
        },
        customers: uniqueCustomers,
        pagination: {
          page: 1,
          limit: 10000,
          total: transformedTransactions.length,
          pages: 1,
        },
      },
    );
  } catch (error) {
    console.error("❌ Error fetching customer wallet report:", error);
    console.error("Error stack:", error.stack);
    return errorResponse(
      res,
      500,
      error.message || "Failed to fetch customer wallet report",
    );
  }
});
