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

  if (!code) {
    return new Response('No authorization code', { status: 400 });
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code);
    await storeTokens(tokenResponse);
    return redirect('/dashboard');
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
}

// Function to initiate Zoho OAuth flow
export async function initiateZohoOAuth(request?: Request) {
  const { codeVerifier, codeChallenge } = generatePkceChallenge();

  // Store code verifier securely for later use
  await storeCodeVerifier(codeVerifier, request);

  // Generate a random state to prevent CSRF
  const state = generateRandomState();
  await storeState(state, request);

  const authParams = new URLSearchParams({
    client_id: process.env.ZOHO_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: 'https://hr-assistance.hieunguyen.dev/oauthredirect',
    // Comprehensive scopes for Zoho Mail
    scope: 'ZohoMail.accounts.READ ZohoMail.messages.READ offline_access', 
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline' // This is crucial for getting a refresh token
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
        }
      }
    );

    console.log('Token Exchange Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Token Exchange Error:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Utility to generate random state
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
} 