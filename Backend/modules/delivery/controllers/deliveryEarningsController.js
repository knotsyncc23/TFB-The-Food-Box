import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Delivery from '../models/Delivery.js';
import Order from '../../order/models/Order.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import EarningAddon from '../../admin/models/EarningAddon.js';
import EarningAddonHistory from '../../admin/models/EarningAddonHistory.js';
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
 * Get Delivery Partner Earnings
 * GET /api/delivery/earnings
 * Query params: period (today, week, month, all), page, limit, date (for specific date/week/month)
 */
export const getEarnings = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { period = 'all', page = 1, limit = 1000, date } = req.query;

    // Calculate date range based on period and optional date parameter
    let startDate = null;
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // End of day

    // If date is provided, use it as base date for period calculation
    const baseDate = date ? new Date(date) : new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(baseDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(baseDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Get week range (Monday to Sunday)
        startDate = new Date(baseDate);
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'all':
      default:
        startDate = null;
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    // Get or create wallet for delivery partner
    const wallet = await DeliveryWallet.findOrCreateByDeliveryId(delivery._id);

    // Filter transactions based on period and type
    let transactions = wallet.transactions || [];
    
    // Filter by transaction type (only 'payment' type for earnings)
    transactions = transactions.filter(t => 
      t.type === 'payment' && 
      t.status === 'Completed'
    );

    // Filter by date range if period is specified
    if (startDate) {
      transactions = transactions.filter(t => {
        const transactionDate = t.createdAt || t.processedAt || new Date();
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => {
      const dateA = a.createdAt || a.processedAt || new Date(0);
      const dateB = b.createdAt || b.processedAt || new Date(0);
      return dateB - dateA;
    });

    // Get order details for each transaction
    const orderIds = transactions
      .filter(t => t.orderId)
      .map(t => t.orderId);

    // Fetch orders in batch
    const orders = await Order.find({
      _id: { $in: orderIds }
    })
      .select('orderId restaurantName deliveredAt createdAt')
      .lean();

    // Create order map for quick lookup
    const orderMap = {};
    orders.forEach(order => {
      orderMap[order._id.toString()] = order;
    });

    // Combine transaction and order data
    const earnings = transactions.map(transaction => {
      const order = transaction.orderId ? orderMap[transaction.orderId.toString()] : null;
      return {
        transactionId: transaction._id?.toString(),
        orderId: order?.orderId || transaction.orderId?.toString() || 'Unknown',
        restaurantName: order?.restaurantName || 'Unknown Restaurant',
        amount: transaction.amount || 0,
        description: transaction.description || '',
        deliveredAt: order?.deliveredAt || transaction.createdAt || transaction.processedAt,
        createdAt: transaction.createdAt || transaction.processedAt,
        paymentCollected: transaction.paymentCollected || false
      };
    });

    // Calculate pagination
    const totalEarnings = earnings.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedEarnings = earnings.slice(skip, skip + parseInt(limit));

    // Calculate summary statistics
    const totalAmount = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalOrders = earnings.length;
    
    // Calculate time on orders (difference between order creation and delivery)
    let totalTimeMinutes = 0;
    earnings.forEach(e => {
      // Find order by orderId string (e.orderId is string like "ORD-123-456")
      const order = orders.find(o => o.orderId === e.orderId);
      if (order && order.createdAt && order.deliveredAt) {
        const timeDiff = new Date(order.deliveredAt) - new Date(order.createdAt);
        totalTimeMinutes += Math.floor(timeDiff / (1000 * 60));
      }
    });

    const totalHours = Math.floor(totalTimeMinutes / 60);
    const totalMinutesRemainder = totalTimeMinutes % 60;

    // Calculate breakdown
    const orderEarning = totalAmount; // All payments are order earnings
    const incentive = 0; // Can be added from bonus transactions separately if needed
    const otherEarnings = 0; // Can include tips, bonuses, etc.

    return successResponse(res, 200, 'Earnings retrieved successfully', {
      earnings: paginatedEarnings,
      summary: {
        period,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        totalOrders,
        totalEarnings: totalAmount,
        totalHours,
        totalMinutes: totalMinutesRemainder,
        orderEarning,
        incentive,
        otherEarnings
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalEarnings,
        pages: Math.ceil(totalEarnings / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching delivery earnings: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to fetch earnings');
  }
});

/**
 * Get Active Earning Addon Offers for Delivery Partner
 * GET /api/delivery/earnings/active-offers
 */
export const getActiveEarningAddons = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const now = new Date();

    // Count delivered orders for an offer window.
    // Important: some historical orders may not have `deliveredAt` populated.
    // In that case we fall back to `tracking.delivered.timestamp`, then `createdAt`.
    const countDeliveredOrdersInRange = async (deliveryId, start, end) => {
      const pipeline = [
        {
          $match: {
            deliveryPartnerId: deliveryId,
            status: "delivered",
          },
        },
        {
          $project: {
            ts: {
              $ifNull: [
                "$deliveredAt",
                { $ifNull: ["$tracking.delivered.timestamp", "$createdAt"] },
              ],
            },
          },
        },
        {
          $match: {
            $expr: {
              $and: [
                { $gte: ["$ts", start] },
                { $lte: ["$ts", end] },
              ],
            },
          },
        },
        { $count: "count" },
      ]

      const result = await Order.aggregate(pipeline);
      return result?.[0]?.count || 0;
    };

    // Get ALL active earning addons (not just those currently valid)
    // This includes offers that haven't started yet but are active
    const activeAddons = await EarningAddon.find({
      status: 'active',
      endDate: { $gte: now }, // Only show offers that haven't ended yet
      $or: [
        { maxRedemptions: null },
        { $expr: { $lt: ['$currentRedemptions', '$maxRedemptions'] } }
      ]
    })
      .select('title description requiredOrders earningAmount startDate endDate status maxRedemptions currentRedemptions createdAt')
      .sort({ createdAt: -1 }) // Get most recent first
      .lean();

    logger.info(`Found ${activeAddons.length} active earning addons for delivery partner ${delivery._id}`);

    // Check validity for each addon and add delivery partner's progress
    const addonsWithProgress = await Promise.all(
      activeAddons.map(async (addon) => {
        try {
          // Use the later of: offer creation date or offer start date
          const offerStartDate = new Date(addon.startDate);
          const offerCreatedAt = addon.createdAt ? new Date(addon.createdAt) : offerStartDate;
          // Count orders from when offer was created (or start date, whichever is later)
          const countFromDate = offerCreatedAt > offerStartDate ? offerCreatedAt : offerStartDate;
          const endDate = new Date(addon.endDate);
          
          // Calculate delivery partner's order count AFTER offer creation
          // Count orders from offer creation/start date to now (or end date if offer hasn't started)
          const countStartDate = now > countFromDate ? countFromDate : now;
          const endBound = now > endDate ? endDate : now;
          const orderCount = await countDeliveredOrdersInRange(
            delivery._id,
            countStartDate,
            endBound
          ).catch((err) => {
            logger.error(`Error counting orders for addon ${addon._id}:`, err);
            return 0;
          });

          // Check if delivery boy already redeemed this offer
          const redeemed = await EarningAddonHistory.findOne({
            earningAddonId: addon._id,
            deliveryPartnerId: delivery._id,
            status: 'credited'
          }).catch(err => {
            logger.error(`Error checking redemption for addon ${addon._id}:`, err);
            return null;
          });

          // Check if offer is currently valid (started and not ended)
          const isValid = addon.status === 'active' &&
            now >= offerStartDate &&
            now <= endDate &&
            (addon.maxRedemptions === null || addon.currentRedemptions < addon.maxRedemptions);

          // Check if offer is upcoming (not started yet)
          const isUpcoming = addon.status === 'active' && now < offerStartDate;

          const completedOrders = orderCount || 0;
          const targetOrders = addon.requiredOrders || 0;
          const progressOrders = Math.min(completedOrders, targetOrders);
          const isAchieved = completedOrders >= targetOrders;
          const earnedAmount = isAchieved ? (addon.earningAmount || 0) : 0;

          return {
            ...addon,
            isValid,
            isUpcoming,
            currentOrders: completedOrders,
            targetOrders,
            completedOrders,
            progressOrders,
            isAchieved,
            earnedAmount,
            progress: targetOrders > 0 ? Math.min(completedOrders / targetOrders, 1) : 0,
            redeemed: !!redeemed,
            canRedeem: !redeemed && isAchieved && isValid
          };
        } catch (addonError) {
          logger.error(`Error processing addon ${addon._id}:`, addonError);
          // Return addon with default values if processing fails
          return {
            ...addon,
            isValid: false,
            isUpcoming: false,
            currentOrders: 0,
            targetOrders: addon.requiredOrders || 0,
            completedOrders: 0,
            progressOrders: 0,
            isAchieved: false,
            earnedAmount: 0,
            progress: 0,
            redeemed: false,
            canRedeem: false,
            error: 'Failed to process addon'
          };
        }
      })
    );

    logger.info(`Returning ${addonsWithProgress.length} offers with progress data`);

    return successResponse(res, 200, 'Active earning addons retrieved successfully', {
      activeOffers: addonsWithProgress
    });
  } catch (error) {
    logger.error(`Error fetching active earning addons: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to fetch active earning addons');
  }
});

/**
 * Claim Earning Addon Bonus (credit to delivery partner wallet)
 * POST /api/delivery/earnings/active-offers/:offerId/claim
 */
export const claimEarningAddonBonus = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { offerId } = req.params;

    if (!offerId) {
      return errorResponse(res, 400, 'Offer ID is required');
    }

    // Find pending history record for this offer and delivery partner
    const history = await EarningAddonHistory.findOne({
      earningAddonId: offerId,
      deliveryPartnerId: delivery._id,
      status: 'pending'
    });

    if (!history) {
      return errorResponse(res, 404, 'No pending bonus found to claim for this offer');
    }

    // Find or create wallet
    const wallet = await DeliveryWallet.findOrCreateByDeliveryId(history.deliveryPartnerId);

    // Add earning_addon transaction and update balances
    const transaction = wallet.addTransaction({
      amount: history.earningAmount,
      type: 'earning_addon',
      status: 'Completed',
      description: `Earning Addon: ${history.offerSnapshot?.title || 'Offer'}`,
      processedAt: new Date(),
      metadata: {
        earningAddonId: history.earningAddonId.toString(),
        earningAddonHistoryId: history._id.toString(),
        ordersCompleted: history.ordersCompleted,
        ordersRequired: history.ordersRequired,
        claimedBy: 'delivery'
      }
    });

    await wallet.save();

    // Update history record to credited
    history.status = 'credited';
    history.transactionId = transaction?._id;
    history.walletId = wallet._id;
    history.processedBy = delivery._id;
    history.processedAt = new Date();
    await history.save();

    logger.info(
      `💰 Earning addon bonus credited via delivery claim: history=${history._id} delivery=${delivery._id}`
    );

    return successResponse(res, 200, 'Earning addon bonus claimed successfully', {
      historyId: history._id,
      offerId: history.earningAddonId,
      amount: history.earningAmount,
      wallet: {
        totalBalance: wallet.totalBalance,
        totalEarned: wallet.totalEarned
      },
      transaction
    });
  } catch (error) {
    logger.error(`Error claiming earning addon bonus: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to claim earning addon bonus');
  }
});

