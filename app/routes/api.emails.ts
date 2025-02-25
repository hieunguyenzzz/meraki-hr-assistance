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

    console.log('Accounts Response:', JSON.stringify(accountsResponse.data, null, 2));

    // Extract the first account ID
    const accountId = accountsResponse.data.data[0].accountId;

    // Fetch folder information
    const foldersResponse = await axios.get(`https://mail.zoho.com/api/accounts/${accountId}/folders`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Folders Response:', JSON.stringify(foldersResponse.data, null, 2));
    
    // Find Inbox folder ID for safer default
    const inboxFolder = foldersResponse.data.data.find((folder: any) => folder.folderType === "Inbox");
    const defaultFolderId = inboxFolder?.folderId || foldersResponse.data.data[0]?.folderId;
    
    console.log('Using default folder ID:', defaultFolderId);

    // Fetch emails for the specific account
    const emailsResponse = await axios.get(`https://mail.zoho.com/api/accounts/${accountId}/messages/view`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        limit: 5 // Further reduced to minimize API calls during debugging
      }
    });

    console.log('First email in response:', JSON.stringify(emailsResponse.data.data[0], null, 2));

    // Process emails with attachments
    const processedEmails = [];
    
    for (const email of emailsResponse.data.data) {
      console.log(`Processing email ${email.messageId} with subject "${email.subject}"...`);
      
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

      console.log(`Email has attachments: ${basicEmail.hasAttachment}, using folder ID: ${basicEmail.folderId}`);

      // Only fetch attachment details if email has attachments
      if (basicEmail.hasAttachment) {
        try {
          // Try to find the correct folder for this email if folderId is missing
          let folderIdToUse = basicEmail.folderId;
          
          if (!folderIdToUse || folderIdToUse === 'undefined') {
            console.log('Email missing folder ID, searching in all folders...');
            for (const folder of foldersResponse.data.data) {
              try {
                // Check if message exists in this folder
                const checkMessageResponse = await axios.head(
                  `https://mail.zoho.com/api/accounts/${accountId}/folders/${folder.folderId}/messages/${email.messageId}`,
                  {
                    headers: {
                      'Authorization': `Zoho-oauthtoken ${accessToken}`,
                      'Content-Type': 'application/json'
                    }
                  }
                );
                
                if (checkMessageResponse.status === 200) {
                  folderIdToUse = folder.folderId;
                  console.log(`Found email in folder: ${folder.folderName} (${folderIdToUse})`);
                  break;
                }
              } catch (error) {
                // Ignore errors, just try next folder
              }
            }
          }
          
          // Use the correct endpoint to get attachment info
          const attachmentInfoEndpoint = `https://mail.zoho.com/api/accounts/${accountId}/folders/${folderIdToUse}/messages/${email.messageId}/attachmentinfo`;
          console.log(`Fetching attachment info from: ${attachmentInfoEndpoint}`);
          
          const attachmentInfoResponse = await axios.get(attachmentInfoEndpoint, {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('Attachment info response:', JSON.stringify(attachmentInfoResponse.data, null, 2));
          
          if (attachmentInfoResponse.data && 
              attachmentInfoResponse.data.data && 
              attachmentInfoResponse.data.data.attachments) {
            // For each attachment, create a direct download link
            const attachmentsWithUrls = [];
            
            for (const attachment of attachmentInfoResponse.data.data.attachments) {
              try {
                // Create a direct download URL using the content endpoint
                const downloadUrl = `https://mail.zoho.com/api/accounts/${accountId}/folders/${folderIdToUse}/messages/${email.messageId}/attachments/${attachment.attachmentId}`;
                
                attachmentsWithUrls.push({
                  id: attachment.attachmentId,
                  name: attachment.attachmentName,
                  size: attachment.attachmentSize,
                  type: '', // Not provided in the attachment info
                  downloadUrl: downloadUrl
                });
                
                console.log(`Added attachment: ${attachment.attachmentName} with URL: ${downloadUrl}`);
              } catch (downloadError) {
                console.error(`Error processing attachment ${attachment.attachmentId}:`, downloadError.message);
              }
            }
            
            basicEmail.attachments = attachmentsWithUrls;
          }
        } catch (attachmentError) {
          console.error(`Error fetching attachment info for email ${email.messageId}:`, attachmentError.message);
          console.error('Attachment error details:', {
            status: attachmentError.response?.status,
            statusText: attachmentError.response?.statusText,
            data: attachmentError.response?.data
          });
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