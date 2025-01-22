const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const emailQueue = require('../../workers/emailProcessingWorker');

async function scanGmailInbox(integration) {
  try {
    const oauth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: integration.refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    let newMessages = 0;
    let pageToken = null;
    const lastSyncTime = integration.lastSyncTime || new Date(0);

    // Since it runs daily, we can safely look back 2 days to account for any delays
    // and timezone differences
    const daysToLookBack = 2;
    
    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: `has:attachment filename:(pdf OR doc OR docx) newer_than:${daysToLookBack}d`,
        maxResults: 100,
        pageToken: pageToken
      });

      if (!response.data.messages) {
        console.log(`No messages found for ${integration.email}`);
        break;
      }

      // Process this page of messages
      for (const message of response.data.messages) {
        const messageDetails = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['internalDate']
        });
        
        const messageDate = new Date(parseInt(messageDetails.data.internalDate));
        
        // Double check the message is after lastSyncTime
        if (messageDate > lastSyncTime) {
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
              removeOnComplete: true,
              removeOnFail: false
            }
          );
          newMessages++;
        }
      }

      pageToken = response.data.nextPageToken;
      
      if (pageToken) {
        console.log(`Fetching next page of messages for ${integration.email}`);
      }

    } while (pageToken);

    console.log(`Found ${newMessages} new messages for ${integration.email}`);

    // Update last sync time
    await integration.updateOne({
      lastSyncTime: new Date()
    });

    return {
      success: true,
      messagesFound: newMessages
    };

  } catch (error) {
    console.error('Gmail scan error:', error);
    throw error;
  }
}

module.exports = { scanGmailInbox };