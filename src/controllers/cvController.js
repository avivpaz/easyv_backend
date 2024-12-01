const cvService = require('../services/cvService');

async function handleCVUpload(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = await cvService.processCVs(
      req.files,
      req.params.id,
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