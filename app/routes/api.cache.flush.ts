import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getRedisCache } from "~/services/redis-cache";

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST requests
  if (request.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, { status: 405 });
  }
  
  try {
    // Get Redis cache instance
    const redisCache = getRedisCache();
    
    // Connect and run FLUSHALL
    await redisCache.connect();
    const client = redisCache.getClient(); // You would need to add a method to expose the client
    await client.flushAll();
    
    return json({ success: true, message: "Cache successfully flushed" });
  } catch (error) {
    console.error("Error flushing cache:", error);
    return json({ 
      success: false, 
      message: "Error flushing cache", 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
} 