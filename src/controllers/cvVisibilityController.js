const cvVisibilityService = require('../services/cvVisibilityService');

const cvVisibilityController = {
  async unlockCVs(req, res) {
    try {
      const { cvIds } = req.body;
      
      if (!Array.isArray(cvIds) || cvIds.length === 0) {
        return res.status(400).json({ error: 'Invalid CV IDs provided' });
      }

      const result = await cvVisibilityService.unlockCVs(
        cvIds,
        req.user._id,
        req.user.organizationId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async unlockNextCVsByJob(req, res) {
    try {
      const { count } = req.body;
      
      if (!count || count <= 0) {
        return res.status(400).json({ error: 'Invalid count provided' });
      }

      const result = await cvVisibilityService.unlockNextCVsByJob(
        req.params.jobId,
        count,
        req.user._id,
        req.user.organizationId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getJobUnlockStats(req, res) {
    try {
      const result = await cvVisibilityService.getJobUnlockStats(
        req.params.jobId,
        req.user._id,
        req.user.organizationId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = cvVisibilityController;
