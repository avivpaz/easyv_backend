  // controllers/billingController.js
  const billingService = require('../services/billingService');
  const { verifyPaddleWebhook } = require('../config/paddle');

  const billingController = {
    async createPayPalOrder(req, res) {
      try {
        const { price, customData } = req.body;
        
        if (!price || !customData.credits || !customData.organizationId) {
          return res.status(400).json({ 
            error: 'Missing required fields' 
          });
        }
  
        // Verify organization ownership
        if (customData.organizationId !== req.user.organizationId.toString()) {
          return res.status(403).json({ error: 'Access denied' });
        }
  
        const order = await billingService.createPayPalOrder({
          price,
          customData: {
            ...customData,
            userId: req.user.id
          }
        });
  
        const orderResponse = await billingService.createPayPalOrder({
          price,
          customData: {
            ...customData,
            userId: req.user.id
          }
        });
    
        res.json({
          id: orderResponse.id,
          status: orderResponse.status,
          approve_url: orderResponse.approve_url,
          links: orderResponse.links
        });
      } catch (error) {
        console.error('Create PayPal order error:', error);
        res.status(500).json({ 
          error: 'Failed to create PayPal order'
        });
      }
    },

async approvePayPalOrder(req, res) {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ 
        error: 'Missing orderId' 
      });
    }

    const orderData = await billingService.approvePayPalOrder(orderId);

    res.json({
      status: orderData.status,
      purchase_units: orderData.purchase_units,
      details: orderData.details
    });
  } catch (error) {
    console.error('Approve PayPal order error:', error);
    
    // Check for specific PayPal API errors
    if (error.details?.[0]?.issue === 'INSTRUMENT_DECLINED') {
      return res.status(400).json({
        error: 'Payment declined',
        details: error.details
      });
    }

    res.status(500).json({ 
      error: 'Failed to approve PayPal order',
      details: error.message
    });
  }
},
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
      const eventData = req.body;
      console.log(`Processing webhook event_id: ${eventData.event_id}, type: ${eventData.event_type}`);

      try {
        // Verify webhook signature
        const isValid = await verifyPaddleWebhook(req);
        if (!isValid) {
          console.error(`Invalid webhook signature for event: ${eventData.event_id}`);
          return res.status(400).json({ 
            success: false,
            error: 'Invalid webhook signature'
          });
        }

        // Only process completed transactions
        if (eventData.event_type === 'transaction.completed') {
          // Check if this is a credit purchase event
          const credits = parseInt(eventData.data.custom_data?.credits);
          if (!credits) {
            console.log(`Skipping non-credit purchase event: ${eventData.event_id}`);
            return res.status(200).json({
              success: true,
              message: 'Not a credit purchase event'
            });
          }

          console.log(`Processing credit purchase event: ${eventData.event_id}, credits: ${credits}`);
          const result = await billingService.handleCreditPurchase(eventData);
          
          if (result === null) {
            console.log(`Event ${eventData.event_id} was already processed`);
            return res.status(200).json({
              success: true,
              message: 'Event already processed'
            });
          }

          console.log(`Successfully processed event ${eventData.event_id}`);
          return res.status(200).json({
            success: true,
            message: 'Credit purchase processed'
          });
        }

        // For non-transaction.completed events
        console.log(`Ignoring non-completed transaction event: ${eventData.event_id}`);
        return res.status(200).json({
          success: true,
          message: 'Event type not relevant'
        });

      } catch (error) {
        console.error(`Webhook error for event ${eventData.event_id}:`, error);
        
        // Still return 200 to prevent Paddle from retrying
        return res.status(200).json({
          success: false,
          error: error.message
        });
      }
    }
  };

  module.exports = billingController;