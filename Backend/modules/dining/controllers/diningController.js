import DiningRestaurant from "../models/DiningRestaurant.js";
import DiningCategory from "../models/DiningCategory.js";
import DiningLimelight from "../models/DiningLimelight.js";
import DiningBankOffer from "../models/DiningBankOffer.js";
import DiningMustTry from "../models/DiningMustTry.js";
import DiningOfferBanner from "../models/DiningOfferBanner.js";
import DiningStory from "../models/DiningStory.js";
import TableBooking from "../models/TableBooking.js";
import DiningReview from "../models/DiningReview.js";
import DiningCoupon from "../models/DiningCoupon.js";
import mongoose from "mongoose";
import Restaurant from "../../restaurant/models/Restaurant.js";
import RestaurantDiningOffer from "../../restaurant/models/RestaurantDiningOffer.js";
import RestaurantWallet from "../../restaurant/models/RestaurantWallet.js";
import emailService from "../../auth/services/emailService.js";
import { sendPushNotificationToUser } from "../../../shared/services/fcmPushService.js";
import {
  createOrder as createRazorpayOrder,
  verifyPayment as verifyRazorpayPayment,
} from "../../payment/services/razorpayService.js";
import { getRazorpayCredentials } from "../../../shared/utils/envService.js";

// Get all dining restaurants (with filtering)
export const getRestaurants = async (req, res) => {
  try {
    const { city } = req.query;
    let query = {};

    // Simple filter support
    if (city) {
      query.location = { $regex: city, $options: "i" };
    }

    const restaurants = await DiningRestaurant.find(query);
    res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get single restaurant by slug
export const getRestaurantBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    const oid =
      typeof slug === "string" && /^[0-9a-fA-F]{24}$/.test(slug)
        ? new mongoose.Types.ObjectId(slug)
        : null;

    // Menus/inventory always hang off Restaurant, not DiningRestaurant
    const menuRestaurant = await Restaurant.findOne({
      $or: [
        { slug },
        ...(oid ? [{ _id: oid }] : []),
      ],
    })
      .select("_id")
      .lean();

    // Prefer Restaurant for profile (richer delivery fields); else dining-only row
    let entity = await Restaurant.findOne({ slug }).lean();
    if (!entity && oid) {
      entity = await Restaurant.findById(oid).lean();
    }
    if (!entity) {
      entity = await DiningRestaurant.findOne({ slug }).lean();
    }
    if (!entity && oid) {
      entity = await DiningRestaurant.findById(oid).lean();
    }

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    const data = { ...entity };
    if (menuRestaurant?._id) {
      data.menuRestaurantId = String(menuRestaurant._id);
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get dining categories
export const getCategories = async (req, res) => {
  try {
    const categories = await DiningCategory.find({ isActive: true }).sort({
      order: 1,
    });
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get limelight features
export const getLimelight = async (req, res) => {
  try {
    const limelights = await DiningLimelight.find({ isActive: true }).sort({
      order: 1,
    });
    res.status(200).json({
      success: true,
      count: limelights.length,
      data: limelights,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get bank offers
export const getBankOffers = async (req, res) => {
  try {
    const offers = await DiningBankOffer.find({ isActive: true });
    res.status(200).json({
      success: true,
      count: offers.length,
      data: offers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get must tries
export const getMustTries = async (req, res) => {
  try {
    const mustTries = await DiningMustTry.find({ isActive: true }).sort({
      order: 1,
    });
    res.status(200).json({
      success: true,
      count: mustTries.length,
      data: mustTries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get offer banners
export const getOfferBanners = async (req, res) => {
  try {
    const banners = await DiningOfferBanner.find({ isActive: true })
      .populate("restaurant", "name slug")
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get dining stories
export const getStories = async (req, res) => {
  try {
    const stories = await DiningStory.find({ isActive: true }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      success: true,
      count: stories.length,
      data: stories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Create a new table booking
export const createBooking = async (req, res) => {
  try {
    const { restaurant, guests, date, timeSlot, specialRequest } = req.body;
    const userId = req.user._id;

    // If the booking is for a Restaurant row, respect its table-booking approval mode.
    // For legacy DiningRestaurant IDs (no Restaurant row), default to auto-confirmed.
    let initialStatus = "confirmed";
    try {
      const restaurantDoc = await Restaurant.findById(restaurant)
        .select("diningConfig.tableBooking.approvalMode")
        .lean();
      const approvalMode =
        restaurantDoc?.diningConfig?.tableBooking?.approvalMode || "auto";
      initialStatus = approvalMode === "manual" ? "pending" : "confirmed";
    } catch {
      // ignore and keep default
    }

    const booking = await TableBooking.create({
      restaurant,
      user: userId,
      guests,
      date,
      timeSlot,
      specialRequest,
      status: initialStatus,
    });

    // Populate restaurant data for the success page
    let populatedBooking = await TableBooking.findById(booking._id).populate(
      "restaurant",
      "name location image",
    );
    let bookingObj = populatedBooking.toObject();

    // Check if restaurant population failed (might be in DiningRestaurant collection)
    if (!bookingObj.restaurant || typeof bookingObj.restaurant === "string") {
      const diningRes = await DiningRestaurant.findById(
        booking.restaurant,
      ).select("name location image");
      if (diningRes) {
        bookingObj.restaurant = diningRes;
      }
    }

    res.status(201).json({
      success: true,
      message:
        bookingObj.status === "pending"
          ? "Booking request submitted successfully"
          : "Booking confirmed successfully",
      data: bookingObj,
    });

    // Send confirmation email asynchronously if user has email
    if (req.user.email) {
      emailService
        .sendBookingConfirmation(req.user.email, bookingObj)
        .catch((err) => {
          console.error("Failed to send booking confirmation email:", err);
        });
    }

    // Send booking notification to the user (best-effort, async)
    try {
      const restaurantName =
        bookingObj?.restaurant?.name || "restaurant";
      const bookingIdText = bookingObj?.bookingId || "";
      const statusText =
        bookingObj?.status === "pending" ? "pending approval" : "confirmed";

      sendPushNotificationToUser(userId, {
        title: "Table booking created",
        description: `Your booking at ${restaurantName} is ${statusText}${bookingIdText ? ` (ID: ${bookingIdText})` : ""}.`,
        link: "/bookings",
      }).catch(() => {});
    } catch {
      // ignore
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
};

// Get current user's bookings
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await TableBooking.find({ user: req.user._id })
      .populate("restaurant", "name location image")
      .sort({ createdAt: -1 });

    // Manually handle population if the restaurant wasn't found in "Restaurant" collection
    // (it might be in "DiningRestaurant" collection)
    const processedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const bookingObj = booking.toObject();

        if (
          !bookingObj.restaurant ||
          typeof bookingObj.restaurant === "string"
        ) {
          // Try finding in DiningRestaurant
          const diningRes = await DiningRestaurant.findById(
            booking.restaurant,
          ).select("name location image");
          if (diningRes) {
            bookingObj.restaurant = diningRes;
          }
        }
        return bookingObj;
      }),
    );

    res.status(200).json({
      success: true,
      count: processedBookings.length,
      data: processedBookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};

// Get bookings for a specific restaurant (for owners)
export const getRestaurantBookings = async (req, res) => {
  try {
    const restaurantId = req.restaurant ? req.restaurant._id : req.params.restaurantId;
    if (req.restaurant && req.params.restaurantId && req.params.restaurantId !== restaurantId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to view this restaurant's bookings" });
    }

    const bookings = await TableBooking.find({ restaurant: restaurantId })
      .populate("user", "name phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch restaurant bookings",
      error: error.message,
    });
  }
};

// Update booking status (for restaurant owners)
export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    const booking = await TableBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const isUserActor = !!req.user;
    const isRestaurantActor = !!req.restaurant;

    if (!isUserActor && !isRestaurantActor) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (isUserActor) {
      const actorUserId = req.user?._id || req.user?.id;
      if (!actorUserId || booking.user.toString() !== actorUserId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Not authorized for this booking",
        });
      }
      // Customers can only cancel their own booking.
      if (status !== "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Customers can only cancel a booking",
        });
      }
      if (["checked-in", "completed", "dining_completed"].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: "Booking cannot be cancelled at this stage",
        });
      }
    }

    if (isRestaurantActor) {
      const actorRestaurantId = req.restaurant?._id || req.restaurant?.id;
      if (!actorRestaurantId || booking.restaurant.toString() !== actorRestaurantId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Not authorized for this booking",
        });
      }

      const allowed = new Set([
        "confirmed",
        "rejected",
        "cancelled",
        "checked-in",
        "completed",
        "dining_completed",
      ]);
      if (!allowed.has(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status for restaurant action",
        });
      }

      // Don't allow reject/cancel once billing/payment has progressed.
      if (
        (status === "rejected" || status === "cancelled") &&
        (booking.paymentStatus === "paid" || booking.billStatus === "completed")
      ) {
        return res.status(400).json({
          success: false,
          message: "Booking cannot be cancelled/rejected after payment",
        });
      }
    }

    const updateData = { status };
    if (status === "checked-in") {
      updateData.checkInTime = new Date();
    } else if (status === "completed" || status === "dining_completed") {
      updateData.checkOutTime = new Date();
    }

    booking.set(updateData);
    await booking.save();

    res.status(200).json({
      success: true,
      message: `Booking status updated to ${status}`,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    });
  }
};

// Create a review for a completed booking
export const createDiningReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const userId = req.user._id;

    const booking = await TableBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to review this booking",
      });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "You can only review completed bookings",
      });
    }

    const review = await DiningReview.create({
      booking: bookingId,
      user: userId,
      restaurant: booking.restaurant,
      rating,
      comment,
    });

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create review",
      error: error.message,
    });
  }
};

/**
 * Send bill for a table booking (restaurant only).
 * Allowed only when status = dining_completed and bill not yet sent/paid.
 */
export const sendBill = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { billAmount, note } = req.body;
    const restaurantId = req.restaurant._id;

    if (!billAmount || typeof billAmount !== "number" || billAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid bill amount is required",
      });
    }

    const booking = await TableBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.restaurant.toString() !== restaurantId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized for this booking" });
    }
    if (booking.status !== "dining_completed") {
      return res.status(400).json({
        success: false,
        message: "Bill can only be sent when booking status is Dining Completed",
      });
    }
    if (booking.billStatus !== "not_sent") {
      return res.status(400).json({
        success: false,
        message: booking.paymentStatus === "paid" ? "Bill already paid" : "Bill already sent",
      });
    }

    booking.billAmount = billAmount;
    booking.discountAmount = 0;
    booking.finalAmount = billAmount;
    booking.billStatus = "pending";
    booking.billSentAt = new Date();
    if (note != null) booking.billNote = String(note).trim();
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Bill sent successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to send bill",
      error: error.message,
    });
  }
};

