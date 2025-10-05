# 📁 MongoDB GridFS Signed URL System

This implementation provides a complete file storage and signed URL system using MongoDB GridFS, eliminating the need for external storage services like S3.

## 🚀 Features

- **GridFS Integration**: Store files directly in MongoDB using GridFS
- **Signed URLs**: JWT-based signed URLs with configurable expiry
- **Authentication**: Optional and required authentication middleware
- **File Streaming**: Efficient file streaming with proper headers
- **File Management**: Upload, download, delete, and list files
- **Security**: Token validation and permission-based access
- **Health Checks**: Service health monitoring

## 📋 API Endpoints

### File Upload & Management

#### Upload File
```http
POST /api/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <optional-jwt-token>

Form Data:
- file: <file>
- userId: <optional-user-id>
- metadata: <optional-json-metadata>
```

**Response:**
```json
{
  "success": true,
  "file": {
    "id": "507f1f77bcf86cd799439011",
    "filename": "image.jpg",
    "size": 1024000,
    "contentType": "image/jpeg",
    "signedUrl": "http://localhost:4000/api/files/507f1f77bcf86cd799439011?token=eyJ..."
  },
  "message": "File uploaded successfully"
}
```

#### Generate Signed URL
```http
POST /api/files/:fileId/signed-url
Content-Type: application/json
Authorization: Bearer <optional-jwt-token>

{
  "userId": "user123",
  "permissions": ["read", "download"],
  "expiry": "1h",
  "metadata": {"purpose": "preview"}
}
```

**Response:**
```json
{
  "success": true,
  "fileId": "507f1f77bcf86cd799439011",
  "signedUrl": "http://localhost:4000/api/files/507f1f77bcf86cd799439011?token=eyJ...",
  "expiresIn": "1h",
  "permissions": ["read", "download"]
}
```

#### Get File Info
```http
GET /api/files/:fileId/info
Authorization: Bearer <optional-jwt-token>
```

#### Delete File
```http
DELETE /api/files/:fileId
Authorization: Bearer <required-jwt-token>
```

#### List Files
```http
GET /api/files?userId=user123&limit=10&skip=0
Authorization: Bearer <optional-jwt-token>
```

### File Access (Signed URLs)

#### Stream File
```http
GET /api/files/:id?token=<jwt-token>
```

#### Download File
```http
GET /api/files/:id/download?token=<jwt-token>
```

#### Get File Metadata
```http
GET /api/files/:id/metadata?token=<jwt-token>
```

### Health Check
```http
GET /api/files/health
```

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=5m

# Base URL for signed URLs
BASE_URL=https://vps-be.vercel.app

# MongoDB (already configured)
MONGODB_URI=mongodb://localhost:27017/your-database
```

## 💻 Usage Examples

### 1. Upload a File

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('userId', 'user123');

const response = await fetch('/api/files/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + userToken
  },
  body: formData
});

const result = await response.json();
console.log('Signed URL:', result.file.signedUrl);
```

### 2. Generate Signed URL for Existing File

```javascript
const response = await fetch('/api/files/507f1f77bcf86cd799439011/signed-url', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + userToken
  },
  body: JSON.stringify({
    userId: 'user123',
    permissions: ['read'],
    expiry: '1h'
  })
});

const result = await response.json();
console.log('Signed URL:', result.signedUrl);
```

### 3. Access File with Signed URL

```javascript
// The signed URL can be used directly in img src, or fetched
const imageUrl = 'http://localhost:4000/api/files/507f1f77bcf86cd799439011?token=eyJ...';

// Use in HTML
<img src={imageUrl} alt="User uploaded image" />

// Or fetch programmatically
const response = await fetch(imageUrl);
const blob = await response.blob();
```

### 4. Authentication Examples

#### Generate Auth Token
```javascript
import { generateAuthToken } from './auth.middleware';

const user = {
  userId: 'user123',
  email: 'user@example.com',
  role: 'user',
  permissions: ['read', 'write']
};

const authToken = generateAuthToken(user, '24h');
```

#### Use with API Calls
```javascript
const response = await fetch('/api/files/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + authToken
  },
  body: formData
});
```

## 🔒 Security Features

### Token Validation
- JWT tokens with configurable expiry
- File-specific token validation
- Permission-based access control

### Authentication Levels
- **Optional Auth**: Works with or without authentication
- **Required Auth**: Must provide valid JWT token
- **Role-based**: Check user roles
- **Permission-based**: Check specific permissions

### File Security
- Files stored in MongoDB GridFS
- No direct file system access
- Token-based access control
- Configurable cache headers

## 🏗️ Architecture

```
Client Request
    ↓
Express Server
    ↓
Authentication Middleware (Optional)
    ↓
File Controller
    ↓
GridFS Service
    ↓
MongoDB GridFS
```

## 📊 File Flow

1. **Upload**: File → Multer → GridFS → Return signed URL
2. **Access**: Signed URL → Token validation → Stream from GridFS
3. **Management**: Auth required → CRUD operations on GridFS

## 🚨 Error Handling

The system provides comprehensive error handling:

- **401 Unauthorized**: Invalid or missing token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: File doesn't exist
- **413 Payload Too Large**: File size exceeds limit
- **500 Internal Server Error**: Server-side errors

## 🔧 Customization

### Custom Expiry Times
```javascript
// Generate URL with custom expiry
const signedUrl = generateSignedUrl(fileId, {
  expiry: '2h', // 2 hours
  userId: 'user123'
});
```

### Custom Permissions
```javascript
// Generate URL with specific permissions
const signedUrl = generateSignedUrlWithPermissions(fileId, ['read', 'download'], {
  userId: 'user123',
  expiry: '1h'
});
```

### File Type Restrictions
Modify the multer configuration in `file.controller.ts`:

```javascript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Custom file type validation
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|pdf|doc|docx/;
    // ... rest of validation
  }
});
```

## 🎯 Benefits

✅ **No External Dependencies**: Everything stored in MongoDB  
✅ **Cost Effective**: No S3 or external storage costs  
✅ **Secure**: JWT-based signed URLs with expiry  
✅ **Scalable**: GridFS handles large files efficiently  
✅ **Flexible**: Configurable permissions and authentication  
✅ **Integrated**: Works seamlessly with existing MongoDB setup  

## 🚀 Getting Started

1. Install dependencies (already done)
2. Set environment variables
3. Start your server
4. Use the API endpoints as documented above

The system is now ready to handle file uploads, generate signed URLs, and serve files securely through MongoDB GridFS!
