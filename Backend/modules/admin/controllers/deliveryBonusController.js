import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Delivery from '../../delivery/models/Delivery.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';
import { sendPushNotificationToDeliveryPartner } from '../../../shared/services/fcmPushService.js';
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

function getDeliverySocketRooms(deliveryPartnerId) {
  const normalizedId = deliveryPartnerId?.toString?.() || String(deliveryPartnerId || "");
  const rooms = new Set();

  if (normalizedId) {
    rooms.add(`delivery:${normalizedId}`);
  }

  if (mongoose.Types.ObjectId.isValid(normalizedId)) {
    rooms.add(`delivery:${new mongoose.Types.ObjectId(normalizedId).toString()}`);
  }

  return [...rooms];
}

async function notifyDeliveryPartnerBonus(req, deliveryPartnerId, payload) {
  try {
    const io = req.app?.get?.("io");
    if (io) {
      const deliveryNamespace = io.of("/delivery");
      const rooms = getDeliverySocketRooms(deliveryPartnerId);

      for (const room of rooms) {
        deliveryNamespace.to(room).emit("delivery_bonus", payload);
        deliveryNamespace.to(room).emit("play_notification_sound", {
          type: "bonus",
          title: payload.title,
        });
      }
    }
  } catch (error) {
    logger.warn(`Failed to emit bonus notification over socket: ${error.message}`);
  }
}

/**
 * Add Bonus to Delivery Partner
 * POST /api/admin/delivery-partners/bonus
 * Body: { deliveryPartnerId, amount, reference }
 */
