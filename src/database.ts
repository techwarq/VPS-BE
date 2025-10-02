import { MongoClient, Db } from 'mongodb';

let client: MongoClient;
let db: Db;

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // Use default database or specify database name
    console.log('✅ Connected to MongoDB');
    return db;
  } catch (error) {
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


