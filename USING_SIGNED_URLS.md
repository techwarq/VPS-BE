# 🔗 Using Signed URLs in Your Application

## ✅ Your Signed URLs Are Working Correctly!

The format is: `http://localhost:4000/api/files/{fileId}?token={jwt}`

Example:
```
http://localhost:4000/api/files/68de37303852dd4ef5b307b5?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📋 How to Use in Frontend

### React/Next.js Example:

```jsx
import { useState } from 'react';

function AvatarGenerator() {
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateAvatar = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:4000/api/photoshoot/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hair_color: "black",
          eye_color: "brown",
          ethnicity: "south asian",
          age: 26,
          gender: "male",
          framing: "half-body",
          style: "studio headshot",
          background: "neutral gray",
          aspect_ratio: "3:4",
          storeInGridFS: true,  // ← Enable GridFS storage
          userId: "user123"      // ← Your user ID
        })
      });

      // Read streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const results = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.images && data.images.length > 0) {
                results.push(data);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      setAvatars(results);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={generateAvatar} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Avatar'}
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {avatars.map((avatar, index) => (
          <div key={index}>
            <h3>{avatar.angle}</h3>
            {/* ✅ Use the signed URL directly in img src */}
            <img 
              src={avatar.images[0].signedUrl} 
              alt={avatar.angle}
              style={{ width: '100%' }}
            />
            <p>File ID: {avatar.images[0].fileId}</p>
            <p>Size: {(avatar.images[0].size / 1024).toFixed(2)} KB</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AvatarGenerator;
```

### Vanilla JavaScript Example:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Avatar Generator</title>
</head>
<body>
    <button id="generateBtn">Generate Avatar</button>
    <div id="avatars"></div>

    <script>
        document.getElementById('generateBtn').addEventListener('click', async () => {
            const response = await fetch('http://localhost:4000/api/photoshoot/avatar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hair_color: "black",
                    eye_color: "brown",
                    ethnicity: "south asian",
                    age: 26,
                    gender: "male",
                    framing: "half-body",
                    style: "studio headshot",
                    background: "neutral gray",
                    aspect_ratio: "3:4",
                    storeInGridFS: true,
                    userId: "user123"
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const avatarsDiv = document.getElementById('avatars');
            avatarsDiv.innerHTML = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const data = JSON.parse(line);
                            if (data.images && data.images.length > 0) {
                                // ✅ Create img element with signed URL
                                const img = document.createElement('img');
                                img.src = data.images[0].signedUrl;
                                img.alt = data.angle;
                                img.style.width = '300px';
                                img.style.margin = '10px';
                                avatarsDiv.appendChild(img);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>
```

### Vue.js Example:

```vue
<template>
  <div>
    <button @click="generateAvatar" :disabled="loading">
      {{ loading ? 'Generating...' : 'Generate Avatar' }}
    </button>

    <div class="avatar-grid">
      <div v-for="(avatar, index) in avatars" :key="index" class="avatar-card">
        <h3>{{ avatar.angle }}</h3>
        <!-- ✅ Use the signed URL directly -->
        <img :src="avatar.images[0].signedUrl" :alt="avatar.angle" />
        <p>Size: {{ (avatar.images[0].size / 1024).toFixed(2) }} KB</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      avatars: [],
      loading: false
    }
  },
  methods: {
    async generateAvatar() {
      this.loading = true;
      this.avatars = [];

      try {
        const response = await fetch('http://localhost:4000/api/photoshoot/avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hair_color: "black",
            eye_color: "brown",
            ethnicity: "south asian",
            age: 26,
            gender: "male",
            framing: "half-body",
            style: "studio headshot",
            background: "neutral gray",
            aspect_ratio: "3:4",
            storeInGridFS: true,
            userId: "user123"
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (data.images && data.images.length > 0) {
                  this.avatars.push(data);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>

<style scoped>
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.avatar-card img {
  width: 100%;
  border-radius: 8px;
}
</style>
```

## 🔐 Important Notes

### Token Expiry
- Default expiry: **24 hours**
- After expiry, you'll need to generate a new signed URL
- Expired tokens return: `{"error":"Invalid or expired token"}`

### CORS Headers
- Already configured in your backend
- Allows requests from any origin
- Works with localhost:3000, localhost:3001, localhost:3002, etc.

### Error Handling

```javascript
// Check if image loads successfully
const img = new Image();
img.onload = () => {
  console.log('Image loaded successfully!');
};
img.onerror = () => {
  console.error('Failed to load image - token may be expired');
};
img.src = signedUrl;
```

### Downloading Images

```javascript
async function downloadImage(signedUrl, filename) {
  const response = await fetch(signedUrl);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
}

// Usage:
downloadImage(avatar.images[0].signedUrl, 'avatar-front.png');
```

## ✅ Summary

Your signed URLs are **already correct** and work perfectly! Just use them directly as:

```javascript
<img src={signedUrl} alt="Avatar" />
```

No changes needed to the backend code - it's already generating the right format! 🎉

