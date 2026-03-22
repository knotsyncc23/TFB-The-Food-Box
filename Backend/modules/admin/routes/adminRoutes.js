import express from "express";
import {
  getAllWithdrawalRequests,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
} from "../../restaurant/controllers/withdrawalController.js";
import { updateDiningSeating } from "../../restaurant/controllers/diningManagementController.js";
import {
  getDashboardStats,
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  getUsers,
  getUserById,
  updateUserStatus,
  getRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  updateRestaurantStatus,
  getRestaurantJoinRequests,
  approveRestaurant,
  rejectRestaurant,
  reverifyRestaurant,
  deleteRestaurant,
  updateRestaurantDiningSettings,
  updateRestaurantDiningCommission,
  getAllOffers,
  getRestaurantAnalytics,
  getCustomerWalletReport,
} from "../controllers/adminController.js";
import {
  getBusinessSettings,
  updateBusinessSettings,
} from "../controllers/businessSettingsController.js";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  updateCategoryPriority,
} from "../controllers/categoryController.js";
import {
  getJoinRequests,
  getDeliveryPartnerById,
  approveDeliveryPartner,
  rejectDeliveryPartner,
  getDeliveryPartners,
  createDeliveryPartner,
  updateDeliveryPartnerStatus,
  deleteDeliveryPartner,
  reverifyDeliveryPartner,
} from "../controllers/deliveryPartnerController.js";
import { getDeliveryEarnings } from "../controllers/deliveryEarningsController.js";
import {
  addBonus,
  getBonusTransactions,
} from "../controllers/deliveryBonusController.js";
import {
  createEarningAddon,
  getEarningAddons,
  getEarningAddonById,
  updateEarningAddon,
  deleteEarningAddon,
  toggleEarningAddonStatus,
  checkEarningAddonCompletions,
} from "../controllers/earningAddonController.js";
import {
  getEarningAddonHistory,
  getEarningAddonHistoryById,
  creditEarningToWallet,
  cancelEarningAddonHistory,
  getEarningAddonHistoryStatistics,
} from "../controllers/earningAddonHistoryController.js";
import {
  getEnvVariables,
  saveEnvVariables,
} from "../controllers/envVariablesController.js";
import {
  getCommissionRules,
  getCommissionRuleById,
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
  toggleCommissionRuleStatus,
  calculateCommission,
} from "../controllers/deliveryBoyCommissionController.js";
import {
  getDeliveryCashLimit,
  updateDeliveryCashLimit,
} from "../controllers/deliveryCashLimitController.js";
import { getCashLimitSettlements } from "../controllers/cashLimitSettlementController.js";
import {
  getDeliveryWithdrawalRequests,
  approveDeliveryWithdrawal,
  rejectDeliveryWithdrawal,
} from "../controllers/deliveryWithdrawalController.js";
import {
  getDeliveryBoyWallets,
  addWalletAdjustment,
} from "../controllers/deliveryBoyWalletController.js";
import {
  getEmergencyHelp,
  getEmergencyHelpPublic,
  createOrUpdateEmergencyHelp,
  toggleEmergencyHelpStatus,
} from "../controllers/deliveryEmergencyHelpController.js";
import {
  getAllTickets,
  getTicketByIdAdmin,
  updateTicket,
  getTicketStats,
} from "../controllers/deliverySupportTicketController.js";
import {
  getRestaurantCommissions,
  getApprovedRestaurants,
  getRestaurantCommissionById,
  getCommissionByRestaurantId,
  createRestaurantCommission,
  updateRestaurantCommission,
  deleteRestaurantCommission,
  toggleRestaurantCommissionStatus,
  calculateCommission as calculateRestaurantCommission,
} from "../controllers/restaurantCommissionController.js";
import {
  getPendingFoodApprovals,
  approveFoodItem,
  rejectFoodItem,
} from "../controllers/foodApprovalController.js";
import {
  getAllComplaints,
  getComplaintDetails,
  updateComplaintStatus,
  updateInternalNotes,
} from "../controllers/restaurantComplaintController.js";
import {
  getOrderSettlementDetails,
  getRestaurantSettlements,
  getDeliverySettlements,
  getRestaurantSettlementReport,
  getDeliverySettlementReport,
  markSettlementsProcessed,
  getAdminWalletSummary,
  getSettlementStatistics,
} from "../controllers/settlementController.js";
import {
  getAuditLogs,
  getAuditLogById,
  getEntityAuditLogs,
  getCommissionChangeLogs,
} from "../controllers/auditLogController.js";
import {
  sendPushNotificationAdmin,
  listPushNotificationsAdmin,
} from "../controllers/pushNotificationController.js";
import { getAbout, updateAbout } from "../controllers/aboutController.js";
import {
  getTerms,
  updateTerms,
} from "../controllers/termsAndConditionController.js";
import {
  getPrivacy,
  updatePrivacy,
} from "../controllers/privacyPolicyController.js";
import {
  getContactUs,
  updateContactUs,
} from "../controllers/contactUsController.js";
import {
  getRefund,
  updateRefund,
} from "../controllers/refundPolicyController.js";
import {
  getShipping,
  updateShipping,
} from "../controllers/shippingPolicyController.js";
import {
  getCancellation,
  updateCancellation,
} from "../controllers/cancellationPolicyController.js";
import {
  getAllFeedbacks,
  getFeedbackById,
  updateFeedbackStatus,
  replyToFeedback,
  deleteFeedback,
} from "../controllers/feedbackController.js";
import {
  createFeedbackExperience,
  getFeedbackExperiences,
  getFeedbackExperienceById,
  deleteFeedbackExperience,
} from "../controllers/feedbackExperienceController.js";
import {
  getAllSafetyEmergencies,
  getSafetyEmergencyById,
  updateSafetyEmergencyStatus,
  updateSafetyEmergencyPriority,
  respondToSafetyEmergency,
  deleteSafetyEmergency,
} from "../controllers/safetyEmergencyController.js";
import {
  getOrders,
  getOrderById,
  markOrderReady,
  getSearchingDeliverymanOrders,
  getRefundRequests,
  processRefund,
  getOngoingOrders,
  getTransactionReport,
  getRestaurantReport,
} from "../controllers/orderController.js";
import {
  getAllReviews,
  getReviewByOrderId,
  getReviewsByRestaurant,
  getDeliverymanReviews,
} from "../controllers/reviewController.js";
import {
  getFeeSettings,
  createOrUpdateFeeSettings,
  updateFeeSettings,
  getFeeSettingsHistory,
  getPublicFeeSettings,
} from "../controllers/feeSettingsController.js";
import {
  getDiningCoupons,
  getDiningCouponById,
  createDiningCoupon,
  updateDiningCoupon,
  deleteDiningCoupon,
  toggleDiningCouponStatus,
} from "../controllers/diningCouponController.js";
import { getDiningEarnings } from "../controllers/diningEarningsController.js";
import zoneRoutes from "./zoneRoutes.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import { uploadMiddleware } from "../../../shared/utils/cloudinaryService.js";

