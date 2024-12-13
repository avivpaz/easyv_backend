// routes/billing.js
const express = require('express');
const router = express.Router();
const { 
  handleWebhook, 
  getCreditsBalance, 
  getTransactions 
} = require('../controllers/billingController');
const authMiddleware = require('../middleware/auth');

// Changed from /subscription to /credits
router.get('/credits/:organizationId', authMiddleware, getCreditsBalance);
router.get('/transactions/:organizationId', authMiddleware, getTransactions);
router.post('/webhook', handleWebhook);

module.exports = router;