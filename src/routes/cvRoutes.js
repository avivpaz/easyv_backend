const express = require('express');
const router = express.Router();
const { handleCVUpload, getAllCVs, updateCVStatus, deleteCVById } = require('../controllers/cvController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getAllCVs);
router.put('/:cvId/status', updateCVStatus);
router.delete('/:cvId', deleteCVById);


module.exports = router;