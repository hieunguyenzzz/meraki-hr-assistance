import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { retrieveTokens } from "~/utils/token-storage";

export async function loader() {
  const tokens = await retrieveTokens();
  
  return json({
    isConnected: !!tokens,
    connectedAt: tokens ? new Date(tokens.created_at).toLocaleString() : null
  });
}

export default function Dashboard() {
  const { isConnected, connectedAt } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      {isConnected ? (
        <div className="bg-green-100 p-4 rounded">
          <p>Zoho Mail is connected</p>
          <p>Connected at: {connectedAt}</p>
        </div>
      ) : (
        <div className="bg-red-100 p-4 rounded">
          <p>Zoho Mail is not connected</p>
        </div>
      )}
    </div>
  );
} 