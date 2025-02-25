import axios from "axios";
import { storeTokens } from "./token-storage";

export async function refreshZohoToken(refreshToken: string) {
  try {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        refresh_token: refreshToken,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      }
    });

    // Store the new tokens
    await storeTokens({
      ...response.data,
      refresh_token: refreshToken, // Keep the original refresh token
      created_at: new Date().toISOString()
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing Zoho token:', error);
    throw error;
  }
} 