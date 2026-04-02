import DiningCoupon from "../../dining/models/DiningCoupon.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";

/**
 * List dining coupons (admin)
 * GET /api/admin/dining-coupons
 */
export const getDiningCoupons = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isActive, search } = req.query;
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, Math.min(100, parseInt(limit, 10)));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));

  const query = {};
  const normalizedSearch = typeof search === "string"
    ? search.replace(/\s+/g, "").trim()
    : "";
  if (isActive !== undefined && isActive !== "") {
    query.isActive = isActive === "true" || isActive === true;
  }
  if (normalizedSearch) {
    query.code = { $regex: normalizedSearch, $options: "i" };
  }

  const [list, total] = await Promise.all([
    DiningCoupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    DiningCoupon.countDocuments(query),
  ]);

  return successResponse(res, 200, "Dining coupons fetched", {
    data: list,
    pagination: {
      page: Math.max(1, parseInt(page, 10)),
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  });
});

/**
 * Get single dining coupon (admin)
 * GET /api/admin/dining-coupons/:id
 */
export const getDiningCouponById = asyncHandler(async (req, res) => {
  const coupon = await DiningCoupon.findById(req.params.id).lean();
  if (!coupon) {
    return errorResponse(res, 404, "Coupon not found");
  }
  return successResponse(res, 200, "Coupon fetched", { data: coupon });
});

/**
 * Create dining coupon (admin)
 * POST /api/admin/dining-coupons
 */
export const createDiningCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    discountType,
    discountValue,
    maxDiscount,
    minBillAmount,
    expiryDate,
    isActive = true,
    usageLimit,
  } = req.body;

  if (!code || !String(code).trim()) {
    return errorResponse(res, 400, "Coupon code is required");
  }
  if (!discountType || !["percentage", "flat"].includes(discountType)) {
    return errorResponse(res, 400, "discountType must be 'percentage' or 'flat'");
  }
  if (typeof discountValue !== "number" || discountValue < 0) {
    return errorResponse(res, 400, "Valid discountValue is required");
  }
  if (!expiryDate) {
    return errorResponse(res, 400, "expiryDate is required");
  }

  const normalizedCode = String(code).trim().toUpperCase();
  const existing = await DiningCoupon.findOne({ code: normalizedCode });
  if (existing) {
    return errorResponse(res, 400, "A coupon with this code already exists");
  }

  const coupon = await DiningCoupon.create({
    code: normalizedCode,
    discountType,
    discountValue,
    maxDiscount: maxDiscount != null ? Number(maxDiscount) : null,
    minBillAmount: minBillAmount != null ? Number(minBillAmount) : 0,
    expiryDate: new Date(expiryDate),
    isActive: isActive !== false,
    usageLimit: usageLimit != null ? parseInt(usageLimit, 10) : null,
  });

  return successResponse(res, 201, "Dining coupon created", { data: coupon });
});

/**
 * Update dining coupon (admin)
 * PUT /api/admin/dining-coupons/:id
 */
export const updateDiningCoupon = asyncHandler(async (req, res) => {
  const coupon = await DiningCoupon.findById(req.params.id);
  if (!coupon) {
    return errorResponse(res, 404, "Coupon not found");
  }

  const {
    code,
    discountType,
    discountValue,
    maxDiscount,
    minBillAmount,
    expiryDate,
    isActive,
    usageLimit,
  } = req.body;

  if (code != null && String(code).trim()) {
    const normalized = String(code).trim().toUpperCase();
    if (normalized !== coupon.code) {
      const existing = await DiningCoupon.findOne({ code: normalized });
      if (existing) {
        return errorResponse(res, 400, "A coupon with this code already exists");
      }
      coupon.code = normalized;
    }
  }
  if (discountType != null) {
    if (!["percentage", "flat"].includes(discountType)) {
      return errorResponse(res, 400, "discountType must be 'percentage' or 'flat'");
    }
    coupon.discountType = discountType;
  }
  if (typeof discountValue === "number" && discountValue >= 0) {
    coupon.discountValue = discountValue;
  }
  if (maxDiscount !== undefined) {
    coupon.maxDiscount = maxDiscount == null ? null : Number(maxDiscount);
  }
  if (minBillAmount !== undefined) {
    coupon.minBillAmount = Number(minBillAmount) || 0;
  }
  if (expiryDate != null) {
    coupon.expiryDate = new Date(expiryDate);
  }
  if (typeof isActive === "boolean") {
    coupon.isActive = isActive;
  }
  if (usageLimit !== undefined) {
    coupon.usageLimit = usageLimit == null ? null : parseInt(usageLimit, 10);
  }

  await coupon.save();
  return successResponse(res, 200, "Dining coupon updated", { data: coupon });
});

/**
 * Delete dining coupon (admin)
 * DELETE /api/admin/dining-coupons/:id
 */
export const deleteDiningCoupon = asyncHandler(async (req, res) => {
  const coupon = await DiningCoupon.findByIdAndDelete(req.params.id);
  if (!coupon) {
    return errorResponse(res, 404, "Coupon not found");
  }
  return successResponse(res, 200, "Dining coupon deleted");
});

/**
 * Toggle dining coupon active status (admin)
 * PATCH /api/admin/dining-coupons/:id/status
 */
export const toggleDiningCouponStatus = asyncHandler(async (req, res) => {
  const coupon = await DiningCoupon.findById(req.params.id);
  if (!coupon) {
    return errorResponse(res, 404, "Coupon not found");
  }
  coupon.isActive = !coupon.isActive;
  await coupon.save();
  return successResponse(res, 200, "Coupon status updated", {
    data: { isActive: coupon.isActive },
  });
});
