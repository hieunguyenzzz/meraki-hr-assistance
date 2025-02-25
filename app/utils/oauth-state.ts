import { createCookieSessionStorage } from "@remix-run/node";
import { generatePkceChallenge } from "~/utils/pkce";

// Create a session storage for OAuth state and code verifier
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'oauth_state',
    httpOnly: true,
    maxAge: 15 * 60, // 15 minutes
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET || 'fallback_secret'],
    secure: process.env.NODE_ENV === 'production'
  }
});

export async function storeState(state: string, request?: Request): Promise<string | undefined> {
  try {
    // Always create a new session if no existing cookie
    const session = await sessionStorage.getSession(
      request?.headers.get('Cookie')
    );
    
    session.set('oauth_state', state);
    
    // Log the stored state for debugging
    console.log('Storing state:', state);
    
    // Commit the session and get the cookie header
    const cookie = await sessionStorage.commitSession(session);
    
    // Log the cookie header
    console.log('State Storage Cookie Header:', cookie);
    
    return cookie;
  } catch (error) {
    console.error('Error storing state:', error);
    throw error;
  }
}

export async function getStoredState(request?: Request): Promise<string | null> {
  try {
    const session = await sessionStorage.getSession(
      request?.headers.get('Cookie')
    );
    
    const storedState = session.get('oauth_state');
    
    // Log the retrieved state for debugging
    console.log('Retrieved stored state:', storedState);
    console.log('Full session data:', session.data);
    
    return storedState || null;
  } catch (error) {
    console.error('Error retrieving state:', error);
    return null;
  }
}

export async function storeCodeVerifier(verifier: string, request?: Request): Promise<void> {
  try {
    const session = await sessionStorage.getSession(
      request?.headers.get('Cookie')
    );
    
    session.set('code_verifier', verifier);
    
    // Commit the session
    await sessionStorage.commitSession(session);
  } catch (error) {
    console.error('Error storing code verifier:', error);
    throw error;
  }
}

export async function retrieveCodeVerifier(request?: Request): Promise<string | null> {
  try {
    const session = await sessionStorage.getSession(
      request?.headers.get('Cookie')
    );
    
    return session.get('code_verifier') || null;
  } catch (error) {
    console.error('Error retrieving code verifier:', error);
    return null;
  }
}

export async function initiateZohoOAuth(request?: Request) {
  const { codeVerifier, codeChallenge } = generatePkceChallenge();

  await storeCodeVerifier(codeVerifier, request);

  const state = generateRandomState();
  await storeState(state, request);

  const authParams = new URLSearchParams({
    client_id: process.env.ZOHO_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: 'https://hr-assistance.hieunguyen.dev/oauthredirect',
    scope: 'ZohoMail.accounts.READ ZohoMail.messages.READ offline_access', 
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline'
  });

  return `https://accounts.zoho.com/oauth/v2/auth?${authParams.toString()}`;
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
} 