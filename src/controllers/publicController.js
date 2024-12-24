const organizationService = require('../services/organizationService');
const jobService=require('../services/jobService');
const cvService=require('../services/cvService');
const { CV,Job } = require('../models/index');

const mongoose = require('mongoose');

async function getPublicOrganizationDetails(req, res) {
    try {
      const { organizationId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(organizationId)) {
        return res.status(400).json({ error: 'Invalid organization ID' });
      }
      // Get organization details with extra stats
      const result = await organizationService.getPublicOrganizationDetails(organizationId);
   
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
   
      res.json(result.data);
    } catch (error) {
      console.error('Get organization details error:', error);
      res.status(500).json({ error: 'Failed to fetch organization details' });
    }
}
// Get single public job
async function getPublicOrganizationJobs(req, res) {
    try {
      const { organizationId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(organizationId)) {
        return res.status(400).json({ error: 'Invalid organization ID' });
      }
   
      const result = await jobService.getPublicOrganizationJobs(organizationId, req.query);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
   
      res.json(result.data);
    } catch (error) {
      console.error('Get organization jobs error:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
   }

   async function getPublicJob(req, res) {
    try {
      const { id } = req.params;
      
      const result = await jobService.getPublicJob(id);
   
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
   
      res.json(result.data);
    } catch (error) {
      console.error('Get public job error:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
   }

   // controllers/publicCvController.js
   async function handlePublicCVUpload(req, res) {
    try {
      const { jobId } = req.params;
      const { submissionType } = req.body;
  
      // Validate required fields based on submission type
      if (submissionType === 'file' && !req.file) {
        return res.status(400).json({ error: 'No CV file uploaded' });
      }
  
      if (submissionType === 'text') {
        const requiredFields = ['fullName', 'email', 'phoneNumber', 'cvText'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
          return res.status(400).json({ 
            error: `Missing required fields: ${missingFields.join(', ')}` 
          });
        }
      }
  
      const job = await Job.findOne({ 
        _id: jobId,
        status: { $ne: 'deleted' }
      }).select('title description location workType employmentType requiredSkills organization _id');
      
      if (!job) {
        return {
          success: false,
          error: 'Job not found or access denied',
          fileName: file.originalname
        };
      }
      
      let result;
      if (submissionType === 'file') {
        result = await cvService.processCV(req.file, job, job.organization);
      } else {
        result = await cvService.processTextSubmission(req.body, job, job.organization);
      }

      if (!result.success) {
        return res.status(result.error === 'cv_duplication' ? 400 : 500)
          .json({ error: result.error });
      }
  
      res.json({ 
        message: 'Successfully submitted your application',
        data: result.data
      });
    } catch (error) {
      console.error('Public CV upload error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  module.exports = {
    getPublicOrganizationDetails,
    getPublicOrganizationJobs,
    getPublicJob,
    handlePublicCVUpload
  };