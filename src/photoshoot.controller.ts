import { Request, Response } from 'express';
import GeminiConnector from './gemini.connector';
import RunwayConnector from './runway.connector';
import FluxConnector from './flux.connector';

interface GenerateModelsBody {
  gender: string;
  ethnicity: string;
  age: number;
  skinTone: string;
  eyeColor: string;
  hairStyle: string;
  hairColor: string;
  clothingStyle: string;
  count?: number; // default 4
}

interface GeneratePoseBody {
  prompt: string;
  count: number;
  geminiImage?: { mimeType: string; data: string }; // base64 for gemini
  runwayImageUrl?: string; // URL for runway reference image
  ratio?: string; // runway ratio
  runwayModel?: 'gen4_image' | 'gen4_image_turbo';
}

interface GenerateBackgroundBody {
  locationType: string;
  locationDetail: string;
  cameraAngle: string;
  lightingStyle: string;
  mood: string;
  aspect_ratio?: string | null;
  count?: number; // default 1
}

interface ImageGroupItem {
  prompt: string;
  images: Array<{ mimeType: string; data: string }>; // base64 images
}

interface MultiImageBody {
  groups: ImageGroupItem[]; // [{ images: [], prompt }, ...]
}

function ensureApiKey(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

function buildModelPrompt(b: GenerateModelsBody): string {
  return (
    `A highly realistic portrait of a fashion model, \n` +
    `${b.gender} with ${b.ethnicity} features, \n` +
    `${b.age} years old, \n` +
    `${b.skinTone} skin tone, \n` +
    `${b.eyeColor} eyes, \n` +
    `${b.hairStyle} ${b.hairColor} hair, \n` +
    `wearing ${b.clothingStyle}, \n` +
    `posing in a professional studio setting, \n` +
    `full-body shot, natural lighting, 8k ultra-detailed photography. \n` +
    `Generate ${b.count || 4} distinct image variations.`
  );
}

function parseGeminiParts(candidate: any) {
  const parts = candidate?.content?.parts || [];
  let text = '';
  const images: Array<{ mimeType: string; data: string }> = [];
  for (const part of parts) {
    if (part.text) text += part.text;
    if (part.inlineData) {
      images.push({ mimeType: part.inlineData.mimeType || 'image/png', data: part.inlineData.data || '' });
    }
  }
  return { text, images };
}

export const generateModels = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as GenerateModelsBody & { aspect_ratio?: string; fluxEndpoint?: string };
    const bflKey = ensureApiKey('BFL_API_KEY', process.env.BFL_API_KEY);
    const endpoint = body.fluxEndpoint || process.env.BFL_FLUX_MODELS_ENDPOINT || 'https://api.bfl.ai/v1/flux-1.1-pro-ultra';
    const flux = new FluxConnector(bflKey, endpoint);

    const count = body.count ?? 4;
    const prompt = buildModelPrompt(body);
    const tasks = Array.from({ length: count }).map(async () => {
      return flux.createRequest({
        prompt,
        ...(body.aspect_ratio ? { aspect_ratio: body.aspect_ratio } : {}),
      });
    });

    const results = await Promise.all(tasks);
    res.json({ success: true, model: 'flux-1.1-pro-ultra', results });
  } catch (error) {
    console.error('generateModels error:', error);
    res.status(500).json({ error: 'Failed to generate models', message: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const generatePose = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as GeneratePoseBody;
    if (!body.prompt || !body.count) {
      res.status(400).json({ error: 'prompt and count are required' });
      return;
    }

    const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
    const runwayApiKey = process.env.RUNWAY_API_KEY || '';

    const gCount = Math.floor(body.count / 2);
    const rCount = body.count - gCount;

    const geminiResults: Array<{ text: string; images: Array<{ mimeType: string; data: string }> }> = [];
    const runwayTasks: Array<{ taskId: string }> = [];

    if (gCount > 0) {
      if (!geminiApiKey || !body.geminiImage) {
        res.status(400).json({ error: 'geminiImage and GEMINI_API_KEY required for Gemini portion' });
        return;
      }
      const gemini = new GeminiConnector(geminiApiKey);
      const tasks = Array.from({ length: gCount }).map(async () => {
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: [{ role: 'user', parts: [{ text: body.prompt }, { inlineData: body.geminiImage }] }],
          responseModalities: ['IMAGE', 'TEXT'],
        });
        const cand = response.candidates?.[0];
        return parseGeminiParts(cand);
      });
      geminiResults.push(...await Promise.all(tasks));
    }

    if (rCount > 0) {
      if (!runwayApiKey || !body.runwayImageUrl) {
        res.status(400).json({ error: 'runwayImageUrl and RUNWAY_API_KEY required for Runway portion' });
        return;
      }
      const runway = new RunwayConnector(runwayApiKey);
      const ratio = body.ratio || '1024:1024';
      const model = body.runwayModel || 'gen4_image_turbo';
      const tasks = Array.from({ length: rCount }).map(async () => {
        const result = await runway.generateImage({
          promptText: body.prompt,
          ratio,
          model,
          referenceImages: [{ uri: body.runwayImageUrl! }],
        } as any);
        return { taskId: result.id };
      });
      runwayTasks.push(...await Promise.all(tasks));
    }

    res.json({ success: true, geminiResults, runwayTasks });
  } catch (error) {
    console.error('generatePose error:', error);
    res.status(500).json({ error: 'Failed to generate pose', message: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const generateBackground = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as GenerateBackgroundBody;
    const apiKey = ensureApiKey('BFL_API_KEY', process.env.BFL_API_KEY);
    const flux = new FluxConnector(apiKey);

    const count = body.count ?? 1;
    const prompt = (
      `Fashion photoshoot setting: \n` +
      `${body.locationType} background, \n` +
      `${body.locationDetail}, \n` +
      `photographed from a ${body.cameraAngle} perspective, \n` +
      `with ${body.lightingStyle} lighting, \n` +
      `capturing a ${body.mood} atmosphere, \n` +
      `8k ultra-detailed photography.`
    );

    const tasks = Array.from({ length: count }).map(async () => {
      const result = await flux.createRequest({ prompt, aspect_ratio: body.aspect_ratio });
      return result;
    });

    const results = await Promise.all(tasks);
    res.json({ success: true, results });
  } catch (error) {
    console.error('generateBackground error:', error);
    res.status(500).json({ error: 'Failed to generate background', message: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const generatePhotoshoot = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as MultiImageBody;
    if (!Array.isArray(body.groups) || body.groups.length === 0) {
      res.status(400).json({ error: 'groups array is required' });
      return;
    }
    const apiKey = ensureApiKey('GEMINI_API_KEY or GOOGLE_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(apiKey);

    const results = await Promise.all(body.groups.map(async (group) => {
      const parts: any[] = [{ text: group.prompt }];
      for (const img of group.images) parts.push({ inlineData: img });
      const response = await gemini.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: [{ role: 'user', parts }],
        responseModalities: ['IMAGE', 'TEXT'],
      });
      const cand = response.candidates?.[0];
      return parseGeminiParts(cand);
    }));

    res.json({ success: true, results });
  } catch (error) {
    console.error('generatePhotoshoot error:', error);
    res.status(500).json({ error: 'Failed to generate photoshoot', message: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const generateFinalPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as MultiImageBody;
    if (!Array.isArray(body.groups) || body.groups.length === 0) {
      res.status(400).json({ error: 'groups array is required' });
      return;
    }
    const apiKey = ensureApiKey('GEMINI_API_KEY or GOOGLE_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(apiKey);

    const results = await Promise.all(body.groups.map(async (group) => {
      const parts: any[] = [{ text: group.prompt }];
      for (const img of group.images) parts.push({ inlineData: img });
      const response = await gemini.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: [{ role: 'user', parts }],
        responseModalities: ['IMAGE', 'TEXT'],
      });
      const cand = response.candidates?.[0];
      return parseGeminiParts(cand);
    }));

    res.json({ success: true, results });
  } catch (error) {
    console.error('generateFinalPhoto error:', error);
    res.status(500).json({ error: 'Failed to generate final photo', message: error instanceof Error ? error.message : 'Unknown error' });
  }
};


