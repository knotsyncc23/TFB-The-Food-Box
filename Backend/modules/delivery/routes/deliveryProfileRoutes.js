import express from 'express';
import { getProfile, updateProfile, reverify, deleteProfile } from '../controllers/deliveryProfileController.js';
import { authenticate } from '../middleware/deliveryAuth.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';
import {
  createSupportTicket,
  getDeliveryTickets,
  getTicketById
} from '../../admin/controllers/deliverySupportTicketController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', validate(Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().lowercase().trim().optional().allow(null, ''),
  dateOfBirth: Joi.date().optional().allow(null),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say').optional(),
  vehicle: Joi.object({
    type: Joi.string().valid('bike', 'scooter', 'bicycle', 'car').optional(),
    number: Joi.string()
      .trim()
      .uppercase()
      .pattern(/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/)
      .message('Vehicle number must be in format MH12AB1234')
      .optional()
      .allow(null, ''),
    model: Joi.string().trim().optional().allow(null, ''),
    brand: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  location: Joi.object({
    addressLine1: Joi.string().trim().optional().allow(null, ''),
    addressLine2: Joi.string().trim().optional().allow(null, ''),
    area: Joi.string().trim().optional().allow(null, ''),
    city: Joi.string()
      .trim()
      .pattern(/^[A-Za-z\s]+$/)
      .message('City should only contain letters and spaces')
      .optional()
      .allow(null, ''),
    state: Joi.string().trim().optional().allow(null, ''),
    zipCode: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  profileImage: Joi.object({
    url: Joi.string().uri().optional().allow(null, ''),
    publicId: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  documents: Joi.object({
    bankDetails: Joi.object({
      accountHolderName: Joi.string().trim().min(2).max(100).optional().allow(null, ''),
      accountNumber: Joi.string().trim().min(9).max(18).optional().allow(null, ''),
      ifscCode: Joi.string()
        .trim()
        .length(11)
        .uppercase()
        .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .message('IFSC code must be 11 characters (e.g., HDFC0001234)')
        .optional()
        .allow(null, ''),
      bankName: Joi.string().trim().min(2).max(100).optional().allow(null, '')
    }).optional()
  }).optional()
})), updateProfile);
router.delete('/profile', deleteProfile);

// Reverify route (resubmit for approval)
router.post('/reverify', reverify);

// Support tickets routes
router.post('/support-tickets', validate(Joi.object({
  subject: Joi.string().trim().min(3).max(200).required().messages({
    'string.empty': 'Subject is required',
    'string.min': 'Subject must be at least 3 characters',
    'string.max': 'Subject must not exceed 200 characters',
    'any.required': 'Subject is required'
  }),
  description: Joi.string().trim().min(10).max(2000).required().messages({
    'string.empty': 'Description is required',
    'string.min': 'Description must be at least 10 characters',
    'string.max': 'Description must not exceed 2000 characters',
    'any.required': 'Description is required'
  }),
  category: Joi.string().valid('payment', 'account', 'technical', 'order', 'other').optional().allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional().allow('', null)
})), createSupportTicket);

router.get('/support-tickets', getDeliveryTickets);
router.get('/support-tickets/:id', getTicketById);

export default router;

