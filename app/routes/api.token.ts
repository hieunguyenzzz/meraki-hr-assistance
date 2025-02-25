import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getZohoAccessToken } from "~/utils/zoho-auth";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const accessToken = await getZohoAccessToken();
    
    return json({
      success: true,
      accessToken
    });
  } catch (error) {
    console.error('Error fetching access token:', error);
    
    return json({
      success: false,
      error: 'Failed to retrieve access token'
    }, { status: 500 });
  }
} 