// workers/emailProcessingWorker.js
const Queue = require('bull');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const { EmailIntegration, CV } = require('../models');

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

    // Process attachments if any
    if (email.data.payload.parts) {
      for (const part of email.data.payload.parts) {
        if (part.filename && isCVFileType(part.filename)) {
          // Get attachment
          const attachment = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: part.body.attachmentId
          });

          // Process CV
          await processCV(attachment, integration, email);
          
          // Update job progress
          await job.progress(100);
        }
      }
    }

    console.log(`Successfully processed message ${messageId}`);

  } catch (error) {
    console.error('Email processing error:', error);
    throw error; // Bull will handle the error
  }
});

function isCVFileType(filename) {
  const validExtensions = ['.pdf', '.doc', '.docx'];
  return validExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

async function processCV(attachment, integration, email) {
  const buffer = Buffer.from(attachment.data.data, 'base64');
  
  const headers = email.data.payload.headers;
  const subject = headers.find(h => h.name === 'Subject')?.value;
  const from = headers.find(h => h.name === 'From')?.value;

  const cv = await CV.create({
    organization: integration.organization,
    submissionType: 'email',
    status: 'pending',
    visibility: 'locked',
    rawData: buffer,
    metadata: {
      emailSubject: subject,
      emailFrom: from,
      emailDate: new Date(parseInt(email.data.internalDate))
    }
  });

  console.log(`Created CV record ${cv._id} from email`);
}

// Handle errors
emailQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

emailQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

module.exports = emailQueue;