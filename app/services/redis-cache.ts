import { createClient } from 'redis';

class RedisCacheService {
  private client;
  private isConnected = false;
  
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });
    
    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });
  }
  
  async connect() {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }
  
  async set(key: string, value: any, expiryInSeconds = 604800) { // Default 7 days
    try {
      await this.connect();
      await this.client.set(key, JSON.stringify(value), {
        EX: expiryInSeconds
      });
      return true;
    } catch (error) {
      console.error('Redis Set Error:', error);
      return false;
    }
  }
  
  async get(key: string) {
    try {
      await this.connect();
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis Get Error:', error);
      return null;
    }
  }
  
  async exists(key: string) {
    try {
      await this.connect();
      return await this.client.exists(key);
    } catch (error) {
      console.error('Redis Exists Error:', error);
      return false;
    }
  }
  
  async disconnect() {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }
}

// Singleton instance
let instance: RedisCacheService | null = null;

export function getRedisCache(): RedisCacheService {
  if (!instance) {
    instance = new RedisCacheService();
  }
  return instance;
} 