/**
 * Apply coupon to a pending dining bill (user).
 */
export const applyCoupon = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { code } = req.body;
    const userId = req.user._id || req.user.id;

    if (!code || !String(code).trim()) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const booking = await TableBooking.findById(bookingId).populate("appliedCoupon");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized for this booking" });
    }
    if (booking.billStatus !== "pending" || booking.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Coupon can only be applied to a pending, unpaid bill",
      });
    }

    const coupon = await DiningCoupon.findOne({ code: String(code).trim().toUpperCase() });
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid coupon code" });
    }
    if (!coupon.isActive) {
      return res.status(400).json({ success: false, message: "This coupon is not active" });
    }
    if (coupon.expiryDate < new Date()) {
      return res.status(400).json({ success: false, message: "This coupon has expired" });
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
    }
    if (booking.billAmount < (coupon.minBillAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: `Minimum bill amount for this coupon is ₹${coupon.minBillAmount}`,
      });
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = (booking.billAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscount != null && coupon.maxDiscount > 0) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = Math.min(coupon.discountValue, booking.billAmount);
    }
    const finalAmount = Math.max(0, booking.billAmount - discount);

    const wasAlreadyApplied = booking.appliedCoupon && booking.appliedCoupon.toString() === coupon._id.toString();
    booking.appliedCoupon = coupon._id;
    booking.discountAmount = discount;
    booking.finalAmount = finalAmount;
    await booking.save();

    if (!wasAlreadyApplied) {
      coupon.usedCount += 1;
      await coupon.save();
    }

    res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        discountAmount: discount,
        finalAmount,
        billAmount: booking.billAmount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to apply coupon",
      error: error.message,
    });
  }
};

