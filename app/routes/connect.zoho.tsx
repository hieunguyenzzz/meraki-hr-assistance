import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { initiateZohoOAuth } from "./oauthredirect";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const authorizationUrl = await initiateZohoOAuth();
    return redirect(authorizationUrl);
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return new Response('Failed to initiate OAuth', { status: 500 });
  }
} 