const router = express.Router();

// Debug: Log route file loading
// All admin routes require admin authentication
router.use(authenticateAdmin);

// Debug middleware - log ALL requests to help debug routing
router.use((req, res, next) => {
  if (req.path.includes("refund") || req.path.includes("orders")) {
  }
  next();
});

// Dashboard
router.get("/dashboard/stats", getDashboardStats);

// Delivery Partner global cash limit (applies to all delivery boys)
router.get("/delivery-cash-limit", getDeliveryCashLimit);
router.put("/delivery-cash-limit", updateDeliveryCashLimit);
router.get("/cash-limit-settlement", getCashLimitSettlements);

// Delivery withdrawal requests (admin)
router.get("/delivery-withdrawal/requests", getDeliveryWithdrawalRequests);
router.post("/delivery-withdrawal/:id/approve", approveDeliveryWithdrawal);
router.post("/delivery-withdrawal/:id/reject", rejectDeliveryWithdrawal);

router.get("/delivery-boy-wallet", getDeliveryBoyWallets);
router.post("/delivery-boy-wallet/adjustment", addWalletAdjustment);

// Admin Management
router.get("/admins", getAdmins);
router.get("/admins/:id", getAdminById);
router.post("/admins", createAdmin);
router.put("/admins/:id", updateAdmin);
router.delete("/admins/:id", deleteAdmin);

