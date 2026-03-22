import express from 'express';
import { getContactUsPublic } from '../controllers/contactUsController.js';

const router = express.Router();

router.get('/contact-us/public', getContactUsPublic);

export default router;
