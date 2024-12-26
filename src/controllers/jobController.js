const jobService = require('../services/jobService');
const jwt = require('jsonwebtoken');

async function createJob(req, res) {
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
      return res.status(400).json({ error: result.error });
    }
    res.status(201).json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


async function getOrganizationJobs(req, res) {
    try {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    if (req.user.organizationId && organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: 'Unauthorized access to organization data' });
    }
      const result = await jobService.getOrganizationJobs(organizationId, req.query);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async function getJob(req, res) {
    try {
      const { id } = req.params;
      const result = await jobService.getJob(id);
  
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
  
   
      res.json(result.data);

    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  }

  async function getJobCVs(req, res) {
    try {
      const { id: jobId } = req.params;
      const result = await jobService.getJobCVs(jobId, req.user.organizationId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json(result.data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

async function updateJob(req, res) {
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
      return res.status(404).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
}
  async function deleteJob(req, res) {
    try {
      const { id: jobId } = req.params;
      const result = await jobService.deleteJob(jobId, req.user.organizationId);
      
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
  
      res.json({ message: 'Job deleted successfully' });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({ error: 'Failed to delete job' });
    }
  }

  async function generateSocialShare(req, res) {
    try {
      const { jobId } = req.params;
      const organizationId = req.user.organizationId;
  
      const result = await jobService.generateSocialShareText(jobId, organizationId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
  
      res.json(result.data);
    } catch (error) {
      console.error('Generate social share error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  
  async function generateJobDescription(req, res) {
    try {
      const {  description } = req.body;
      
      if (!description) {
        return res.status(400).json({ error: 'Job description is required' });
      }
  
      const result = await jobService.generateJobDetails(description);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
  
      res.json(result.data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  module.exports = { createJob, getOrganizationJobs ,getJob,getJobCVs,deleteJob,generateJobDescription,generateSocialShare,  updateJob };