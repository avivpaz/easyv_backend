const cvService = require('../services/cvService');
const { CV,Job } = require('../models/index');

async function handleCVUpload(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const job = await Job.findOne({ 
      _id: req.params.id,
      status: { $ne: 'deleted' }
    }).select('title description location workType employmentType requiredSkills _id');

    if (!job) {
      return {
        success: false,
        error: 'Job not found or access denied',
        fileName: file.originalname
      };
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
    res.status(500).json({ error: error.message });
  }
}

async function getAllCVs(req, res) {
  try {
    const result = await cvService.getAllCVs(req.user.organizationId, req.query);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
async function deleteCVById(req, res) {
  try {
    const { cvId } = req.params;
    const result = await cvService.deleteCVById(cvId, req.user.organizationId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'CV deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
async function updateCVStatus(req, res) {
  try {
    const { cvId } = req.params;
    const { status } = req.body;
    
    const result = await cvService.updateCVStatus(cvId, status, req.user.organizationId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
module.exports = { handleCVUpload, getAllCVs ,updateCVStatus,deleteCVById};