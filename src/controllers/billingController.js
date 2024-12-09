const billingService = require('../services/billingService');
const { verifyPaddleWebhook } = require('../config/paddle');

  async function getSubscription(req, res) {
    try {
      const { organizationId } = req.params;
      
      // Verify organization ownership
      if (organizationId !== req.user.organizationId.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const subscription = await billingService.getSubscription(organizationId);
      res.json(subscription);
    } catch (error) {
      console.error('Get subscription error:', error);
      res.status(500).json({ error: 'Failed to fetch subscription information' });
    }
  }

  async function getTransactions(req, res) {
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
  }

  async function handleWebhook(req, res) {
    try {
      const eventData = req.body;
      
      // Verify webhook signature
      const isValid = await verifyPaddleWebhook(req);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      console.log('Webhook received:', eventData);

      if (eventData.event_type === 'subscription.activated') {
        await billingService.handleSubscriptionActivated(eventData);
      } else if (eventData.event_type === 'subscription.updated') {
        await billingService.handleSubscriptionUpdated(eventData);
      } else if (eventData.event_type === 'subscription.canceled') {
        await billingService.handleSubscriptionCanceled(eventData);
      }

      // Always return 200 to acknowledge receipt
      res.json({ success: true });
    } catch (error) {
      console.error('Webhook handler error:', error);
      // Still return 200 to acknowledge receipt
      res.json({ success: false, error: error.message });
    }
  }

module.exports = {getSubscription,getTransactions,handleWebhook};