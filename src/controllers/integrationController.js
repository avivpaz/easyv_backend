// controllers/integrationController.js
const integrationService = require('../services/integrationService');

async function connectGmail(req, res, next) {
  try {
    const { code } = req.body;
    const { userId, organizationId } = req.user; // From your auth middleware
    
    if (!code) {
      const error = new Error('Authorization code is required');
      error.statusCode = 400;
      return next(error);
    }

    const result = await integrationService.connectGmailAccount(code, userId, organizationId);
    
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('Gmail connection error:', error);
    next(error);
  }
}

async function listIntegrations(req, res, next) {
    try {
      const { userId, organizationId } = req.user;
      const { type } = req.query; // Add type parameter
      const result = await integrationService.listIntegrations(userId, organizationId, type);
      
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

module.exports = {
  connectGmail,
  listIntegrations,
  disconnectIntegration
};