// Profile Management
router.get("/profile", getAdminProfile);
router.put("/profile", updateAdminProfile);

// Settings Management
router.put("/settings/change-password", changeAdminPassword);

// User Management
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id/status", updateUserStatus);
router.get("/customer-wallet-report", getCustomerWalletReport);

// Restaurant Management
router.get("/restaurants", getRestaurants);
router.get("/restaurants/requests", getRestaurantJoinRequests);
router.get("/restaurants/:id", getRestaurantById);
router.post("/restaurants", createRestaurant);
router.put("/restaurants/:id", updateRestaurant);
router.get("/restaurant-analytics/:restaurantId", getRestaurantAnalytics);
router.post("/restaurants/:id/approve", approveRestaurant);
router.post("/restaurants/:id/reject", rejectRestaurant);
router.post("/restaurants/:id/reverify", reverifyRestaurant);
router.put("/restaurants/:id/status", updateRestaurantStatus);
router.put("/restaurants/:id/dining-settings", updateRestaurantDiningSettings);
router.patch("/restaurants/:id/dining-commission", updateRestaurantDiningCommission);
router.patch("/restaurants/:id/dining-seating", updateDiningSeating);
router.delete("/restaurants/:id", deleteRestaurant);

// Dining Coupons (admin)
router.get("/dining-coupons", getDiningCoupons);
router.get("/dining-coupons/:id", getDiningCouponById);
router.post("/dining-coupons", createDiningCoupon);
router.put("/dining-coupons/:id", updateDiningCoupon);
router.delete("/dining-coupons/:id", deleteDiningCoupon);
router.patch("/dining-coupons/:id/status", toggleDiningCouponStatus);

// Dining Earnings (admin)
router.get("/dining-earnings", getDiningEarnings);

// Category Management
router.get("/categories", getCategories);
router.get("/categories/:id", getCategoryById);
router.post("/categories", uploadMiddleware.single("image"), createCategory);
router.put("/categories/:id", uploadMiddleware.single("image"), updateCategory);
router.delete("/categories/:id", deleteCategory);
router.patch("/categories/:id/status", toggleCategoryStatus);
router.patch("/categories/:id/priority", updateCategoryPriority);

// Fee Settings Management (Delivery & Platform Fee)
router.get("/fee-settings", getFeeSettings);
router.post("/fee-settings", createOrUpdateFeeSettings);
router.put("/fee-settings/:id", updateFeeSettings);
router.get("/fee-settings/history", getFeeSettingsHistory);

// Delivery Partner Management
router.get("/delivery-partners/requests", getJoinRequests);
router.get("/delivery-partners", getDeliveryPartners);
router.post("/delivery-partners", createDeliveryPartner);
router.get("/delivery-partners/earnings", getDeliveryEarnings);
router.get("/delivery-partners/reviews", getDeliverymanReviews); // Must be before /:id route
router.get("/delivery-partners/:id", getDeliveryPartnerById);
router.post("/delivery-partners/:id/approve", approveDeliveryPartner);
router.post("/delivery-partners/:id/reject", rejectDeliveryPartner);
router.post("/delivery-partners/:id/reverify", reverifyDeliveryPartner);
router.patch("/delivery-partners/:id/status", updateDeliveryPartnerStatus);
router.delete("/delivery-partners/:id", deleteDeliveryPartner);

// Delivery Partner Bonus Management
router.post("/delivery-partners/bonus", addBonus);
router.get("/delivery-partners/bonus/transactions", getBonusTransactions);

// Earning Addon Management
router.post("/earning-addon", createEarningAddon);
router.get("/earning-addon", getEarningAddons);
router.get("/earning-addon/:id", getEarningAddonById);
router.put("/earning-addon/:id", updateEarningAddon);
router.delete("/earning-addon/:id", deleteEarningAddon);
router.patch("/earning-addon/:id/status", toggleEarningAddonStatus);
router.post("/earning-addon/check-completions", checkEarningAddonCompletions);

