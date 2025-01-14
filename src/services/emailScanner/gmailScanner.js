const { google } = require('googleapis');
const { OAuth2 } = google.auth;

// services/emailScanner/gmailScanner.js
const emailQueue = require('../../workers/emailProcessingWorker');

async function scanGmailInbox(integration) {
  try {
    const oauth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: integration.refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Default to 30 days if no lastSyncTime is set
    const daysAgo = integration.lastSyncTime 
      ? Math.ceil((Date.now() - integration.lastSyncTime) / (1000 * 60 * 60 * 24))
      : 30;
    
    console.log(`Scanning emails from last ${daysAgo} days for ${integration.email}`);

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `has:attachment filename:(pdf OR doc OR docx) newer_than:${daysAgo}d`,
      maxResults: 50
    });

    if (!response.data.messages) {
      console.log(`No messages found for ${integration.email}`);
      return {
        success: true,
        messagesFound: 0
      };
    }

    console.log(`Found ${response.data.messages.length} messages for ${integration.email}`);

    // Add jobs to Bull queue
    for (const message of response.data.messages) {
      await emailQueue.add(
        {
          integrationId: integration._id,
          messageId: message.id
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: true, // Remove successful jobs
          removeOnFail: false     // Keep failed jobs for inspection
        }
      );
    }

    // Update last sync time
    await integration.updateOne({
      lastSyncTime: new Date()
    });

    return {
      success: true,
      messagesFound: response.data.messages.length
    };

  } catch (error) {
    console.error('Gmail scan error:', error);
    throw error;
  }
}

module.exports = { scanGmailInbox };