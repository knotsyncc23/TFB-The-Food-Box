import SafetyEmergency from '../models/SafetyEmergency.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';

/**
 * Create Safety Emergency Report (Public - User)
 * POST /api/safety-emergency
 */
export const createSafetyEmergency = asyncHandler(async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return errorResponse(res, 400, 'Safety emergency message is required');
    }

    // Get user info from request (user is authenticated via middleware)
    const userId = req.user._id;
    const userName = req.user.name || req.user.firstName || req.user.email?.split('@')[0] || 'User';
    const userEmail = req.user.email || '';
    const userPhone = req.user.phone || '';

    // Auto-detect priority based on keywords
    const messageLower = message.toLowerCase();
    let priority = 'medium';
    if (messageLower.includes('urgent') || messageLower.includes('critical') || messageLower.includes('emergency') || messageLower.includes('immediate')) {
      priority = 'critical';
    } else if (messageLower.includes('serious') || messageLower.includes('danger') || messageLower.includes('unsafe')) {
      priority = 'high';
    }

    const safetyEmergency = await SafetyEmergency.create({
      userId,
      userName,
      userEmail,
      userPhone,
      message: message.trim(),
      status: priority === 'critical' ? 'urgent' : 'unread',
      priority
    });

    return successResponse(res, 201, 'Safety emergency report submitted successfully', safetyEmergency);
  } catch (error) {
    console.error('Error creating safety emergency report:', error);
    return errorResponse(res, 500, error.message || 'Failed to submit safety emergency report');
  }
});

/**
 * Get All Safety Emergency Reports (Admin)
 * GET /api/admin/safety-emergency
 */
export const getAllSafetyEmergencies = asyncHandler(async (req, res) => {
  try {
    const { status, priority, search, page = 1, limit = 10 } = req.query;

    // Build query
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const safetyEmergencies = await SafetyEmergency.find(query)
      .populate('userId', 'name email phone')
      .populate('respondedBy', 'name email')
      .sort({ priority: -1, createdAt: -1 }) // Sort by priority first, then by date
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await SafetyEmergency.countDocuments(query);

    return successResponse(res, 200, 'Safety emergency reports retrieved successfully', {
      safetyEmergencies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching safety emergency reports:', error);
    return errorResponse(res, 500, 'Failed to fetch safety emergency reports');
  }
});

/**
 * Get Single Safety Emergency Report (Admin)
 * GET /api/admin/safety-emergency/:id
 */
export const getSafetyEmergencyById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const safetyEmergency = await SafetyEmergency.findById(id)
      .populate('userId', 'name email phone')
      .populate('respondedBy', 'name email')
      .lean();

    if (!safetyEmergency) {
      return errorResponse(res, 404, 'Safety emergency report not found');
    }

    return successResponse(res, 200, 'Safety emergency report retrieved successfully', safetyEmergency);
  } catch (error) {
    console.error('Error fetching safety emergency report:', error);
    return errorResponse(res, 500, 'Failed to fetch safety emergency report');
  }
});

/**
 * Update Safety Emergency Status (Admin)
 * PUT /api/admin/safety-emergency/:id/status
 */
export const updateSafetyEmergencyStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['unread', 'read', 'resolved', 'urgent'].includes(status)) {
      return errorResponse(res, 400, 'Valid status is required (unread, read, resolved, urgent)');
    }

    const updateData = { status };
    
    // If marking as resolved, set resolvedAt
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    const safetyEmergency = await SafetyEmergency.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('userId', 'name email phone');

    if (!safetyEmergency) {
      return errorResponse(res, 404, 'Safety emergency report not found');
    }

    return successResponse(res, 200, 'Safety emergency status updated successfully', safetyEmergency);
  } catch (error) {
    console.error('Error updating safety emergency status:', error);
    return errorResponse(res, 500, 'Failed to update safety emergency status');
  }
});

/**
 * Update Safety Emergency Priority (Admin)
 * PUT /api/admin/safety-emergency/:id/priority
 */
export const updateSafetyEmergencyPriority = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!priority || !['low', 'medium', 'high', 'critical'].includes(priority)) {
      return errorResponse(res, 400, 'Valid priority is required (low, medium, high, critical)');
    }

    const updateData = { priority };
    
    // If priority is critical, also set status to urgent
    if (priority === 'critical') {
      updateData.status = 'urgent';
    }

    const safetyEmergency = await SafetyEmergency.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('userId', 'name email phone');

    if (!safetyEmergency) {
      return errorResponse(res, 404, 'Safety emergency report not found');
    }

    return successResponse(res, 200, 'Safety emergency priority updated successfully', safetyEmergency);
  } catch (error) {
    console.error('Error updating safety emergency priority:', error);
    return errorResponse(res, 500, 'Failed to update safety emergency priority');
  }
});

/**
 * Respond to Safety Emergency (Admin)
 * PUT /api/admin/safety-emergency/:id/respond
 */
export const respondToSafetyEmergency = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { adminResponse } = req.body;

    if (!adminResponse || !adminResponse.trim()) {
      return errorResponse(res, 400, 'Response message is required');
    }

    const safetyEmergency = await SafetyEmergency.findByIdAndUpdate(
      id,
      {
        adminResponse: adminResponse.trim(),
        status: 'read',
        respondedBy: req.admin._id,
        respondedAt: new Date()
      },
      { new: true }
    )
      .populate('userId', 'name email phone')
      .populate('respondedBy', 'name email');

    if (!safetyEmergency) {
      return errorResponse(res, 404, 'Safety emergency report not found');
    }

    return successResponse(res, 200, 'Response sent successfully', safetyEmergency);
  } catch (error) {
    console.error('Error responding to safety emergency:', error);
    return errorResponse(res, 500, 'Failed to send response');
  }
});

/**
 * Delete Safety Emergency Report (Admin)
 * DELETE /api/admin/safety-emergency/:id
 */
export const deleteSafetyEmergency = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const safetyEmergency = await SafetyEmergency.findByIdAndDelete(id);

    if (!safetyEmergency) {
      return errorResponse(res, 404, 'Safety emergency report not found');
    }

    return successResponse(res, 200, 'Safety emergency report deleted successfully');
  } catch (error) {
    console.error('Error deleting safety emergency report:', error);
    return errorResponse(res, 500, 'Failed to delete safety emergency report');
  }
});

