const { Job, CV } = require('../models');
const openai = require('../config/openai');

const jobService = {
  async createJob(jobData, organizationId) {
    try {
      const job = await Job.create({
        ...jobData,
        organization: organizationId
      });

      return {
        success: true,
        data: job
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async deleteJob(jobId, organizationId) {
    try {
      const job = await Job.findOneAndUpdate(
        {
          _id: jobId,
          organization: organizationId
        },
        {
          status: 'deleted'
        },
        { new: true }
      );

      if (!job) {
        return {
          success: false,
          error: 'Job not found or access denied'
        };
      }

      return {
        success: true,
        data: job
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getOrganizationJobs(organizationId, query = {}) {
    try {
      const filter = { 
        organization: organizationId,
        status: { $ne: 'deleted' }
      };
      
      if (query.status) {
        filter.status = query.status;
      }

      const jobs = await Job.find(filter)
        .sort({ createdAt: -1 })
        .select('-__v');

      return {
        success: true,
        data: jobs
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getJob(jobId, organizationId) {
    try {
      const job = await Job.findOne({
        _id: jobId,
        status: { $ne: 'deleted' }
      }).select('-__v');

      if (!job) {
        return { 
          success: false, 
          error: 'Job not found or access denied' 
        };
      }

      return {
        success: true,
        data: job
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getJobCVs(jobId, organizationId) {
    try {
      const job = await Job.findOne({
        _id: jobId,
        organization: organizationId
      });

      if (!job) {
        return { success: false, error: 'Job not found or access denied' };
      }

      const cvs = await CV.find({
        job: jobId,
        organization: organizationId
      })
        .sort({ createdAt: -1 })
        .select('-__v');

      return {
        success: true,
        data: cvs
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async generateJobDetails(title, description = '') {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ 
          role: "user", 
          content: `Generate a job description for "${title}"${description ? ` based on the following context: ${description}` : ''}.
  The generated description should be 2-3 sentences maximum. 
  Required skills should be 5-7 core technical skills that best match the role and context. 
  Nice to have skills should be 3-5 additional relevant skills.`
        }],
        functions: [{
          name: "processJobDetails",
          parameters: {
            type: "object",
            properties: {
              description: { 
                type: "string",
                description: "A concise job description with responsibilities and requirements"
              },
              requiredSkills: {
                type: "array",
                items: { type: "string" },
                description: "5-7 core technical skills required for the position"
              },
              niceToHaveSkills: {
                type: "array",
                items: { type: "string" },
                description: "3-5 additional desired skills"
              },
              additionalContext: {
                type: "string",
                description: "Any additional context or notes about how the job details were tailored"
              }
            },
            required: ["description", "requiredSkills", "niceToHaveSkills"]
          }
        }],
        function_call: { name: "processJobDetails" }
      });
  
      const functionCallResult = JSON.parse(response.choices[0].message.function_call.arguments);
  
      return {
        success: true,
        data: {
          description: functionCallResult.description || '',
          requiredSkills: Array.isArray(functionCallResult.requiredSkills) 
            ? functionCallResult.requiredSkills.slice(0, 7)
            : [],
          niceToHaveSkills: Array.isArray(functionCallResult.niceToHaveSkills)
            ? functionCallResult.niceToHaveSkills.slice(0, 5)
            : [],
          additionalContext: functionCallResult.additionalContext || ''
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to generate job details: ' + error.message
      };
    }
  }
};

module.exports = jobService;