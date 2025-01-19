const integrationService = require('../services/integrationService');

// Validation helpers
const validateIntegrationType = (type) => {
  const validTypes = ['email', 'social', 'jobPlatform'];
  return validTypes.includes(type);
};

const validateProvider = (type, provider) => {
  const providers = {
    email: ['gmail', 'outlook'],
    social: ['linkedin', 'twitter', 'facebook'],
    jobPlatform: ['greenhouse', 'lever', 'workday']
  };
  return providers[type]?.includes(provider) || false;
};

// Connect different integration types
async function connectIntegration(req, res, next) {
  try {
    const { type, provider, code, accessToken, profileData } = req.body;
    const { userId, organizationId } = req.user;

    // Validate integration type
    if (!type || !validateIntegrationType(type)) {
      const error = new Error('Invalid integration type');
      error.statusCode = 400;
      return next(error);
    }

    // Validate provider for the given type
    if (!provider || !validateProvider(type, provider)) {
      const error = new Error(`Invalid provider for ${type} integration`);
      error.statusCode = 400;
      return next(error);
    }

    let result;
    switch (type) {
      case 'email':
        if (!code) {
          const error = new Error('Authorization code is required for email integration');
          error.statusCode = 400;
          return next(error);
        }
        
        if (provider === 'gmail') {
          result = await integrationService.connectGmailAccount(code, userId, organizationId);
        } else if (provider === 'outlook') {
          result = await integrationService.connectOutlookAccount(code, userId, organizationId);
        }
        break;

      case 'social':
        if (!accessToken || !profileData) {
          const error = new Error('Access token and profile data are required for social integration');
          error.statusCode = 400;
          return next(error);
        }
        result = await integrationService.connectSocialAccount(
          provider, 
          accessToken, 
          userId, 
          organizationId, 
          profileData
        );
        break;

      case 'jobPlatform':
        if (!accessToken) {
          const error = new Error('Access token is required for job platform integration');
          error.statusCode = 400;
          return next(error);
        }
        result = await integrationService.connectJobPlatform(
          provider,
          accessToken,
          userId,
          organizationId
        );
        break;
    }

    if (!result?.success) {
      const error = new Error(result?.error || 'Integration failed');
      error.statusCode = 400;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('Integration connection error:', error);
    next(error);
  }
}

async function listIntegrations(req, res, next) {
  try {
    const { userId, organizationId } = req.user;
    const { type, provider } = req.query;

    // Validate type if provided
    if (type && !validateIntegrationType(type)) {
      const error = new Error('Invalid integration type');
      error.statusCode = 400;
      return next(error);
    }

    // Validate provider if both type and provider are provided
    if (type && provider && !validateProvider(type, provider)) {
      const error = new Error(`Invalid provider for ${type} integration`);
      error.statusCode = 400;
      return next(error);
    }

    const result = await integrationService.listIntegrations(
      userId, 
      organizationId, 
      type,
      provider
    );

    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('List integrations error:', error);
    next(error);
  }
}

async function disconnectIntegration(req, res, next) {
  try {
    const { integrationId } = req.params;
    const { userId } = req.user;
    
    if (!integrationId) {
      const error = new Error('Integration ID is required');
      error.statusCode = 400;
      return next(error);
    }

    const result = await integrationService.disconnectIntegration(integrationId, userId);
    
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('Disconnect integration error:', error);
    next(error);
  }
}

async function syncIntegration(req, res, next) {
  try {
    const { integrationId } = req.params;
    const { userId } = req.user;

    if (!integrationId) {
      const error = new Error('Integration ID is required');
      error.statusCode = 400;
      return next(error);
    }

    const result = await integrationService.syncIntegration(integrationId, userId);

    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('Sync integration error:', error);
    next(error);
  }
}

module.exports = {
  connectIntegration,  // New unified connect endpoint
  listIntegrations,
  disconnectIntegration,
  syncIntegration,    // New sync endpoint
  // Keep the old endpoints for backward compatibility if needed
  connectGmail: (req, res, next) => {
    req.body.type = 'email';
    req.body.provider = 'gmail';
    return connectIntegration(req, res, next);
  }
};