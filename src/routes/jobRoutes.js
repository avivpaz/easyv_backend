const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { createJob, getOrganizationJobs, getJob, getJobCVs, uploadJobCVs ,deleteJob,generateJobDescription,generateSocialShare} = require('../controllers/jobController');
const {handleCVUpload } = require('../controllers/cvController');

const authMiddleware = require('../middleware/auth');
const jobPublicAccess = require('../middleware/jobPublicAccess.js');
const { 
    unlockNextCVsByJob, 
    getJobUnlockStats 
  } = require('../controllers/cvVisibilityController');
  
router.post('/', authMiddleware, createJob);
router.get('/', authMiddleware, getOrganizationJobs);
router.get('/:id', getJob);
router.get('/:id/cv', authMiddleware, getJobCVs);
router.post('/:id/cv',authMiddleware, upload.array('cvs', 10), handleCVUpload);
// router.post('/:id/cv', jobPublicAccess, upload.array('cvs', 10), handleCVUpload);
router.delete('/:id', authMiddleware, deleteJob);
router.post('/description', generateJobDescription);
router.post('/:jobId/unlock-cvs', unlockNextCVsByJob);
router.get('/:jobId/unlock-stats', getJobUnlockStats);
router.get('/:jobId/social-share', authMiddleware, generateSocialShare);

module.exports = router;