const express = require('express');
const router = express.Router();
const {handleWebhook,getSubscription,getTransactions} = require('../controllers/billingController');
const authMiddleware = require('../middleware/auth');

router.get('/subscription/:organizationId', authMiddleware, getSubscription);
router.get('/transactions/:organizationId', authMiddleware, getTransactions);
router.post('/webhook', handleWebhook);

module.exports = router;