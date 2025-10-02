import { GridFSBucket, ObjectId } from 'mongodb';
import { getDatabase } from './database';

let bucket: GridFSBucket;

export function getGridFSBucket(): GridFSBucket {
  if (!bucket) {
    const db = getDatabase();
    bucket = new GridFSBucket(db, { bucketName: 'images' });
  }
  return bucket;
}

export interface UploadResult {
  fileId: string;
  filename: string;
  size: number;
  contentType?: string;
}

export async function uploadFile(
  stream: NodeJS.ReadableStream,
  filename: string,
  options?: {
    contentType?: string;
    metadata?: any;
  }
): Promise<UploadResult> {
  const gridFSBucket = getGridFSBucket();
  
  return new Promise((resolve, reject) => {
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      contentType: options?.contentType,
      metadata: options?.metadata
    });

    console.log('📤 Upload stream created with ID:', uploadStream.id.toString());

    stream
      .pipe(uploadStream)
      .on('finish', () => {
        const result = {
          fileId: uploadStream.id.toString(),
          filename: filename,
          size: uploadStream.length,
          contentType: options?.contentType
        };
        console.log('✅ Upload finished! File ID:', result.fileId);
        console.log('📋 Upload result:', result);
        resolve(result);
      })
      .on('error', (error) => {
        console.error('❌ Upload error:', error);
        reject(error);
      });
  });
}

export async function downloadFile(fileId: string): Promise<NodeJS.ReadableStream> {
  const gridFSBucket = getGridFSBucket();
  const objectId = new ObjectId(fileId);
  
  return gridFSBucket.openDownloadStream(objectId);
}

export async function getFileInfo(fileId: string): Promise<any> {
  console.log('🔍 getFileInfo: Looking for file ID:', fileId);
  const gridFSBucket = getGridFSBucket();
  const objectId = new ObjectId(fileId);
  console.log('🔍 getFileInfo: ObjectId created:', objectId.toString());
  
  const files = await gridFSBucket.find({ _id: objectId }).toArray();
  console.log('📄 getFileInfo: Files found:', files.length);
  
  if (files.length > 0) {
    console.log('📋 getFileInfo: File details:', {
      _id: files[0]._id,
      filename: files[0].filename,
      length: files[0].length
    });
  }
  
  return files[0] || null;
}

export async function deleteFile(fileId: string): Promise<boolean> {
  try {
    const gridFSBucket = getGridFSBucket();
    const objectId = new ObjectId(fileId);
    
    await gridFSBucket.delete(objectId);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

export async function listFiles(filter: any = {}): Promise<any[]> {
  const gridFSBucket = getGridFSBucket();
  return await gridFSBucket.find(filter).toArray();
}
