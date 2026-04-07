import Feedback from '../models/Feedback.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';

/**
 * Create Feedback (Public - User)
 * POST /api/feedback
 */
export const createFeedback = asyncHandler(async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return errorResponse(res, 400, 'Feedback message is required');
    }

    // Get user info from request (user is authenticated via middleware)
    const userId = req.user._id;
    const userName = req.user.name || req.user.firstName || req.user.email?.split('@')[0] || 'User';
    const userEmail = req.user.email || '';
    const userPhone = req.user.phone || '';

    const feedback = await Feedback.create({
      userId,
      userName,
      userEmail,
      userPhone,
      message: message.trim(),
      status: 'unread'
    });

    return successResponse(res, 201, 'Feedback submitted successfully', feedback);
  } catch (error) {
    console.error('Error creating feedback:', error);
    return errorResponse(res, 500, 'Failed to submit feedback');
  }
});

/**
 * Get All Feedbacks (Admin)
 * GET /api/admin/feedback
 */
export const getAllFeedbacks = asyncHandler(async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    // Build query
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
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

    const feedbacks = await Feedback.find(query)
      .populate('userId', 'name email phone')
      .populate('repliedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Feedback.countDocuments(query);

    return successResponse(res, 200, 'Feedbacks retrieved successfully', {
      feedbacks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    return errorResponse(res, 500, 'Failed to fetch feedbacks');
  }
});

/**
 * Get Single Feedback (Admin)
 * GET /api/admin/feedback/:id
 */
export const getFeedbackById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findById(id)
      .populate('userId', 'name email phone')
      .populate('repliedBy', 'name email')
      .lean();

    if (!feedback) {
      return errorResponse(res, 404, 'Feedback not found');
    }

    return successResponse(res, 200, 'Feedback retrieved successfully', feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return errorResponse(res, 500, 'Failed to fetch feedback');
  }
});

/**
 * Update Feedback Status (Admin)
 * PUT /api/admin/feedback/:id/status
 */
export const updateFeedbackStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['unread', 'read', 'replied'].includes(status)) {
      return errorResponse(res, 400, 'Valid status is required (unread, read, replied)');
    }

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('userId', 'name email phone');

    if (!feedback) {
      return errorResponse(res, 404, 'Feedback not found');
    }

    return successResponse(res, 200, 'Feedback status updated successfully', feedback);
  } catch (error) {
    console.error('Error updating feedback status:', error);
    return errorResponse(res, 500, 'Failed to update feedback status');
  }
});

/**
 * Reply to Feedback (Admin)
 * PUT /api/admin/feedback/:id/reply
 */
export const replyToFeedback = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { adminReply } = req.body;

    if (!adminReply || !adminReply.trim()) {
      return errorResponse(res, 400, 'Reply message is required');
    }

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      {
        adminReply: adminReply.trim(),
        status: 'replied',
        repliedBy: req.admin._id,
        repliedAt: new Date()
      },
      { new: true }
    )
      .populate('userId', 'name email phone')
      .populate('repliedBy', 'name email');

    if (!feedback) {
      return errorResponse(res, 404, 'Feedback not found');
    }

    return successResponse(res, 200, 'Reply sent successfully', feedback);
  } catch (error) {
    console.error('Error replying to feedback:', error);
    return errorResponse(res, 500, 'Failed to send reply');
  }
});

/**
 * Delete Feedback (Admin)
 * DELETE /api/admin/feedback/:id
 */
export const deleteFeedback = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findByIdAndDelete(id);

    if (!feedback) {
      return errorResponse(res, 404, 'Feedback not found');
    }

    return successResponse(res, 200, 'Feedback deleted successfully');
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return errorResponse(res, 500, 'Failed to delete feedback');
  }
});

