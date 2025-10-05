/**
 * Test script for the MongoDB GridFS Signed URL System
 * Run this script to test the file upload and signed URL functionality
 */

const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

const BASE_URL = 'https://vps-be.vercel.app';

// Test configuration
const TEST_CONFIG = {
  // Create a test image file
  testImagePath: './test-image.txt',
  testImageContent: 'This is a test file for GridFS upload',
  userId: 'test-user-123'
};

async function createTestFile() {
  // Create a simple test file
  fs.writeFileSync(TEST_CONFIG.testImagePath, TEST_CONFIG.testImageContent);
  console.log('✅ Test file created');
}

async function cleanupTestFile() {
  if (fs.existsSync(TEST_CONFIG.testImagePath)) {
    fs.unlinkSync(TEST_CONFIG.testImagePath);
    console.log('🧹 Test file cleaned up');
  }
}

async function testFileUpload() {
  console.log('\n📤 Testing file upload...');
  
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(TEST_CONFIG.testImagePath), {
      filename: 'test-file.txt',
      contentType: 'text/plain'
    });
    formData.append('userId', TEST_CONFIG.userId);
    formData.append('metadata', JSON.stringify({
      purpose: 'test',
      uploadedAt: new Date().toISOString()
    }));

    const response = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ File upload successful');
      console.log('📁 File ID:', result.file.id);
      console.log('🔗 Signed URL:', result.file.signedUrl);
      return result.file.id;
    } else {
      console.log('❌ File upload failed:', result);
      return null;
    }
  } catch (error) {
    console.log('❌ Upload error:', error.message);
    return null;
  }
}

async function testSignedUrlGeneration(fileId) {
  console.log('\n🔗 Testing signed URL generation...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/files/${fileId}/signed-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: TEST_CONFIG.userId,
        permissions: ['read', 'download'],
        expiry: '10m',
        metadata: { purpose: 'test-access' }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Signed URL generation successful');
      console.log('🔗 New Signed URL:', result.signedUrl);
      return result.signedUrl;
    } else {
      console.log('❌ Signed URL generation failed:', result);
      return null;
    }
  } catch (error) {
    console.log('❌ Signed URL generation error:', error.message);
    return null;
  }
}

async function testFileAccess(signedUrl) {
  console.log('\n📥 Testing file access with signed URL...');
  
  try {
    const response = await fetch(signedUrl);
    
    if (response.ok) {
      const content = await response.text();
      console.log('✅ File access successful');
      console.log('📄 File content:', content);
      console.log('📊 Content length:', content.length);
      return true;
    } else {
      console.log('❌ File access failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ File access error:', error.message);
    return false;
  }
}

async function testFileInfo(fileId) {
  console.log('\n📋 Testing file info retrieval...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/files/${fileId}/info`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ File info retrieval successful');
      console.log('📁 File info:', JSON.stringify(result.file, null, 2));
      return true;
    } else {
      console.log('❌ File info retrieval failed:', result);
      return false;
    }
  } catch (error) {
    console.log('❌ File info error:', error.message);
    return false;
  }
}

async function testFileList() {
  console.log('\n📋 Testing file list...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/files?limit=10`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ File list retrieval successful');
      console.log('📁 Total files:', result.total);
      console.log('📄 Files:', result.files.length);
      return true;
    } else {
      console.log('❌ File list retrieval failed:', result);
      return false;
    }
  } catch (error) {
    console.log('❌ File list error:', error.message);
    return false;
  }
}

async function testHealthCheck() {
  console.log('\n🏥 Testing health check...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/files/health`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Health check successful');
      console.log('📊 Status:', result.status);
      return true;
    } else {
      console.log('❌ Health check failed:', result);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting MongoDB GridFS Signed URL System Tests');
  console.log('=' .repeat(60));
  
  let fileId = null;
  let signedUrl = null;
  
  try {
    // Create test file
    await createTestFile();
    
    // Test health check
    await testHealthCheck();
    
    // Test file upload
    fileId = await testFileUpload();
    if (!fileId) {
      console.log('❌ Cannot continue tests without successful file upload');
      return;
    }
    
    // Test file info
    await testFileInfo(fileId);
    
    // Test signed URL generation
    signedUrl = await testSignedUrlGeneration(fileId);
    if (!signedUrl) {
      console.log('❌ Cannot test file access without signed URL');
      return;
    }
    
    // Test file access
    await testFileAccess(signedUrl);
    
    // Test file list
    await testFileList();
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 All tests completed successfully!');
    console.log('📁 File ID:', fileId);
    console.log('🔗 Signed URL:', signedUrl);
    
  } catch (error) {
    console.log('\n❌ Test suite error:', error.message);
  } finally {
    // Cleanup
    await cleanupTestFile();
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
    await runTests();
  }
}

// Run the tests
main().catch(console.error);
