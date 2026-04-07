import Delivery from '../../delivery/models/Delivery.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Get Delivery Partner Join Requests
 * GET /api/admin/delivery-partners/requests
 * Query params: status (pending, denied), page, limit, search, zone, jobType, vehicleType
 */
export const getJoinRequests = asyncHandler(async (req, res) => {
  try {
    const { 
      status = 'pending', 
      page = 1, 
      limit = 50,
      search,
      zone,
      jobType,
      vehicleType
    } = req.query;

    // Build query
    const query = {};
    
    // Status filter
    if (status === 'pending') {
      query.status = 'pending';
    } else if (status === 'denied') {
      query.status = 'blocked'; // Assuming 'blocked' is used for denied/rejected
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Zone filter (if zones are stored in availability.zones)
    if (zone) {
      // This might need adjustment based on how zones are stored
      query['availability.zones'] = zone;
    }

    // Vehicle type filter
    if (vehicleType) {
      query['vehicle.type'] = vehicleType.toLowerCase();
    }

    // Job type filter - assuming this might be stored in a field or derived
    // For now, we'll skip this as it's not clear from the Delivery model
    // You might need to add a jobType field to the Delivery model

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch delivery partners
    const deliveries = await Delivery.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Delivery.countDocuments(query);

    // Format response to match frontend expectations
    const formattedRequests = deliveries.map((delivery, index) => {
      // Determine job type (you may need to add this field to Delivery model)
      // For now, using a default or derived value
      const jobType = 'Freelance'; // Default or derive from delivery data

      // Get zone from location (city, state, country)
      let zone = 'All over the World'; // Default
      
      if (delivery.location) {
        const locationParts = [];
        
        // Add city if available
        if (delivery.location.city) {
          locationParts.push(delivery.location.city);
        }
        
        // Add state if available
        if (delivery.location.state) {
          locationParts.push(delivery.location.state);
        }
        
        // Add country (default to India if not specified)
        const country = delivery.location.country || 'India';
        locationParts.push(country);
        
        // If we have location parts, join them
        if (locationParts.length > 0) {
          zone = locationParts.join(', ');
        } else if (delivery.availability?.zones?.length > 0) {
          // Fallback to zones if location not available
          zone = 'Multiple Zones';
        }
      } else if (delivery.availability?.zones?.length > 0) {
        zone = 'Multiple Zones';
      }

      // Get vehicle type
      const vehicleType = delivery.vehicle?.type 
        ? delivery.vehicle.type.charAt(0).toUpperCase() + delivery.vehicle.type.slice(1)
        : 'N/A';

      return {
        _id: delivery._id.toString(),
        sl: skip + index + 1,
        name: delivery.name || 'N/A',
        email: delivery.email || 'N/A',
        phone: delivery.phone || 'N/A',
        zone: zone,
        jobType: jobType,
        vehicleType: vehicleType,
        status: delivery.status === 'blocked' ? 'Rejected' : delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1),
        rejectionReason: delivery.rejectionReason || null,
        createdAt: delivery.createdAt,
        // Include full data for view/details
        fullData: {
          ...delivery,
          _id: delivery._id.toString()
        }
      };
    });

    return successResponse(res, 200, 'Join requests retrieved successfully', {
      requests: formattedRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching join requests: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to fetch join requests');
  }
});

/**
 * Get Delivery Partner by ID
 * GET /api/admin/delivery-partners/:id
 */
export const getDeliveryPartnerById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const delivery = await Delivery.findById(id)
      .select('-password -refreshToken')
      .lean();

    if (!delivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    return successResponse(res, 200, 'Delivery partner retrieved successfully', {
      delivery
    });
  } catch (error) {
    logger.error(`Error fetching delivery partner: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to fetch delivery partner');
  }
});

/**
 * Approve Delivery Partner Join Request
 * POST /api/admin/delivery-partners/:id/approve
 */
export const approveDeliveryPartner = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id; // Admin who is approving

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    if (delivery.status === 'approved' || delivery.status === 'active') {
      return errorResponse(res, 400, 'Delivery partner is already approved');
    }

    // Update status to approved
    delivery.status = 'approved';
    delivery.verifiedAt = new Date();
    delivery.verifiedBy = adminId;
    delivery.isActive = true;

    await delivery.save();

    try {
      const serverModule = await import("../../../server.js");
      const io = serverModule.getIO ? serverModule.getIO() : null;
      if (io) {
        const approvalPayload = {
          deliveryId: delivery.deliveryId,
          mongoId: delivery._id.toString(),
          status: delivery.status,
          verifiedAt: delivery.verifiedAt,
          title: "Account approved",
          message: "Your delivery account has been approved. You can start receiving orders now.",
        };

        io.to(`delivery:${delivery._id.toString()}`).emit("delivery_partner_approved", approvalPayload);
        if (delivery.deliveryId) {
          io.to(`delivery:${delivery.deliveryId}`).emit("delivery_partner_approved", approvalPayload);
        }
      }
    } catch (socketError) {
      logger.warn(`Could not emit delivery approval event: ${socketError.message}`);
    }

    logger.info(`Delivery partner approved: ${id}`, {
      approvedBy: adminId,
      deliveryId: delivery.deliveryId
    });

    return successResponse(res, 200, 'Delivery partner approved successfully', {
      delivery: {
        _id: delivery._id.toString(),
        name: delivery.name,
        status: delivery.status,
        verifiedAt: delivery.verifiedAt
      }
    });
  } catch (error) {
    logger.error(`Error approving delivery partner: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to approve delivery partner');
  }
});

/**
 * Reject/Deny Delivery Partner Join Request
 * POST /api/admin/delivery-partners/:id/reject
 */
export const rejectDeliveryPartner = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Rejection reason/note (required)
    const adminId = req.user._id; // Admin who is rejecting

    // Validate reason is provided
    if (!reason || !reason.trim()) {
      return errorResponse(res, 400, 'Rejection reason is required');
    }

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    if (delivery.status === 'blocked') {
      return errorResponse(res, 400, 'Delivery partner is already rejected');
    }

    // Update status to blocked (rejected) and store rejection details
    // Note: isActive is NOT set to false - denied partners can still login to see rejection reason
    delivery.status = 'blocked';
    delivery.rejectionReason = reason.trim();
    delivery.rejectedAt = new Date();
    delivery.rejectedBy = adminId;

    await delivery.save();

    logger.info(`Delivery partner rejected: ${id}`, {
      rejectedBy: adminId,
      reason: reason,
      deliveryId: delivery.deliveryId
    });

    return successResponse(res, 200, 'Delivery partner rejected successfully', {
      delivery: {
        _id: delivery._id.toString(),
        name: delivery.name,
        status: delivery.status,
        rejectionReason: delivery.rejectionReason
      }
    });
  } catch (error) {
    logger.error(`Error rejecting delivery partner: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to reject delivery partner');
  }
});

/**
 * Create Delivery Partner (admin adds new delivery boy)
 * POST /api/admin/delivery-partners
 * Body: name, email, phone, password, vehicleType?, zone?
 */
export const createDeliveryPartner = asyncHandler(async (req, res) => {
  try {
    const { name, email, phone, password, vehicleType, zone } = req.body;

    if (!name || !name.trim()) {
      return errorResponse(res, 400, 'Name is required');
    }
    if (!phone || !phone.trim()) {
      return errorResponse(res, 400, 'Phone number is required');
    }
    const normalizedPhone = phone.trim().replace(/\s/g, '');
    if (normalizedPhone.length < 10) {
      return errorResponse(res, 400, 'Valid phone number is required');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return errorResponse(res, 400, 'Password must be at least 8 characters');
    }

    const existing = await Delivery.findOne({
      $or: [
        { phone: normalizedPhone },
        ...(email && email.trim() ? [{ email: email.trim().toLowerCase() }] : [])
      ]
    });
    if (existing) {
      if (existing.phone === normalizedPhone) {
        return errorResponse(res, 400, 'A delivery partner already exists with this phone number');
      }
      return errorResponse(res, 400, 'A delivery partner already exists with this email');
    }

    const vehicleTypeMap = {
      bike: 'bike',
      scooter: 'scooter',
      bicycle: 'bicycle',
      car: 'car',
      motorcycle: 'bike'
    };
    const vType = (vehicleType && vehicleTypeMap[String(vehicleType).toLowerCase()]) || 'bike';

    const deliveryData = {
      name: name.trim(),
      phone: normalizedPhone,
      password: password,
      email: email && email.trim() ? email.trim().toLowerCase() : undefined,
      signupMethod: 'email',
      status: 'approved',
      phoneVerified: false,
      isActive: true,
      verifiedAt: new Date(),
      verifiedBy: req.user._id,
      vehicle: { type: vType },
      ...(zone && zone.trim() ? { location: { area: zone.trim() } } : {})
    };

    const delivery = await Delivery.create(deliveryData);

    logger.info(`Delivery partner created by admin: ${delivery._id}`, {
      createdBy: req.user._id,
      deliveryId: delivery.deliveryId
    });

    return successResponse(res, 201, 'Delivery partner created successfully', {
      delivery: {
        _id: delivery._id.toString(),
        name: delivery.name,
        email: delivery.email,
        phone: delivery.phone,
        deliveryId: delivery.deliveryId,
        status: delivery.status
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(res, 400, 'A delivery partner already exists with this phone or email');
    }
    logger.error(`Error creating delivery partner: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to create delivery partner');
  }
});

