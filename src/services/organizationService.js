// services/organizationService.js
const { Organization } = require('../models');
const { uploadToS3, deleteFromS3 } = require('./s3Service');
const path = require('path');

const organizationService = {
  async updateOrganization(organizationId, organizationData) {
    try {
      const organization = await Organization.findById(organizationId);
      
      if (!organization) {
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      // Handle logo upload if provided
      if (organizationData.logo) {
        try {
          // Delete old logo if exists
          if (organization.logoUrl) {
            // Extract filename from the URL
            const oldLogoUrl = organization.logoUrl;
            const fileName = oldLogoUrl.split('/').pop();
            await deleteFromS3(fileName);
          }

          // Generate unique filename for the logo
          const fileName = `${organizationId}-logo-${Date.now()}${path.extname(organizationData.logo.originalname)}`;

          // Upload new logo
          await uploadToS3(
            organizationData.logo.buffer,
            fileName,
            '',
            process.env.AWS_BUCKET_LOGOS_NAME
          );
          organization.logoUrl = `${process.env.LOGOS_CLOUDFRONT_DOMAIN}/${fileName}`;

        } catch (error) {
          console.error('Logo upload error:', error);
          return {
            success: false,
            error: 'Failed to upload logo'
          };
        }
      }

      // Update other fields
      if (organizationData.name) {
        organization.name = organizationData.name;
      }
      if (organizationData.description) {
        organization.description = organizationData.description;
      }
      if (organizationData.website !== undefined) {
        organization.website = organizationData.website;
      }
      if (organizationData.linkedinUrl !== undefined) {
        organization.linkedinUrl = organizationData.linkedinUrl;
      }
      if (organizationData.brandColor !== undefined) {
        organization.brandColor = organizationData.brandColor;
      }
      await organization.save();

      return {
        success: true,
        data: organization
      };
    } catch (error) {
      console.error('Update organization error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  async getPublicOrganizationDetails(organizationId) {
    try {
      const organization = await Organization.findById(organizationId)
        .select('name description website linkedinUrl logoUrl brandColorm -_id');
   
      if (!organization) {
        return { success: false, error: 'Organization not found' };
      }
   
      return { 
        success: true, 
        data: organization
      };
   
    } catch (error) {
      console.error('Get public organization details error:', error);
      return { success: false, error: 'Failed to fetch organization details' };
    }
   },

  async getOrganization(organizationId) {
    try {
      const organization = await Organization.findById(organizationId)
        .select('name description website linkedinUrl logoUrl plan createdAt');

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      return {
        success: true,
        data: organization
      };
    } catch (error) {
      console.error('Get organization error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = organizationService;