// Earning Addon History Management
router.get("/earning-addon-history", getEarningAddonHistory);
router.get(
  "/earning-addon-history/statistics",
  getEarningAddonHistoryStatistics,
);
router.get("/earning-addon-history/:id", getEarningAddonHistoryById);
router.post("/earning-addon-history/:id/credit", creditEarningToWallet);
router.patch("/earning-addon-history/:id/cancel", cancelEarningAddonHistory);

// Push Notification
router.get("/push-notification", listPushNotificationsAdmin);
router.post("/push-notification", sendPushNotificationAdmin);

// Environment Variables Management
router.get("/env-variables", getEnvVariables);
router.post("/env-variables", saveEnvVariables);

// Delivery Boy Commission Management
router.get("/delivery-boy-commission", getCommissionRules);
router.post("/delivery-boy-commission", createCommissionRule);
router.post("/delivery-boy-commission/calculate", calculateCommission);
router.get("/delivery-boy-commission/:id", getCommissionRuleById);
router.put("/delivery-boy-commission/:id", updateCommissionRule);
router.delete("/delivery-boy-commission/:id", deleteCommissionRule);
router.patch("/delivery-boy-commission/:id/status", toggleCommissionRuleStatus);

// Delivery Emergency Help Management
router.get("/delivery-emergency-help", getEmergencyHelp);
router.post("/delivery-emergency-help", createOrUpdateEmergencyHelp);
router.patch("/delivery-emergency-help/status", toggleEmergencyHelpStatus);

// Delivery Support Tickets Management
router.get("/delivery-support-tickets", getAllTickets);
router.get("/delivery-support-tickets/stats", getTicketStats);
router.get("/delivery-support-tickets/:id", getTicketByIdAdmin);
router.put("/delivery-support-tickets/:id", updateTicket);

// Restaurant Commission Management
router.get("/restaurant-commission", getRestaurantCommissions);
router.get(
  "/restaurant-commission/approved-restaurants",
  getApprovedRestaurants,
);
router.get(
  "/restaurant-commission/restaurant/:restaurantId",
  getCommissionByRestaurantId,
);
router.post("/restaurant-commission", createRestaurantCommission);
router.post("/restaurant-commission/calculate", calculateRestaurantCommission);
router.get("/restaurant-commission/:id", getRestaurantCommissionById);
router.put("/restaurant-commission/:id", updateRestaurantCommission);
router.delete("/restaurant-commission/:id", deleteRestaurantCommission);
router.patch(
  "/restaurant-commission/:id/status",
  toggleRestaurantCommissionStatus,
);

// Restaurant Complaint Management
router.get("/restaurant-complaints", getAllComplaints);
router.get("/restaurant-complaints/:id", getComplaintDetails);
router.put("/restaurant-complaints/:id/status", updateComplaintStatus);
router.put("/restaurant-complaints/:id/notes", updateInternalNotes);

// Food Approval Management
router.get("/food-approvals", getPendingFoodApprovals);
router.post("/food-approvals/:id/approve", approveFoodItem);
router.post("/food-approvals/:id/reject", rejectFoodItem);

// Offers Management
router.get("/offers", getAllOffers);

// Zone Management
router.use("/zones", zoneRoutes);

// About Page Management
router.get("/about", getAbout);
router.put("/about", updateAbout);

// Terms and Condition Management
router.get("/terms", getTerms);
router.put("/terms", updateTerms);

// Privacy Policy Management
router.get("/privacy", getPrivacy);
router.put("/privacy", updatePrivacy);

// Contact Us (CMS)
router.get("/contact-us", getContactUs);
router.put("/contact-us", updateContactUs);

// Refund Policy Management
router.get("/refund", getRefund);
router.put("/refund", updateRefund);

// Shipping Policy Management
router.get("/shipping", getShipping);
router.put("/shipping", updateShipping);

// Cancellation Policy Management
router.get("/cancellation", getCancellation);
router.put("/cancellation", updateCancellation);

