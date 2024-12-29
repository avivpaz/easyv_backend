const cvService = require('../services/cvService');
const { CV,Job } = require('../models/index');

async function handleCVUpload(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      const error = new Error('No files uploaded');
      error.statusCode = 400;
      return next(error);
    }

    const job = await Job.findOne({ 
      _id: req.params.id,
      status: { $ne: 'deleted' }
    }).select('title description location workType employmentType requiredSkills _id');

    if (!job) {
      const error = new Error('Job not found or access denied');
      error.statusCode = 404;
      return next(error);
    }

    const results = await cvService.processCVs(
      req.files,
      job,
      req.user.organizationId
    );

    res.json({
      message: `Successfully processed ${results.successful.length} CVs, ${results.failed.length} failed`,
      successful: results.successful,
      failed: results.failed
    });
  } catch (error) {
    next(error);
  }
}

async function getAllCVs(req, res, next) {
  try {
    const result = await cvService.getAllCVs(req.user.organizationId, req.query);
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }
    res.json(result.data);
  } catch (error) {
    next(error);
  }
}

async function deleteCVById(req, res, next) {
  try {
    const { cvId } = req.params;
    const result = await cvService.deleteCVById(cvId, req.user.organizationId);

    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }

    res.json({ message: 'CV deleted successfully' });
  } catch (error) {
    next(error);
  }
}

async function updateCVStatus(req, res, next) {
  try {
    const { cvId } = req.params;
    const { status } = req.body;
    
    const result = await cvService.updateCVStatus(cvId, status, req.user.organizationId);
    
    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }
    
    res.json(result.data);
  } catch (error) {
    next(error);
  }
}

module.exports = { handleCVUpload, getAllCVs, updateCVStatus, deleteCVById };