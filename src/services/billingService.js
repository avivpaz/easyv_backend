// services/billingService.js
const { Organization } = require('../models');
const { getPaddleClient } = require('../config/paddle');

const billingService = {
  async getCreditsBalance(organizationId) {
    try {
      const organization = await Organization.findById(organizationId)
        .select('credits customerId');

      return {
        credits: organization?.credits || 0
      };
    } catch (error) {
      console.error('Get credits balance error:', error);
      throw error;
    }
  },

  async getTransactions(organizationId) {
    try {
      const organization = await Organization.findById(organizationId)
        .select('customerId');

      if (!organization?.customerId) {
        return [];
      }

      // Get transactions directly from Paddle
      const paddle = getPaddleClient();
      const { data: transactions } = await paddle.transactions.list({
        customer_id: organization.customerId,
        order: 'desc'
      });

      // Map Paddle transactions to our format
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
  },

  async handleCreditPurchase(eventData) {
    try {
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
        organization.customerId = eventData.data.customer.id;
      }

      // Only add credits if the transaction is completed
      if (eventData.data.status === 'completed') {
        organization.credits += credits;
        await organization.save();
      }

      return organization;
    } catch (error) {
      console.error('Handle credit purchase error:', error);
      throw error;
    }
  },

  async deductCredits(organizationId, creditsToDeduct = 1) {
    try {
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check if organization has enough credits
      if (organization.credits < creditsToDeduct) {
        throw new Error('Insufficient credits');
      }

      // Deduct credits
      organization.credits -= creditsToDeduct;
      await organization.save();

      return {
        success: true,
        remainingCredits: organization.credits
      };
    } catch (error) {
      console.error('Deduct credits error:', error);
      throw error;
    }
  }
};

module.exports = billingService;