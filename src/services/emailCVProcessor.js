// services/emailCVProcessor.js
const cvService = require('./cvService');
const { Job } = require('../models');
const openai = require('../config/openai');

const emailCVProcessor = {
  async processEmailCV(file, organizationId, source = 'gmail') {
    try {
      // Get all active jobs for the organization
      const activeJobs = await Job.find({
        organization: organizationId,
        status: 'active'
      });

      if (!activeJobs.length) {
        return {
          success: false,
          error: 'no_active_jobs',
          message: 'No active jobs found for CV analysis'
        };
      }

      // Extract text from file first
      const text = await cvService.extractTextFromFile(file);

      // Prepare job contexts for analysis
      const jobContexts = activeJobs.map(job => ({
        id: job._id,
        context: `
        Job Title: ${job.title}
        Description: ${job.description}
        `
      }));

      // Analyze CV against all jobs
      const cvAnalysis = await analyzeCVForJobs(text, jobContexts);
      
      // Process the CV for each relevant job
      const results = [];
      for (const analysis of cvAnalysis.relevantJobs) {
        const job = activeJobs.find(j => j._id.toString() === analysis.jobId);
        if (job && analysis.relevanceScore >= 0.6) { // Threshold for processing
          const result = await cvService.processCV(file, job, organizationId, source);
          results.push({
            jobId: job._id,
            jobTitle: job.title,
            result
          });
        }
      }

      return {
        success: true,
        data: {
          processedJobs: results,
          totalJobs: activeJobs.length,
          relevantJobs: cvAnalysis.relevantJobs.length
        }
      };
    } catch (error) {
      console.error('Email CV processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Helper function to analyze CV against multiple jobs
async function analyzeCVForJobs(cvText, jobContexts) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "user",
        content: `Analyze this CV text for relevance to multiple job positions.
        
        CV Text:
        ${cvText}
        
        Jobs to analyze against:
        ${jobContexts.map(job => job.context).join('\n\n')}
        
        For each job, determine the relevance and provide a score and justification.`
      }],
      functions: [{
        name: "analyzeCVRelevance",
        parameters: {
          type: "object",
          properties: {
            relevantJobs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  jobId: {
                    type: "string",
                    description: "The ID of the job position"
                  },
                  relevanceScore: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Score indicating how relevant the CV is to this job (0-1)"
                  },
                  category: {
                    type: "string",
                    enum: ["Highly Relevant", "Relevant", "Not Relevant"],
                    description: "Overall relevance category"
                  },
                  justification: {
                    type: "string",
                    description: "Explanation of why the CV is relevant or not relevant to this job"
                  }
                },
                required: ["jobId", "relevanceScore", "category", "justification"]
              }
            }
          },
          required: ["relevantJobs"]
        }
      }],
      function_call: { name: "analyzeCVRelevance" }
    });

    return JSON.parse(response.choices[0].message.function_call.arguments);
  } catch (error) {
    console.error('CV analysis error:', error);
    throw error;
  }
}

module.exports = emailCVProcessor;