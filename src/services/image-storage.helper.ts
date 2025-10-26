import { Readable } from 'stream';
import { uploadFile } from './gridfs.service';
import { generateSignedUrl } from './signed-url.service';

export interface ImageStorageResult {
  fileId: string;
  filename: string;
  size: number;
  contentType: string;
  signedUrl: string;
}

export async function storeBase64Image(
  base64Data: string,
  mimeType: string,
  options?: {
    filename?: string;
    userId?: string;
    metadata?: any;
    expiry?: string;
  }
): Promise<ImageStorageResult> {
  try {
    const base64String = base64Data.replace(/^data:[^;]+;base64,/, '');
    
    const buffer = Buffer.from(base64String, 'base64');
    
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    
    const extension = getExtensionFromMimeType(mimeType);
    const timestamp = Date.now();
    const filename = options?.filename || `generated-image-${timestamp}.${extension}`;
    
    console.log('📤 About to upload file:', filename);
    
    const uploadResult = await uploadFile(stream, filename, {
      contentType: mimeType,
      metadata: {
        ...options?.metadata,
        uploadedBy: options?.userId,
        uploadedAt: new Date().toISOString(),
        source: 'generated'
      }
    });
    
    console.log('✅ Upload successful! File ID:', uploadResult.fileId);
    console.log('📋 Full upload result:', uploadResult);
    
    const signedUrl = generateSignedUrl(uploadResult.fileId, {
      userId: options?.userId,
      expiry: options?.expiry || '24h', 
      metadata: {
        ...uploadResult,
        generated: true
      }
    });
    
    console.log('🔗 Generated signed URL:', signedUrl);
    
    return {
      fileId: uploadResult.fileId,
      filename: uploadResult.filename,
      size: uploadResult.size,
      contentType: uploadResult.contentType || mimeType,
      signedUrl: signedUrl
    };
    
  } catch (error) {
    console.error('Error storing base64 image:', error);
    throw new Error(`Failed to store image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function storeMultipleBase64Images(
  images: Array<{ mimeType: string; data: string }>,
  options?: {
    filenamePrefix?: string;
    userId?: string;
    metadata?: any;
    expiry?: string;
  }
): Promise<ImageStorageResult[]> {
  const results: ImageStorageResult[] = [];
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const filename = options?.filenamePrefix 
      ? `${options.filenamePrefix}-${i + 1}`
      : undefined;
    
    try {
      const result = await storeBase64Image(image.data, image.mimeType, {
        filename,
        userId: options?.userId,
        metadata: options?.metadata,
        expiry: options?.expiry
      });
      
      results.push(result);
    } catch (error) {
      console.error(`Error storing image ${i + 1}:`, error);
    }
  }
  
  return results;
}

function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg'
  };
  return map[mimeType] || 'jpg';
}

export function convertGeminiImagesToStorage(
  geminiImages: Array<{ mimeType: string; data: string }>,
  options?: {
    filenamePrefix?: string;
    userId?: string;
    metadata?: any;
    expiry?: string;
  }
): Promise<ImageStorageResult[]> {
  return storeMultipleBase64Images(geminiImages, options);
}
