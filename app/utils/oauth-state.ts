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

export async function storeState(state: string): Promise<void> {
  const session = await sessionStorage.getSession();
  session.set('oauth_state', state);
  
  // Commit the session
  await sessionStorage.commitSession(session);
}

export async function getStoredState(): Promise<string | null> {
  const session = await sessionStorage.getSession();
  return session.get('oauth_state') || null;
}

export async function storeCodeVerifier(verifier: string): Promise<void> {
  const session = await sessionStorage.getSession();
  session.set('code_verifier', verifier);
  
  // Commit the session
  await sessionStorage.commitSession(session);
}

export async function retrieveCodeVerifier(): Promise<string | null> {
  const session = await sessionStorage.getSession();
  return session.get('code_verifier') || null;
} 