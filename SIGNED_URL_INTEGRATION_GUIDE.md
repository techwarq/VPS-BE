# 🔗 Signed URL Integration Guide

This guide explains how to use the new signed URL system integrated with your photoshoot and Gemini endpoints.

## 🎯 Overview

All image generation endpoints now support automatic storage in MongoDB GridFS with signed URL generation. Instead of returning base64 image data, the system now returns signed URLs that provide secure, time-limited access to the generated images.

## 🚀 New Features

### ✅ Automatic GridFS Storage
- All generated images are automatically stored in MongoDB GridFS
- Images are organized with metadata and proper filenames
- No more base64 data in responses (unless explicitly requested)

### ✅ Signed URL Generation
- Each stored image gets a signed URL with configurable expiry
- Default expiry: 24 hours for generated images
- Secure token-based access control

### ✅ Backward Compatibility
- Existing endpoints work without changes
- New `storeInGridFS` parameter enables the feature
- Fallback to base64 if GridFS storage fails

## 📋 Updated Endpoints

### 1. Gemini Endpoints

#### `/api/gemini/generate`
```javascript
// New parameters
{
  "prompt": "Generate a beautiful landscape",
  "model": "gemini-2.5-flash-image-preview",
  "responseModalities": ["IMAGE", "TEXT"],
  "storeImagesInGridFS": true,        // NEW: Enable GridFS storage
  "userId": "user123",                // NEW: User ID for metadata
  "metadata": {                       // NEW: Additional metadata
    "type": "landscape",
    "project": "test"
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "model": "gemini-2.5-flash-image-preview",
  "text": "Generated landscape description...",
  "images": [
    {
      "fileId": "507f1f77bcf86cd799439011",
      "filename": "gemini-generated-1.jpg",
      "size": 1024000,
      "contentType": "image/jpeg",
      "signedUrl": "http://localhost:4000/api/files/507f1f77bcf86cd799439011?token=eyJ..."
    }
  ],
  "storedInGridFS": true
}
```

#### `/api/gemini/generate-stream`
Same parameters as above, with streaming response.

### 2. Photoshoot Endpoints

#### `/api/photoshoot/models`
```javascript
{
  "gender": "female",
  "ethnicity": "caucasian",
  "age": 25,
  "skinTone": "fair",
  "eyeColor": "blue",
  "hairStyle": "long wavy",
  "hairColor": "brown",
  "clothingStyle": "casual jeans and t-shirt",
  "count": 4,
  "storeInGridFS": true,              // NEW: Enable GridFS storage
  "userId": "user123"                 // NEW: User ID for metadata
}
```

**Streaming Response:**
```javascript
// Each model generation returns:
{
  "id": "model-0",
  "status": "completed",
  "images": [
    {
      "fileId": "507f1f77bcf86cd799439011",
      "filename": "model-0-1.jpg",
      "size": 1024000,
      "contentType": "image/jpeg",
      "signedUrl": "http://localhost:4000/api/files/507f1f77bcf86cd799439011?token=eyJ..."
    }
  ],
  "text": "Generated model description...",
  "storedInGridFS": true,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

#### `/api/photoshoot/avatar`
```javascript
{
  "subject": "A 25-year-old woman with long brown hair and blue eyes",
  "style": "professional headshot, studio lighting",
  "background": "neutral gray background",
  "aspect_ratio": "3:4",
  "storeInGridFS": true,              // NEW: Enable GridFS storage
  "userId": "user123"                 // NEW: User ID for metadata
}
```

**Streaming Response:**
```javascript
// Each angle generation returns:
{
  "angle": "front",
  "prompt": "Generated prompt...",
  "images": [
    {
      "fileId": "507f1f77bcf86cd799439011",
      "filename": "avatar-front-1.jpg",
      "size": 1024000,
      "contentType": "image/jpeg",
      "signedUrl": "http://localhost:4000/api/files/507f1f77bcf86cd799439011?token=eyJ..."
    }
  ],
  "text": "Generated description...",
  "storedInGridFS": true
}
```

#### `/api/photoshoot/pose`
```javascript
{
  "prompt": "Generate a dynamic pose",
  "count": 3,
  "geminiImage": {
    "mimeType": "image/jpeg",
    "data": "base64data..."
  },
  "storeInGridFS": true,              // NEW: Enable GridFS storage
  "userId": "user123"                 // NEW: User ID for metadata
}
```

#### `/api/photoshoot/background`
```javascript
{
  "locationType": "studio",
  "locationDetail": "modern minimalist",
  "cameraAngle": "eye-level",
  "lightingStyle": "soft diffused",
  "mood": "professional",
  "storeInGridFS": true,              // NEW: Enable GridFS storage
  "userId": "user123"                 // NEW: User ID for metadata
}
```

#### `/api/photoshoot/shoot` and `/api/photoshoot/final`
```javascript
{
  "groups": [
    {
      "prompt": "Combine model with background",
      "images": [
        {
          "mimeType": "image/jpeg",
          "data": "base64data..."
        }
      ]
    }
  ],
  "storeInGridFS": true,              // NEW: Enable GridFS storage
  "userId": "user123"                 // NEW: User ID for metadata
}
```

## 🔧 Configuration

### Environment Variables
Make sure these are set in your `.env` file:

```env
# JWT Configuration for signed URLs
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=5m

