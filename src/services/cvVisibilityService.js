const { CV, Job } = require('../models');
const billingService = require('./billingService');

class CVVisibilityService {
  async checkCreditBalance(organizationId, requiredCredits) {
    const balance = await billingService.getCreditsBalance(organizationId);
    return {
      hasEnoughCredits: balance.credits >= requiredCredits,
      availableCredits: balance.credits,
      requiredCredits
    };
  }

  async processUnlocking(cvs, userId, organizationId, description) {
    if (cvs.length === 0) {
      return {
        success: false,
        error: 'No locked CVs available',
        remainingCredits: (await billingService.getCreditsBalance(organizationId)).credits
      };
    }

    // Check credit balance before proceeding
    const balanceCheck = await this.checkCreditBalance(organizationId, cvs.length);
    if (!balanceCheck.hasEnoughCredits) {
      return {
        success: false,
        error: 'Insufficient credits',
        remainingCredits: balanceCheck.availableCredits,
        requiredCredits: balanceCheck.requiredCredits,
        availableCVs: cvs.length
      };
    }

    // Deduct credits using BillingService
    const deductionResult = await billingService.deductCredits(
      organizationId,
      cvs.length,
      {
        relatedEntity: {
          entityType: 'cv',
          entityId: cvs[0]._id
        },
        description,
        performedBy: userId
      }
    );

    if (!deductionResult.success) {
      return {
        success: false,
        error: deductionResult.error,
        remainingCredits: deductionResult.remainingCredits
      };
    }

    // Update CV visibility
    const updatePromises = cvs.map(cv => {
      cv.visibility = 'unlocked';
      cv.unlockedBy.push({ user: userId }); // Still track who unlocked it
      return cv.save();
    });

    await Promise.all(updatePromises);

    return {
      success: true,
      message: `${cvs.length} CVs unlocked successfully`,
      data: cvs,
      remainingCredits: deductionResult.remainingCredits
    };
  }

  async unlockCVs(cvIds, userId, organizationId) {
    try {
      // Get all CVs and verify they belong to the organization
      const cvs = await CV.find({ 
        _id: { $in: cvIds }, 
        organization: organizationId 
      });

      if (cvs.length !== cvIds.length) {
        throw new Error('One or more CVs not found or access denied');
      }

      // Filter out already unlocked CVs
      const cvsToUnlock = cvs.filter(cv => cv.visibility === 'locked');

      if (cvsToUnlock.length === 0) {
        return {
          success: true,
          message: 'All CVs already unlocked',
          data: cvs
        };
      }

      const description = `Unlock ${cvsToUnlock.length} CV${cvsToUnlock.length > 1 ? 's' : ''}`;
      return await this.processUnlocking(cvsToUnlock, userId, organizationId, description);
    } catch (error) {
      throw error;
    }
  }

  async unlockNextCVsByJob(jobId, count, userId, organizationId) {
    try {
      // Verify job exists and belongs to organization
      const job = await Job.findOne({ 
        _id: jobId, 
        organization: organizationId 
      });

      if (!job) {
        throw new Error('Job not found or access denied');
      }

      // Get next locked CVs for this job
      const lockedCVs = await CV.find({
        job: jobId,
        organization: organizationId,
        visibility: 'locked'
      })
      .sort({ createdAt: -1 })
      .limit(count);

      const description = `Unlock ${lockedCVs.length} CV${lockedCVs.length > 1 ? 's' : ''} for job: ${job.title}`;
      return await this.processUnlocking(lockedCVs, userId, organizationId, description);
    } catch (error) {
      throw error;
    }
  }

  async canUnlockCVs(cvIds, userId, organizationId) {
    try {
      const cvs = await CV.find({ 
        _id: { $in: cvIds }, 
        organization: organizationId 
      });

      const cvsToUnlock = cvs.filter(cv => cv.visibility === 'locked');

      const balanceCheck = await this.checkCreditBalance(organizationId, cvsToUnlock.length);

      return {
        success: true,
        canUnlock: balanceCheck.hasEnoughCredits,
        availableCredits: balanceCheck.availableCredits,
        requiredCredits: balanceCheck.requiredCredits,
        alreadyUnlocked: cvs.length - cvsToUnlock.length,
        toUnlock: cvsToUnlock.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new CVVisibilityService();