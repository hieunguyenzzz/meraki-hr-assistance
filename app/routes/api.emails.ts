import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import axios from "axios";

// Zoho Mail API configuration
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

// Function to get access token
async function getZohoAccessToken() {
  try {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        refresh_token: ZOHO_REFRESH_TOKEN,
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
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
    const response = await axios.get('https://mail.zoho.com/api/accounts/v1/emails', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        limit: 100,
        sortBy: 'date',
        sortOrder: 'desc'
      }
    });

    // Transform email data to include only necessary information
    return response.data.data.map((email: any) => ({
      id: email.messageId,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      snippet: email.snippet
    }));
  } catch (error) {
    console.error('Error fetching Zoho emails:', error);
    throw new Error('Failed to fetch emails');
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Validate request (add authentication middleware if needed)
  
  try {
    const accessToken = await getZohoAccessToken();
    const emails = await fetchZohoEmails(accessToken);
    
    return json({
      success: true,
      emails,
      total: emails.length
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      emails: []
    }, { status: 500 });
  }
} 