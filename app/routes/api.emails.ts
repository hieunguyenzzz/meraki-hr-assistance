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

// Function to fetch emails
async function fetchZohoEmails(accessToken: string) {
  try {
    // Get user accounts first
    const accountsResponse = await axios.get('https://mail.zoho.com/api/accounts', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Accounts Response:', accountsResponse.data);

    // Extract the first account ID
    const accountId = accountsResponse.data.data[0].accountId;

    // Fetch emails for the specific account using the correct endpoint
    const emailsResponse = await axios.get(`https://mail.zoho.com/api/accounts/${accountId}/messages/view`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        limit: 100
      }
    });

    console.log('Emails Response:', emailsResponse.data);

    // Transform email data to include only necessary information
    return emailsResponse.data.data.map((email: any) => ({
      id: email.messageId,
      subject: email.subject,
      from: email.fromAddress,
      to: email.toAddress,
      date: email.receivedTime ? new Date(parseInt(email.receivedTime)).toISOString() : new Date().toISOString(),
      snippet: email.snippet || '',
      hasAttachment: email.hasAttachment === '1'
    }));
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