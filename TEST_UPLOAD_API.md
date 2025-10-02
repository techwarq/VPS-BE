# 📤 Upload API - Get Signed URLs

## 🚀 API Endpoint

**POST** `http://localhost:4000/api/upload`

Upload any image file and get a signed URL immediately!

---

## 📋 How to Use

### Method 1: Upload from File (CURL)

```bash
# Basic upload
curl -X POST http://localhost:4000/api/upload \
  -F "file=@/path/to/your/image.jpg"

# Upload with userId
curl -X POST http://localhost:4000/api/upload \
  -F "file=@/path/to/your/image.jpg" \
  -F "userId=user123"

# Upload with custom expiry (default: 24h)
curl -X POST http://localhost:4000/api/upload \
  -F "file=@/path/to/your/image.jpg" \
  -F "userId=user123" \
  -F "expiry=48h"

# Upload with metadata
curl -X POST http://localhost:4000/api/upload \
  -F "file=@/path/to/your/image.jpg" \
  -F "userId=user123" \
  -F 'metadata={"category":"profile","tags":["avatar","headshot"]}'
```

### Method 2: Test with Sample Image

```bash
# Download a test image first
curl -o test-image.jpg https://picsum.photos/800/600

# Upload it
curl -X POST http://localhost:4000/api/upload \
  -F "file=@test-image.jpg" \
  -F "userId=testUser"
```

### Method 3: Upload from Desktop

```bash
# Upload an image from your Desktop (macOS)
curl -X POST http://localhost:4000/api/upload \
  -F "file=@$HOME/Desktop/your-image.png" \
  -F "userId=user123"

# Upload an image from your Downloads
curl -X POST http://localhost:4000/api/upload \
  -F "file=@$HOME/Downloads/photo.jpg" \
  -F "userId=user123"
```

---

## 📦 Request Format

### Form Data Fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | **Yes** | The image file to upload |
| `userId` | String | No | User ID (default: "anonymous") |
| `expiry` | String | No | Token expiry time (default: "24h") |
| `metadata` | JSON String | No | Additional metadata |

### Supported File Types:
- JPEG/JPG
- PNG
- GIF
- WebP
- SVG
- BMP

### File Size Limit:
- Maximum: **50MB**

---

## ✅ Response Format

### Success Response (201 Created):

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "file": {
    "fileId": "68de4a8f3852dd4ef5b30800",
    "filename": "my-image.jpg",
    "size": 245678,
    "contentType": "image/jpeg",
    "signedUrl": "http://localhost:4000/api/files/68de4a8f3852dd4ef5b30800?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

### Error Response (400/500):

```json
{
  "success": false,
  "error": "No file provided",
  "message": "Please upload a file using the 'file' field in form-data"
}
```

---

## 🔧 Using in Frontend

### React/Next.js Example:

```jsx
import { useState } from 'react';

function ImageUploader() {
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', 'user123');
    formData.append('expiry', '24h');

    try {
      const response = await fetch('http://localhost:4000/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        setSignedUrl(result.file.signedUrl);
        console.log('File uploaded!', result.file);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
      />
      
      {uploading && <p>Uploading...</p>}
      
      {signedUrl && (
        <div>
          <p>✅ Upload successful!</p>
          <img src={signedUrl} alt="Uploaded" style={{ maxWidth: '400px' }} />
        </div>
      )}
    </div>
  );
}
```

### Vanilla JavaScript Example:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Upload Image</title>
</head>
<body>
    <input type="file" id="fileInput" accept="image/*">
    <button onclick="uploadFile()">Upload</button>
    <div id="result"></div>

    <script>
        async function uploadFile() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Please select a file');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', 'user123');

            try {
                const response = await fetch('http://localhost:4000/api/upload', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    document.getElementById('result').innerHTML = `
                        <p>✅ Upload successful!</p>
                        <img src="${result.file.signedUrl}" style="max-width: 400px;">
                        <p>File ID: ${result.file.fileId}</p>
                        <p>Size: ${(result.file.size / 1024).toFixed(2)} KB</p>
                    `;
                } else {
                    alert('Upload failed: ' + result.message);
                }
            } catch (error) {
                alert('Upload error: ' + error.message);
            }
        }
    </script>
</body>
</html>
```

### Python Example:

```python
import requests

# Upload file
with open('image.jpg', 'rb') as f:
    files = {'file': f}
    data = {
        'userId': 'user123',
        'expiry': '24h'
    }
    
    response = requests.post(
        'http://localhost:4000/api/upload',
        files=files,
        data=data
    )
    
    result = response.json()
    
    if result['success']:
        print(f"✅ Upload successful!")
        print(f"Signed URL: {result['file']['signedUrl']}")
        print(f"File ID: {result['file']['fileId']}")
    else:
        print(f"❌ Upload failed: {result['message']}")
```

---

## 🧪 Quick Test Commands

### Test 1: Upload a Screenshot
```bash
# Take a screenshot on macOS (saves to Desktop)
# Then run:
curl -X POST http://localhost:4000/api/upload \
  -F "file=@$HOME/Desktop/Screen Shot*.png" \
  -F "userId=testUser" \
  | jq '.'
```

### Test 2: Create and Upload a Test Image (requires ImageMagick)
```bash
# Create a test image
convert -size 800x600 xc:blue test.png

# Upload it
curl -X POST http://localhost:4000/api/upload \
  -F "file=@test.png" \
  -F "userId=testUser" \
  | jq '.file.signedUrl' -r
```

### Test 3: Upload and Save Response
```bash
# Upload and save the response to a file
curl -X POST http://localhost:4000/api/upload \
  -F "file=@image.jpg" \
  -F "userId=user123" \
  -o upload-response.json

# View the response
cat upload-response.json | jq '.'
```

---

## 📊 Expiry Time Formats

Valid expiry formats (using ms library):
- `"60s"` - 60 seconds
- `"5m"` - 5 minutes
- `"2h"` - 2 hours
- `"24h"` - 24 hours (default)
- `"7d"` - 7 days
- `"30d"` - 30 days

---

## 🔐 Security Features

✅ **Token-based authentication** - Signed URLs use JWT tokens  
✅ **Time-limited access** - URLs expire after the specified time  
✅ **User tracking** - Track uploads by userId  
✅ **File type validation** - Only images allowed  
✅ **Size limits** - Maximum 50MB per file  
✅ **MongoDB GridFS** - Files stored securely in database

---

## 🎯 Use Cases

1. **Profile Picture Upload** - Users upload avatars
2. **Product Images** - Upload product photos for e-commerce
3. **Document Upload** - Upload images of documents/receipts
4. **Social Media** - Share images with temporary access
5. **Image Processing** - Upload for AI processing (like avatar generation)

---

## ❓ Troubleshooting

### Issue: "No file provided"
**Solution:** Make sure you're using `-F "file=@path"` with the `@` symbol

### Issue: "Only image files are allowed"
**Solution:** Check that your file has a valid image extension (.jpg, .png, etc.)

### Issue: "File size too large"
**Solution:** Compress your image or use a file under 50MB

### Issue: "Cannot read properties of undefined"
**Solution:** Make sure the server is running: `npm run dev`

---

## 📝 Notes

- Files are stored permanently in MongoDB GridFS
- Signed URLs expire, but files remain stored
- You can generate new signed URLs for existing files using `/api/files/:fileId/signed-url`
- To delete a file, use: `DELETE /api/files/:fileId` (requires auth)
- To list all files, use: `GET /api/files`

---

Happy uploading! 🚀

