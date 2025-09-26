# Database Setup Guide

This project now includes MongoDB integration for storing photoshoot generation data.

## Environment Variables

Add the following environment variable to your `.env` file:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/vps-photoshoot
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/vps-photoshoot
```

## Database Schema

The application uses the following collections:

### 1. Model Generations (`modelGenerations`)
Stores data for model generation requests using FLUX.

### 2. Pose Generations (`poseGenerations`)
Stores data for pose generation requests using Gemini and Runway.

### 3. Background Generations (`backgroundGenerations`)
Stores data for background generation requests using FLUX.

### 4. Photoshoot Generations (`photoshootGenerations`)
Stores data for photoshoot generation requests using Gemini.

### 5. Final Photo Generations (`finalPhotoGenerations`)
Stores data for final photo generation requests using Gemini.

### 6. Photoshoot Sessions (`photoshootSessions`)
Groups related generations into sessions for better organization.

### 7. Users (`users`)
Optional user management for future features.

## Features Added

- **Database Integration**: All photoshoot generation endpoints now save data to MongoDB
- **Generation Tracking**: Each generation request is tracked with status, results, and metadata
- **Error Handling**: Failed generations are logged with error details
- **Session Management**: Optional session grouping for related generations
- **Statistics**: Built-in methods to get generation statistics

## API Response Changes

All generation endpoints now return additional fields:
- `generationId`: Unique identifier for the generation record
- `status`: Current status (pending, completed, failed)
- `completedCount`: Number of successfully completed items
- `totalCount`: Total number of items requested

## Usage Example

```javascript
// Example request body with optional user/session tracking
{
  "gender": "female",
  "ethnicity": "asian",
  "age": 25,
  "skinTone": "medium",
  "eyeColor": "brown",
  "hairStyle": "long",
  "hairColor": "black",
  "clothingStyle": "casual",
  "count": 4,
  "userId": "user123", // Optional
  "sessionId": "session456" // Optional
}
```

## Database Service

The `DatabaseService` class provides methods for:
- Creating and updating generation records
- Retrieving generation data
- Managing sessions
- Getting usage statistics

## Connection Management

The application automatically:
- Connects to MongoDB on startup
- Handles connection errors gracefully
- Closes connections on shutdown
- Provides connection status logging

