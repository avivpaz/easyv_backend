const { OAuth2Client } = require('google-auth-library');
const { Integration, EmailIntegration, SocialIntegration, JobPlatformIntegration } = require('../models');
const { scanGmailInbox } = require('./emailScanner/gmailScanner');

// OAuth clients
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

const integrationService = {
  // Helper function to get the correct integration model
  getIntegrationModel(type) {
    switch (type) {
      case 'email':
        return EmailIntegration;
      case 'social':
        return SocialIntegration;
      case 'jobPlatform':
        return JobPlatformIntegration;
      default:
        return Integration;
    }
  },

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

      // Create or update integration using EmailIntegration model
      const integration = await EmailIntegration.findOneAndUpdate(
        { 
          userId,
          organization: organizationId,
          email,
          provider: 'gmail',
          integrationType: 'email'  // Required for discriminator
        },
        {
          refreshToken: tokens.refresh_token,
          status: 'active',
          lastSyncTime: new Date(),
          credentials: {
            access_token: tokens.access_token,
            token_type: tokens.token_type,
            scope: tokens.scope
          }
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        data: {
          integrationId: integration._id,
          email: integration.email,
          status: integration.status,
          type: integration.integrationType
        }
      };
    } catch (error) {
      console.error('Gmail integration error:', error);
      return { success: false, error: error.message };
    }
  },

  async connectSocialAccount(provider, accessToken, userId, organizationId, profileData) {
    try {
      const integration = await SocialIntegration.findOneAndUpdate(
        {
          userId,
          organization: organizationId,
          provider,
          integrationType: 'social'
        },
        {
          status: 'active',
          lastSyncTime: new Date(),
          socialHandle: profileData.handle,
          socialProfile: profileData.profileUrl,
          credentials: {
            access_token: accessToken
          },
          providerMetadata: profileData
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        data: {
          integrationId: integration._id,
          provider: integration.provider,
          status: integration.status,
          type: integration.integrationType
        }
      };
    } catch (error) {
      console.error('Social integration error:', error);
      return { success: false, error: error.message };
    }
  },

  async listIntegrations(userId, organizationId, type) {
    try {
      const query = {
        userId,
        organization: organizationId
      };
      
      if (type) {
        query.integrationType = type;
      }
  
      // Use the base Integration model to query all types
      const integrations = await Integration.find(query);
  
      return {
        success: true,
        data: integrations.map(integration => ({
          id: integration._id,
          type: integration.integrationType,
          provider: integration.provider,
          status: integration.status,
          lastSyncTime: integration.lastSyncTime,
          // Add type-specific fields based on integrationType
          ...(integration.integrationType === 'email' && { email: integration.email }),
          ...(integration.integrationType === 'social' && { 
            socialHandle: integration.socialHandle,
            socialProfile: integration.socialProfile
          })
        }))
      };
    } catch (error) {
      console.error('List integrations error:', error);
      return { success: false, error: error.message };
    }
  },

  async disconnectIntegration(integrationId, userId) {
    try {
      // First, find the integration to get its type
      const existingIntegration = await Integration.findOne({
        _id: integrationId,
        userId
      });

      if (!existingIntegration) {
        return { success: false, error: 'Integration not found' };
      }

      // Use the correct model based on type
      const IntegrationModel = this.getIntegrationModel(existingIntegration.integrationType);
      
      const integration = await IntegrationModel.findOneAndUpdate(
        {
          _id: integrationId,
          userId
        },
        {
          status: 'disconnected',
          credentials: null  // Clear sensitive data
        },
        { new: true }
      );

      return {
        success: true,
        data: {
          id: integration._id,
          type: integration.integrationType,
          provider: integration.provider,
          status: integration.status
        }
      };
    } catch (error) {
      console.error('Disconnect integration error:', error);
      return { success: false, error: error.message };
    }
  },


  async syncEmailIntegration(integration) {
    try {
      if (integration.status !== 'active') {
        throw new Error('Cannot sync inactive integration');
      }

      switch (integration.provider) {
        case 'gmail':
          const result = await scanGmailInbox(integration);
          return {
            success: true,
            data: {
              messagesFound: result.messagesFound,
              lastSyncTime: new Date()
            }
          };

        case 'outlook':
          // Implement outlook sync when needed
          throw new Error('Outlook sync not implemented');

        default:
          throw new Error(`Unknown email provider: ${integration.provider}`);
      }
    } catch (error) {
      console.error('Email sync error:', error);
      
      // Handle specific error types
      if (error.code === 401) {
        await integration.updateOne({
          status: 'error',
          lastError: 'Authentication failed - please reconnect your account'
        });
      } else if (error.code === 429) {
        await integration.updateOne({
          status: 'error',
          lastError: 'Rate limit exceeded - please try again later'
        });
      }

      return {
        success: false,
        error: error.message
      };
    }
  },

  async syncSocialIntegration(integration) {
    // Implement when needed
    throw new Error('Social integration sync not implemented');
  },

  async syncJobPlatformIntegration(integration) {
    // Implement when needed
    throw new Error('Job platform integration sync not implemented');
  },

  async syncIntegration(integrationId, userId) {
    try {
      const integration = await Integration.findOne({
        _id: integrationId,
        userId
      });

      if (!integration) {
        return {
          success: false,
          error: 'Integration not found'
        };
      }

      // Implementation varies based on integration type
      switch (integration.integrationType) {
        case 'email':
          return await this.syncEmailIntegration(integration);
        case 'social':
          return await this.syncSocialIntegration(integration);
        case 'jobPlatform':
          return await this.syncJobPlatformIntegration(integration);
        default:
          throw new Error(`Unknown integration type: ${integration.integrationType}`);
      }
    } catch (error) {
      console.error('Sync integration error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = integrationService;