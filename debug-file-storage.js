/**
 * Debug script to check file storage in GridFS
 */

const { MongoClient, ObjectId } = require('mongodb');

async function debugFileStorage() {
  const uri = 'mongodb+srv://sonali00999:UAzJY5OjIT7PbWwe@cluster0.j9pcuav.mongodb.net/myDatabase?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    // Check if GridFS collections exist
    const collections = await db.listCollections().toArray();
    console.log('📁 Available collections:', collections.map(c => c.name));
    
    // Check images.files collection
    const filesCollection = db.collection('images.files');
    const files = await filesCollection.find({}).limit(5).toArray();
    console.log('📄 Files in images.files:', files.length);
    
    if (files.length > 0) {
      console.log('📋 Sample file:', {
        _id: files[0]._id,
        filename: files[0].filename,
        length: files[0].length,
        uploadDate: files[0].uploadDate
      });
      
      // Test if we can find the specific file
      const testFileId = '68ddfe6d336a84a3e5b68b54';
      console.log('🔍 Looking for file ID:', testFileId);
      
      try {
        const objectId = new ObjectId(testFileId);
        const specificFile = await filesCollection.findOne({ _id: objectId });
        console.log('🎯 Found specific file:', specificFile ? 'YES' : 'NO');
        
        if (specificFile) {
          console.log('📄 File details:', {
            _id: specificFile._id,
            filename: specificFile.filename,
            length: specificFile.length,
            contentType: specificFile.contentType
          });
        }
      } catch (error) {
        console.log('❌ Error with ObjectId conversion:', error.message);
      }
    }
    
    // Check images.chunks collection
    const chunksCollection = db.collection('images.chunks');
    const chunks = await chunksCollection.find({}).limit(5).toArray();
    console.log('🧩 Chunks in images.chunks:', chunks.length);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

debugFileStorage();
