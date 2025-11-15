import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { downloadFile, getFileInfo } from '../services/gridfs.service';
import { validateToken } from '../services/signed-url.service';
import { convertGeminiImagesToStorage, ImageStorageResult } from '../services/image-storage.helper';
import { connectToDatabase } from '../config/database';

interface GeminiTestRequestBody {
  prompt: string;
  imageUrls?: string[]; // Array of signed URLs or external image URLs
  userId?: string;
  expiry?: string; // Expiry for response image signed URLs
}

// Helper function to extract fileId from signed URL
function extractFileIdFromSignedUrl(signedUrl: string): string | null {
  try {
    // Signed URL format: http://localhost:4000/api/files/{fileId}?token=...
    const url = new URL(signedUrl);
    const pathParts = url.pathname.split('/');
    const fileIdIndex = pathParts.indexOf('files');
    
    if (fileIdIndex !== -1 && pathParts[fileIdIndex + 1]) {
      return pathParts[fileIdIndex + 1];
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing signed URL:', error);
    return null;
  }
}

// Helper function to convert stream to buffer
function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

// Helper function to check if URL is a GridFS signed URL
function isGridFSSignedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.includes('/api/files/');
  } catch {
    return false;
  }
}

// Helper function to fetch external image from URL
async function fetchExternalImage(url: string): Promise<{ data: string; mimeType: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return {
      mimeType: contentType,
      data: base64
    };
  } catch (error) {
    console.error('Error fetching external image from URL:', url, error);
    throw new Error(`Failed to fetch image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to fetch image from GridFS using signed URL or external URL
async function fetchImageFromUrl(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  // Check if it's a GridFS signed URL
  if (isGridFSSignedUrl(imageUrl)) {
    try {
      const fileId = extractFileIdFromSignedUrl(imageUrl);
      
      if (!fileId) {
        throw new Error('Invalid signed URL format');
      }
      
      // Extract token from URL for validation (optional, but good practice)
      const url = new URL(imageUrl);
      const token = url.searchParams.get('token');
      
      if (token) {
        const validation = validateToken(token);
        if (!validation.valid) {
          throw new Error(`Invalid token: ${validation.error}`);
        }
      }
      
      // Get file info to get mimeType
      const fileInfo = await getFileInfo(fileId);
      if (!fileInfo) {
        throw new Error(`File not found: ${fileId}`);
      }
      
      // Download file stream
      const downloadStream = await downloadFile(fileId);
      
      // Convert stream to buffer
      const buffer = await streamToBuffer(downloadStream);
      
      // Convert buffer to base64
      const base64Data = buffer.toString('base64');
      
      return {
        data: base64Data,
        mimeType: fileInfo.contentType || 'image/jpeg'
      };
      
    } catch (error) {
      console.error('Error fetching image from GridFS signed URL:', error);
      throw error;
    }
  } else {
    // It's an external URL, fetch it directly
    return await fetchExternalImage(imageUrl);
  }
}

export const geminiTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      res.status(500).json({ 
        error: 'Gemini API key not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY.' 
      });
      return;
    }

    await connectToDatabase();

    const body: GeminiTestRequestBody = req.body;
    
    if (!body.prompt) {
      res.status(400).json({ 
        error: 'Prompt is required' 
      });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Build the parts array with text and images
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    
    // Add text prompt
    parts.push({ text: body.prompt });
    
    // Fetch images from URLs (signed URLs or external URLs) if provided
    if (body.imageUrls && Array.isArray(body.imageUrls) && body.imageUrls.length > 0) {
      console.log(`🖼️  Fetching ${body.imageUrls.length} image(s) from URLs...`);
      
      for (const imageUrl of body.imageUrls) {
        try {
          const imageData = await fetchImageFromUrl(imageUrl);
          if (imageData) {
            parts.push({
              inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.data
              }
            });
            const urlType = isGridFSSignedUrl(imageUrl) ? 'GridFS' : 'external';
            console.log(`✅ Successfully fetched ${urlType} image: ${imageData.mimeType}`);
          }
        } catch (error) {
          console.error(`❌ Failed to fetch image from URL ${imageUrl}:`, error);
          res.status(400).json({
            error: 'Failed to fetch image from URL',
            message: error instanceof Error ? error.message : 'Unknown error',
            url: imageUrl
          });
          return;
        }
      }
    }

    // Use gemini-2.5-flash-image-preview if images are provided, otherwise gemini-2.5-flash
    const model = 'gemini-2.5-flash-image'

    console.log(`🧪 Testing Gemini with model: ${model}`);
    console.log(`📝 Prompt: ${body.prompt}`);
    console.log(`🖼️  Images: ${body.imageUrls?.length || 0}`);

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts
        }
      ]
    });

    const candidate = response.candidates?.[0];
    const responseParts = candidate?.content?.parts || [];
    
    let text = '';
    const responseImages: Array<{ mimeType: string; data: string }> = [];

    for (const part of responseParts) {
      if (part.text) {
        text += part.text;
      } else if (part.inlineData) {
        responseImages.push({
          mimeType: part.inlineData.mimeType || 'application/octet-stream',
          data: part.inlineData.data || ''
        });
      }
    }

    // Store response images in GridFS and get signed URLs
    let storedImages: ImageStorageResult[] = [];
    if (responseImages.length > 0) {
      try {
        storedImages = await convertGeminiImagesToStorage(responseImages, {
          filenamePrefix: 'gemini-test-response',
          userId: body.userId,
          metadata: {
            model: model,
            prompt: body.prompt,
            generatedAt: new Date().toISOString(),
            source: 'gemini-test-api'
          },
          expiry: body.expiry || '24h'
        });
        console.log(`✅ Stored ${storedImages.length} response image(s) in GridFS`);
      } catch (error) {
        console.error('❌ Error storing response images in GridFS:', error);
        // Continue even if storage fails, return base64 images
      }
    }

    res.json({
      success: true,
      model,
      prompt: body.prompt,
      response: {
        text: text || response.text || '',
        images: storedImages.length > 0 
          ? storedImages.map(img => ({
              fileId: img.fileId,
              filename: img.filename,
              signedUrl: img.signedUrl,
              size: img.size,
              contentType: img.contentType
            }))
          : (responseImages.length > 0 
              ? responseImages.map(img => ({
                  mimeType: img.mimeType,
                  data: img.data // base64 fallback if GridFS storage failed
                }))
              : undefined)
      },
      metadata: {
        finishReason: candidate?.finishReason,
        urlContextMetadata: candidate?.urlContextMetadata,
        imagesStoredInGridFS: storedImages.length > 0
      }
    });

  } catch (error) {
    console.error('❌ Gemini test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Gemini',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
};
