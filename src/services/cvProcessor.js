// services/cvProcessor.js
const openai = require('../config/openai');
const { CV, Job } = require('../models/index');
const { uploadToS3, deleteFromS3 } = require('./s3Service');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require("word-extractor");
const extractor = new WordExtractor();

class CVProcessor {
  // Validation Helpers
  static validateFileType(file) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.mimetype)) {
      return {
        success: false,
        error: 'invalid_file_type',
        fileName: file.originalname
      };
    }
    
    return { success: true };
  }

  static async extractTextFromFile(file) {
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    
    switch (fileExtension) {
      case 'pdf':
        const pdfData = await pdfParse(file.buffer);
        return pdfData.text;
        
      case 'doc':
        const extracted = await extractor.extract(file.buffer);
        return extracted.getBody();
        
      case 'docx':
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value;
        
      default:
        throw new Error('Unsupported file format. Only PDF and DOC/DOCX files are supported.');
    }
  }

  static async validateIfCV(text) {
    try {
      const validationResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: "Analyze if this text is a CV/resume: " + text
        }],
        functions: [{
          name: "validateCV",
          parameters: {
            type: "object",
            properties: {
              isCV: { 
                type: "boolean",
                description: "Whether the text is a CV/resume"
              },
              reason: { 
                type: "string",
                description: "Explanation of why the text is or isn't a CV"
              }
            },
            required: ["isCV", "reason"]
          }
        }],
        function_call: { name: "validateCV" }
      });

      return JSON.parse(validationResponse.choices[0].message.function_call.arguments);
    } catch (error) {
      throw new Error(`CV validation failed: ${error.message}`);
    }
  }

  // Database Helpers
  static async checkDuplicateApplication(email, jobId) {
    try {
        const existingApplication = await CV.findOne({
            'candidate.email': { $regex: new RegExp(`^${email}$`, 'i') },
            job: jobId
          });

      return {
        isDuplicate: !!existingApplication,
        existingApplication
      };
    } catch (error) {
      throw new Error(`Duplicate check failed: ${error.message}`);
    }
  }

  static async createCVRecord({
    candidate,
    ranking,
    job,
    organization,
    submissionType = 'file',
    source = 'landing_page',
    fileDetails = null,
    rawText = null,
    sourceIntegration = null  // Add this parameter
  }) {
    try {
      const cvData = {
        candidate,
        ranking,
        job,
        organization,
        submissionType,
        source,
        status: ranking.category === 'Not Relevant' ? 'rejected' : 'pending',
        visibility: ranking.category === 'Not Relevant' ? 'unlocked' : 'locked'
      };
  
      // Add sourceIntegration if it exists
      if (sourceIntegration) {
        cvData.sourceIntegration = sourceIntegration;
      }
  
      if (fileDetails) {
        cvData.fileUrl = fileDetails.fileUrl;
        cvData.originalFileName = fileDetails.originalFileName;
        cvData.safeFileName = fileDetails.safeFileName;
        cvData.s3Path = fileDetails.s3Path;
        cvData.fileType = fileDetails.fileType;
      }
  
      if (rawText) {
        cvData.rawText = rawText;
      }
  
      const cv = await CV.create(cvData);
      return { success: true, data: cv };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }  

  // File Handling
  static async prepareFileUpload(file, cvData, organizationId, jobId) {
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const candidateName = cvData.fullName
      ? cvData.fullName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      : 'unnamed-candidate';
    
    const safeFileName = `${candidateName}-${timestamp}.${fileExtension}`;
    const s3Path = `${organizationId}/${jobId}/${safeFileName}`;

    return {
      safeFileName,
      s3Path
    };
  }

  // CV Analysis Methods
  static async analyzeCVForJob(text, jobContext) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: `Extract and format key information from this CV and analyze its relevance to the job:
          Job Information:
          ${jobContext}
      
          CV Text: ${text}
      
          Apply consistent formatting:
          - Names in Title Case
          - Bullet points start with capital letter
          - Technical terms with proper capitalization
          - Dates in YYYY-YYYY format
          - Email addresses must be lowercase

          
          If non-English, translate to English with same formatting rules.
          
          Analyze the candidate's overall fit for the role based on their experience, skills, and education.`
        }],
        functions: [{
          name: "processCVData",
          parameters: {
            type: "object",
            properties: {
              fullName: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              summary: { type: "string" },
              education: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    degree: { type: "string" },
                    institution: { type: "string" },
                    year: { type: "string" }
                  }
                }
              },
              experience: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    company: { type: "string" },
                    position: { type: "string" },
                    dates: { type: "string" },
                    responsibilities: {
                      type: "array",
                      items: { type: "string" }
                    },
                    isRelevant: { type: "boolean" }
                  }
                }
              },
              skills: {
                type: "array",
                items: { type: "string" }
              },
              languages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    proficiency: {
                      type: "string",
                      enum: ["Native", "Fluent", "Advanced", "Intermediate", "Basic"]
                    }
                  }
                }
              },
              originalLanguage: { type: "string" },
              ranking: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: ["Highly Relevant", "Relevant", "Not Relevant"]
                  },
                  justification: { type: "string" }
                }
              }
            },
            required: ["fullName", "email", "phone", "summary", "education", "experience", "skills", "languages", "originalLanguage", "ranking"]
          }
        }],
        function_call: { name: "processCVData" }
      });

      return {
        isCV: true,
        data: JSON.parse(response.choices[0].message.function_call.arguments)
      };
    } catch (error) {
      return {
        isCV: false,
        message: "Error processing the text",
        error: error.message
      };
    }
  }

  static async analyzeCVForMultipleJobs(cvText, jobContexts) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: `Analyze this CV text for relevance to multiple job positions.
          
          CV Text:
          ${cvText}
          
          Jobs to analyze against:
          ${jobContexts.map(job => job.context).join('\n\n')}`
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
                    jobId: { type: "string" },
                    relevanceScore: {
                      type: "number",
                      minimum: 0,
                      maximum: 1
                    },
                    category: {
                      type: "string",
                      enum: ["Highly Relevant", "Relevant", "Not Relevant"]
                    },
                    justification: { type: "string" }
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
      throw new Error(`Multiple jobs analysis failed: ${error.message}`);
    }
  }

  // Main Processing Methods
  static async processSingleJob(file, job, organizationId, source = 'landing_page') {
    try {
      // Step 1: Validate file type
      const fileValidation = this.validateFileType(file);
      if (!fileValidation.success) {
        return fileValidation;
      }

      // Step 2: Extract and validate CV
      const text = await this.extractTextFromFile(file);
      const validation = await this.validateIfCV(text);
      
      if (!validation.isCV) {
        return {
          success: false,
          error: 'invalid_file',
          message: validation.reason,
          fileName: file.originalname
        };
      }

      // Step 3: Process CV content
      const jobContext = `
        Job Title: ${job.title}
        Key Skills: ${job.requiredSkills?.join(', ') || ''}
        Description: ${job.description}
      `;
      const cvInfo = await this.analyzeCVForJob(text, jobContext);

      // Step 4: Check for duplicates
      const duplicateCheck = await this.checkDuplicateApplication(
        cvInfo.data.email,
        job._id
      );
      
      if (duplicateCheck.isDuplicate) {
        return {
          success: false,
          error: 'cv_duplication',
          fileName: file.originalname,
          duplicate: true
        };
      }

      // Step 5: Handle file upload
      const { safeFileName, s3Path } = await this.prepareFileUpload(
        file,
        cvInfo.data,
        organizationId,
        job._id
      );

      try {
        const fileUrl = await uploadToS3(
          file.buffer,
          safeFileName,
          `${organizationId}/${job._id}`,
          process.env.AWS_BUCKET_NAME,
          process.env.CVS_CLOUDFRONT_DOMAIN
        );

        // Step 6: Create CV record
        return await this.createCVRecord({
          candidate: cvInfo.data,
          ranking: {
            category: cvInfo.data.ranking.category,
            justification: cvInfo.data.ranking.justification
          },
          job: job._id,
          organization: organizationId,
          source,
          fileDetails: {
            fileUrl,
            originalFileName: file.originalname,
            safeFileName,
            s3Path,
            fileType: file.mimetype
          }
        });
      } catch (error) {
        // Cleanup on error
        try {
          await deleteFromS3(s3Path);
        } catch (deleteError) {
          console.error('Failed to delete S3 file after error:', deleteError);
        }
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fileName: file.originalname
      };
    }
  }

  static async processEmailCV(file, organizationId, source = 'email_integration', integrationId = null) {  // Add integrationId parameter
    try {
      // Step 1: Find active jobs
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

      // Step 2: Validate file type
      const fileValidation = this.validateFileType(file);
      if (!fileValidation.success) {
        return fileValidation;
      }

      // Step 3: Extract and validate CV
      const text = await this.extractTextFromFile(file);
      const validation = await this.validateIfCV(text);
      
      if (!validation.isCV) {
        return {
          success: false,
          error: 'invalid_file',
          message: validation.reason,
          fileName: file.originalname
        };
      }

      // Step 4: Prepare job contexts once
      const jobContexts = activeJobs.map(job => ({
        id: job._id,
        title: job.title,
        context: `
          Job ID: ${job._id}
          Job Title: ${job.title}
          Key Skills: ${job.requiredSkills?.join(', ') || ''}
          Description: ${job.description}
        `
      }));

      // Step 5: Analyze CV for all jobs
      const cvAnalysis = await this.analyzeCVForMultipleJobs(text, jobContexts);
      const relevantJobs = cvAnalysis.relevantJobs.filter(
        analysis => analysis.relevanceScore >= 0.7
      );

      if (relevantJobs.length === 0) {
        return {
          success: true,
          data: {
            processedJobs: [],
            totalJobs: activeJobs.length,
            relevantJobs: 0,
            message: 'No relevant jobs found for this CV'
          }
        };
      }

      // Step 6: Process for each relevant job
      const results = [];
      const processedEmails = new Set();

      for (const analysis of relevantJobs) {
        const job = activeJobs.find(j => j._id.toString() === analysis.jobId);
        if (!job) continue;

        const cvInfo = await this.analyzeCVForJob(
          text, 
          jobContexts.find(j => j.id === job._id).context
        );

        // Check for duplicates
        const duplicateCheck = await this.checkDuplicateApplication(
          cvInfo.data.email,
          job._id
        );
        
        if (duplicateCheck.isDuplicate) {
          results.push({
            jobId: job._id,
            jobTitle: job.title,
            result: {
              success: false,
              error: 'cv_duplication',
              fileName: file.originalname,
              duplicate: true
            }
          });
          continue;
        }

        // Handle file upload
        const { safeFileName, s3Path } = await this.prepareFileUpload(
          file,
          cvInfo.data,
          organizationId,
          job._id
        );

        try {
          const fileUrl = await uploadToS3(
            file.buffer,
            safeFileName,
            `${organizationId}/${job._id}`,
            process.env.AWS_BUCKET_NAME,
            process.env.CVS_CLOUDFRONT_DOMAIN
          );

          // Create CV record
          const cvResult = await this.createCVRecord({
            candidate: cvInfo.data,
            ranking: {
              category: analysis.category,
              justification: analysis.justification
            },
            job: job._id,
            organization: organizationId,
            source,
            sourceIntegration: integrationId,  // Add this line
            fileDetails: {
              fileUrl,
              originalFileName: file.originalname,
              safeFileName,
              s3Path,
              fileType: file.mimetype
            }
          });

          results.push({
            jobId: job._id,
            jobTitle: job.title,
            result: cvResult
          });
        } catch (error) {
          // Cleanup on error
          try {
            await deleteFromS3(s3Path);
          } catch (deleteError) {
            console.error('Failed to delete S3 file after error:', deleteError);
          }
          
          results.push({
            jobId: job._id,
            jobTitle: job.title,
            result: { success: false, error: error.message }
          });
        }
      }

      return {
        success: true,
        data: {
          processedJobs: results,
          totalJobs: activeJobs.length,
          relevantJobs: relevantJobs.length
        }
      };
    } catch (error) {
      console.error('Email CV processing error:', error);
      return {
        success: false,
        error: error.message,
        fileName: file?.originalname
      };
    }
  }

  static async processTextSubmission(formData, job, organizationId, source = 'landing_page') {
    try {
      // Step 1: Check for duplicate application
      const duplicateCheck = await this.checkDuplicateApplication(
        formData.email.toLowerCase(),
        job._id
      );
      
      if (duplicateCheck.isDuplicate) {
        return {
          success: false,
          error: 'cv_duplication',
          duplicate: true
        };
      }

      // Step 2: Analyze CV content
      const jobContext = `
        Job Title: ${job.title}
        Key Skills: ${job.requiredSkills?.join(', ') || ''}
        Description: ${job.description}
      `;
      const cvInfo = await this.analyzeCVForJob(formData.cvText, jobContext);

      if (!cvInfo.isCV) {
        return {
          success: false,
          error: 'invalid_submission',
          message: cvInfo.message
        };
      }

      // Step 3: Create CV record
      return await this.createCVRecord({
        candidate: {
          fullName: formData.fullName,
          email: formData.email.toLowerCase(),
          phone: formData.phoneNumber,
          summary: cvInfo.data.summary,
          education: cvInfo.data.education,
          experience: cvInfo.data.experience,
          skills: cvInfo.data.skills,
          languages: cvInfo.data.languages,
          originalLanguage: cvInfo.data.originalLanguage
        },
        ranking: {
          category: cvInfo.data.ranking.category,
          justification: cvInfo.data.ranking.justification
        },
        job: job._id,
        organization: organizationId,
        submissionType: 'text',
        source,
        rawText: formData.cvText
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = CVProcessor;