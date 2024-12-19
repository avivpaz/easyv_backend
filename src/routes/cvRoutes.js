const express = require('express');
const router = express.Router();
const { getAllCVs, updateCVStatus, deleteCVById } = require('../controllers/cvController');
const authMiddleware = require('../middleware/auth');
const { unlockCVs } = require('../controllers/cvVisibilityController');

router.use(authMiddleware);

router.get('/', getAllCVs);
router.put('/:cvId/status', updateCVStatus);
router.delete('/:cvId', deleteCVById);
router.post('/unlock', unlockCVs);

 
module.exports = router;