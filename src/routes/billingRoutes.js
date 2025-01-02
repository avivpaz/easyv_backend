// routes/billing.js
const express = require('express');
const router = express.Router();
const { 
  createPayPalOrder,
  handleWebhook, 
  getCreditsBalance, 
  getTransactions ,
  approvePayPalOrder
} = require('../controllers/billingController');
const authMiddleware = require('../middleware/auth');

router.post('/create-paypal-order', authMiddleware, createPayPalOrder);
router.post('/approve-paypal-order', authMiddleware, approvePayPalOrder);
router.get('/credits/:organizationId', authMiddleware, getCreditsBalance);
router.get('/transactions/:organizationId', authMiddleware, getTransactions);
router.post('/webhook', handleWebhook);

module.exports = router;