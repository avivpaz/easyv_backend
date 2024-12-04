const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { getPublicJob, getPublicOrganizationJobs,getPublicOrganizationDetails,handlePublicCVUpload } = require('../controllers/publicController');
const jobPublicAccess = require('../middleware/jobPublicAccess');

router.get('/organizations/:organizationId', getPublicOrganizationDetails);

// Get job details for the public application page
router.get('/organizations/:organizationId/jobs', getPublicOrganizationJobs);

// Get job details for previewing the job
router.get('/jobs/:id', getPublicJob);

// Handle CV upload for public job applications 
router.post('/jobs/:jobId/apply', 
   jobPublicAccess,
   upload.single('cv'), // Changed to single file upload
   handlePublicCVUpload
);

module.exports = router;