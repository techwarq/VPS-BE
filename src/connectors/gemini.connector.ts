import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs';
import { convertGeminiImagesToStorage, ImageStorageResult } from '../services/image-storage.helper';

type GeminiModality = 'TEXT' | 'IMAGE';

interface GeminiGenerateRequestBody {
  prompt?: string;
  parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  imageBase64?: string;
  imageMimeType?: string;
  model?: string;
  responseModalities?: GeminiModality[];
  saveImagesToDisk?: boolean;
  fileNamePrefix?: string;
  storeImagesInGridFS?: boolean;
  userId?: string;
  metadata?: any;
}

function getExtensionFromMimeType(mimeType: string | undefined): string {
  if (!mimeType) return 'bin';
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  return map[mimeType] || 'bin';
}

class GeminiConnector {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateContent(params: {
    model: string;
    contents: any[];
    responseModalities?: GeminiModality[];
  }) {
    const { model, contents, responseModalities } = params;
    return this.client.models.generateContent({
      model,
      contents,
      ...(responseModalities && responseModalities.length > 0
        ? { config: { responseModalities } }
        : {}),
    });
  }

  async generateContentStream(params: {
    model: string;
    contents: any[];
    responseModalities?: GeminiModality[];
  }) {
    const { model, contents, responseModalities } = params;
    return this.client.models.generateContentStream({
      model,
      contents,
      ...(responseModalities && responseModalities.length > 0
        ? { config: { responseModalities } }
        : {}),
    });
  }
}

