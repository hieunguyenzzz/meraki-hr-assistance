import { retrieveTokens } from "./token-storage";
import { refreshZohoToken } from "./token-refresh";

export async function withTokenRefresh<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Check if error is due to expired token
    if (error instanceof Error && error.message.includes('invalid_grant')) {
      const tokens = await retrieveTokens();
      
      if (tokens && tokens.refresh_token) {
        // Attempt to refresh token
        await refreshZohoToken(tokens.refresh_token);
        
        // Retry the original function
        return await fn();
      }
    }
    
    throw error;
  }
} 