const organizationService = require('../services/organizationService');
const jobService = require('../services/jobService');  
const cvService = require('../services/cvService');
const { CV, Job } = require('../models/index');
const mongoose = require('mongoose');

async function getPublicOrganizationDetails(req, res, next) {
   try {
     const { organizationId } = req.params;
     
     if (!mongoose.Types.ObjectId.isValid(organizationId)) {
       const error = new Error('Invalid organization ID');
       error.statusCode = 400;
       return next(error);
     }

     const result = await organizationService.getPublicOrganizationDetails(organizationId);
  
     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = 404;
       return next(error);
     }
  
     res.json(result.data);
   } catch (error) {
     console.error('Get organization details error:', error);
     next(error);
   }
}

async function getPublicOrganizationJobs(req, res, next) {
   try {
     const { organizationId } = req.params;
     
     if (!mongoose.Types.ObjectId.isValid(organizationId)) {
       const error = new Error('Invalid organization ID');
       error.statusCode = 400;
       return next(error);
     }
  
     const result = await jobService.getPublicOrganizationJobs(organizationId, req.query);
     
     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = 400;
       return next(error);
     }
  
     res.json(result.data);
   } catch (error) {
     console.error('Get organization jobs error:', error);
     next(error);
   }
}

async function getPublicJob(req, res, next) {
   try {
     const { id } = req.params;
     
     const result = await jobService.getPublicJob(id);
  
     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = 404;
       return next(error);
     }
  
     res.json(result.data);
   } catch (error) {
     console.error('Get public job error:', error);
     next(error);
   }
}

async function handlePublicCVUpload(req, res, next) {
   try {
     const { jobId } = req.params;
     const { submissionType } = req.body;
 
     // Validate required fields based on submission type
     if (submissionType === 'file' && !req.file) {
       const error = new Error('No CV file uploaded');
       error.statusCode = 400;
       return next(error);
     }
 
     if (submissionType === 'text') {
       const requiredFields = ['fullName', 'email', 'phoneNumber', 'cvText'];
       const missingFields = requiredFields.filter(field => !req.body[field]);
       
       if (missingFields.length > 0) {
         const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
         error.statusCode = 400;
         return next(error);
       }
     }
 
     const job = await Job.findOne({ 
       _id: jobId,
       status: { $ne: 'deleted' }
     }).select('title description location workType employmentType requiredSkills organization _id');
     
     if (!job) {
       const error = new Error('Job not found or access denied');
       error.statusCode = 404;
       return next(error);
     }
     
     let result;
     if (submissionType === 'file') {
       result = await cvService.processCV(req.file, job, job.organization);
     } else {
       result = await cvService.processTextSubmission(req.body, job, job.organization);
     }

     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = result.error === 'cv_duplication' ? 400 : 500;
       return next(error);
     }
 
     res.json({ 
       message: 'Successfully submitted your application',
       data: result.data
     });
   } catch (error) {
     console.error('Public CV upload error:', error);
     next(error);
   }
}

module.exports = {
   getPublicOrganizationDetails,
   getPublicOrganizationJobs,
   getPublicJob,
   handlePublicCVUpload
};