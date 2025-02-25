import { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "react-router-dom";
import { initiateZohoOAuth } from "../../utils/oauth-state";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const authorizationUrl = await initiateZohoOAuth(request);
    return redirect(authorizationUrl);
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return new Response('Failed to initiate OAuth', { status: 500 });
  }
} 