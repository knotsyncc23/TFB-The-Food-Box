import ContactUs from '../models/ContactUs.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';

/**
 * Get Contact Us (Public)
 * GET /api/contact-us/public
 */
export const getContactUsPublic = asyncHandler(async (req, res) => {
  try {
    const doc = await ContactUs.findOne({ isActive: true })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!doc) {
      return successResponse(res, 200, 'Contact page retrieved successfully', {
        title: 'Contact Us',
        content: '<p>No contact information available at the moment.</p>'
      });
    }

    return successResponse(res, 200, 'Contact page retrieved successfully', doc);
  } catch (error) {
    console.error('Error fetching contact page:', error);
    return errorResponse(res, 500, 'Failed to fetch contact page');
  }
});

/**
 * Get Contact Us (Admin)
 * GET /api/admin/contact-us
 */
export const getContactUs = asyncHandler(async (req, res) => {
  try {
    let doc = await ContactUs.findOne({ isActive: true }).lean();

    if (!doc) {
      doc = await ContactUs.create({
        title: 'Contact Us',
        content:
          '<p>Reach our support team by email at support@example.com or call us during business hours.</p>',
        updatedBy: req.admin._id
      });
    }

    return successResponse(res, 200, 'Contact page retrieved successfully', doc);
  } catch (error) {
    console.error('Error fetching contact page:', error);
    return errorResponse(res, 500, 'Failed to fetch contact page');
  }
});

/**
 * Update Contact Us
 * PUT /api/admin/contact-us
 */
export const updateContactUs = asyncHandler(async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    let doc = await ContactUs.findOne({ isActive: true });

    if (!doc) {
      doc = new ContactUs({
        title: title || 'Contact Us',
        content,
        updatedBy: req.admin._id
      });
    } else {
      if (title !== undefined) doc.title = title;
      doc.content = content;
      doc.updatedBy = req.admin._id;
    }

    await doc.save();

    return successResponse(res, 200, 'Contact page updated successfully', doc);
  } catch (error) {
    console.error('Error updating contact page:', error);
    return errorResponse(res, 500, 'Failed to update contact page');
  }
});
