// controllers/billingController.js
const billingService = require('../services/billingService');
const { verifyPaddleWebhook } = require('../config/paddle');

const billingController = {
  async getCreditsBalance(req, res) {
    try {
      const { organizationId } = req.params;
      
      // Verify organization ownership
      if (organizationId !== req.user.organizationId.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const balance = await billingService.getCreditsBalance(organizationId);
      res.json(balance);
    } catch (error) {
      console.error('Get credits balance error:', error);
      res.status(500).json({ error: 'Failed to fetch credits information' });
    }
  },

  async getTransactions(req, res) {
    try {
      const { organizationId } = req.params;
      
      // Verify organization ownership
      if (organizationId !== req.user.organizationId.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const transactions = await billingService.getTransactions(organizationId);
      res.json(transactions);
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  },

  async handleWebhook(req, res) {
    try {
      const eventData = req.body;
      
      // Verify webhook signature
      const isValid = await verifyPaddleWebhook(req);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      console.log('Webhook received:', eventData);

      // Only care about completed transactions that add credits
      if (eventData.event_type === 'transaction.completed') {
        await billingService.handleCreditPurchase(eventData);
      }

      // Always return 200 to acknowledge receipt
      res.json({ success: true });
    } catch (error) {
      console.error('Webhook handler error:', error);
      // Still return 200 to acknowledge receipt
      res.json({ success: false, error: error.message });
    }
  }
};

module.exports = billingController;