export const addBonus = asyncHandler(async (req, res) => {
  // Declare variables outside try block so they're accessible in catch
  let deliveryPartnerId, amount, reference, adminId;
  
  try {
    ({ deliveryPartnerId, amount, reference } = req.body);
    adminId = req.user?._id || req.user?.id;
    
    if (!adminId) {
      logger.error('Admin ID not found in request');
      return errorResponse(res, 401, 'Unauthorized: Admin authentication required');
    }

    // Validate inputs
    if (!deliveryPartnerId) {
      return errorResponse(res, 400, 'Delivery partner ID is required');
    }

    if (!amount || parseFloat(amount) <= 0) {
      return errorResponse(res, 400, 'Valid bonus amount is required');
    }

    const bonusAmount = parseFloat(amount);

    // Validate delivery partner ID format
    if (!mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
      logger.error(`Invalid delivery partner ID format: ${deliveryPartnerId}`);
      return errorResponse(res, 400, 'Invalid delivery partner ID format');
    }

    // Find delivery partner
    const delivery = await Delivery.findById(deliveryPartnerId);
    if (!delivery) {
      logger.error(`Delivery partner not found with ID: ${deliveryPartnerId}`);
      return errorResponse(res, 404, `Delivery partner not found with ID: ${deliveryPartnerId}`);
    }
    
    logger.info(`Found delivery partner: ${delivery.name} (${delivery.deliveryId})`);

    // Find or create wallet
    let wallet = await DeliveryWallet.findOne({ deliveryId: deliveryPartnerId });
    if (!wallet) {
      wallet = await DeliveryWallet.create({
        deliveryId: deliveryPartnerId,
        totalBalance: 0,
        cashInHand: 0,
        totalWithdrawn: 0,
        totalEarned: 0
      });
    }

    // Store old balance for logging
    const oldBalance = wallet.totalBalance || 0;
    const oldPocketBalance = (wallet.totalBalance || 0) - (wallet.cashInHand || 0);

    // Log before adding transaction
    logger.info(`📝 Before adding bonus:`, {
      walletId: wallet._id,
      currentTotalBalance: wallet.totalBalance,
      currentTotalEarned: wallet.totalEarned,
      currentCashInHand: wallet.cashInHand,
      bonusAmount: bonusAmount
    });

    // Add bonus transaction
    const transaction = wallet.addTransaction({
      amount: bonusAmount,
      type: 'bonus',
      status: 'Completed',
      description: reference ? `Admin Bonus: ${reference}` : 'Admin Bonus',
      processedAt: new Date(),
      processedBy: adminId,
      metadata: reference ? {
        bonusType: 'admin_bonus',
        reference: reference
      } : {
        bonusType: 'admin_bonus'
      }
    });

    // Log after adding transaction (before save)
    logger.info(`📝 After addTransaction (before save):`, {
      walletId: wallet._id,
      totalBalance: wallet.totalBalance,
      totalEarned: wallet.totalEarned,
      transactionAmount: transaction.amount,
      transactionType: transaction.type,
      transactionStatus: transaction.status
    });

    // Mark wallet as modified to ensure Mongoose saves all changes
    wallet.markModified('transactions');
    wallet.markModified('totalBalance');
    wallet.markModified('totalEarned');
    
    // Save wallet (this will update totalBalance and totalEarned)
    await wallet.save();
    
    // Double-check: Verify wallet was saved correctly
    const verifyWallet = await DeliveryWallet.findById(wallet._id);
    if (verifyWallet.totalBalance !== wallet.totalBalance) {
      logger.error(`❌ Wallet balance mismatch after save! Expected: ${wallet.totalBalance}, Got: ${verifyWallet.totalBalance}`);
    }

    // Log after save
    logger.info(`📝 After wallet.save():`, {
      walletId: wallet._id,
      totalBalance: wallet.totalBalance,
      totalEarned: wallet.totalEarned
    });

    // Reload wallet from database to ensure we have the latest data
    const updatedWallet = await DeliveryWallet.findById(wallet._id);
    
    if (!updatedWallet) {
      logger.error(`❌ Wallet not found after save: ${wallet._id}`);
      return errorResponse(res, 500, 'Failed to update wallet');
    }

    // Verify the balance was updated
    const newBalance = updatedWallet.totalBalance || 0;
    const newPocketBalance = updatedWallet.totalBalance || 0; // Pocket balance = total balance
    
    // Log final state
    logger.info(`📝 Final wallet state:`, {
      walletId: updatedWallet._id,
      newTotalBalance: newBalance,
      newPocketBalance: newPocketBalance,
      totalEarned: updatedWallet.totalEarned,
      cashInHand: updatedWallet.cashInHand,
      transactionsCount: updatedWallet.transactions.length,
      lastTransaction: updatedWallet.transactions[updatedWallet.transactions.length - 1]
    });
    
    logger.info(`✅ Bonus added successfully:`, {
      deliveryPartnerId: deliveryPartnerId,
      bonusAmount: bonusAmount,
      oldBalance: oldBalance,
      newBalance: newBalance,
      balanceIncrease: newBalance - oldBalance,
      oldPocketBalance: oldPocketBalance,
      newPocketBalance: newPocketBalance,
      pocketBalanceIncrease: newPocketBalance - oldPocketBalance,
      totalEarned: updatedWallet.totalEarned,
      cashInHand: updatedWallet.cashInHand,
      transactionId: transaction._id?.toString()
    });

    // Transaction is already available from addTransaction() call above

    // Safe helper to convert ID to string
    const safeIdToString = (id) => {
      if (!id) return null;
      if (typeof id === 'string') return id;
      if (id.toString && typeof id.toString === 'function') return id.toString();
      return String(id);
    };

    logger.info(`Bonus added to delivery partner: ${deliveryPartnerId}`, {
      adminId: safeIdToString(adminId) || 'not set',
      deliveryId: delivery.deliveryId || 'not set',
      bonusAmount,
      transactionId: transaction && transaction._id ? safeIdToString(transaction._id) : 'not set',
      reference: reference || 'none'
    });

    // Build response safely
    const responseData = {
      transaction: {
        _id: transaction && transaction._id ? transaction._id : null,
        transactionId: transaction && transaction._id ? safeIdToString(transaction._id) : null,
        amount: (transaction && transaction.amount !== undefined) ? transaction.amount : bonusAmount,
        type: (transaction && transaction.type) ? transaction.type : 'bonus',
        status: (transaction && transaction.status) ? transaction.status : 'Completed',
        description: (transaction && transaction.description) ? transaction.description : (reference ? `Admin Bonus: ${reference}` : 'Admin Bonus'),
        createdAt: (transaction && transaction.createdAt) ? transaction.createdAt : new Date(),
        reference: reference || null
      },
      wallet: {
        totalBalance: newBalance,
        totalEarned: (updatedWallet && updatedWallet.totalEarned !== undefined) ? updatedWallet.totalEarned : 0,
        cashInHand: (updatedWallet && updatedWallet.cashInHand !== undefined) ? updatedWallet.cashInHand : 0,
        pocketBalance: newPocketBalance, // Pocket balance = total balance (includes bonus)
        bonusAdded: bonusAmount,
        balanceBefore: oldBalance,
        balanceAfter: newBalance
      },
      delivery: {
        _id: (delivery && delivery._id) ? safeIdToString(delivery._id) : null,
        name: (delivery && delivery.name) ? delivery.name : 'Unknown',
        deliveryId: (delivery && delivery.deliveryId) ? delivery.deliveryId : null
      }
    };

    await notifyDeliveryPartnerBonus(req, deliveryPartnerId, {
      type: "bonus",
      title: "Bonus added",
      body: reference
        ? `You received a bonus of ₹${bonusAmount.toFixed(2)} (${reference})`
        : `You received a bonus of ₹${bonusAmount.toFixed(2)}`,
      amount: bonusAmount,
      reference: reference || null,
      transactionId: transaction && transaction._id ? safeIdToString(transaction._id) : null,
      deliveryPartnerId: safeIdToString(deliveryPartnerId),
      createdAt: new Date().toISOString(),
    });

    await sendPushNotificationToDeliveryPartner(deliveryPartnerId, {
      title: "Bonus added",
      description: reference
        ? `You received a bonus of ₹${bonusAmount.toFixed(2)} (${reference})`
        : `You received a bonus of ₹${bonusAmount.toFixed(2)}`,
    });

    return successResponse(res, 200, 'Bonus added successfully', responseData);
  } catch (error) {
    logger.error(`Error adding bonus: ${error.message}`, { 
      error: error.stack,
      deliveryPartnerId: deliveryPartnerId || 'not set',
      amount: amount || 'not set',
      adminId: adminId ? (adminId.toString ? adminId.toString() : String(adminId)) : 'not set',
      errorName: error.name
    });
    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Delivery Partner ID:', deliveryPartnerId || 'not set');
    console.error('Amount:', amount || 'not set');
    console.error('Admin ID:', adminId ? (adminId.toString ? adminId.toString() : String(adminId)) : 'not set');
    console.error('Request body:', req.body);
    console.error('Request user:', req.user ? { id: req.user._id || req.user.id, role: req.user.role } : 'not set');
    console.error('==========================');
    return errorResponse(res, 500, `Failed to add bonus: ${error.message}`);
  }
});

