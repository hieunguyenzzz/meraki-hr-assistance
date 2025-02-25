import { createCookieSessionStorage } from "@remix-run/node";

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