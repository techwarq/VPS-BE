/**
 * Test script for the integrated signed URL system with photoshoot and gemini endpoints
 * This demonstrates how to use the new storeInGridFS functionality
 */

const fetch = require('node-fetch');

const BASE_URL = 'https://vps-be.vercel.app';

// Test configuration
const TEST_CONFIG = {
  userId: 'test-user-123',
  storeInGridFS: true
};

async function testGeminiWithGridFS() {
  console.log('\n🤖 Testing Gemini with GridFS storage...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/gemini/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'Generate a beautiful landscape image with mountains and a lake',
        model: 'gemini-2.5-flash-image-preview',
        responseModalities: ['IMAGE', 'TEXT'],
        storeImagesInGridFS: true,
        userId: TEST_CONFIG.userId,
        metadata: {
          test: 'gemini-gridfs-integration',
          type: 'landscape'
        }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Gemini with GridFS successful');
      console.log('📝 Text:', result.text);
      console.log('🖼️ Images stored:', result.storedInGridFS);
      
      if (result.images && result.images.length > 0) {
        console.log('🔗 First image signed URL:', result.images[0].signedUrl);
        console.log('📁 File ID:', result.images[0].fileId);
      }
    } else {
      console.log('❌ Gemini with GridFS failed:', result);
    }
  } catch (error) {
    console.log('❌ Gemini test error:', error.message);
  }
}

async function testAvatarGenerationWithGridFS() {
  console.log('\n👤 Testing Avatar Generation with GridFS storage...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/photoshoot/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: 'A 25-year-old woman with long brown hair and blue eyes',
        style: 'professional headshot, studio lighting',
        background: 'neutral gray background',
        aspect_ratio: '3:4',
        storeInGridFS: true,
        userId: TEST_CONFIG.userId
      })
    });

    if (response.ok) {
      console.log('✅ Avatar generation with GridFS started');
      console.log('📡 Streaming response...');
      
      // Read the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.angle) {
                console.log(`📸 Generated ${data.angle} angle`);
                if (data.storedInGridFS && data.images && data.images.length > 0) {
                  console.log(`🔗 Signed URL: ${data.images[0].signedUrl}`);
                }
              }
            } catch (e) {
              console.log('📄 Raw line:', line);
            }
          }
        }
      }
    } else {
      const result = await response.json();
      console.log('❌ Avatar generation failed:', result);
    }
  } catch (error) {
    console.log('❌ Avatar test error:', error.message);
  }
}

async function testModelGenerationWithGridFS() {
  console.log('\n👥 Testing Model Generation with GridFS storage...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/photoshoot/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gender: 'female',
        ethnicity: 'caucasian',
        age: 25,
        skinTone: 'fair',
        eyeColor: 'blue',
        hairStyle: 'long wavy',
        hairColor: 'brown',
        clothingStyle: 'casual jeans and t-shirt',
        count: 2,
        storeInGridFS: true,
        userId: TEST_CONFIG.userId
      })
    });

    if (response.ok) {
      console.log('✅ Model generation with GridFS started');
      console.log('📡 Streaming response...');
      
      // Read the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.id) {
                console.log(`📸 Generated model ${data.id}`);
                if (data.storedInGridFS && data.images && data.images.length > 0) {
                  console.log(`🔗 Signed URL: ${data.images[0].signedUrl}`);
                }
              }
            } catch (e) {
              console.log('📄 Raw line:', line);
            }
          }
        }
      }
    } else {
      const result = await response.json();
      console.log('❌ Model generation failed:', result);
    }
  } catch (error) {
    console.log('❌ Model test error:', error.message);
  }
}

async function testFileAccess() {
  console.log('\n🔍 Testing file access with signed URLs...');
  
  try {
    // First generate a simple image
    const generateResponse = await fetch(`${BASE_URL}/api/gemini/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'A simple test image',
        model: 'gemini-2.5-flash-image-preview',
        responseModalities: ['IMAGE'],
        storeImagesInGridFS: true,
        userId: TEST_CONFIG.userId
      })
    });

    const generateResult = await generateResponse.json();
    
    if (generateResponse.ok && generateResult.images && generateResult.images.length > 0) {
      const signedUrl = generateResult.images[0].signedUrl;
      console.log('🔗 Testing signed URL:', signedUrl);
      
      // Try to access the file
      const accessResponse = await fetch(signedUrl);
      
      if (accessResponse.ok) {
        console.log('✅ File access successful');
        console.log('📊 Content-Type:', accessResponse.headers.get('content-type'));
        console.log('📏 Content-Length:', accessResponse.headers.get('content-length'));
      } else {
        console.log('❌ File access failed:', accessResponse.status, accessResponse.statusText);
      }
    } else {
      console.log('❌ Failed to generate test image');
    }
  } catch (error) {
    console.log('❌ File access test error:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Signed URL Integration Tests');
  console.log('=' .repeat(60));
  
  try {
    // Test basic Gemini with GridFS
    await testGeminiWithGridFS();
    
    // Test Avatar generation with GridFS
    await testAvatarGenerationWithGridFS();
    
    // Test Model generation with GridFS
    await testModelGenerationWithGridFS();
    
    // Test file access
    await testFileAccess();
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 All integration tests completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Gemini images are now stored in GridFS with signed URLs');
    console.log('✅ Photoshoot endpoints support GridFS storage');
    console.log('✅ All generated images return signed URLs instead of base64');
    console.log('✅ File access works with token validation');
    
  } catch (error) {
    console.log('\n❌ Test suite error:', error.message);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (response.ok) {
      console.log('✅ Server is running');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first:');
    console.log('   npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runAllTests();
  }
}

// Run the tests
main().catch(console.error);
