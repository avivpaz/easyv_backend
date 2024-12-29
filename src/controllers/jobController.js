const jobService = require('../services/jobService');
const jwt = require('jsonwebtoken');

async function createJob(req, res, next) {
  try {
    const jobData = {
      title: req.body.title,
      description: req.body.description,
      location: req.body.location,
      workType: req.body.workType,
      employmentType: req.body.employmentType,
      requiredSkills: req.body.requiredSkills,
      niceToHaveSkills: req.body.niceToHaveSkills,
      status: req.body.status || 'active'
    };

    const result = await jobService.createJob(jobData, req.user.organizationId);
    
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }
    res.status(201).json(result.data);
  } catch (error) {
    next(error);
  }
}

async function getOrganizationJobs(req, res, next) {
  try {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      const error = new Error('Organization ID is required');
      error.statusCode = 400;
      return next(error);
    }

    if (req.user.organizationId && organizationId !== req.user.organizationId) {
      const error = new Error('Unauthorized access to organization data');
      error.statusCode = 403;
      return next(error);
    }

    const result = await jobService.getOrganizationJobs(organizationId, req.query);
    
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }
    res.json(result.data);
  } catch (error) {
    next(error);
  }
}

async function getJob(req, res, next) {
  try {
    const { id } = req.params;
    const result = await jobService.getJob(id);

    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 404;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('Get job error:', error);
    next(error);
  }
}

async function getJobCVs(req, res, next) {
  try {
    const { id: jobId } = req.params;
    const result = await jobService.getJobCVs(jobId, req.user.organizationId);
    
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }
    
    res.json(result.data);
  } catch (error) {
    next(error);
  }
}

async function updateJob(req, res, next) {
  try {
    const { id: jobId } = req.params;
    const jobData = {
      title: req.body.title,
      description: req.body.description,
      location: req.body.location,
      workType: req.body.workType,
      employmentType: req.body.employmentType,
      requiredSkills: req.body.requiredSkills,
      niceToHaveSkills: req.body.niceToHaveSkills,
      status: req.body.status || 'active'
    };

    const result = await jobService.updateJob(jobId, jobData, req.user.organizationId);
    
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 404;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('Update job error:', error);
    next(error);
  }
}

async function deleteJob(req, res, next) {
  try {
    const { id: jobId } = req.params;
    const result = await jobService.deleteJob(jobId, req.user.organizationId);
    
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 404;
      return next(error);
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    next(error);
  }
}

async function generateSocialShare(req, res, next) {
  try {
    const { jobId } = req.params;
    const organizationId = req.user.organizationId;

    const result = await jobService.generateSocialShareText(jobId, organizationId);
    
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('Generate social share error:', error);
    next(error);
  }
}

async function generateJobDescription(req, res, next) {
  try {
    const { description } = req.body;
    
    if (!description) {
      const error = new Error('Job description is required');
      error.statusCode = 400;
      return next(error);
    }

    const result = await jobService.generateJobDetails(description);
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    next(error);
  }
}

module.exports = { 
  createJob, 
  getOrganizationJobs,
  getJob,
  getJobCVs,
  deleteJob,
  generateJobDescription,
  generateSocialShare,
  updateJob 
};