# Base URL for signed URLs
BASE_URL=http://localhost:4000

# MongoDB (already configured)
MONGODB_URI=mongodb://localhost:27017/your-database
```

## 💻 Usage Examples

### 1. Generate Avatar with Signed URLs

```javascript
const response = await fetch('/api/photoshoot/avatar', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    subject: 'A professional businesswoman',
    style: 'corporate headshot',
    background: 'neutral gray',
    aspect_ratio: '3:4',
    storeInGridFS: true,
    userId: 'user123'
  })
});

// Handle streaming response
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      const data = JSON.parse(line);
      if (data.images && data.images.length > 0) {
        // Use the signed URL directly
        const imageUrl = data.images[0].signedUrl;
        console.log('Generated image:', imageUrl);
        
        // Use in HTML
        // <img src={imageUrl} alt="Generated avatar" />
      }
    }
  }
}
```

### 2. Generate Models with Signed URLs

```javascript
const response = await fetch('/api/photoshoot/models', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    gender: 'female',
    ethnicity: 'asian',
    age: 28,
    skinTone: 'medium',
    eyeColor: 'brown',
    hairStyle: 'short bob',
    hairColor: 'black',
    clothingStyle: 'business suit',
    count: 3,
    storeInGridFS: true,
    userId: 'user123'
  })
});

// Handle streaming response and collect signed URLs
const imageUrls = [];
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      const data = JSON.parse(line);
      if (data.images && data.images.length > 0) {
        imageUrls.push(data.images[0].signedUrl);
      }
    }
  }
}

console.log('Generated model URLs:', imageUrls);
```

### 3. Use Gemini with GridFS

```javascript
const response = await fetch('/api/gemini/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'Create a futuristic cityscape at sunset',
    model: 'gemini-2.5-flash-image-preview',
    responseModalities: ['IMAGE', 'TEXT'],
    storeImagesInGridFS: true,
    userId: 'user123',
    metadata: {
      type: 'cityscape',
      project: 'futuristic-art'
    }
  })
});

const result = await response.json();

if (result.success && result.images.length > 0) {
  const imageUrl = result.images[0].signedUrl;
  console.log('Generated image URL:', imageUrl);
  
  // Use the image
  // <img src={imageUrl} alt="Generated cityscape" />
}
```

## 🔒 Security Features

### Token-Based Access
- Each signed URL contains a JWT token with expiry
- Tokens are file-specific and cannot be reused for other files
- Configurable expiry times (default: 24 hours for generated images)

### Metadata Tracking
- All stored images include metadata about generation parameters
- User ID tracking for access control
- Generation timestamps and source information

### Error Handling
- Graceful fallback to base64 if GridFS storage fails
- Comprehensive error logging
- Non-blocking storage (generation continues even if storage fails)

## 📊 Benefits

### ✅ Performance
- No more large base64 responses
- Efficient file streaming
- Reduced memory usage

### ✅ Storage
- Centralized file management
- Automatic cleanup capabilities
- Scalable storage solution

### ✅ Security
- Time-limited access
- Token-based authentication
- No direct file system access

### ✅ Integration
- Works with existing endpoints
- Backward compatible
- Easy to enable/disable

## 🧪 Testing

Run the integration test script:

```bash
# Start your server
npm run dev

# In another terminal, run the tests
node test-signed-url-integration.js
```

This will test:
- Gemini image generation with GridFS
- Avatar generation with signed URLs
- Model generation with signed URLs
- File access with token validation

## 🔄 Migration Guide

### For Existing Clients

1. **No Changes Required**: Existing code continues to work
2. **Enable GridFS**: Add `storeInGridFS: true` to requests
3. **Update Response Handling**: Handle signed URLs instead of base64 data
4. **Test Thoroughly**: Verify image access works correctly

### Example Migration

**Before:**
```javascript
// Old way - base64 data
const response = await fetch('/api/photoshoot/avatar', {
  method: 'POST',
  body: JSON.stringify({ subject: 'A person' })
});

const data = await response.json();
const base64Image = data.images[0].data;
// <img src={`data:image/jpeg;base64,${base64Image}`} />
```

**After:**
```javascript
// New way - signed URLs
const response = await fetch('/api/photoshoot/avatar', {
  method: 'POST',
  body: JSON.stringify({ 
    subject: 'A person',
    storeInGridFS: true,
    userId: 'user123'
  })
});

const data = await response.json();
const signedUrl = data.images[0].signedUrl;
// <img src={signedUrl} />
```

## 🎉 Summary

The signed URL integration provides:

- **Automatic GridFS Storage**: All generated images stored in MongoDB
- **Signed URL Generation**: Secure, time-limited access to images
- **Backward Compatibility**: Existing code continues to work
- **Enhanced Security**: Token-based access control
- **Better Performance**: No more large base64 responses
- **Easy Integration**: Simple parameter to enable the feature

Your photoshoot and Gemini endpoints now provide a complete file storage solution with signed URLs, eliminating the need for external storage services while maintaining security and performance.
