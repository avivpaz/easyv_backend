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

async extractCVInfo(text,jobContext) {
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
        content: `Extract and format key information from this CV and analyze its relevance to the job:
        Job Information:
        ${jobContext}
    
        CV Text: ${text}
    
        Apply consistent formatting:
        - Names in Title Case
        - Bullet points start with capital letter
        - Technical terms with proper capitalization
        - Dates in YYYY-YYYY format
        
        If non-English, translate to English with same formatting rules.`
      }],
      functions: [{
        name: "processCVData",
        parameters: {
          type: "object",
          properties: {
            fullName: { 
              type: "string",
              description: "Full name in Title Case (e.g., 'John Smith')"
            },
            email: { type: "string" },
            phone: { 
              type: "string",
              description: "Phone number in international format with country code (e.g., '+1-123-456-7890' or '+44 20 7123 4567')"
            },
            summary: {
              type: "string",
              description: "2-3 sentence professional summary in proper sentence case"
            },
            education: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  degree: {
                    type: "string",
                    description: "Degree in Title Case (e.g., 'Bachelor of Science in Computer Science')"
                  },
                  institution: {
                    type: "string",
                    description: "Institution name in Title Case"
                  },
                  year: {
                    type: "string",
                    description: "Year range as YYYY-YYYY or YYYY if ongoing"
                  }
                }
              }
            },
            experience: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company: {
                    type: "string",
                    description: "Company name in Title Case"
                  },
                  position: {
                    type: "string",
                    description: "Position title in Title Case"
                  },
                  dates: {
                    type: "string",
                    description: "Date range as YYYY-YYYY or YYYY-present"
                  },
                  responsibilities: {
                    type: "array",
                    items: {
                      type: "string",
                      description: "Responsibility in sentence case, starting with action verb"
                    }
                  },
                  isRelevant: {
                    type: "boolean",
                    description: "Whether this experience is relevant to the job position"
                  }          
                }
              }
            },
            skills: {
              type: "array",
              items: {
                type: "string",
                description: "Skills with proper capitalization (e.g., 'JavaScript', 'project management')"
              }
            },
            languages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Language name in Title Case"
                  },
                  proficiency: {
                    type: "string",
                    enum: ["Native", "Fluent", "Advanced", "Intermediate", "Basic"]
                  }
                },
                required: ["name", "proficiency"]
              }
            },
            originalLanguage: { type: "string" }
          },
          required: ["fullName", "email", "phone", "summary", "education", "experience", "skills", "languages", "originalLanguage"]
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
async processCV(file, job, organizationId) {
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

    const jobContext = `
    Job Title: ${job.title}
    Key Skills: ${job.requiredSkills.join(', ')}
    Description: ${job.description}
    `;

    // Extract text from file
    const text = await this.extractTextFromFile(file);
    
    // Process the extracted text
    const cvResult = await this.extractCVInfo(text, jobContext);
    
    // Check if the text is actually a CV
    if (!cvResult.isCV) {      
      return { 
        success: false, 
        error: 'invalid_file',
        fileName: file.originalname 
      };
    }

    // Check for existing application with same email for this job
    const existingApplication = await CV.findOne({
      'candidate.email': cvResult.data.email.toLowerCase(),
      job: job._id
    });

    if (existingApplication) {
      return {
        success: false,
        error: 'cv_duplication',
        fileName: file.originalname,
        duplicate: true
      };
    }

    // Create safe filename using the correct field name (fullName)
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const candidateName = cvResult.data.fullName
      ? cvResult.data.fullName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-') // Replace special chars with hyphens
          .replace(/-+/g, '-')        // Replace multiple hyphens with single
          .replace(/^-|-$/g, '')      // Remove leading/trailing hyphens
      : 'unnamed-candidate';
    const safeFileName = `${candidateName}-${timestamp}.${fileExtension}`;

    // Create the complete S3 path
    const s3Path = `${organizationId}/${job._id}/${safeFileName}`;

    // Upload file to S3
    const fileUrl = await uploadToS3(
      file.buffer,           // file
      safeFileName,          // fileName
      `${organizationId}/${job._id}`, // folder
      process.env.AWS_BUCKET_NAME,     // bucket
      process.env.CVS_CLOUDFRONT_DOMAIN // cloudfront
    );

    const cv = await CV.create({
      candidate: cvResult.data,
      job: job._id,
      organization: organizationId,
      fileUrl: fileUrl,
      originalFileName: file.originalname,
      safeFileName: safeFileName,
      s3Path: s3Path,       // Store the full S3 path for deletion
      fileType: file.mimetype,
      submissionType: 'file',
      status: 'pending'
    });

    return { success: true, data: cv };
  } catch (error) {
    // If there's an error and we've created the s3Path, try to delete the file
    if (typeof s3Path !== 'undefined') {
      try {
        await deleteFromS3(s3Path);
      } catch (deleteError) {
        console.error('Failed to delete S3 file after error:', deleteError);
      }
    }
    
    return { 
      success: false, 
      error: error.message, 
      fileName: file.originalname 
    };
  }
},
async processTextSubmission(formData, job, organizationId) {
  try {
    // Check for duplicate application
    const existingApplication = await CV.findOne({
      'candidate.email': formData.email.toLowerCase(),
      job: job._id
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
        content: `Analyze this job application focusing ONLY on the content and professional substance. 
        Ignore grammar, formatting, and structural issues completely.
        Evaluate based on:
        - Presence of relevant work experience
        - Skills and qualifications
        - Professional achievements
        - Education background
        - Career objectives (if included)
        
        Text to analyze: ${formData.cvText}`
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
    
    //TODO Return this 
    // if (!validation.isValid) {
    //   return {
    //     success: false,
    //     error: 'invalid_submission',
    //     message: validation.reason
    //   };
    // }

    // Process the text content using GPT-4
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: `Extract and format professional information from this text. Apply consistent formatting:
        - Names and titles in Title Case
        - Summaries and descriptions in proper sentence case
        - Technical terms with proper capitalization
        - Dates in YYYY-YYYY format
        
        Text to process: ${formData.cvText}`
      }],
      functions: [{
        name: "processApplicationText",
        parameters: {
          type: "object", 
          properties: {
            summary: {
              type: "string",
              description: "2-3 sentence professional summary in proper sentence case"
            },
            education: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  degree: {
                    type: "string",
                    description: "Degree in Title Case"
                  },
                  institution: {
                    type: "string",
                    description: "Institution name in Title Case"
                  },
                  year: {
                    type: "string",
                    description: "Year range as YYYY-YYYY or YYYY if ongoing"
                  }
                }
              }
            },
            experience: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company: {
                    type: "string",
                    description: "Company name in Title Case"
                  },
                  position: {
                    type: "string",
                    description: "Position title in Title Case"
                  },
                  dates: {
                    type: "string",
                    description: "Date range as YYYY-YYYY or YYYY-present"
                  },
                  responsibilities: {
                    type: "array",
                    items: {
                      type: "string",
                      description: "Responsibility in sentence case, starting with action verb"
                    }
                  },
                  isRelevant: {
                    type: "boolean",
                    description: "Whether this experience is relevant to the job position"
                  }                         
                }
              }
            },
            skills: {
              type: "array",
              items: {
                type: "string",
                description: "Skills with proper capitalization (e.g., 'JavaScript', 'project management')"
              }
            }
          },
          required: ["summary", "education", "experience", "skills"]
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
      job: job._id,
      organization: organizationId,
      submissionType: 'text', 
      rawText: formData.cvText, 
      status: 'pending'
    });

    return { success: true, data: cv };
  } catch (error) {
    return { success: false, error: error.message };
  }
},

async processCVs(files, job, organizationId) {
  const results = {
    successful: [],
    failed: []
  };

  // Process CVs concurrently with Promise.all
  const processPromises = files.map(async (file) => {
    const result = await this.processCV(file, job, organizationId);
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
}


};
module.exports = cvService;
