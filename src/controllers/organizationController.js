// controllers/organizationController.js
const organizationService = require('../services/organizationService');

async function updateOrganization(req, res) {
  try {
    const { id } = req.params;
    
    // Verify organization ownership
    if (id !== req.user.organizationId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate file type if logo is being uploaded
    if (req.file && req.file.mimetype !== 'image/png') {
      return res.status(400).json({ error: 'Only PNG files are allowed for logos' });
    }

    const organizationData = {
      description: req.body.description,
      website: req.body.website,
      linkedinUrl: req.body.linkedinUrl,
      logo: req.file // Multer will add the file here if uploaded
    };

    const result = await organizationService.updateOrganization(id, organizationData);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to update organization'
    });
  }
}

async function getOrganization(req, res) {
  try {
    const { id } = req.params;
    
    // Optional: Verify organization access
    if (id !== req.user.organizationId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await organizationService.getOrganization(id);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch organization details'
    });
  }
}

module.exports = {
  updateOrganization,
  getOrganization
};