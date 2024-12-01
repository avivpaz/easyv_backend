// services/cvService.js
const openai = require('../config/openai');
const { CV } = require('../models/index');
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
    const fileUrl = await uploadToS3(file.buffer, `${Date.now()}-${file.originalname}`);
    
    // Extract text from file
    const text = await this.extractTextFromFile(file);
    
    // Process the extracted text
    const cvData = await this.extractCVInfo(text);

    const cv = await CV.create({
      candidate: cvData,
      job: jobId,
      organization: organizationId,
      fileUrl: fileUrl,
      originalFileName: file.originalname,
      fileType: file.mimetype
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
  const response = await openai.chat.completions.create({
    model: "gpt-4",
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
                responsibilities: { type: "array", items: { type: "string" } }
              }
            }
          },
          skills: { type: "array", items: { type: "string" } },
          originalLanguage: { type: "string", description: "The original language of the CV" }
        },
        required: ["fullName", "email", "phone", "education", "experience", "skills", "originalLanguage"]
      }
    }],
    function_call: { name: "processCVData" }
  });

  return JSON.parse(response.choices[0].message.function_call.arguments);
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
}
};
module.exports = cvService;
