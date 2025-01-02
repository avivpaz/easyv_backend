const billingService = require('../services/billingService');
const { verifyPaddleWebhook } = require('../config/paddle');

async function createPayPalOrder(req, res, next) {
  try {
    const { price, customData } = req.body;
    
    if (!price || !customData.credits || !customData.organizationId) {
      const error = new Error('Missing required fields');
      error.statusCode = 400;
      return next(error);
    }

    // Verify organization ownership
    if (customData.organizationId !== req.user.organizationId.toString()) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      return next(error);
    }

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
    if (!error.statusCode) {
      error.statusCode = 500;
      error.message = 'Failed to create PayPal order';
    }
    next(error);
  }
}

async function approvePayPalOrder(req, res, next) {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      const error = new Error('Missing orderId');
      error.statusCode = 400;
      return next(error);
    }

    const orderData = await billingService.approvePayPalOrder(orderId);
    
    res.json({
      status: orderData.status,
      purchase_units: orderData.purchase_units,
      details: orderData.details
    });
  } catch (error) {
    console.error('Approve PayPal order error:', error);
    
    if (error.details?.[0]?.issue === 'INSTRUMENT_DECLINED') {
      error.statusCode = 400;
      error.message = 'Payment declined';
    } else {
      error.statusCode = 500;
      error.message = 'Failed to approve PayPal order';
    }
    next(error);
  }
}

async function getCreditsBalance(req, res, next) {
  try {
    const { organizationId } = req.params;
    
    if (organizationId !== req.user.organizationId.toString()) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      return next(error);
    }

    const result = await billingService.getCreditsBalance(organizationId);
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }
    
    res.json(result.data);
  } catch (error) {
    console.error('Get credits balance error:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
      error.message = 'Failed to fetch credits information';
    }
    next(error);
  }
}

async function getTransactions(req, res, next) {
  try {
    const { organizationId } = req.params;
    
    if (organizationId !== req.user.organizationId.toString()) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      return next(error);
    }

    const result = await billingService.getTransactions(organizationId);
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }
    
    res.json(result.data);
  } catch (error) {
    console.error('Get transactions error:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
      error.message = 'Failed to fetch transactions';
    }
    next(error);
  }
}

async function handleWebhook(req, res, next) {
  const eventData = req.body;
  console.log(`Processing webhook event_id: ${eventData.event_id}, type: ${eventData.event_type}`);

  try {
    const isValid = await verifyPaddleWebhook(req);
    if (!isValid) {
      const error = new Error('Invalid webhook signature');
      error.statusCode = 400;
      return next(error);
    }

    // Only process completed transactions
    if (eventData.event_type === 'transaction.completed') {
      const credits = parseInt(eventData.data.custom_data?.credits);
      if (!credits) {
        return res.json({
          success: true,
          message: 'Not a credit purchase event'
        });
      }

      console.log(`Processing credit purchase event: ${eventData.event_id}, credits: ${credits}`);
      const result = await billingService.handleCreditPurchase(eventData);
      
      if (result === null) {
        return res.json({
          success: true,
          message: 'Event already processed'
        });
      }

      if (!result.success) {
        const error = new Error(result.error);
        error.statusCode = 400;
        return next(error);
      }

      return res.json({
        success: true,
        message: 'Credit purchase processed'
      });
    }

    // For non-transaction.completed events
    return res.json({
      success: true,
      message: 'Event type not relevant'
    });

  } catch (error) {
    console.error(`Webhook error for event ${eventData.event_id}:`, error);
    // For webhooks, we still return 200 to prevent retries, but include error in response
    res.status(200).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  createPayPalOrder,
  approvePayPalOrder,
  getCreditsBalance,
  getTransactions,
  handleWebhook
};