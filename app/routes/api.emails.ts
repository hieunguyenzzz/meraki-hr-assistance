import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import axios from "axios";
import { retrieveTokens } from "~/utils/token-storage";

// Function to get access token using stored refresh token
async function getZohoAccessToken() {
  try {
    // Retrieve stored tokens
    const storedTokens = await retrieveTokens();

    if (!storedTokens || !storedTokens.refresh_token) {
      throw new Error('No stored Zoho tokens found');
    }

    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        refresh_token: storedTokens.refresh_token,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Zoho access token:', error);
    throw new Error('Failed to obtain access token');
  }
}

// Function to fetch emails with attachments
async function fetchZohoEmails(accessToken: string) {
  try {
    // Get user accounts first
    const accountsResponse = await axios.get('https://mail.zoho.com/api/accounts', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Extract the first account ID
    const accountId = accountsResponse.data.data[0].accountId;

    // Fetch folder information
    const foldersResponse = await axios.get(`https://mail.zoho.com/api/accounts/${accountId}/folders`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Find Inbox folder ID for safer default
    const inboxFolder = foldersResponse.data.data.find((folder: any) => folder.folderType === "Inbox");
    const defaultFolderId = inboxFolder?.folderId || foldersResponse.data.data[0]?.folderId;

    // Fetch emails for the specific account
    const emailsResponse = await axios.get(`https://mail.zoho.com/api/accounts/${accountId}/messages/view`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        limit: 10 // Further reduced to minimize API calls
      }
    });

    // Process emails with attachments
    const processedEmails = [];
    
    for (const email of emailsResponse.data.data) {
      const basicEmail = {
        id: email.messageId,
        subject: email.subject || 'No Subject',
        from: email.fromAddress || 'Unknown Sender',
        to: email.toAddress || 'Unknown Recipient',
        date: email.receivedTime ? new Date(parseInt(email.receivedTime)).toISOString() : new Date().toISOString(),
        snippet: email.summary || '',
        hasAttachment: email.hasAttachment === '1',
        folderId: email.folderId || defaultFolderId,
        attachments: []
      };

      // Only fetch attachment details if email has attachments
      if (basicEmail.hasAttachment) {
        try {
          // Use folder-specific endpoint for attachments
          const attachmentsEndpoint = `https://mail.zoho.com/api/accounts/${accountId}/folders/${basicEmail.folderId}/messages/${email.messageId}/attachments`;
          
          const attachmentsResponse = await axios.get(attachmentsEndpoint, {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (attachmentsResponse.data && attachmentsResponse.data.data) {
            // For each attachment, get download URL
            const attachmentsWithUrls = [];
            
            for (const attachment of attachmentsResponse.data.data) {
              try {
                const downloadEndpoint = `https://mail.zoho.com/api/accounts/${accountId}/folders/${basicEmail.folderId}/messages/${email.messageId}/attachments/${attachment.attachmentId}/download`;
                
                const downloadResponse = await axios.get(downloadEndpoint, {
                  headers: {
                    'Authorization': `Zoho-oauthtoken ${accessToken}`,
                    'Content-Type': 'application/json'
                  }
                });
                
                if (downloadResponse.data && downloadResponse.data.downloadUrl) {
                  attachmentsWithUrls.push({
                    id: attachment.attachmentId,
                    name: attachment.attachmentName,
                    size: attachment.attachmentSize,
                    type: attachment.attachmentType,
                    downloadUrl: downloadResponse.data.downloadUrl
                  });
                }
              } catch (downloadError) {
                console.error(`Error getting download URL for attachment ${attachment.attachmentId}:`, downloadError.message);
              }
            }
            
            basicEmail.attachments = attachmentsWithUrls;
          }
        } catch (attachmentError) {
          console.error(`Error fetching attachments for email ${email.messageId}:`, attachmentError.message);
        }
      }
      
      processedEmails.push(basicEmail);
    }

    return processedEmails;
  } catch (error) {
    console.error('Error fetching Zoho emails:', error);
    console.error('Detailed error:', error.response?.data);
    console.error('Error config:', error.config);
    throw error;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Check if Zoho is connected
    const storedTokens = await retrieveTokens();
    
    if (!storedTokens) {
      return json({
        success: false,
        error: 'Zoho Mail is not connected',
        emails: []
      }, { status: 401 });
    }

    const accessToken = await getZohoAccessToken();
    const emails = await fetchZohoEmails(accessToken);
    
    return json({
      success: true,
      emails,
      total: emails.length
    });
  } catch (error) {
    console.error('Detailed API Emails Error:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      emails: []
    }, { status: 500 });
  }
}

// Utility function to truncate text
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength 
    ? text.substring(0, maxLength) + '...' 
    : text;
} 