/**
 * Get All Delivery Partners (for listing)
 * GET /api/admin/delivery-partners
 * Query params: status, page, limit, search
 */
export const getDeliveryPartners = asyncHandler(async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 50,
      search,
      isActive,
      includeAvailability
    } = req.query;

    // Build query - only get approved/active delivery partners for list
    const query = {
      status: { $in: ['approved', 'active'] } // Only show approved/active partners
    };
    
    // Status filter (if provided, override default)
    if (status) {
      query.status = status;
    }

    // isActive filter (if provided)
    if (isActive !== undefined) {
      query.isActive = isActive === 'true' || isActive === true;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { deliveryId: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build select fields - always include availability when requested
    // Note: In Mongoose, if a field is not explicitly excluded, it's included by default
    // So we just need to make sure we're not excluding availability
    let selectFields = '-password -refreshToken';
    
    // Fetch delivery partners
    const deliveries = await Delivery.find(query)
      .select(selectFields)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Log for debugging
    if (includeAvailability === 'true' || includeAvailability === true) {
      deliveries.forEach((d, idx) => {
        const hasLocation = d.availability?.currentLocation?.coordinates;
      });
    }

    // Import Order model for order counts
    const Order = (await import('../../order/models/Order.js')).default;

    // Get order statistics for each delivery partner
    const deliveryIds = deliveries.map(d => d._id);
    
    // Get order counts for each delivery partner
    const orderStats = await Order.aggregate([
      {
        $match: {
          deliveryPartnerId: { $in: deliveryIds }
        }
      },
      {
        $group: {
          _id: '$deliveryPartnerId',
          totalOrders: { $sum: 1 },
          assignedOrders: {
            $sum: {
              $cond: [
                { $in: ['$status', ['out_for_delivery', 'ready', 'preparing']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Create a map of deliveryId -> stats
    const statsMap = {};
    orderStats.forEach(stat => {
      statsMap[stat._id.toString()] = {
        totalOrders: stat.totalOrders || 0,
        assignedOrders: stat.assignedOrders || 0
      };
    });

    // Format response with order stats and zone info
    const formattedPartners = deliveries.map((delivery, index) => {
      const stats = statsMap[delivery._id.toString()] || { totalOrders: 0, assignedOrders: 0 };
      
      // Get zone from location
      let zone = 'All over the World';
      if (delivery.location) {
        const locationParts = [];
        if (delivery.location.city) locationParts.push(delivery.location.city);
        if (delivery.location.state) locationParts.push(delivery.location.state);
        const country = delivery.location.country || 'India';
        locationParts.push(country);
        if (locationParts.length > 0) {
          zone = locationParts.join(', ');
        }
      }

      // Get availability status
      const isOnline = delivery.availability?.isOnline || false;
      const availabilityStatus = isOnline ? 'Online' : 'Offline';

      return {
        _id: delivery._id.toString(),
        sl: skip + index + 1,
        name: delivery.name || 'N/A',
        email: delivery.email || 'N/A',
        phone: delivery.phone || 'N/A',
        zone: zone,
        totalOrders: stats.totalOrders,
        assignedOrders: stats.assignedOrders,
        status: availabilityStatus,
        rating: delivery.metrics?.rating || 0,
        deliveryId: delivery.deliveryId || 'N/A',
        isActive: delivery.isActive !== false,
        profileImage: delivery.profileImage?.url || null,
        // Include availability data when requested
        ...(includeAvailability === 'true' || includeAvailability === true ? {
          availability: delivery.availability || null
        } : {}),
        // Include full data
        fullData: {
          ...delivery,
          _id: delivery._id.toString()
        }
      };
    });

    // Get total count
    const total = await Delivery.countDocuments(query);

    return successResponse(res, 200, 'Delivery partners retrieved successfully', {
      deliveryPartners: formattedPartners,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching delivery partners: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to fetch delivery partners');
  }
});

/**
 * Delete Delivery Partner
 * DELETE /api/admin/delivery-partners/:id
 * Deletes all related data and logs out the delivery partner
 */
export const deleteDeliveryPartner = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    // Import related models
    const DeliveryWallet = (await import('../../delivery/models/DeliveryWallet.js')).default;
    const Order = (await import('../../order/models/Order.js')).default;

    // Start transaction for atomic operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Delete Delivery Wallet and all transactions
      const walletDeleted = await DeliveryWallet.deleteOne({ deliveryId: id }).session(session);
      logger.info(`Deleted wallet for delivery partner: ${id}`, { walletDeleted });

      // 2. Update Orders - Remove deliveryPartnerId (set to null)
      // This preserves order history but removes the delivery partner assignment
      const ordersUpdated = await Order.updateMany(
        { deliveryPartnerId: id },
        { $unset: { deliveryPartnerId: 1 } },
        { session }
      );
      logger.info(`Updated orders for delivery partner: ${id}`, { 
        ordersUpdated: ordersUpdated.modifiedCount 
      });

      // 3. Clear refreshToken to force logout
      // This will invalidate all active sessions
      await Delivery.updateOne(
        { _id: id },
        { $unset: { refreshToken: 1 } },
        { session }
      );

      // 4. Delete the Delivery partner record
      await Delivery.deleteOne({ _id: id }).session(session);

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      logger.info(`Delivery partner deleted successfully: ${id}`, {
        deletedBy: req.user._id,
        deliveryId: delivery.deliveryId,
        walletDeleted: walletDeleted.deletedCount,
        ordersUpdated: ordersUpdated.modifiedCount
      });

      return successResponse(res, 200, 'Delivery partner and all related data deleted successfully. Partner has been logged out.');
    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    logger.error(`Error deleting delivery partner: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to delete delivery partner');
  }
});

/**
 * Reverify Delivery Partner (Resubmit for approval)
 * POST /api/admin/delivery-partners/:id/reverify
 */
export const reverifyDeliveryPartner = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    if (delivery.status !== 'blocked') {
      return errorResponse(res, 400, 'Only rejected delivery partners can be reverted');
    }

    // Reset to pending status and clear rejection details
    delivery.status = 'pending';
    delivery.isActive = true; // Allow login to see verification message
    delivery.rejectionReason = undefined;
    delivery.rejectedAt = undefined;
    delivery.rejectedBy = undefined;

    await delivery.save();

    logger.info(`Delivery partner reverted for reverification: ${id}`, {
      deliveryId: delivery.deliveryId
    });

    return successResponse(res, 200, 'Delivery partner request resubmitted for verification', {
      delivery: {
        _id: delivery._id.toString(),
        name: delivery.name,
        status: delivery.status
      }
    });
  } catch (error) {
    logger.error(`Error reverifying delivery partner: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to reverify delivery partner');
  }
});

/**
 * Update Delivery Partner Status
 * PATCH /api/admin/delivery-partners/:id/status
 */
export const updateDeliveryPartnerStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body;

    const delivery = await Delivery.findById(id);

    if (!delivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    // Update status if provided
    if (status) {
      const validStatuses = ['pending', 'approved', 'active', 'suspended', 'blocked'];
      if (!validStatuses.includes(status)) {
        return errorResponse(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      delivery.status = status;
    }

    // Update isActive if provided
    if (typeof isActive === 'boolean') {
      delivery.isActive = isActive;
    }

    await delivery.save();

    logger.info(`Delivery partner status updated: ${id}`, {
      status: delivery.status,
      isActive: delivery.isActive,
      updatedBy: req.user._id
    });

    return successResponse(res, 200, 'Delivery partner status updated successfully', {
      delivery: {
        _id: delivery._id.toString(),
        name: delivery.name,
        status: delivery.status,
        isActive: delivery.isActive
      }
    });
  } catch (error) {
    logger.error(`Error updating delivery partner status: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to update delivery partner status');
  }
});

