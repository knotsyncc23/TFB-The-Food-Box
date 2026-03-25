import EarningAddon from '../../admin/models/EarningAddon.js';
import EarningAddonHistory from '../../admin/models/EarningAddonHistory.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import Order from '../../order/models/Order.js';
import mongoose from 'mongoose';

/**
 * Check and award earning addon bonuses when a delivery boy completes an order
 * @param {Object} deliveryId - Delivery partner ID
 * @param {Object} orderId - Order ID that was just completed
 * @param {Date} orderDeliveredAt - When the order was delivered
 * @returns {Promise<Object|null>} - Returns bonus details if awarded, null otherwise
 */
export const checkAndAwardEarningAddon = async (deliveryId, orderId, orderDeliveredAt = new Date()) => {
  try {
    const now = new Date();
    
    // Get all active earning addons that are currently valid
    const activeOffers = await EarningAddon.find({
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { maxRedemptions: null },
        { $expr: { $lt: ['$currentRedemptions', '$maxRedemptions'] } }
      ]
    }).lean();

    if (!activeOffers || activeOffers.length === 0) {
      return null;
    }

    // Count delivered orders for an offer window.
    // Some orders may miss `deliveredAt`, so we fall back to tracking.delivered.timestamp, then createdAt.
    const countDeliveredOrdersInRange = async (deliveryPartnerId, start, end) => {
      const pipeline = [
        {
          $match: {
            deliveryPartnerId: deliveryPartnerId,
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
    // Check each offer to see if delivery boy qualifies
    for (const offer of activeOffers) {
      try {
        // Check if delivery boy already redeemed this offer
        const existingRedemption = await EarningAddonHistory.findOne({
          earningAddonId: offer._id,
          deliveryPartnerId: deliveryId,
          status: 'credited'
        });

        if (existingRedemption) {
          continue;
        }

        // Count orders completed by this delivery boy AFTER offer was created
        // Use the later of: offer creation date or offer start date
        const offerStartDate = new Date(offer.startDate);
        const offerCreatedAt = offer.createdAt ? new Date(offer.createdAt) : offerStartDate;
        // Count orders from when offer was created (or start date, whichever is later)
        const countFromDate = offerCreatedAt > offerStartDate ? offerCreatedAt : offerStartDate;
        const endDate = new Date(offer.endDate);
        
        // Count delivered orders AFTER offer creation and within the offer end date.
        // Use fallback timestamps if `deliveredAt` is missing.
        const orderCount = await countDeliveredOrdersInRange(
          deliveryId,
          countFromDate,
          endDate
        );
        // Check if delivery boy has completed the required number of orders
        if (orderCount >= offer.requiredOrders) {
          // Check if bonus was already awarded (check wallet transactions)
          const wallet = await DeliveryWallet.findOne({ deliveryId });
          if (wallet) {
            const existingBonus = wallet.transactions.find(t => {
              if (t.type !== 'earning_addon' || t.status !== 'Completed') return false;
              
              // Handle metadata - can be Map or plain object
              const metadata = t.metadata;
              if (metadata) {
                const earningAddonId = metadata instanceof Map 
                  ? metadata.get('earningAddonId')
                  : metadata.earningAddonId;
                
                return earningAddonId?.toString() === offer._id.toString();
              }
              return false;
            });

            if (existingBonus) {
              continue;
            }
          }

          // Check if already has pending history record
          const existingPendingHistory = await EarningAddonHistory.findOne({
            earningAddonId: offer._id,
            deliveryPartnerId: deliveryId,
            status: 'pending'
          });

          if (existingPendingHistory) {
            continue;
          }

          // Delivery boy qualifies for offer - create pending history record
          // Admin will manually credit the amount from history page
          // Ensure offer._id is ObjectId (handle both string and ObjectId formats)
          let offerId = offer._id;
          if (mongoose.Types.ObjectId.isValid(offer._id)) {
            offerId = typeof offer._id === 'string' 
              ? new mongoose.Types.ObjectId(offer._id) 
              : offer._id;
          }
          // Create history record with 'pending' status
          // Amount will be credited to wallet only when admin manually credits from history page
          const history = await EarningAddonHistory.create({
            earningAddonId: offerId,
            deliveryPartnerId: deliveryId,
            offerSnapshot: {
              title: offer.title,
              requiredOrders: offer.requiredOrders,
              earningAmount: offer.earningAmount,
              startDate: offer.startDate,
              endDate: offer.endDate
            },
            ordersCompleted: orderCount,
            ordersRequired: offer.requiredOrders,
            earningAmount: offer.earningAmount,
            completedAt: now,
            status: 'pending', // Status is 'pending' - admin will credit manually
            // transactionId and walletId will be set when admin credits from history page
            contributingOrders: [orderId.toString()],
            metadata: {
              completionTime: Math.ceil((now - offerStartDate) / (1000 * 60 * 60 * 24)) // days
            }
          });
          // Verify history record was saved correctly
          const verifyHistory = await EarningAddonHistory.findById(history._id).lean();
          // Update offer redemption count
          const updateResult = await EarningAddon.updateOne(
            { _id: offerId },
            { $inc: { currentRedemptions: 1 } }
          );
          // Verify the count was updated
          const updatedOffer = await EarningAddon.findById(offerId).select('currentRedemptions').lean();
          // Also verify by counting history records
          const historyCount = await EarningAddonHistory.countDocuments({
            earningAddonId: offerId,
            status: { $in: ['pending', 'credited'] }
          });
          return {
            success: true,
            offerId: offer._id,
            offerTitle: offer.title,
            amount: offer.earningAmount,
            ordersCompleted: orderCount,
            ordersRequired: offer.requiredOrders,
            historyId: history._id,
            status: 'pending', // Status is pending, not credited yet
            message: 'History record created. Admin will credit manually from history page.'
          };
        }
      } catch (offerError) {
        console.error(`❌ Error processing offer ${offer._id}:`, offerError);
        // Continue with next offer
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error(`❌ Error checking earning addon bonuses:`, error);
    // Don't throw - this is a bonus feature, shouldn't break order completion
    return null;
  }
};

/**
 * Get delivery boy's progress for all active offers
 * @param {Object} deliveryId - Delivery partner ID
 * @returns {Promise<Array>} - Array of offers with progress
 */
export const getDeliveryBoyOfferProgress = async (deliveryId) => {
  try {
    const now = new Date();
    
    const activeOffers = await EarningAddon.find({
      status: 'active',
      endDate: { $gte: now },
      $or: [
        { maxRedemptions: null },
        { $expr: { $lt: ['$currentRedemptions', '$maxRedemptions'] } }
      ]
    }).lean();

    const offersWithProgress = await Promise.all(
      activeOffers.map(async (offer) => {
        // Use the later of: offer creation date or offer start date
        const offerStartDate = new Date(offer.startDate);
        const offerCreatedAt = offer.createdAt ? new Date(offer.createdAt) : offerStartDate;
        // Count orders from when offer was created (or start date, whichever is later)
        const countFromDate = offerCreatedAt > offerStartDate ? offerCreatedAt : offerStartDate;
        const endDate = new Date(offer.endDate);
        
        // Count orders completed AFTER offer creation and within offer period
        const orderCount = await Order.countDocuments({
          deliveryPartnerId: deliveryId,
          status: 'delivered',
          deliveredAt: {
            $gte: countFromDate, // Count from offer creation/start date
            $lte: now > endDate ? endDate : now
          }
        });

        // Check if already redeemed (credited) or has pending record
        const redeemed = await EarningAddonHistory.findOne({
          earningAddonId: offer._id,
          deliveryPartnerId: deliveryId,
          status: { $in: ['credited', 'pending'] }
        });

        const isValid = offer.status === 'active' &&
          now >= startDate &&
          now <= endDate &&
          (offer.maxRedemptions === null || offer.currentRedemptions < offer.maxRedemptions);

        return {
          ...offer,
          isValid,
          currentOrders: orderCount,
          progress: offer.requiredOrders > 0 ? Math.min(orderCount / offer.requiredOrders, 1) : 0,
          redeemed: !!redeemed,
          canRedeem: !redeemed && orderCount >= offer.requiredOrders && isValid
        };
      })
    );

    return offersWithProgress;
  } catch (error) {
    console.error(`❌ Error getting offer progress:`, error);
    return [];
  }
};