/**
 * Get Bonus Transactions
 * GET /api/admin/delivery-partners/bonus/transactions
 * Query params: page, limit, search, deliveryPartnerId
 */
export const getBonusTransactions = asyncHandler(async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      search,
      deliveryPartnerId
    } = req.query;

    // Build query for wallets with bonus transactions
    const walletQuery = {};
    if (deliveryPartnerId) {
      walletQuery.deliveryId = deliveryPartnerId;
    }

    // Find wallets with bonus transactions
    const wallets = await DeliveryWallet.find(walletQuery)
      .populate('deliveryId', 'name deliveryId phone email')
      .lean();

    // Extract all bonus transactions
    let allTransactions = [];
    wallets.forEach(wallet => {
      wallet.transactions
        .filter(t => t.type === 'bonus')
        .forEach(transaction => {
          allTransactions.push({
            ...transaction,
            deliveryPartner: {
              _id: wallet.deliveryId._id || wallet.deliveryId,
              name: wallet.deliveryId.name || 'Unknown',
              deliveryId: wallet.deliveryId.deliveryId || 'N/A',
              phone: wallet.deliveryId.phone || 'N/A'
            },
            walletId: wallet._id
          });
        });
    });

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allTransactions = allTransactions.filter(t => 
        t.deliveryPartner.name.toLowerCase().includes(searchLower) ||
        t.deliveryPartner.deliveryId.toLowerCase().includes(searchLower) ||
        t._id.toString().toLowerCase().includes(searchLower) ||
        (t.metadata?.reference && t.metadata.reference.toLowerCase().includes(searchLower))
      );
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = allTransactions.length;
    const paginatedTransactions = allTransactions.slice(skip, skip + parseInt(limit));

    // Format response
    const formattedTransactions = paginatedTransactions.map((transaction, index) => ({
      sl: skip + index + 1,
      transactionId: transaction._id.toString(),
      deliveryman: transaction.deliveryPartner.name,
      deliveryPartnerId: transaction.deliveryPartner._id.toString(),
      deliveryId: transaction.deliveryPartner.deliveryId,
      bonus: `₹${transaction.amount.toFixed(2)}`,
      amount: transaction.amount,
      reference: transaction.metadata?.reference || transaction.description || 'N/A',
      createdAt: transaction.createdAt,
      status: transaction.status,
      processedBy: transaction.processedBy
    }));

    return successResponse(res, 200, 'Bonus transactions retrieved successfully', {
      transactions: formattedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching bonus transactions: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to fetch bonus transactions');
  }
});

