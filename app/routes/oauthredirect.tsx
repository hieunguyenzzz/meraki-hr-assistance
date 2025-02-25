import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import axios from "axios";
import { generatePkceChallenge } from "~/utils/pkce"; // We'll create this utility

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Validate state to prevent CSRF
  const storedState = await getStoredState(); // Implement state storage/validation
  if (state !== storedState) {
    return new Response('Invalid state', { status: 400 });
  }

  if (!code) {
    return new Response('No authorization code', { status: 400 });
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);

    // Store tokens securely (e.g., in a secure server-side session or database)
    await storeTokens(tokenResponse);

    // Redirect to a success page or dashboard
    return redirect('/dashboard');
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
}

// Function to initiate Zoho OAuth flow
export async function initiateZohoOAuth() {
  const { codeVerifier, codeChallenge } = generatePkceChallenge();

  // Store code verifier securely for later use
  await storeCodeVerifier(codeVerifier);

  // Generate a random state to prevent CSRF
  const state = generateRandomState();
  await storeState(state);

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
  const codeVerifier = await retrieveCodeVerifier();

  const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: {
      grant_type: 'authorization_code',
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      redirect_uri: 'https://hr-assistance.hieunguyen.dev/oauthredirect',
      code: code,
      code_verifier: codeVerifier
    }
  });

  // Log the refresh token (only do this once for initial setup)
  console.log('Refresh Token:', response.data.refresh_token);

  return response.data;
}

// Utility functions (implement these based on your storage mechanism)
async function getStoredState(): Promise<string> {
  // Implement secure state retrieval (e.g., from session or encrypted storage)
  throw new Error('Not implemented');
}

async function storeState(state: string): Promise<void> {
  // Implement secure state storage
  throw new Error('Not implemented');
}

async function storeTokens(tokens: any): Promise<void> {
  // Implement secure token storage
  throw new Error('Not implemented');
}

async function storeCodeVerifier(verifier: string): Promise<void> {
  // Implement secure code verifier storage
  throw new Error('Not implemented');
}

async function retrieveCodeVerifier(): Promise<string> {
  // Implement secure code verifier retrieval
  throw new Error('Not implemented');
}

// Utility to generate random state
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
} 