/**
 * Debug endpoint to test file info retrieval
 */

const express = require('express');
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');

const app = express();
const PORT = 4001;

// MongoDB connection
let db;
let bucket;

async function connectToDatabase() {
  const uri = 'mongodb+srv://sonali00999:UAzJY5OjIT7PbWwe@cluster0.j9pcuav.mongodb.net/myDatabase?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  bucket = new GridFSBucket(db, { bucketName: 'images' });
  console.log('✅ Debug server connected to MongoDB');
}

// Debug endpoint
app.get('/debug/file/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    console.log('🔍 Debug: Looking for file ID:', fileId);
    
    // Check if file exists
    const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
    console.log('📄 Debug: Files found:', files.length);
    
    if (files.length > 0) {
      const file = files[0];
      console.log('📋 Debug: File details:', {
        _id: file._id,
        filename: file.filename,
        length: file.length,
        contentType: file.contentType
      });
      
      res.json({
        success: true,
        file: {
          _id: file._id,
          filename: file.filename,
          length: file.length,
          contentType: file.contentType
        }
      });
    } else {
      console.log('❌ Debug: File not found');
      res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist'
      });
    }
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Start server
async function startServer() {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Debug server running on port ${PORT}`);
    console.log(`🔍 Test with: http://localhost:${PORT}/debug/file/68ddfe6d336a84a3e5b68b54`);
  });
}

startServer().catch(console.error);
