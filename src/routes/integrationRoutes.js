// routes/integrationRoutes.js
const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const authMiddleware = require('../middleware/auth');
const { EmailIntegration } = require('../models');
const { scanGmailInbox } = require('../services/emailScanner/gmailScanner');

// router.use(authMiddleware);

router.post('/gmail/connect', integrationController.connectGmail);
router.get('/', integrationController.listIntegrations);
router.post('/:integrationId/disconnect', integrationController.disconnectIntegration);
router.get('/scan', async (req, res) => {
    try {
        // Get all active Gmail integrations
        const activeIntegrations = await EmailIntegration.find({
          provider: 'gmail',
          status: 'active'
        });
    
        console.log(`Starting scan for ${activeIntegrations.length} Gmail integrations`);
    
        for (const integration of activeIntegrations) {
          try {
            await scanGmailInbox(integration);
          } catch (error) {
            console.error(`Error scanning integration ${integration._id}:`, error);
            
            // Update integration status if there's an auth error
            if (error.code === 401) {
              await integration.updateOne({
                status: 'error',
                lastError: 'Authentication failed - please reconnect Gmail'
              });
            }
          }
        }
      } catch (error) {
        console.error('Email scan job error:', error);
      }
  });
module.exports = router;