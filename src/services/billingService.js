const mongoose = require('mongoose');
const { Organization, CreditTransaction } = require('../models');
const { getPaddleClient } = require('../config/paddle');

class BillingService {
  async createCreditTransaction(data) {
    const { organizationId, type, amount, relatedEntity, metadata } = data;
    
    try {
      // Check for existing event if it's a Paddle transaction
      if (metadata?.paddleEventId) {
        const existingTransaction = await CreditTransaction.findOne({
          'metadata.paddleEventId': metadata.paddleEventId
        });

        if (existingTransaction) {
          console.log(`Event ${metadata.paddleEventId} already processed`);
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
    // TODO change this false to check i document db 
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
      const organization = await Organization.findById(organizationId)
        .select('customerId');

      if (!organization?.customerId) {
        return [];
      }

      const paddle = getPaddleClient();
      const { data: transactions } = await paddle.transactions.list({
        customer_id: organization.customerId,
        order: 'desc'
      });

      return transactions.map(transaction => ({
        id: transaction.id,
        date: transaction.created_at,
        amount: transaction.details.totals.total,
        credits: transaction.custom_data?.credits || 0,
        status: transaction.status,
        invoiceUrl: transaction.invoice_url
      }));
    } catch (error) {
      console.error('Get transactions error:', error);
      throw error;
    }
  }

  async handleCreditPurchase(eventData) {
    try {
      // Check if we've already processed this event
      const existingTransaction = await CreditTransaction.findOne({
        'metadata.paddleEventId': eventData.event_id
      });

      if (existingTransaction) {
        console.log(`Event ${eventData.event_id} already processed`);
        return null;
      }

      const organizationId = eventData.data.custom_data?.organizationId;
      const credits = parseInt(eventData.data.custom_data?.credits) || 0;
      
      if (!organizationId || !credits) {
        throw new Error('Missing required data in webhook');
      }

      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Store/update customer ID
      if (!organization.customerId) {
        organization.customerId = eventData.data.customer_id;
        await organization.save();
      }

      // Only add credits if the transaction is completed
      if (eventData.data.status === 'completed') {
        await this.createCreditTransaction({
          organizationId,
          type: 'purchase',
          amount: credits,
          metadata: {
            paddleTransactionId: eventData.data.id,
            paddleEventId: eventData.event_id,  // Store event ID for deduplication
            description: `Credit purchase - ${credits} credits`,
            performedBy: eventData.data.custom_data?.userId
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
        relatedEntity: metadata.relatedEntity,
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
        performedBy: adminUserId,
        isManualAdjustment: true
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