/**
 * Create Razorpay order for dining bill payment (user).
 */
export const createDiningPaymentOrder = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user._id || req.user.id;

    const booking = await TableBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized for this booking" });
    }
    if (booking.billStatus !== "pending" || booking.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "No pending bill to pay for this booking",
      });
    }
    const amountToPay = booking.finalAmount;
    if (!amountToPay || amountToPay <= 0) {
      return res.status(400).json({ success: false, message: "Invalid payable amount" });
    }

    const amountInPaise = Math.round(amountToPay * 100);
    // Razorpay receipt must be <= 40 characters. Use a compact, deterministic format.
    let receipt = `dining_${booking._id.toString().slice(-8)}_${Date.now()
      .toString()
      .slice(-6)}`;
    if (receipt.length > 40) {
      receipt = receipt.slice(0, 40);
    }
    const razorpayOrder = await createRazorpayOrder({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: { bookingId: booking._id.toString(), type: "dining" },
    });

    booking.razorpayOrderId = razorpayOrder.id;
    await booking.save();

    const credentials = await getRazorpayCredentials();
    const keyId = credentials?.keyId || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY;

    res.status(200).json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: amountInPaise,
        currency: "INR",
        key_id: keyId,
        finalAmount: amountToPay,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

/**
 * Verify dining payment and update booking + commission (user).
 */
