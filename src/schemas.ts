import { ObjectId } from 'mongodb';

// Base interface for all documents
export interface BaseDocument {
  _id?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Model generation schema
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

// Pose generation schema
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

// Background generation schema
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

// Photoshoot generation schema
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

// Final photo generation schema
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

// Session schema to group related generations
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

// User schema (optional, for future user management)
export interface User extends BaseDocument {
  email: string;
  name?: string;
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

// Collection names
export const COLLECTIONS = {
  MODEL_GENERATIONS: 'modelGenerations',
  POSE_GENERATIONS: 'poseGenerations',
  BACKGROUND_GENERATIONS: 'backgroundGenerations',
  PHOTOSHOOT_GENERATIONS: 'photoshootGenerations',
  FINAL_PHOTO_GENERATIONS: 'finalPhotoGenerations',
  PHOTOSHOOT_SESSIONS: 'photoshootSessions',
  USERS: 'users',
} as const;

