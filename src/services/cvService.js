// services/cvService.js
const { CV } = require('../models/index');
const { deleteFromS3 } = require('./s3Service');
const CVProcessor = require('./cvProcessor');

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

  // Wrapper methods for CV processing
  async processCV(file, job, organizationId, source = 'landing_page') {
    return CVProcessor.processSingleJob(file, job, organizationId, source);
  },

  async processCVs(files, job, organizationId, source = 'landing_page') {
    const results = {
      successful: [],
      failed: []
    };

    const processPromises = files.map(async (file) => {
      const result = await CVProcessor.processSingleJob(file, job, organizationId, source);
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

  async processTextSubmission(formData, job, organizationId, source = 'landing_page') {
    return CVProcessor.processTextSubmission(formData, job, organizationId, source);
  }
};

module.exports = cvService;