export const geminiGenerate = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      res.status(500).json({ error: 'Gemini API key not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY.' });
      return;
    }

    const body: GeminiGenerateRequestBody = req.body || {};
    const model = body.model || (body.imageBase64 || body.parts?.some(p => p.inlineData) ? 'gemini-2.5-flash-image-preview' : 'gemini-2.5-flash');
    const responseModalities = body.responseModalities && body.responseModalities.length > 0 ? body.responseModalities : undefined;

    const contents: any[] = [];

    if (body.parts && Array.isArray(body.parts) && body.parts.length > 0) {
      contents.push({ role: 'user', parts: body.parts });
    } else {
      const parts: any[] = [];
      if (body.prompt) {
        parts.push({ text: body.prompt });
      }
      if (body.imageBase64 && body.imageMimeType) {
        parts.push({ inlineData: { mimeType: body.imageMimeType, data: body.imageBase64 } });
      }
      if (parts.length === 0) {
        res.status(400).json({ error: 'Provide either prompt, parts, or imageBase64 + imageMimeType.' });
        return;
      }
      contents.push({ role: 'user', parts });
    }

    const connector = new GeminiConnector(apiKey);
    const response = await connector.generateContent({ model, contents, responseModalities });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let combinedText = '';
    const images: Array<{ mimeType: string; data: string; savedPath?: string }> = [];
    let storedImages: ImageStorageResult[] = [];

    let imageIndex = 0;
    for (const part of parts) {
      if (part.text) {
        combinedText += part.text;
      } else if (part.inlineData) {
        const mimeType: string = part.inlineData.mimeType || 'application/octet-stream';
        const data: string = part.inlineData.data || '';
        const entry: { mimeType: string; data: string; savedPath?: string } = { mimeType, data };
        
        if (body.saveImagesToDisk) {
          const prefix = body.fileNamePrefix || 'gemini_output';
          const ext = getExtensionFromMimeType(mimeType);
          const filePath = `${prefix}_${imageIndex++}.${ext}`;
          const buffer = Buffer.from(data, 'base64');
          fs.writeFileSync(filePath, buffer);
          entry.savedPath = filePath;
        }
        
        images.push(entry);
      }
    }

    if (body.storeImagesInGridFS && images.length > 0) {
      try {
        storedImages = await convertGeminiImagesToStorage(images, {
          filenamePrefix: body.fileNamePrefix || 'gemini-generated',
          userId: body.userId,
          metadata: {
            ...body.metadata,
            model: model,
            prompt: body.prompt,
            generatedAt: new Date().toISOString()
          },
          expiry: '24h'
        });
      } catch (error) {
        console.error('Error storing images in GridFS:', error);
      }
    }

    res.json({
      success: true,
      model,
      text: combinedText || response.text || '',
      images: body.storeImagesInGridFS ? storedImages : images,
      storedInGridFS: body.storeImagesInGridFS || false,
      urlContextMetadata: candidate?.urlContextMetadata,
    });
  } catch (error) {
    console.error('Gemini generate error:', error);
    res.status(500).json({
      error: 'Failed to generate content with Gemini',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const geminiGenerateStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      res.status(500).json({ error: 'Gemini API key not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY.' });
      return;
    }

    const body: GeminiGenerateRequestBody = req.body || {};
    const model = body.model || (body.imageBase64 || body.parts?.some(p => p.inlineData) ? 'gemini-2.5-flash-image-preview' : 'gemini-2.5-flash');
    const responseModalities = body.responseModalities && body.responseModalities.length > 0 ? body.responseModalities : undefined;

    const contents: any[] = [];
    if (body.parts && Array.isArray(body.parts) && body.parts.length > 0) {
      contents.push({ role: 'user', parts: body.parts });
    } else {
      const parts: any[] = [];
      if (body.prompt) parts.push({ text: body.prompt });
      if (body.imageBase64 && body.imageMimeType) {
        parts.push({ inlineData: { mimeType: body.imageMimeType, data: body.imageBase64 } });
      }
      if (parts.length === 0) {
        res.status(400).json({ error: 'Provide either prompt, parts, or imageBase64 + imageMimeType.' });
        return;
      }
      contents.push({ role: 'user', parts });
    }

    const connector = new GeminiConnector(apiKey);
    const stream = await connector.generateContentStream({ model, contents, responseModalities });

    let combinedText = '';
    const images: Array<{ mimeType: string; data: string; savedPath?: string }> = [];
    let storedImages: ImageStorageResult[] = [];
    let imageIndex = 0;

    for await (const chunk of stream as any) {
      if (chunk?.candidates?.[0]?.content?.parts?.length) {
        for (const part of chunk.candidates[0].content.parts) {
          if (part.text) {
            combinedText += part.text;
          } else if (part.inlineData) {
            const mimeType: string = part.inlineData.mimeType || 'application/octet-stream';
            const data: string = part.inlineData.data || '';
            const entry: { mimeType: string; data: string; savedPath?: string } = { mimeType, data };
            if (body.saveImagesToDisk) {
              const prefix = body.fileNamePrefix || 'gemini_stream_output';
              const ext = getExtensionFromMimeType(mimeType);
              const filePath = `${prefix}_${imageIndex++}.${ext}`;
              const buffer = Buffer.from(data, 'base64');
              fs.writeFileSync(filePath, buffer);
              entry.savedPath = filePath;
            }
            images.push(entry);
          }
        }
      } else if (typeof (chunk as any).text === 'string') {
        combinedText += (chunk as any).text;
      }
    }

    if (body.storeImagesInGridFS && images.length > 0) {
      try {
        storedImages = await convertGeminiImagesToStorage(images, {
          filenamePrefix: body.fileNamePrefix || 'gemini-stream-generated',
          userId: body.userId,
          metadata: {
            ...body.metadata,
            model: model,
            prompt: body.prompt,
            generatedAt: new Date().toISOString(),
            streamed: true
          },
          expiry: '24h'
        });
      } catch (error) {
        console.error('Error storing streamed images in GridFS:', error);
      }
    }

    res.json({
      success: true,
      model,
      text: combinedText,
      images: body.storeImagesInGridFS ? storedImages : images,
      storedInGridFS: body.storeImagesInGridFS || false,
    });
  } catch (error) {
    console.error('Gemini generate stream error:', error);
    res.status(500).json({
      error: 'Failed to stream content with Gemini',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export default GeminiConnector;


