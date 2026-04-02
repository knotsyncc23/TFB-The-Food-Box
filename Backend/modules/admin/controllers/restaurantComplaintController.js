import RestaurantComplaint from '../models/RestaurantComplaint.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';

/**
 * Get all restaurant complaints
 * GET /api/admin/restaurant-complaints
 */
export const getAllComplaints = asyncHandler(async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      complaintType, 
      restaurantId,
      fromDate,
      toDate,
      search
    } = req.query;

    const query = {};
    const normalizedSearch = typeof search === 'string'
      ? search.replace(/\s+/g, '').trim()
      : '';

    // Status filter
    if (status) {
      query.status = status;
    }

    // Complaint type filter
    if (complaintType) {
      query.complaintType = complaintType;
    }

    // Restaurant filter
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Search filter
    if (normalizedSearch) {
      query.$or = [
        { orderNumber: { $regex: normalizedSearch, $options: 'i' } },
        { customerName: { $regex: normalizedSearch, $options: 'i' } },
        { customerPhone: { $regex: normalizedSearch, $options: 'i' } },
        { restaurantName: { $regex: normalizedSearch, $options: 'i' } },
        { subject: { $regex: normalizedSearch, $options: 'i' } },
        { description: { $regex: normalizedSearch, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const complaints = await RestaurantComplaint.find(query)
      .populate('orderId', 'orderId orderNumber status createdAt')
      .populate('customerId', 'name phone email')
      .populate('restaurantId', 'name restaurantId')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await RestaurantComplaint.countDocuments(query);

    // Get summary statistics
    const stats = await RestaurantComplaint.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {};
    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    return successResponse(res, 200, 'Complaints retrieved successfully', {
      complaints,
      stats: {
        total: total,
        pending: statusCounts.pending || 0,
        in_progress: statusCounts.in_progress || 0,
        resolved: statusCounts.resolved || 0,
        rejected: statusCounts.rejected || 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    return errorResponse(res, 500, 'Failed to fetch complaints');
  }
});

/**
 * Get complaint details
 * GET /api/admin/restaurant-complaints/:id
 */
export const getComplaintDetails = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await RestaurantComplaint.findById(id)
      .populate('orderId')
      .populate('customerId', 'name phone email')
      .populate('restaurantId', 'name restaurantId profileImage')
      .populate('resolvedBy', 'name email')
      .lean();

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    return successResponse(res, 200, 'Complaint retrieved successfully', {
      complaint
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    return errorResponse(res, 500, 'Failed to fetch complaint details');
  }
});

/**
 * Update complaint status
 * PUT /api/admin/restaurant-complaints/:id/status
 */
export const updateComplaintStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse, internalNotes } = req.body;
    const adminId = req.user?._id;

    const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse(res, 400, 'Valid status is required');
    }

    const complaint = await RestaurantComplaint.findById(id);

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    // Update status
    complaint.status = status;

    // Update admin response if provided (safe for null/non-string)
    if (adminResponse != null && typeof adminResponse === 'string') {
      complaint.adminResponse = adminResponse.trim();
      complaint.adminRespondedAt = new Date();
    }

    // Update internal notes if provided (avoid null.trim() / non-string.trim())
    if (internalNotes !== undefined) {
      complaint.internalNotes = (internalNotes == null || typeof internalNotes !== 'string')
        ? ''
        : internalNotes.trim();
    }

    // If resolved, set resolved date and admin
    if (status === 'resolved') {
      complaint.resolvedAt = new Date();
      if (adminId) complaint.resolvedBy = adminId;
    }

    await complaint.save();

    return successResponse(res, 200, 'Complaint status updated successfully', {
      complaint: {
        id: complaint._id,
        status: complaint.status,
        adminResponse: complaint.adminResponse,
        adminRespondedAt: complaint.adminRespondedAt,
        resolvedAt: complaint.resolvedAt
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return errorResponse(res, 400, 'Invalid complaint id');
    }
    console.error('Error updating complaint status:', error);
    return errorResponse(res, 500, 'Failed to update complaint status');
  }
});

/**
 * Add internal notes
 * PUT /api/admin/restaurant-complaints/:id/notes
 */
export const updateInternalNotes = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { internalNotes } = req.body;

    const complaint = await RestaurantComplaint.findById(id);

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    complaint.internalNotes = internalNotes ? internalNotes.trim() : '';
    await complaint.save();

    return successResponse(res, 200, 'Internal notes updated successfully', {
      complaint: {
        id: complaint._id,
        internalNotes: complaint.internalNotes
      }
    });
  } catch (error) {
    console.error('Error updating internal notes:', error);
    return errorResponse(res, 500, 'Failed to update internal notes');
  }
});
