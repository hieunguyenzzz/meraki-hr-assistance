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

export default function ConnectZoho() {
  // This is a fallback component in case someone navigates directly to this route
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Connect Zoho Mail</h1>
      <p>Please use the connection button to initiate OAuth flow.</p>
    </div>
  );
} 