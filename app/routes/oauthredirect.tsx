import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import axios from "axios";
import { generatePkceChallenge } from "~/utils/pkce";
import { storeTokens } from "~/utils/token-storage";
import { 
  storeState, 
  getStoredState, 
  storeCodeVerifier, 
  retrieveCodeVerifier 
} from "~/utils/oauth-state";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const location = url.searchParams.get('location');
  const accountsServer = url.searchParams.get('accounts-server');

  console.log('OAuth Redirect Details:', {
    code,
    state,
    location,
    accountsServer
  });

  if (!code) {
    return new Response('No authorization code', { status: 400 });
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code);
    
    // Add additional metadata to the token response
    const enhancedTokenResponse = {
      ...tokenResponse,
      created_at: new Date().toISOString(),
      location,
      accounts_server: accountsServer
    };

    await storeTokens(enhancedTokenResponse);
    return redirect('/dashboard');
  } catch (error) {
    console.error('Detailed OAuth Error:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });
    
    return new Response(`Authentication failed: ${error.message}`, { status: 500 });
  }
}

// Function to initiate Zoho OAuth flow
export async function initiateZohoOAuth(request?: Request) {
  // Generate a random state to prevent CSRF
  const state = generateRandomState();
  await storeState(state, request);

  const authParams = new URLSearchParams({
    client_id: process.env.ZOHO_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: 'https://hr-assistance.hieunguyen.dev/oauthredirect',
    // More explicit and comprehensive scopes including attachment access
    scope: 'ZohoMail.accounts.READ,ZohoMail.messages.READ,ZohoMail.messages.ALL,ZohoMail.folders.READ,ZohoMail.folders.ALL,ZohoMail.attachments.READ,offline_access', 
    state: state,
    access_type: 'offline' // Explicitly request a refresh token
  });

  // Redirect to Zoho authorization URL
  return `https://accounts.zoho.com/oauth/v2/auth?${authParams.toString()}`;
}

// Token exchange function
async function exchangeCodeForTokens(code: string) {
  try {
    console.log('Exchanging code:', code);
    console.log('Client ID:', process.env.ZOHO_CLIENT_ID);
    console.log('Redirect URI:', 'https://hr-assistance.hieunguyen.dev/oauthredirect');

    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.ZOHO_CLIENT_ID || '',
        client_secret: process.env.ZOHO_CLIENT_SECRET || '',
        redirect_uri: 'https://hr-assistance.hieunguyen.dev/oauthredirect',
        code: code
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    console.log('Token Exchange Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Token Exchange Error Details:', {
      errorMessage: error.message,
      errorResponse: error.response?.data,
      errorStatus: error.response?.status
    });
    throw error;
  }
}

// Utility to generate random state
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
} 