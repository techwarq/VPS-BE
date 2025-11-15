import { MongoClient, Db } from 'mongodb';

let client: MongoClient;
let db: Db;
let isConnecting = false;

export async function connectToDatabase(): Promise<Db> {
  // If we have a db instance, check if connection is still alive
  if (db && client) {
    // Check if client is still connected (faster than ping)
    const topology = (client as any).topology;
    if (topology && topology.isConnected && topology.isConnected()) {
      return db;
    } else {
      // Connection is dead, reset and reconnect
      console.warn('⚠️ Database connection lost, reconnecting...');
      try {
        await client.close();
      } catch (e) {
        // Ignore close errors
      }
      db = null as any;
      client = null as any;
    }
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait a bit and retry
    await new Promise(resolve => setTimeout(resolve, 100));
    if (db) return db;
  }

  isConnecting = true;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    isConnecting = false;
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db();
    console.log('✅ Connected to MongoDB');
    isConnecting = false;
    return db;
  } catch (error) {
    isConnecting = false;
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

export function getDatabase(): Db {
  if (!db) {
    console.error('❌ Database not connected. Call connectToDatabase() first.');
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }
  console.log('✅ Database connection retrieved successfully');
  return db;
}