/**
 * Test script to check file streaming functionality
 */

const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');

async function testFileStream() {
  const uri = 'mongodb+srv://sonali00999:UAzJY5OjIT7PbWwe@cluster0.j9pcuav.mongodb.net/myDatabase?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const bucket = new GridFSBucket(db, { bucketName: 'images' });
    
    // Test file ID from the error
    const testFileId = '68ddfe6d336a84a3e5b68b54';
    console.log('🔍 Testing file ID:', testFileId);
    
    // Check if file exists
    const files = await bucket.find({ _id: new ObjectId(testFileId) }).toArray();
    console.log('📄 Files found:', files.length);
    
    if (files.length > 0) {
      const file = files[0];
      console.log('📋 File details:', {
        _id: file._id,
        filename: file.filename,
        length: file.length,
        contentType: file.contentType
      });
      
      // Try to create download stream
      try {
        const downloadStream = bucket.openDownloadStream(new ObjectId(testFileId));
        console.log('✅ Download stream created successfully');
        
        // Test if we can read from the stream
        let dataLength = 0;
        downloadStream.on('data', (chunk) => {
          dataLength += chunk.length;
        });
        
        downloadStream.on('end', () => {
          console.log('✅ Stream ended successfully, total data length:', dataLength);
        });
        
        downloadStream.on('error', (error) => {
          console.log('❌ Stream error:', error.message);
        });
        
        // Wait a bit for the stream to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log('❌ Error creating download stream:', error.message);
      }
    } else {
      console.log('❌ File not found in GridFS');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testFileStream();
