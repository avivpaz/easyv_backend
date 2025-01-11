// services/integrationService.js
const { OAuth2Client } = require('google-auth-library');
const { EmailIntegration } = require('../models');

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

const integrationService = {
  async connectGmailAccount(code, userId, organizationId) {
    try {
      // Exchange code for tokens
      const { tokens } = await googleClient.getToken(code);
      
      // Get user info using the access token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info from Google');
      }

      const userData = await userInfoResponse.json();
      const { email } = userData;

      // Create or update integration
      const integration = await EmailIntegration.findOneAndUpdate(
        { 
          userId,
          organization: organizationId,
          email,
          provider: 'gmail'
        },
        {
          refreshToken: tokens.refresh_token,
          status: 'active',
          lastSyncTime: new Date(),
          'providerMetadata.access_token': tokens.access_token,
          'providerMetadata.token_type': tokens.token_type,
          'providerMetadata.scope': tokens.scope,
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        data: {
          integrationId: integration._id,
          email: integration.email,
          status: integration.status
        }
      };
    } catch (error) {
      console.error('Gmail integration error:', error);
      return { success: false, error: error.message };
    }
  },

  async listIntegrations(userId, organizationId, type) {
    try {
      const query = {
        userId,
        organization: organizationId
      };
      
      // Add provider type if specified
      if (type) {
        query.provider = { $in: type === 'email' ? ['gmail', 'outlook'] : [] };
      }
  
      const integrations = await EmailIntegration.find(query);
  
      return {
        success: true,
        data: integrations
      };
    } catch (error) {
      console.error('List integrations error:', error);
      return { success: false, error: error.message };
    }
},

  async disconnectIntegration(integrationId, userId) {
    try {
      const integration = await EmailIntegration.findOneAndUpdate(
        {
          _id: integrationId,
          userId
        },
        {
          status: 'disconnected',
          'providerMetadata.access_token': null
        },
        { new: true }
      );

      if (!integration) {
        return { success: false, error: 'Integration not found' };
      }

      return {
        success: true,
        data: integration
      };
    } catch (error) {
      console.error('Disconnect integration error:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = integrationService;