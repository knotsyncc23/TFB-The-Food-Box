import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
  uploadProfileImage,
  removeProfileImage,
  updateUserLocation,
  getUserLocation,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress
} from '../controllers/userController.js';
import { authenticate } from '../../auth/middleware/auth.js';
import { uploadMiddleware } from '../../../shared/utils/cloudinaryService.js';
import userWalletRoutes from './userWalletRoutes.js';
import complaintRoutes from './complaintRoutes.js';
import { getUserNotifications } from '../controllers/notificationController.js';

const router = express.Router();

// All routes require user authentication
router.use(authenticate);

// Profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.delete('/profile', deleteUserAccount);

// Profile image upload
router.post(
  '/profile/avatar',
  uploadMiddleware.single('image'),
  uploadProfileImage
);

// Profile image removal
router.delete('/profile/avatar', removeProfileImage);

// Location routes
router.get('/location', getUserLocation);
router.put('/location', updateUserLocation);

// Address routes
router.get('/addresses', getUserAddresses);
router.post('/addresses', addUserAddress);
router.put('/addresses/:id', updateUserAddress);
router.delete('/addresses/:id', deleteUserAddress);

// Wallet routes
router.use('/wallet', userWalletRoutes);

// Notifications
router.get('/notifications', getUserNotifications);

// Complaint routes
router.use('/complaints', complaintRoutes);

export default router;

