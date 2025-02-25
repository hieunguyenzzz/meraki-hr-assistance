import crypto from 'crypto';

export function generatePkceChallenge() {
  // Generate code verifier
  const codeVerifier = generateRandomString(64);
  
  // Create code challenge
  const codeChallenge = createCodeChallenge(codeVerifier);

  return { codeVerifier, codeChallenge };
}

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.randomBytes(length);
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join('');
}

function createCodeChallenge(codeVerifier: string): string {
  const base64Digest = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return base64Digest;
} 