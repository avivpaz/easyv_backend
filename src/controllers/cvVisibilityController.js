const cvVisibilityService = require('../services/cvVisibilityService');

const cvVisibilityController = {
 async unlockCVs(req, res, next) {
   try {
     const { cvIds } = req.body;
     
     if (!Array.isArray(cvIds) || cvIds.length === 0) {
       const error = new Error('Invalid CV IDs provided');
       error.statusCode = 400;
       return next(error);
     }

     const result = await cvVisibilityService.unlockCVs(
       cvIds,
       req.user._id,
       req.user.organizationId
     );

     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = 400;
       return next(error);
     }

     res.json(result);
   } catch (error) {
     next(error);
   }
 },

 async unlockNextCVsByJob(req, res, next) {
   try {
     const { count } = req.body;
     
     if (!count || count <= 0) {
       const error = new Error('Invalid count provided');
       error.statusCode = 400;
       return next(error);
     }

     const result = await cvVisibilityService.unlockNextCVsByJob(
       req.params.jobId,
       count,
       req.user._id,
       req.user.organizationId
     );

     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = 400;
       return next(error);
     }

     res.json(result);
   } catch (error) {
     next(error);
   }
 },

 async getJobUnlockStats(req, res, next) {
   try {
     const result = await cvVisibilityService.getJobUnlockStats(
       req.params.jobId,
       req.user._id,
       req.user.organizationId
     );

     res.json(result);
   } catch (error) {
     next(error);
   }
 }
};

module.exports = cvVisibilityController;