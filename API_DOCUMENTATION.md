# VPS Photoshoot API Documentation

## Overview
This API provides endpoints for generating AI-powered photoshoot content using multiple AI services (Gemini, Runway, FLUX) with MongoDB database integration for tracking and managing generation requests.

## Environment Setup

### Required Environment Variables
```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/vps-photoshoot

# API Keys
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
RUNWAY_API_KEY=your_runway_api_key_here
BFL_API_KEY=your_bfl_api_key_here

# Optional Configuration
BFL_FLUX_MODELS_ENDPOINT=https://api.bfl.ai/v1/flux-1.1-pro-ultra
```

## Photoshoot Generation Endpoints

### 1. Generate Models
**POST** `/api/photoshoot/models`

Generate fashion model images using FLUX.

**Request Body:**
```json
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
  "aspect_ratio": "1024:1024",
  "fluxEndpoint": "https://api.bfl.ai/v1/flux-1.1-pro-ultra",
  "userId": "user123",
  "sessionId": "session456"
}
```

**Response:**
```json
{
  "success": true,
  "model": "flux-1.1-pro-ultra",
  "results": [
    {
      "id": "task-1",
      "status": "completed",
      "imageUrl": "https://...",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "generationId": "507f1f77bcf86cd799439011",
  "status": "completed",
  "completedCount": 4,
  "totalCount": 4
}
```

### 2. Generate Pose
**POST** `/api/photoshoot/pose`

Generate pose variations using Gemini and Runway.

**Request Body:**
```json
{
  "prompt": "Professional fashion pose",
  "count": 4,
  "geminiImage": {
    "mimeType": "image/png",
    "data": "base64_encoded_image_data"
  },
  "runwayImageUrl": "https://example.com/image.jpg",
  "ratio": "1024:1024",
  "runwayModel": "gen4_image_turbo",
  "userId": "user123",
  "sessionId": "session456"
}
```

### 3. Generate Background
**POST** `/api/photoshoot/background`

Generate background images using FLUX.

**Request Body:**
```json
{
  "locationType": "studio",
  "locationDetail": "modern white studio",
  "cameraAngle": "eye level",
  "lightingStyle": "soft natural lighting",
  "mood": "professional",
  "aspect_ratio": "1024:1024",
  "count": 1,
  "userId": "user123",
  "sessionId": "session456"
}
```

### 4. Generate Photoshoot
**POST** `/api/photoshoot/shoot`

Generate photoshoot images using Gemini.

**Request Body:**
```json
{
  "groups": [
    {
      "prompt": "Professional fashion photoshoot",
      "images": [
        {
          "mimeType": "image/png",
          "data": "base64_encoded_image_data"
        }
      ]
    }
  ],
  "userId": "user123",
  "sessionId": "session456"
}
```

### 5. Generate Final Photo
**POST** `/api/photoshoot/final`

Generate final photoshoot images using Gemini.

**Request Body:** Same as Generate Photoshoot

## Database Management Endpoints

### 1. Get Generation
**GET** `/api/database/generation/:type/:id`

Retrieve a specific generation record.

**Parameters:**
- `type`: Generation type (`model`, `pose`, `background`, `photoshoot`, `final`)
- `id`: Generation ID

### 2. Get User Statistics
**GET** `/api/database/stats/user/:userId`

Get generation statistics for a specific user.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalGenerations": 25,
    "totalImages": 100,
    "totalSessions": 5
  }
}
```

### 3. Get Global Statistics
**GET** `/api/database/stats/global`

Get global generation statistics.

### 4. Get User Sessions
**GET** `/api/database/sessions/user/:userId?limit=10`

Get sessions for a specific user.

### 5. Create Session
**POST** `/api/database/sessions`

Create a new photoshoot session.

**Request Body:**
```json
{
  "userId": "user123",
  "sessionName": "Summer Collection",
  "description": "Fashion shoot for summer collection"
}
```

### 6. Get Session
**GET** `/api/database/sessions/:sessionId`

Get a specific session by ID.

## Database Schema

### Collections
- `modelGenerations`: FLUX model generation records
- `poseGenerations`: Gemini/Runway pose generation records
- `backgroundGenerations`: FLUX background generation records
- `photoshootGenerations`: Gemini photoshoot generation records
- `finalPhotoGenerations`: Gemini final photo generation records
- `photoshootSessions`: Session management records
- `users`: User management records (optional)

### Common Fields
All generation records include:
- `_id`: MongoDB ObjectId
- `userId`: Optional user identifier
- `sessionId`: Optional session identifier
- `requestData`: Original request parameters
- `status`: Generation status (`pending`, `completed`, `failed`)
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp
- `error`: Error message (if failed)

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "message": "Detailed error message",
  "generationId": "507f1f77bcf86cd799439011" // If applicable
}
```

## Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found
- `500`: Internal Server Error

## Features

### Database Integration
- Automatic connection management
- Generation tracking and status updates
- Error logging and recovery
- Session management
- Usage statistics

### AI Service Integration
- FLUX for model and background generation
- Gemini for pose and photoshoot generation
- Runway for pose generation
- Parallel processing for multiple generations

### Monitoring
- Generation status tracking
- Error logging
- Performance metrics
- User usage statistics

