import { ObjectId } from 'mongodb';

export interface BaseDocument {
  _id?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelGeneration extends BaseDocument {
  userId?: string;
  sessionId?: string;
  requestData: {
    gender: string;
    ethnicity: string;
    age: number;
    skinTone: string;
    eyeColor: string;
    hairStyle: string;
    hairColor: string;
    clothingStyle: string;
    count: number;
    aspect_ratio?: string;
    fluxEndpoint?: string;
  };
  prompt: string;
  results: Array<{
    id: string;
    status: 'pending' | 'completed' | 'failed';
    imageUrl?: string;
    error?: string;
    createdAt: Date;
  }>;
  status: 'pending' | 'completed' | 'failed';
  totalCount: number;
  completedCount: number;
  error?: string;
}

export interface PoseGeneration extends BaseDocument {
  userId?: string;
  sessionId?: string;
  requestData: {
    prompt: string;
    count: number;
    geminiImage?: { mimeType: string; data: string };
    runwayImageUrl?: string;
    ratio?: string;
    runwayModel?: 'gen4_image' | 'gen4_image_turbo';
  };
  geminiResults: Array<{
    text: string;
    images: Array<{ mimeType: string; data: string }>;
  }>;
  runwayTasks: Array<{
    taskId: string;
    status: 'pending' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }>;
  status: 'pending' | 'completed' | 'failed';
  totalCount: number;
  completedCount: number;
  error?: string;
}

export interface BackgroundGeneration extends BaseDocument {
  userId?: string;
  sessionId?: string;
  requestData: {
    locationType: string;
    locationDetail: string;
    cameraAngle: string;
    lightingStyle: string;
    mood: string;
    aspect_ratio?: string;
    count: number;
  };
  prompt: string;
  results: Array<{
    id: string;
    status: 'pending' | 'completed' | 'failed';
    imageUrl?: string;
    error?: string;
    createdAt: Date;
  }>;
  status: 'pending' | 'completed' | 'failed';
  totalCount: number;
  completedCount: number;
  error?: string;
}

export interface PhotoshootGeneration extends BaseDocument {
  userId?: string;
  sessionId?: string;
  requestData: {
    groups: Array<{
      prompt: string;
      images: Array<{ mimeType: string; data: string }>;
    }>;
  };
  results: Array<{
    text: string;
    images: Array<{ mimeType: string; data: string }>;
  }>;
  status: 'pending' | 'completed' | 'failed';
  totalGroups: number;
  completedGroups: number;
  error?: string;
}

export interface FinalPhotoGeneration extends BaseDocument {
  userId?: string;
  sessionId?: string;
  requestData: {
    groups: Array<{
      prompt: string;
      images: Array<{ mimeType: string; data: string }>;
    }>;
  };
  results: Array<{
    text: string;
    images: Array<{ mimeType: string; data: string }>;
  }>;
  status: 'pending' | 'completed' | 'failed';
  totalGroups: number;
  completedGroups: number;
  error?: string;
}

export interface PhotoshootSession extends BaseDocument {
  userId?: string;
  sessionName?: string;
  description?: string;
  modelGenerationId?: ObjectId;
  poseGenerationId?: ObjectId;
  backgroundGenerationId?: ObjectId;
  photoshootGenerationId?: ObjectId;
  finalPhotoGenerationId?: ObjectId;
  status: 'active' | 'completed' | 'archived';
  metadata?: {
    totalImages?: number;
    totalCost?: number;
    duration?: number;
  };
}

export interface User extends BaseDocument {
  email: string;
  name?: string;
  password?: string; // Hashed password for username/password auth
  googleId?: string; // Google OAuth ID
  profilePicture?: string;
  authProvider: 'local' | 'google' | 'both'; // Track how user signed up
  emailVerified: boolean;
  lastLogin?: Date;
  preferences?: {
    defaultAspectRatio?: string;
    defaultModel?: string;
    notificationSettings?: any;
  };
  usage?: {
    totalGenerations: number;
    totalImages: number;
    lastActive: Date;
  };
}

export const COLLECTIONS = {
  MODEL_GENERATIONS: 'modelGenerations',
  POSE_GENERATIONS: 'poseGenerations',
  BACKGROUND_GENERATIONS: 'backgroundGenerations',
  PHOTOSHOOT_GENERATIONS: 'photoshootGenerations',
  FINAL_PHOTO_GENERATIONS: 'finalPhotoGenerations',
  PHOTOSHOOT_SESSIONS: 'photoshootSessions',
  USERS: 'users',
} as const;