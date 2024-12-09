const { Organization } = require('../models');
const { getPaddleClient } = require('../config/paddle');

const billingService = {
  async getSubscription(organizationId) {
    try {
      const organization = await Organization.findById(organizationId)
        .select('subscription plan');

      if (!organization?.subscription?.customerId) {
        return {
          plan: organization?.plan || 'free',
          subscription: null
        };
      }

      // Get real-time subscription data from Paddle
      const paddle = getPaddleClient();
      const subscription = await paddle.subscriptions.get(organization.subscription.subscriptionId);

      return {
        plan: organization.plan,
        subscription: {
          status: organization.subscription.status,
          customerId: organization.subscription.customerId,
          subscriptionId: organization.subscription.subscriptionId,
          nextBillingDate: subscription.next_billed_at,
          lastBillingDate: subscription.last_billed_at,
          amount: subscription.items[0].price.unit_price,
          interval: subscription.items[0].billing_cycle.interval
        }
      };
    } catch (error) {
      console.error('Get subscription error:', error);
      throw error;
    }
  },

  async getTransactions(organizationId) {
    try {
      const organization = await Organization.findById(organizationId)
        .select('subscription');

      if (!organization?.subscription?.customerId) {
        return [];
      }

      // Get transactions from Paddle
      const paddle = getPaddleClient();
      const { data: transactions } = await paddle.transactions.list({
        customer_id: organization.subscription.customerId,
        order: 'desc'
      });

      return transactions.map(transaction => ({
        id: transaction.id,
        date: transaction.created_at,
        amount: transaction.details.totals.total,
        currency: transaction.currency_code,
        status: transaction.status,
        invoiceUrl: transaction.invoice_url
      }));
    } catch (error) {
      console.error('Get transactions error:', error);
      throw error;
    }
  },

  async handleSubscriptionActivated(eventData) {
    try {
      const organizationId = eventData.data.custom_data?.organizationId;
      if (!organizationId) {
        throw new Error('Missing organization ID in webhook data');
      }

      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Map product ID to plan
      const planMapping = {
        'pro_01jegxajzwadrcgw07zdzgt2n8': 'pro',
        // Add other plan mappings as needed
      };

      // Update organization subscription data
      organization.subscription = {
        customerId: eventData.data.customer_id,
        subscriptionId: eventData.data.subscription_id,
        status: 'active',
        updatedAt: new Date()
      };

      organization.plan = planMapping[eventData.data.items[0].product.id] || 'free';
      
      await organization.save();
      return organization;
    } catch (error) {
      console.error('Handle subscription activated error:', error);
      throw error;
    }
  },

  async handleSubscriptionUpdated(eventData) {
    try {
      const organizationId = eventData.data.custom_data?.organization_id;
      if (!organizationId) {
        throw new Error('Missing organization ID in webhook data');
      }

      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Update subscription status
      organization.subscription.status = eventData.data.status;
      organization.subscription.updatedAt = new Date();
      
      await organization.save();
      return organization;
    } catch (error) {
      console.error('Handle subscription updated error:', error);
      throw error;
    }
  },

  async handleSubscriptionCanceled(eventData) {
    try {
      const organizationId = eventData.data.custom_data?.organization_id;
      if (!organizationId) {
        throw new Error('Missing organization ID in webhook data');
      }

      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Update subscription status
      organization.subscription.status = 'cancelled';
      organization.subscription.updatedAt = new Date();
      organization.plan = 'free';
      
      await organization.save();
      return organization;
    } catch (error) {
      console.error('Handle subscription canceled error:', error);
      throw error;
    }
  }
};

module.exports = billingService;