// Feedback Management
router.get("/feedback", getAllFeedbacks);
router.get("/feedback/:id", getFeedbackById);
router.put("/feedback/:id/status", updateFeedbackStatus);
router.put("/feedback/:id/reply", replyToFeedback);
router.delete("/feedback/:id", deleteFeedback);

// Feedback Experience Management
router.post("/feedback-experience", createFeedbackExperience);
router.get("/feedback-experience", getFeedbackExperiences);
router.get("/feedback-experience/:id", getFeedbackExperienceById);
router.delete("/feedback-experience/:id", deleteFeedbackExperience);

// Safety Emergency Management
router.get("/safety-emergency", getAllSafetyEmergencies);
router.get("/safety-emergency/:id", getSafetyEmergencyById);
router.put("/safety-emergency/:id/status", updateSafetyEmergencyStatus);
router.put("/safety-emergency/:id/priority", updateSafetyEmergencyPriority);
router.put("/safety-emergency/:id/respond", respondToSafetyEmergency);
router.delete("/safety-emergency/:id", deleteSafetyEmergency);

// Order Management
router.get("/orders", getOrders);
router.get("/orders/searching-deliveryman", getSearchingDeliverymanOrders);
router.get("/orders/ongoing", getOngoingOrders);
router.get("/orders/transaction-report", getTransactionReport);
router.get("/orders/restaurant-report", getRestaurantReport);

// Order Refund - MUST be before /orders/:id to avoid route conflicts
// Using explicit pattern /orders/refund/:orderId
router.post("/orders/refund/:orderId", async (req, res, next) => {
  // Call processRefund - it's already wrapped with asyncHandler
  return processRefund(req, res, next);
});
// Refund Requests - MUST be registered before any catch-all routes
// Register POST route FIRST (more specific) before GET route
// Register the refund route handler directly
router.post("/refund-requests/:orderId/process", async (req, res, next) => {
  // Ensure orderId is passed correctly
  if (!req.params.orderId) {
    console.error("❌ [ROUTE] orderId parameter is missing!");
    return res.status(400).json({
      success: false,
      message: "Order ID is required",
    });
  }

  // Call processRefund - it's already wrapped with asyncHandler
  return processRefund(req, res, next);
});

router.get("/refund-requests", getRefundRequests);
// Review Management
router.get("/reviews", getAllReviews);
router.get("/reviews/:orderId", getReviewByOrderId);
router.get("/reviews/restaurant/:restaurantId", getReviewsByRestaurant);

// Mark order as ready (admin) – must be before /orders/:id
router.patch("/orders/:id/mark-ready", markOrderReady);

// Get order by ID (must be last to avoid matching other routes)
router.get("/orders/:id", getOrderById);

// Business Settings Management
router.get("/business-settings", getBusinessSettings);
router.put(
  "/business-settings",
  uploadMiddleware.fields([
    { name: "logo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  updateBusinessSettings,
);

// Settlement Routes
router.get("/settlements/order/:orderId", getOrderSettlementDetails);
router.get("/settlements/restaurants", getRestaurantSettlements);
router.get("/settlements/delivery", getDeliverySettlements);
router.get(
  "/settlements/restaurants/:restaurantId/report",
  getRestaurantSettlementReport,
);
router.get(
  "/settlements/delivery/:deliveryId/report",
  getDeliverySettlementReport,
);
router.post("/settlements/mark-processed", markSettlementsProcessed);
router.get("/settlements/admin-wallet", getAdminWalletSummary);
router.get("/settlements/statistics", getSettlementStatistics);

// Audit Log Routes
router.get("/audit-logs", getAuditLogs);
router.get("/audit-logs/:id", getAuditLogById);
router.get("/audit-logs/entity/:entityType/:entityId", getEntityAuditLogs);
router.get("/audit-logs/commission-changes", getCommissionChangeLogs);

// Withdrawal Request Routes (Admin)
router.get("/withdrawal/requests", getAllWithdrawalRequests);
router.post("/withdrawal/:id/approve", approveWithdrawalRequest);
router.post("/withdrawal/:id/reject", rejectWithdrawalRequest);

export default router;
