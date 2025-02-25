import fs from 'fs/promises';
import path from 'path';

const TOKEN_FILE = path.resolve(process.cwd(), 'zoho-tokens.json');

export async function storeTokens(tokens: any) {
  try {
    await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log('Tokens stored successfully');
  } catch (error) {
    console.error('Error storing tokens:', error);
  }
}

export async function retrieveTokens() {
  try {
    const tokenData = await fs.readFile(TOKEN_FILE, 'utf-8');
    return JSON.parse(tokenData);
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    return null;
  }
} 