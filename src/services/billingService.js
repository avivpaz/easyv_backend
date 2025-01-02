const mongoose = require('mongoose');
const { Organization, CreditTransaction } = require('../models');

// Cache for PayPal SDK
let paypalSDK = null;

// Helper function to load PayPal SDK
async function loadPayPalSDK() {
  if (!paypalSDK) {
    paypalSDK = await import('@paypal/paypal-server-sdk');
  }
  return paypalSDK;
}

class BillingService {
  async getPayPalClient() {
    const sdk = await loadPayPalSDK();
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    const environment = process.env.NODE_ENV === 'production'
      ?  sdk.Environment.Production
      :  sdk.Environment.Sandbox;

    return  new sdk.Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
    },
    timeout: 0,
    environment: environment,
    logging: {
        logLevel: sdk.LogLevel.info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
    }
    });
  }

  async createPayPalOrder(data) {
    const { price, customData } = data;
    
    try {
      const sdk = await loadPayPalSDK();
      const client = await this.getPayPalClient();
      const ordersController = new sdk.OrdersController(client);

      const orderData={ 
        prefer: "return=minimal",
         body:{
            intent: 'CAPTURE',
            applicationContext: {
              shippingPreference: 'NO_SHIPPING'
            },
            purchaseUnits: [{
              referenceId: customData.organizationId,
              description: `${customData.credits} CV Credits Purchase`,
              customId: JSON.stringify({
                credits: customData.credits,
                organizationId: customData.organizationId,
                tier: customData.tier || 'custom'
              }),
              amount: {
                currencyCode: 'USD',
                value: Number(price).toFixed(2)
              }
            }]
      }}

      try {
        const order = await ordersController.ordersCreate(orderData);
        return JSON.parse(order.body);
      } catch (error) {
        if (error instanceof sdk.ApiError) {
          console.error('PayPal API Error:', {
            statusCode: error.statusCode,
            message: error.message,
            details: error.details
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('PayPal order creation error:', error);
      throw error;
    }
  }


async approvePayPalOrder(orderId) {
  try {
    const sdk = await loadPayPalSDK();
    const client = await this.getPayPalClient();
    const ordersController = new sdk.OrdersController(client);
    const collect = {
      id: orderId,
      prefer: "return=minimal",
  };

    try {
      const order = await ordersController.ordersCapture(collect);
      const orderData = JSON.parse(order.body);
      
      // Process the successful payment
      if (orderData.status === 'COMPLETED') {
        await this.handleCreditPurchase(orderData);
      }

      return orderData;
    } catch (error) {
      if (error instanceof sdk.ApiError) {
        console.error('PayPal API Error:', {
          statusCode: error.statusCode,
          message: error.message,
          details: error.details
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('PayPal order capture error:', error);
    throw error;
  }
}

  async createCreditTransaction(data) {
    const { organizationId, type, amount, relatedEntity, metadata } = data;
    
    try {
      if (metadata?.paypalOrderId) {
        const existingTransaction = await CreditTransaction.findOne({
          'metadata.paypalOrderId': metadata.paypalOrderId
        });

        if (existingTransaction) {
          console.log(`Order ${metadata.paypalOrderId} already processed`);
          return existingTransaction;
        }
      }

      const latestTransaction = await CreditTransaction.findOne({ 
        organization: organizationId 
      })
      .sort({ createdAt: -1 })
      .select('balanceAfter');

      const currentBalance = latestTransaction?.balanceAfter || 0;
      const newBalance = currentBalance + amount;

      if (newBalance < 0) {
        throw new Error('Insufficient credits');
      }

      const transactionData = {
        organization: organizationId,
        type,
        amount,
        balanceAfter: newBalance,
        relatedEntity,
        metadata
      };

      const isDocumentDB = process.env.NODE_ENV === 'production';
      if (false) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try { 
          const transaction = await CreditTransaction.create([transactionData], { session });
          await session.commitTransaction();
          return transaction[0];
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      } else {
        return await CreditTransaction.create(transactionData);
      }
    } catch (error) {
      console.error('Create transaction error:', error);
      throw error;
    }
  }

  async getCreditsBalance(organizationId) {
    try {
      const latestTransaction = await CreditTransaction.findOne({ 
        organization: organizationId 
      })
      .sort({ createdAt: -1 })
      .select('balanceAfter');

      return {
        credits: latestTransaction?.balanceAfter || 0
      };
    } catch (error) {
      console.error('Get credits balance error:', error);
      throw error;
    }
  }

  async getTransactions(organizationId) {
    try {
      const transactions = await CreditTransaction.find({ 
        organization: organizationId,
        type: 'purchase'
      })
      .sort({ createdAt: -1 })
      .select('amount metadata createdAt balanceAfter')
      .populate('metadata.performedBy', 'fullName email');
  
      return transactions.map(transaction => ({
        id: transaction.metadata.paypalOrderId, // Updated from paddleTransactionId
        date: transaction.createdAt,
        amount: transaction.amount,
        credits: transaction.amount,
        status: 'completed', // PayPal transactions are only recorded when completed
        performedBy: transaction.metadata.performedBy ? {
          id: transaction.metadata.performedBy._id,
          name: transaction.metadata.performedBy.fullName,
          email: transaction.metadata.performedBy.email
        } : null,
        description: transaction.metadata.description
      }));
    } catch (error) {
      console.error('Get transactions error:', error);
      throw error;
    }
  } 

  async handleCreditPurchase(orderData) {
    try {
      const existingTransaction = await CreditTransaction.findOne({
        'metadata.paypalOrderId': orderData.id
      });
  
      if (existingTransaction) {
        console.log(`Order ${orderData.id} already processed`);
        return null;
      }
  
      const customData = JSON.parse(orderData.purchase_units[0].payments.captures[0].custom_id);
      const organizationId = customData.organizationId;
      const credits = parseInt(customData.credits) || 0;
      
      if (!organizationId || !credits) {
        throw new Error('Missing required data in order');
      }
  
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }
  
      if (orderData.status === 'COMPLETED') {
        await this.createCreditTransaction({
          organizationId,
          type: 'purchase',
          amount: credits,
          metadata: {
            description: `PayPal purchase - ${credits} credits`,
            performedBy: customData.userId,
            paypalOrderId: orderData.id // Use paypalOrderId instead of paddleTransactionId
          }
        });
      }
  
      return organization;
    } catch (error) {
      console.error('Handle credit purchase error:', error);
      throw error;
    }
  }

  async deductCredits(organizationId, creditsToDeduct = 1, metadata = {}) {
    try {
      const transaction = await this.createCreditTransaction({
        organizationId,
        type: 'deduction',
        amount: -creditsToDeduct,
        relatedEntity: metadata.entityType && metadata.entityId ? {
          entityType: metadata.entityType,
          entityId: metadata.entityId
        } : undefined,
        metadata: {
          description: metadata.description || `Deduction of ${creditsToDeduct} credits`,
          performedBy: metadata.performedBy
        }
      });
  
      return {
        success: true,
        remainingCredits: transaction.balanceAfter
      };
    } catch (error) {
      if (error.message === 'Insufficient credits') {
        return {
          success: false,
          error: 'Insufficient credits',
          remainingCredits: (await this.getCreditsBalance(organizationId)).credits
        };
      }
      throw error;
    }
  }
  async addCreditsManually(organizationId, amount, adminUserId, reason) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
  
    return this.createCreditTransaction({
      organizationId,
      type: 'adjustment',
      amount,
      metadata: {
        description: reason || `Manual credit adjustment: +${amount} credits`,
        performedBy: adminUserId
      }
    });
  }

  async getCreditHistory(organizationId, options = {}) {
    const {
      startDate,
      endDate,
      type,
      limit = 50,
      page = 1
    } = options;

    const query = { organization: organizationId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (type) query.type = type;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      CreditTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('metadata.performedBy', 'fullName email')
        .populate('relatedEntity.entityId'),
      CreditTransaction.countDocuments(query)
    ]);

    return {
      transactions,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        hasMore: skip + transactions.length < total
      }
    };
  }
}

module.exports = new BillingService();