// services/cvService.js
const openai = require('../config/openai');
const { CV,Job } = require('../models/index');
const { uploadToS3,deleteFromS3 } = require('./s3Service');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require("word-extractor"); 
const extractor = new WordExtractor();
const cvService = {

  async updateCVStatus(cvId, status, organizationId) {
    try {
      const cv = await CV.findOneAndUpdate(
        { _id: cvId, organization: organizationId },
        { status },
        { new: true }
      );

      if (!cv) {
        return { success: false, error: 'CV not found or access denied' };
      }

      return { success: true, data: cv };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
async deleteCVById(cvId, organizationId) {
  try {
    const cv = await CV.findOne({ _id: cvId, organization: organizationId });
    
    if (!cv) {
      return { success: false, error: 'CV not found or access denied' };
    }

    // Extract filename from fileUrl
    const fileName = cv.fileUrl.split('/').pop();
    await deleteFromS3(fileName);
    
    await CV.findByIdAndDelete(cvId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
},

async extractTextFromFile(file) {
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
},

async processCV(file, jobId, organizationId) {
  try {
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.mimetype)) {
      return { 
        success: false, 
        error: 'Invalid file type. Only PDF and DOC/DOCX files are supported.',
        fileName: file.originalname 
      };
    }

    // Upload file to S3
    const fileUrl = await uploadToS3(file.buffer, `${Date.now()}-${file.originalname}`,`${organizationId}/${jobId}`, process.env.AWS_BUCKET_NAME,process.env.CVS_CLOUDFRONT_DOMAIN);
    
    // Extract text from file
    const text = await this.extractTextFromFile(file);
    
    // Process the extracted text
    const cvResult = await this.extractCVInfo(text);

    // Check if the text is actually a CV
    if (!cvResult.isCV) {
      // Delete the uploaded file since it's not a CV
      const fileName = fileUrl.split('/').pop();
      await deleteFromS3(fileName);
      
      return { 
        success: false, 
        error: `invalid_file`,
        fileName: file.originalname 
      };
    }

      // Check for existing application with same email for this job
      const existingApplication = await CV.findOne({
        'candidate.email': cvResult.data.email,
        job: jobId
      });
  
      if (existingApplication) {
        // Delete the uploaded file since it's a duplicate application
        const fileName = fileUrl.split('/').pop();
        await deleteFromS3(fileName);
  
        return {
          success: false,
          error: 'cv_duplication',
          fileName: file.originalname,
          duplicate: true
        };
      }
    
    const cv = await CV.create({
      candidate: cvResult.data,
      job: jobId,
      organization: organizationId,
      fileUrl: fileUrl,
      originalFileName: file.originalname,
      fileType: file.mimetype,
      submissionType: 'file', // Add this
      status: 'pending'
    });

    return { success: true, data: cv };
  } catch (error) {
    return { success: false, error: error.message, fileName: file.originalname };
  }
},
async processCVs(files, jobId, organizationId) {
  const results = {
    successful: [],
    failed: []
  };

  // Process CVs concurrently with Promise.all
  const processPromises = files.map(async (file) => {
    const result = await this.processCV(file, jobId, organizationId);
    if (result.success) {
      results.successful.push(result.data);
    } else {
      results.failed.push({
        fileName: result.fileName,
        error: result.error
      });
    }
  });

  await Promise.all(processPromises);
  return results;
},
async extractCVInfo(text) {
  try {
    // First, validate if it's a CV using GPT-4 with function calling
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

    const validation = JSON.parse(validationResponse.choices[0].message.function_call.arguments);
    
    if (!validation.isCV) {
      return {
        isCV: false,
        message: validation.reason
      };
    }

    // If it is a CV, proceed with information extraction
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: "Extract key information from this CV. If the CV is not in English, translate all information to English, including the name, in your response: " + text
      }],
      functions: [{
        name: "processCVData",
        parameters: {
          type: "object",
          properties: {
            fullName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            summary: { 
              type: "string",
              description: "Create a new 2-3 sentence summary with: number of years of experience, most recant role, specialties, and major achievements. Example: 'Senior Software Engineer with 8 years in cloud/DevOps. Leads 12-person AWS team, achieved 60% faster deployments and $2M savings. Expert in Python and high-availability systems.'",
            },
            education: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  degree: { type: "string" },
                  institution: { type: "string" },
                  year: { 
                    type: "string",
                    description: "Year range in format YYYY-YYYY (e.g. 2018-2022) or single year YYYY if ongoing"
                  }                }
              }
            },
            experience: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company: { type: "string" },
                  position: { type: "string" },
                  dates: { 
                    type: "string",
                    description: "Year range in format YYYY-YYYY (e.g. 2020-2023) or YYYY-present if current position"
                  },
                  responsibilities: { type: "array", items: { type: "string" } }
                }
              }
            },
            skills: { type: "array", items: { type: "string" } },
            languages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { 
                    type: "string",
                    description: "Name of the language"
                  },
                  proficiency: { 
                    type: "string",
                    enum: ["Native", "Fluent", "Advanced", "Intermediate", "Basic"],
                    description: "Proficiency level in the language"
                  }
                },
                required: ["name", "proficiency"]
              },
              description: "List of languages the candidate knows with proficiency levels"
            },
            originalLanguage: { type: "string", description: "The original language of the CV" }
          },
          required: ["fullName", "email", "phone","summary", "education", "experience", "skills", "languages","originalLanguage"]
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
},
async getAllCVs(organizationId, query = {}) {
  try {
    const filter = { organization: organizationId };
    
    if (query.status) {
      filter.status = query.status;
    }
    
    if (query.jobId) {
      filter.job = query.jobId;
    }

    const cvs = await CV.find(filter)
      .populate('job', 'title')
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
async processPublicCV(file, jobId, formData) {
  try {
    const job = await Job.findOne({
      _id: jobId,
      status: 'active'
    }).populate('organization');

    if (!job) {
      return { success: false, error: 'Job not found or not active' };
    }

    const organizationId = job.organization._id;

    // Split processing based on submission type
    if (formData.submissionType === 'file') {
      return this.processCV(file, jobId, organizationId);
    } else {
      return this.processTextSubmission(formData, jobId, organizationId);
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
},
async processTextSubmission(formData, jobId, organizationId) {
  try {
    // Check for duplicate application
    const existingApplication = await CV.findOne({
      'candidate.email': formData.email,
      job: jobId
    });

    if (existingApplication) {
      return {
        success: false,
        error: 'cv_duplication',
        duplicate: true
      };
    }

    const validationResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: "Analyze the text and validate if it's suitable as a job application: " + formData.cvText
      }],
      functions: [{
        name: "validateCV",
        parameters: {
          type: "object",
          properties: {
            isValid: { 
              type: "boolean",
              description: "Whether the text is a valid CV and job application"
            },
            reason: { 
              type: "string",
              description: "Explanation of validation result"
            }
          },
          required: ["isValid", "reason", "type"]
        }
      }],
      function_call: { name: "validateCV" }
    });

    const validation = JSON.parse(validationResponse.choices[0].message.function_call.arguments);
    
    if (false) {
      return {
        success: false,
        error: 'invalid_submission',
        message: validation.reason
      };
    }

    // Process the text content using GPT-4
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: "Extract professional experience, education, skills and summary from this text. Format all date ranges as year-year (e.g. 2020-2023): " + formData.cvText
      }],
      functions: [{
        name: "processApplicationText",
        parameters: {
          type: "object",
          properties: {
            summary: { 
              type: "string",
              description: "A concise professional summary of the candidate highlighting their key qualifications and experience. make it short, 2-3 sentences"
            },
            education: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  degree: { type: "string" },
                  institution: { type: "string" },
                  year: { 
                    type: "string",
                    description: "Year range in format YYYY-YYYY (e.g. 2018-2022) or single year YYYY if ongoing"
                  }
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
                  dates: { 
                    type: "string",
                    description: "Year range in format YYYY-YYYY (e.g. 2021-2024) or YYYY-present if current position"
                  },
                  responsibilities: { type: "array", items: { type: "string" } }
                }
              }
            },
            skills: { type: "array", items: { type: "string" } }
          },
          required: ["education", "experience", "skills","summary"]
        }
      }],
      function_call: { name: "processApplicationText" }
    });
    
    const extractedData = JSON.parse(response.choices[0].message.function_call.arguments);

    // Create CV record with form data and extracted information
    const cv = await CV.create({
      candidate: {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phoneNumber,
        summary:extractedData.summary,
        education: extractedData.education,
        experience: extractedData.experience,
        skills: extractedData.skills
      },
      job: jobId,
      organization: organizationId,
      submissionType: 'text', 
      rawText: formData.cvText, 
      status: 'pending'
    });

    return { success: true, data: cv };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


};
module.exports = cvService;
