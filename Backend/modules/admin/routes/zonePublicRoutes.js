import express from 'express';
import { detectUserZone, getActiveZonesPublic } from '../controllers/zoneController.js';

const router = express.Router();

// Public route - Zone detection for users (no auth required)
router.get('/zones/detect', detectUserZone);
router.get('/zones/active', getActiveZonesPublic);

export default router;
