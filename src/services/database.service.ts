import { Db, ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';
import { 
  ModelGeneration, 
  PoseGeneration, 
  BackgroundGeneration, 
  PhotoshootGeneration, 
  FinalPhotoGeneration, 
  PhotoshootSession,
  User,
  COLLECTIONS 
} from '../types/schemas';

export class DatabaseService {
  private db: Db | null = null;

  private getDb(): Db {
    if (!this.db) {
      this.db = getDatabase();
    }
    return this.db;
  }

  async createModelGeneration(data: Omit<ModelGeneration, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const now = new Date();
    const document: ModelGeneration = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.getDb().collection<ModelGeneration>(COLLECTIONS.MODEL_GENERATIONS).insertOne(document);
    return result.insertedId;
  }

  async updateModelGeneration(id: ObjectId, updates: Partial<ModelGeneration>): Promise<void> {
    await this.getDb().collection<ModelGeneration>(COLLECTIONS.MODEL_GENERATIONS).updateOne(
      { _id: id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async getModelGeneration(id: ObjectId): Promise<ModelGeneration | null> {
    return await this.getDb().collection<ModelGeneration>(COLLECTIONS.MODEL_GENERATIONS).findOne({ _id: id });
  }

  async createPoseGeneration(data: Omit<PoseGeneration, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const now = new Date();
    const document: PoseGeneration = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.getDb().collection<PoseGeneration>(COLLECTIONS.POSE_GENERATIONS).insertOne(document);
    return result.insertedId;
  }

  async updatePoseGeneration(id: ObjectId, updates: Partial<PoseGeneration>): Promise<void> {
    await this.getDb().collection<PoseGeneration>(COLLECTIONS.POSE_GENERATIONS).updateOne(
      { _id: id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async getPoseGeneration(id: ObjectId): Promise<PoseGeneration | null> {
    return await this.getDb().collection<PoseGeneration>(COLLECTIONS.POSE_GENERATIONS).findOne({ _id: id });
  }

  async createBackgroundGeneration(data: Omit<BackgroundGeneration, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const now = new Date();
    const document: BackgroundGeneration = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.getDb().collection<BackgroundGeneration>(COLLECTIONS.BACKGROUND_GENERATIONS).insertOne(document);
    return result.insertedId;
  }

  async updateBackgroundGeneration(id: ObjectId, updates: Partial<BackgroundGeneration>): Promise<void> {
    await this.getDb().collection<BackgroundGeneration>(COLLECTIONS.BACKGROUND_GENERATIONS).updateOne(
      { _id: id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async getBackgroundGeneration(id: ObjectId): Promise<BackgroundGeneration | null> {
    return await this.getDb().collection<BackgroundGeneration>(COLLECTIONS.BACKGROUND_GENERATIONS).findOne({ _id: id });
  }

  async createPhotoshootGeneration(data: Omit<PhotoshootGeneration, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const now = new Date();
    const document: PhotoshootGeneration = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.getDb().collection<PhotoshootGeneration>(COLLECTIONS.PHOTOSHOOT_GENERATIONS).insertOne(document);
    return result.insertedId;
  }

  async updatePhotoshootGeneration(id: ObjectId, updates: Partial<PhotoshootGeneration>): Promise<void> {
    await this.getDb().collection<PhotoshootGeneration>(COLLECTIONS.PHOTOSHOOT_GENERATIONS).updateOne(
      { _id: id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async getPhotoshootGeneration(id: ObjectId): Promise<PhotoshootGeneration | null> {
    return await this.getDb().collection<PhotoshootGeneration>(COLLECTIONS.PHOTOSHOOT_GENERATIONS).findOne({ _id: id });
  }

  async createFinalPhotoGeneration(data: Omit<FinalPhotoGeneration, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const now = new Date();
    const document: FinalPhotoGeneration = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.getDb().collection<FinalPhotoGeneration>(COLLECTIONS.FINAL_PHOTO_GENERATIONS).insertOne(document);
    return result.insertedId;
  }

  async updateFinalPhotoGeneration(id: ObjectId, updates: Partial<FinalPhotoGeneration>): Promise<void> {
    await this.getDb().collection<FinalPhotoGeneration>(COLLECTIONS.FINAL_PHOTO_GENERATIONS).updateOne(
      { _id: id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async getFinalPhotoGeneration(id: ObjectId): Promise<FinalPhotoGeneration | null> {
    return await this.getDb().collection<FinalPhotoGeneration>(COLLECTIONS.FINAL_PHOTO_GENERATIONS).findOne({ _id: id });
  }

  async createSession(data: Omit<PhotoshootSession, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const now = new Date();
    const document: PhotoshootSession = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.getDb().collection<PhotoshootSession>(COLLECTIONS.PHOTOSHOOT_SESSIONS).insertOne(document);
    return result.insertedId;
  }

  async updateSession(id: ObjectId, updates: Partial<PhotoshootSession>): Promise<void> {
    await this.getDb().collection<PhotoshootSession>(COLLECTIONS.PHOTOSHOOT_SESSIONS).updateOne(
      { _id: id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async getSession(id: ObjectId): Promise<PhotoshootSession | null> {
    return await this.getDb().collection<PhotoshootSession>(COLLECTIONS.PHOTOSHOOT_SESSIONS).findOne({ _id: id });
  }

  async getSessionsByUser(userId: string, limit: number = 10): Promise<PhotoshootSession[]> {
    return await this.getDb().collection<PhotoshootSession>(COLLECTIONS.PHOTOSHOOT_SESSIONS)
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async getGenerationStats(userId?: string): Promise<{
    totalGenerations: number;
    totalImages: number;
    totalSessions: number;
  }> {
    const matchStage = userId ? { userId } : {};
    
    const [modelStats, poseStats, backgroundStats, photoshootStats, finalPhotoStats, sessionStats] = await Promise.all([
      this.getDb().collection(COLLECTIONS.MODEL_GENERATIONS).aggregate([
        { $match: matchStage },
        { $group: { _id: null, count: { $sum: 1 }, images: { $sum: '$totalCount' } } }
      ]).toArray(),
      this.getDb().collection(COLLECTIONS.POSE_GENERATIONS).aggregate([
        { $match: matchStage },
        { $group: { _id: null, count: { $sum: 1 }, images: { $sum: '$totalCount' } } }
      ]).toArray(),
      this.getDb().collection(COLLECTIONS.BACKGROUND_GENERATIONS).aggregate([
        { $match: matchStage },
        { $group: { _id: null, count: { $sum: 1 }, images: { $sum: '$totalCount' } } }
      ]).toArray(),
      this.getDb().collection(COLLECTIONS.PHOTOSHOOT_GENERATIONS).aggregate([
        { $match: matchStage },
        { $group: { _id: null, count: { $sum: 1 }, images: { $sum: '$totalGroups' } } }
      ]).toArray(),
      this.getDb().collection(COLLECTIONS.FINAL_PHOTO_GENERATIONS).aggregate([
        { $match: matchStage },
        { $group: { _id: null, count: { $sum: 1 }, images: { $sum: '$totalGroups' } } }
      ]).toArray(),
      this.getDb().collection(COLLECTIONS.PHOTOSHOOT_SESSIONS).countDocuments(matchStage)
    ]);

    const totalGenerations = [
      modelStats[0]?.count || 0,
      poseStats[0]?.count || 0,
      backgroundStats[0]?.count || 0,
      photoshootStats[0]?.count || 0,
      finalPhotoStats[0]?.count || 0
    ].reduce((sum, count) => sum + count, 0);

    const totalImages = [
      modelStats[0]?.images || 0,
      poseStats[0]?.images || 0,
      backgroundStats[0]?.images || 0,
      photoshootStats[0]?.images || 0,
      finalPhotoStats[0]?.images || 0
    ].reduce((sum, count) => sum + count, 0);

    return {
      totalGenerations,
      totalImages,
      totalSessions: sessionStats
    };
  }

  // ============================================
  // User Authentication Methods
  // ============================================

  async createUser(data: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const now = new Date();
    const document: User = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.getDb().collection<User>(COLLECTIONS.USERS).insertOne(document);
    return result.insertedId;
  }

  async getUserById(id: ObjectId): Promise<User | null> {
    return await this.getDb().collection<User>(COLLECTIONS.USERS).findOne({ _id: id });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.getDb().collection<User>(COLLECTIONS.USERS).findOne({ email: email.toLowerCase() });
  }

  async getUserByGoogleId(googleId: string): Promise<User | null> {
    return await this.getDb().collection<User>(COLLECTIONS.USERS).findOne({ googleId });
  }

  async updateUser(id: ObjectId, updates: Partial<User>): Promise<void> {
    await this.getDb().collection<User>(COLLECTIONS.USERS).updateOne(
      { _id: id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async updateUserLastLogin(id: ObjectId): Promise<void> {
    await this.getDb().collection<User>(COLLECTIONS.USERS).updateOne(
      { _id: id },
      { 
        $set: { 
          lastLogin: new Date(),
          updatedAt: new Date()
        } 
      }
    );
  }

  async linkGoogleAccount(userId: ObjectId, googleId: string, profilePicture?: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updates: Partial<User> = {
      googleId,
      authProvider: user.authProvider === 'local' ? 'both' : 'google',
      updatedAt: new Date()
    };

    if (profilePicture) {
      updates.profilePicture = profilePicture;
    }

    await this.getDb().collection<User>(COLLECTIONS.USERS).updateOne(
      { _id: userId },
      { $set: updates }
    );
  }

  async deleteUser(id: ObjectId): Promise<void> {
    await this.getDb().collection<User>(COLLECTIONS.USERS).deleteOne({ _id: id });
  }

  async getAllUsers(limit: number = 100, skip: number = 0): Promise<User[]> {
    return await this.getDb().collection<User>(COLLECTIONS.USERS)
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }
}


