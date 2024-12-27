const { Job, CV } = require('../models');
const openai = require('../config/openai');
function maskFullName(fullName) {
  if (!fullName) return '';
  
  // Split the name into parts
  const nameParts = fullName.split(' ');
  
  // Mask each part: show first letter, mask the rest
  const maskedParts = nameParts.map(part => {
    if (!part) return '';
    return part[0] + '*'.repeat(Math.max(part.length - 1, 1));
  });
  
  // Join the parts back together
  return maskedParts.join(' ');
}

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
  async updateJob(jobId, jobData, organizationId) {
    try {
      const job = await Job.findOneAndUpdate(
        {
          _id: jobId,
          organization: organizationId,
          status: { $ne: 'deleted' }
        },
        {
          ...jobData,
          updatedAt: new Date()
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
      const { page = 1, limit = 10, status, search } = query;
      const skip = (page - 1) * limit;
   
      // Build filter
      const filter = { 
        organization: organizationId,
        status: { $ne: 'deleted' }
      };
      
      if (status) {
        filter.status = status;
      }
  
      // Add title-only search functionality
      if (search) {
        filter.title = new RegExp(search, 'i');
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
            ranking: cv.ranking, // Include full ranking for unlocked CVs
            status: cv.status,
            fileUrl: cv.fileUrl,
            rawText: cv.rawText,
            submissionType: cv.submissionType,
            createdAt: cv.createdAt,
            visibility: 'unlocked'
          };
        } else {
          // Return limited CV details if locked
          return {
            _id: cv._id,
            status: cv.status,
            ranking: {  // Include ranking even for locked CVs
              category: cv.ranking.category,
              justification: cv.ranking.justification
            },
            candidate: {
              // Only return basic candidate info
              fullName: maskFullName(cv.candidate.fullName),
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
  
      // Add stats breakdown by ranking
      const rankingStats = {
        highlyRelevant: cvs.filter(cv => cv.ranking?.category === 'Highly Relevant').length,
        relevant: cvs.filter(cv => cv.ranking?.category === 'Relevant').length,
        notRelevant: cvs.filter(cv => cv.ranking?.category === 'Not Relevant').length
      };
  
      return {
        success: true,
        data: {
          ...groupedCVs,
          stats: {
            total: cvs.length,
            unlocked: groupedCVs.unlocked.length,
            locked: groupedCVs.locked.length,
            byRanking: rankingStats
          }
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  async generateSocialShareText(jobId, organizationId) {
    try {
      // Get the job details with organization populated
      const job = await Job.findOne({ 
        _id: jobId,
        organization: organizationId,
        status: { $ne: 'deleted' }
      })
      .populate('organization', 'name description')
      .select('title description location workType employmentType requiredSkills organization');
  
      if (!job) {
        return { success: false, error: 'Job not found' };
      }
  
      const applicationUrl = `${process.env.APPLY_FRONTEND_URL}/${organizationId}/jobs/${jobId}`;
  
      const jobContext = `
        Company Name: ${job.organization.name}
        Company Description: ${job.organization.description || 'N/A'}
        Job Title: ${job.title}
        Location: ${job.location}
        Work Type: ${job.workType}
        Employment Type: ${job.employmentType}
        Key Skills: ${job.requiredSkills.join(', ')}
        Description: ${job.description}
        Application URL: ${applicationUrl}
      `;
  
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ 
          role: "user", 
          content: `Generate social media posts for a job opening for Twitter, LinkedIn, and Facebook.
  
          Here are the company and job details:
          ${jobContext}
  
          Please create three different posts following these requirements:
  
          1. Twitter Post (250 characters max):
          - Start with company name
          - Short and impactful
          - Include relevant hashtags
          - Focus on the most attractive aspects
          - End with the application URL
  
          2. LinkedIn Post (1000 characters max):
          - Start with company introduction
          - Professional and detailed
          - Include information about role and company culture
          - Use proper formatting with line breaks
          - Highlight growth opportunities
          - Include relevant hashtags
          - End with the application URL
  
          3. Facebook Post (1000 characters max):
          - Start with company introduction
          - Conversational yet professional
          - Focus on company culture and benefits
          - Make it engaging and shareable
          - Include relevant hashtags
          - End with the application URL`
        }],
        functions: [{
          name: "generateSocialPosts",
          parameters: {
            type: "object",
            properties: {
              twitter: {
                type: "string",
                description: "Twitter post text (max 250 characters)"
              },
              linkedin: {
                type: "string",
                description: "LinkedIn post text (max 2300 characters)"
              },
              facebook: {
                type: "string",
                description: "Facebook post text (max 600 characters)"
              }
            },
            required: ["twitter", "linkedin", "facebook"]
          }
        }],
        function_call: { name: "generateSocialPosts" }
      });
  
      const { twitter, linkedin, facebook } = JSON.parse(
        response.choices[0].message.function_call.arguments
      );
  
      return {
        success: true,
        data: {
          posts: [
            { platform: 'twitter', text: twitter },
            { platform: 'linkedin', text: linkedin },
            { platform: 'facebook', text: facebook }
          ],
          applicationUrl,
          organization: {
            name: job.organization.name,
            description: job.organization.description
          }
        }
      };
    } catch (error) {
      console.error('Generate social share text error:', error);
      return { 
        success: false, 
        error: 'Failed to generate social share text: ' + error.message 
      };
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