export const verifyDiningPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user._id || req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification details are required",
      });
    }

    const booking = await TableBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized for this booking" });
    }
    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Bill already paid" });
    }
    if (booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Payment order mismatch" });
    }

    const isValid = await verifyRazorpayPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    const restaurant = await Restaurant.findById(booking.restaurant)
      .select("diningCommissionPercentage")
      .lean();
    const commissionPercentage = restaurant?.diningCommissionPercentage ?? 0;
    const finalAmount = booking.finalAmount;
    const commissionAmount = (finalAmount * commissionPercentage) / 100;
    const restaurantEarning = finalAmount - commissionAmount;
    const adminEarning = commissionAmount;

    booking.paymentStatus = "paid";
    booking.billStatus = "completed";
    booking.paidAt = new Date();
    booking.razorpayOrderId = undefined;
    booking.commissionAmount = commissionAmount;
    booking.restaurantEarning = restaurantEarning;
    booking.adminEarning = adminEarning;
    await booking.save();

    // Credit restaurant wallet with dining earning so it can be withdrawn
    const wallet = await RestaurantWallet.findOrCreateByRestaurantId(booking.restaurant);
    wallet.addTransaction({
      amount: restaurantEarning,
      type: "payment",
      status: "Completed",
      description: `Dining bill #${booking.bookingId || booking._id}`,
    });
    await wallet.save();

    res.status(200).json({
      success: true,
      message: "Payment successful",
      data: {
        paymentStatus: "paid",
        paidAt: booking.paidAt,
        finalAmount,
        commissionAmount,
        restaurantEarning,
        adminEarning,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};

/**
 * Get dining offers (pre-book & walk-in) for a restaurant by slug (public)
 * GET /dining/restaurants/:slug/offers
 */
export const getDiningOffersBySlug = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: req.params.slug })
      .select("_id")
      .lean();
    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }
    const offers = await RestaurantDiningOffer.find({
      restaurant: restaurant._id,
      isActive: true,
    })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: offers });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};
