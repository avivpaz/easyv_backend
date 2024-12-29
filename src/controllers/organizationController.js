// controllers/organizationController.js
const organizationService = require('../services/organizationService');

async function updateOrganization(req, res, next) {
 try {
   const { id } = req.params;
   
   // Verify organization ownership
   if (id !== req.user.organizationId.toString()) {
     const error = new Error('Access denied');
     error.statusCode = 403;
     return next(error);
   }

   // Validate file type if logo is being uploaded
   if (req.file && req.file.mimetype !== 'image/png') {
     const error = new Error('Only PNG files are allowed for logos');
     error.statusCode = 400;
     return next(error);
   }

   const organizationData = {
     name: req.body.name,
     description: req.body.description,
     website: req.body.website,
     linkedinUrl: req.body.linkedinUrl,
     brandColor: req.body.brandColor,
     logo: req.file // Multer will add the file here if uploaded
   };

   const result = await organizationService.updateOrganization(id, organizationData);
   
   if (!result.success) {
     const error = new Error(result.error);
     error.statusCode = 400;
     return next(error);
   }

   res.json(result.data);
 } catch (error) {
   console.error('Update organization error:', error);
   next(error);
 }
}

async function getOrganization(req, res, next) {
 try {
   const { id } = req.params;
   
   // Optional: Verify organization access
   if (id !== req.user.organizationId.toString()) {
     const error = new Error('Access denied');
     error.statusCode = 403;
     return next(error);
   }

   const result = await organizationService.getOrganization(id);

   if (!result.success) {
     const error = new Error(result.error);
     error.statusCode = 404;
     return next(error);
   }

   res.json(result.data);
 } catch (error) {
   console.error('Get organization error:', error);
   next(error);
 }
}

module.exports = {
 updateOrganization,
 getOrganization
};