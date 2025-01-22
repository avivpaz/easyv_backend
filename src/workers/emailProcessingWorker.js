const Queue = require('bull');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const { EmailIntegration } = require('../models');
const CVProcessor = require('../services/cvProcessor');  // Changed this line

// Create a Bull queue
const emailQueue = new Queue('email-processing', {
  redis: {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD
  }
});

// Process jobs from the queue
emailQueue.process(async (job) => {
  const { integrationId, messageId } = job.data;

  try {
    console.log(`Processing message for integration ${integrationId}, messageId: ${messageId}`);
    
    // Get integration details
    const integration = await EmailIntegration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    // Set up Gmail client
    const oauth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: integration.refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get email details
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: messageId
    });

    let processedAttachments = 0;
    let successfulProcessings = 0;

    // Process attachments if any
    if (email.data.payload.parts) {
      for (const part of email.data.payload.parts) {
        if (part.filename && isCVFileType(part.filename)) {
          processedAttachments++;
          
          // Get attachment
          const attachment = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: part.body.attachmentId
          });

          // Create a file-like object
          const file = {
            buffer: Buffer.from(attachment.data.data, 'base64'),
            originalname: part.filename,
            mimetype: getMimeType(part.filename)
          };

          // Extract email metadata
          const headers = email.data.payload.headers;
          const subject = headers.find(h => h.name === 'Subject')?.value;
          const from = headers.find(h => h.name === 'From')?.value;
          
          // Call CVProcessor directly instead of emailCVProcessor
          const result = await CVProcessor.processEmailCV(
            file,
            integration.organization,
            'email_integration',
            integrationId  // Add this parameter
          );

          if (result.success) {
            successfulProcessings++;
            console.log(`Successfully processed CV from email. Relevant for ${result.data.relevantJobs} jobs`);
          } else {
            console.error(`Failed to process CV from email:`, result.error);
          }
          
          // Update job progress
          const progress = (processedAttachments / email.data.payload.parts.length) * 100;
          await job.progress(progress);
        }
      }
    }

    console.log(`Successfully processed message ${messageId}. Processed ${processedAttachments} attachments, ${successfulProcessings} successful`);
    return {
      processedAttachments,
      successfulProcessings
    };

  } catch (error) {
    console.error('Email processing error:', error);
    throw error; // Bull will handle the error
  }
});

// Helper functions remain the same
function isCVFileType(filename) {
  const validExtensions = ['.pdf', '.doc', '.docx'];
  return validExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

function getMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Event handlers remain the same
emailQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

emailQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

module.exports = emailQueue;