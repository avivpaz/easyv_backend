// routes/integrationRoutes.js
const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/gmail/connect', integrationController.connectGmail);
router.get('/', integrationController.listIntegrations);
router.post('/:integrationId/disconnect', integrationController.disconnectIntegration);
router.post('/:integrationId/sync', integrationController.syncIntegration);

module.exports = router;