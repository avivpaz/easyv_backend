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
      const { page = 1, limit = 10, status } = query;
      const skip = (page - 1) * limit;
   
      // Build filter
      const filter = { 
        organization: organizationId,
        status: { $ne: 'deleted' }
      };
      
      if (status) {
        filter.status = status;
      }
   
      // Get jobs with pagination
      const jobs = await Job.find(filter)
        .sort({ createdAt: -1 })
        .select('-__v')
        .skip(skip)
        .limit(Number(limit));
   
      // Get total count for pagination
      const total = await Job.countDocuments(filter);
   
      return {
        success: true,
        data: {
          jobs,
          pagination: {
            total,
            pages: Math.ceil(total / limit),
            page: Number(page),
            limit: Number(limit)
          }
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
   },

  async  getPublicOrganizationJobs(organizationId, query = {}) {
    try {
      const { page = 1, limit = 10, search } = query;
      const skip = (page - 1) * limit;
   
      // Build query
      const queryConditions = {
        organization: organizationId,
        status: 'active'
      };
   
      // Add search if provided
      if (search) {
        queryConditions.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
   
      // Get jobs with pagination
      const jobs = await Job.find(queryConditions)
        .select('title description location workType employmentType requiredSkills createdAt _id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));
   
      // Get total count for pagination
      const total = await Job.countDocuments(queryConditions);
   
      return {
        success: true,
        data: {
          jobs,
          pagination: {
            total,
            pages: Math.ceil(total / limit),
            page: Number(page),
            limit: Number(limit)
          }
        }
      };
   
    } catch (error) {
      console.error('Get public organization jobs error:', error);
      return { success: false, error: 'Failed to fetch jobs' };
    }
   },   
  async getJob(jobId) {
    try {
        const job = await Job.findOne({
            _id: jobId,
            status: { $ne: 'deleted' }
          }).select('-__v');

      if (!job) {
        return { 
          success: false, 
          error: 'Job not found' 
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
  async  getPublicJob(jobId) {
    try {
      const job = await Job.findOne({ 
        _id: jobId,
        status: 'active'
      })
      .select('title description location workType employmentType requiredSkills niceToHaveSkills createdAt -_id');
   
      if (!job) {
        return { success: false, error: 'Job not found' };
      }
   
      return {
        success: true,
        data: job
      };
   
    } catch (error) {
      console.error('Get public job error:', error);
      return { success: false, error: 'Failed to fetch job' };
    }
   },
   async getJobCVs(jobId, organizationId, userId) {
    try {
      const job = await Job.findOne({
        _id: jobId,
        organization: organizationId
      });

      if (!job) {
        return { success: false, error: 'Job not found or access denied' };
      }

      // Get all CVs for the job
      const cvs = await CV.find({
        job: jobId,
        organization: organizationId
      }).sort({ createdAt: -1 });

      // Process each CV based on unlock status
      const processedCVs = cvs.map(cv => {
        const isUnlocked = cv.visibility === 'unlocked';

        if (isUnlocked) {
          // Return full CV details if unlocked
          return {
            _id: cv._id,
            candidate: cv.candidate,
            status: cv.status,
            fileUrl: cv.fileUrl,
            rawText:cv.rawText,
            submissionType: cv.submissionType,
            createdAt: cv.createdAt,
            visibility: 'unlocked'
          };
        } else {
          // Return limited CV details if locked
          return {
            _id: cv._id,
            status: cv.status,
            candidate: {
              // Only return basic candidate info
              fullName: cv.candidate.fullName.replace(/(?<=^[\w-]{3})./g, '*'),
              experience: cv.candidate.experience?.length || 0,
              education: cv.candidate.education?.length || 0,
              skills: cv.candidate.skills?.length || 0
            },
            submissionType: cv.submissionType,
            createdAt: cv.createdAt,
            visibility: 'locked'
          };
        }
      });

      // Group CVs by visibility status
      const groupedCVs = {
        unlocked: processedCVs.filter(cv => cv.visibility === 'unlocked'),
        locked: processedCVs.filter(cv => cv.visibility === 'locked')
      };

      return {
        success: true,
        data: {
          ...groupedCVs,
          stats: {
            total: cvs.length,
            unlocked: groupedCVs.unlocked.length,
            locked: groupedCVs.locked.length
          }
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  async generateJobDetails(description) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ 
          role: "user", 
          content: `Based on the following job description, generate an appropriate job title and enhance the description.
Description: ${description}
Please generate:
1. A clear, specific job title
2. An enhanced description (2-3 sentences maximum)
3. 5-7 core technical skills that best match the role and context
4. 3-5 additional nice-to-have skills`
        }],
        functions: [{
          name: "processJobDetails",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "A clear and specific job title. for example backend developer"
              },
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
            required: ["title", "description", "requiredSkills", "niceToHaveSkills"]
          }
        }],
        function_call: { name: "processJobDetails" }
      });
  
      const functionCallResult = JSON.parse(response.choices[0].message.function_call.arguments);
  
      return {
        success: true,
        data: {
          title: functionCallResult.title || '',
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