import { Request, Response } from 'express';
import GeminiConnector from './gemini.connector';
import { convertGeminiImagesToStorage, ImageStorageResult } from './image-storage.helper';

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
  aspect_ratio?: string;
  userId?: string;
  storeInGridFS?: boolean;
}

interface GeneratePoseBody {
  prompt: string;
  count: number;
  geminiImage?: { mimeType: string; data: string }; // base64 for gemini
  aspect_ratio?: string;
  userId?: string;
  storeInGridFS?: boolean;
}

interface GenerateBackgroundBody {
  locationType: string;
  locationDetail: string;
  cameraAngle: string;
  lightingStyle: string;
  mood: string;
  aspect_ratio?: string;
  count?: number; // default 1
  userId?: string;
  storeInGridFS?: boolean;
}

interface ImageGroupItem {
  prompt: string;
  images: Array<{ mimeType: string; data: string }>; // base64 images
}

interface MultiImageBody {
  groups: ImageGroupItem[]; // [{ images: [], prompt }, ...]
  userId?: string;
  storeInGridFS?: boolean;
}

// New interfaces for avatar generation
interface AvatarGenerateBody {
  subject?: string;
  hair_color?: string;
  eye_color?: string;
  hairstyle?: string;
  ethnicity?: string;
  age?: number;
  gender?: string;
  clothing?: string;
  framing?: string;
  body_scope?: string;
  bodyScope?: string;
  style?: string;
  background?: string;
  aspect_ratio?: string;
  negative_prompt?: string;
  userId?: string;
  storeInGridFS?: boolean;
}

interface TryOnItem {
  avatar_image: string | { mimeType: string; data: string }; // URL string or base64 object
  garment_images: Array<string | { mimeType: string; data: string }>; // URL strings or base64 objects
  reference_model_images?: Array<string | { mimeType: string; data: string }>; // optional reference images
}

interface TryOnRequestBody {
  items: TryOnItem[];
  aspect_ratio?: string;
  style?: string;
  negative_prompt?: string;
  storeInGridFS?: boolean;
  userId?: string;
}

interface PoseRequestBody {
  items: Array<{
    image: string;           // Main subject image URL
    pose_reference?: string; // Pose reference image URL
    background_prompt?: string;
    pose_prompt?: string;
  }>;
  aspect_ratio?: string;        // Optional, defaults to "3:4"
  negative_prompt?: string;     // Optional
}

// New interfaces for improved functionality
type AvatarAngle = {
    name: string;
    prompt: string;
};

type AvatarPromptPlan = {
    subject: string;
    global_style?: string;
    negative_prompt?: string;
    aspect_ratio?: string;
    guidance?: number;
    steps?: number;
    angles: AvatarAngle[];
};

export interface TryOnResultItem {
    avatar_url: string;
    garment_url: string;
    aspect_ratio: string;
    prompt: string;
    image_url: string;
}

export interface TryOnResponseBody {
    success: boolean;
    aspect_ratio: string;
    results: TryOnResultItem[];
}

export interface PoseResponseItem {
    input_image: string;
    aspect_ratio: string;
    mode: 'pose_reference' | 'pose_prompt' | 'pose_both';
    image_url: string;
    background_prompt?: string;
}

export interface PoseResponseBody {
    success: boolean;
    aspect_ratio: string;
    results: PoseResponseItem[];
}

// AddAccessories types
export interface AddAccessoriesItem {
    image: string;
    accessories: { url: string }[];
}

export interface AddAccessoriesRequestBody {
    items: AddAccessoriesItem[];
    prompt?: string;
    aspect_ratio?: string;
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
    `full-body shot, natural lighting, 8k ultra-detailed photography.`
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

// Helper function to fetch image from URL and convert to base64
async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Determine MIME type from response headers or URL
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return {
      mimeType: contentType,
      data: base64
    };
  } catch (error) {
    console.error('Error fetching image from URL:', url, error);
    throw new Error(`Failed to fetch image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to convert image input to base64 format
async function convertImageInputToBase64(input: string | { mimeType: string; data: string } | { signedUrl: string }): Promise<{ mimeType: string; data: string }> {
  if (typeof input === 'string') {
    // It's a URL, fetch it
    return await fetchImageAsBase64(input);
  } else if ('signedUrl' in input) {
    // It's a signed URL object, fetch it
    return await fetchImageAsBase64(input.signedUrl);
  } else {
    // It's already in base64 format
    return input;
  }
}

export const generateModels = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as GenerateModelsBody;
    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);

    const count = body.count ?? 4;
    const prompt = buildModelPrompt(body);

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Generate images one by one and stream results
    for (let i = 0; i < count; i++) {
      try {
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          responseModalities: ['IMAGE', 'TEXT'],
        });

        const parsed = parseGeminiParts(response.candidates?.[0]);
        
        let result: any = {
          id: `model-${i}`,
          status: 'completed' as const,
          images: parsed.images,
          text: parsed.text,
          createdAt: new Date(),
        };

        // Store images in GridFS if requested
        if (body.storeInGridFS && parsed.images && parsed.images.length > 0) {
          try {
            const storedImages = await convertGeminiImagesToStorage(parsed.images, {
              filenamePrefix: `model-${i}`,
              userId: body.userId,
              metadata: {
                type: 'model-generation',
                gender: body.gender,
                ethnicity: body.ethnicity,
                age: body.age,
                skinTone: body.skinTone,
                eyeColor: body.eyeColor,
                hairStyle: body.hairStyle,
                hairColor: body.hairColor,
                clothingStyle: body.clothingStyle,
                aspect_ratio: body.aspect_ratio,
                generatedAt: new Date().toISOString()
              },
              expiry: '24h'
            });
            
            result.images = storedImages;
            result.storedInGridFS = true;
          } catch (error) {
            console.error('Error storing model images in GridFS:', error);
            // Keep original images if storage fails
          }
        }

        // Stream individual result
        res.write(JSON.stringify(result) + '\n');
      } catch (error) {
        const errorResult = {
          id: `model-${i}`,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
          createdAt: new Date(),
        };
        res.write(JSON.stringify(errorResult) + '\n');
      }
    }

    // End the stream
    res.end();
  } catch (error) {
    console.error('generateModels error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate models', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      const errorPayload = { error: `Failed to generate models: ${(error as Error).message}` };
      res.write(JSON.stringify(errorPayload) + '\n');
      res.end();
    }
  }
};

export const generatePose = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as GeneratePoseBody;
    if (!body.prompt || !body.count) {
      res.status(400).json({ error: 'prompt and count are required' });
      return;
    }

    if (!body.geminiImage) {
      res.status(400).json({ error: 'geminiImage is required for pose generation' });
      return;
    }

    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < body.count; i++) {
      try {
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: [{ 
            role: 'user', 
            parts: [
              { text: body.prompt },
              { inlineData: body.geminiImage }
            ] 
          }],
          responseModalities: ['IMAGE', 'TEXT'],
        });

        const parsed = parseGeminiParts(response.candidates?.[0]);
        
        let result: any = {
          id: `pose-${i}`,
          status: 'completed' as const,
          images: parsed.images,
          text: parsed.text,
          createdAt: new Date(),
        };

        // Store images in GridFS if requested
        if (body.storeInGridFS && parsed.images && parsed.images.length > 0) {
          try {
            const storedImages = await convertGeminiImagesToStorage(parsed.images, {
              filenamePrefix: `pose-${i}`,
              userId: body.userId,
              metadata: {
                type: 'pose-generation',
                prompt: body.prompt,
                aspect_ratio: body.aspect_ratio,
                generatedAt: new Date().toISOString()
              },
              expiry: '24h'
            });
            
            result.images = storedImages;
            result.storedInGridFS = true;
          } catch (error) {
            console.error('Error storing pose images in GridFS:', error);
            // Keep original images if storage fails
          }
        }

        res.write(JSON.stringify(result) + '\n');
      } catch (error) {
        const errorResult = {
          id: `pose-${i}`,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
          createdAt: new Date(),
        };
        res.write(JSON.stringify(errorResult) + '\n');
      }
    }

    res.end();
  } catch (error) {
    console.error('generatePose error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate pose', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      const errorPayload = { error: `Failed to generate pose: ${(error as Error).message}` };
      res.write(JSON.stringify(errorPayload) + '\n');
      res.end();
    }
  }
};

export const generateBackground = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as GenerateBackgroundBody;
    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);

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

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < count; i++) {
      try {
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          responseModalities: ['IMAGE', 'TEXT'],
        });

        const parsed = parseGeminiParts(response.candidates?.[0]);
        
        let result: any = {
          id: `background-${i}`,
          status: 'completed' as const,
          images: parsed.images,
          text: parsed.text,
          createdAt: new Date(),
        };

        // Store images in GridFS if requested
        if (body.storeInGridFS && parsed.images && parsed.images.length > 0) {
          try {
            const storedImages = await convertGeminiImagesToStorage(parsed.images, {
              filenamePrefix: `background-${i}`,
              userId: body.userId,
              metadata: {
                type: 'background-generation',
                locationType: body.locationType,
                locationDetail: body.locationDetail,
                cameraAngle: body.cameraAngle,
                lightingStyle: body.lightingStyle,
                mood: body.mood,
                aspect_ratio: body.aspect_ratio,
                generatedAt: new Date().toISOString()
              },
              expiry: '24h'
            });
            
            result.images = storedImages;
            result.storedInGridFS = true;
          } catch (error) {
            console.error('Error storing background images in GridFS:', error);
            // Keep original images if storage fails
          }
        }

        res.write(JSON.stringify(result) + '\n');
      } catch (error) {
        const errorResult = {
          id: `background-${i}`,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
          createdAt: new Date(),
        };
        res.write(JSON.stringify(errorResult) + '\n');
      }
    }

    res.end();
  } catch (error) {
    console.error('generateBackground error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate background', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      const errorPayload = { error: `Failed to generate background: ${(error as Error).message}` };
      res.write(JSON.stringify(errorPayload) + '\n');
      res.end();
    }
  }
};

export const generatePhotoshoot = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as MultiImageBody;
    if (!Array.isArray(body.groups) || body.groups.length === 0) {
      res.status(400).json({ error: 'groups array is required' });
      return;
    }
    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < body.groups.length; i++) {
      const group = body.groups[i];
      try {
        const parts: any[] = [{ text: group.prompt }];
        for (const img of group.images) parts.push({ inlineData: img });
        
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: [{ role: 'user', parts }],
          responseModalities: ['IMAGE', 'TEXT'],
        });
        
        const parsed = parseGeminiParts(response.candidates?.[0]);
        const result = {
          groupIndex: i,
          status: 'completed' as const,
          ...parsed,
          createdAt: new Date(),
        };

        res.write(JSON.stringify(result) + '\n');
      } catch (error) {
        const errorResult = {
          groupIndex: i,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
          createdAt: new Date(),
        };
        res.write(JSON.stringify(errorResult) + '\n');
      }
    }

    res.end();
  } catch (error) {
    console.error('generatePhotoshoot error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate photoshoot', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      const errorPayload = { error: `Failed to generate photoshoot: ${(error as Error).message}` };
      res.write(JSON.stringify(errorPayload) + '\n');
      res.end();
    }
  }
};

export const generateFinalPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as MultiImageBody;
    if (!Array.isArray(body.groups) || body.groups.length === 0) {
      res.status(400).json({ error: 'groups array is required' });
      return;
    }
    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < body.groups.length; i++) {
      const group = body.groups[i];
      try {
        const parts: any[] = [{ text: group.prompt }];
        for (const img of group.images) parts.push({ inlineData: img });
        
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: [{ role: 'user', parts }],
          responseModalities: ['IMAGE', 'TEXT'],
        });
        
        const parsed = parseGeminiParts(response.candidates?.[0]);
        const result = {
          groupIndex: i,
          status: 'completed' as const,
          ...parsed,
          createdAt: new Date(),
        };

        res.write(JSON.stringify(result) + '\n');
      } catch (error) {
        const errorResult = {
          groupIndex: i,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
          createdAt: new Date(),
        };
        res.write(JSON.stringify(errorResult) + '\n');
      }
    }

    res.end();
  } catch (error) {
    console.error('generateFinalPhoto error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate final photo', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      const errorPayload = { error: `Failed to generate final photo: ${(error as Error).message}` };
      res.write(JSON.stringify(errorPayload) + '\n');
      res.end();
    }
  }
};

// New avatar generation endpoint with streaming
export const generateAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as AvatarGenerateBody;
    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GEMINI_API_KEY);
    
    // Build subject description
    const framingNorm = String(
      (body.framing || body.body_scope || body.bodyScope || "headshot")
    ).toLowerCase().replace(/_/g, "-");
    
    const framing: "headshot" | "half-body" | "full-body" =
      framingNorm === "full-body" ? "full-body" :
      framingNorm === "half-body" ? "half-body" : "headshot";

    let descriptionParts: string[] = [];
    if (body.age) descriptionParts.push(`${Number(body.age)}-year-old`);
    if (body.gender) descriptionParts.push(String(body.gender).toLowerCase());
    if (body.ethnicity) descriptionParts.push(String(body.ethnicity).toLowerCase());
    let baseDescription = descriptionParts.join(" ") || "A person";

    const featureParts: string[] = [];
    if (body.hairstyle) featureParts.push(String(body.hairstyle).toLowerCase());
    if (body.hair_color) featureParts.push(`${String(body.hair_color).toLowerCase()} hair`);
    if (body.eye_color) featureParts.push(`${String(body.eye_color).toLowerCase()} eyes`);
    
    let features = "";
    if (featureParts.length > 0) {
      features = ` with ${featureParts.join(", ")}`;
    }

    let clothingDesc = "";
    if (body.clothing) {
      clothingDesc = ` wearing ${String(body.clothing).toLowerCase()}`;
    }

    const subject = body.subject || `${baseDescription}${features}${clothingDesc}.`;

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const gemini = new GeminiConnector(geminiApiKey);
    const baseStyle = body.style || "studio photo, soft diffused lighting, realistic skin texture";
    const consistentStyle = (framing === 'headshot') ? baseStyle : baseStyle.replace(/headshot/ig, 'photo').trim();
    const styleText = `Style: ${consistentStyle}. The shot framing is ${framing}.`;

    const defaultAR = framing === "full-body" ? "9:16" : framing === "half-body" ? "3:4" : "3:4";
    const finalAspectForPlanner = body.aspect_ratio || defaultAR;
    const aspectText = `Preferred aspect_ratio: ${finalAspectForPlanner}.`;
    const bgText = body.background ? `Background: ${body.background}.` : "";

    const geminiSystemPrompt = [
      "You are an expert photography director creating a 5-shot avatar photoshoot plan. Your output MUST be a single, clean JSON object and nothing else.",
      "The final images must look like **real photographs of the same human**, not 3D renders or illustrations.",
      "The first prompt you generate is for the Imagen 4 model. The subsequent four are for Gemini 2.5 Flash, which will use the first generated image as an identity reference.",
      
      "**JSON Schema:**",
      "{",
      "  \"subject\": string,",
      "  \"global_style\": string,",
      "  \"negative_prompt\": string,",
      "  \"aspect_ratio\": string,",
      "  \"angles\": [",
      "    { \"name\": \"front\", \"prompt\": string },",
      "    { \"name\": \"left-3/4\", \"prompt\": string },",
      "    { \"name\": \"right-3/4\", \"prompt\": string },",
      "    { \"name\": \"profile-left\", \"prompt\": string },",
      "    { \"name\": \"profile-right\", \"prompt\": string }",
      "  ]",
      "}",

      "**CRITICAL Prompt Generation Rules:**",
      "1. **Strict Angle Adherence (Most Important Rule):** For each angle in the `angles` array, the prompt you generate MUST describe the person from that EXACT angle. A '3/4 view' means the subject is turned halfway between front-facing and a full profile. It is a failure if the angle in the final image does not match the requested angle name.",
      "2. **DO NOT Copy the Reference Pose:** The subsequent prompts are for generating new images based on a reference photo of the person's face. Your generated prompts must NOT describe the pose from that reference photo. You are to create prompts for NEW, distinct poses at the specified angles.",
      "3. **Identity Preservation Phrase:** For prompts 2 through 5 ('left-3/4', 'right-3/4', etc.), you MUST include this exact critical phrase: 'It is critical to preserve the exact same person, including their facial features, hairstyle, and clothing, from the reference image.'",
      "4. **Photorealism & Detail:** EVERY prompt must describe a photorealistic scene. Include professional camera and lighting details (e.g., 'shot on a 105mm f/1.4 lens', 'lit with a large octabox', 'realistic skin texture with fine details').",
      "5. **Vary Expressions:** For each of the 5 angles, describe a slightly different, natural, professional expression (e.g., 'a slight, confident smile', 'a thoughtful, neutral expression', 'a friendly, open look').",
    ].join("\n");

    const geminiUserPrompt = [
      `Subject: ${subject}.`,
      styleText,
      bgText,
      aspectText,
      body.negative_prompt ? `Negative prompt hints: ${body.negative_prompt}.` : "",
      "Produce the JSON plan now.",
    ].filter(Boolean).join("\n");

    // Generate the plan
    const planResponse = await gemini.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: `${geminiSystemPrompt}\n\n${geminiUserPrompt}` }] }],
      responseModalities: ['TEXT'],
    });

    const jsonText = (planResponse.candidates?.[0]?.content?.parts?.[0]?.text || "")
      .replace(/^```(json)?/i, "").replace(/```$/i, "").trim();

    let plan: any;
    try {
      plan = JSON.parse(jsonText);
    } catch (e) {
      res.status(400).json({ error: "Failed to parse prompt plan JSON from Gemini" });
      return;
    }

    if (!plan.angles || !Array.isArray(plan.angles) || plan.angles.length !== 5) {
      res.status(400).json({ error: "Gemini did not return exactly 5 angles" });
      return;
    }

    // Generate first image (front angle)
    const firstPrompt = plan.angles[0].prompt;
    const firstResponse = await gemini.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: [{ role: 'user', parts: [{ text: firstPrompt }] }],
      responseModalities: ['IMAGE', 'TEXT'],
    });

    const firstParsed = parseGeminiParts(firstResponse.candidates?.[0]);
    if (!firstParsed.images || firstParsed.images.length === 0) {
      res.status(502).json({ error: "Gemini did not return first image" });
      return;
    }

    let firstResult: any = {
      angle: plan.angles[0].name,
      prompt: firstPrompt,
      images: firstParsed.images,
      text: firstParsed.text,
    };

    // Store first image in GridFS if requested
    if (body.storeInGridFS && firstParsed.images && firstParsed.images.length > 0) {
      try {
        const storedImages = await convertGeminiImagesToStorage(firstParsed.images, {
          filenamePrefix: `avatar-${plan.angles[0].name}`,
          userId: body.userId,
          metadata: {
            type: 'avatar-generation',
            angle: plan.angles[0].name,
            subject: body.subject,
            style: body.style,
            background: body.background,
            aspect_ratio: body.aspect_ratio,
            generatedAt: new Date().toISOString()
          },
          expiry: '24h'
        });
        
        firstResult.images = storedImages;
        firstResult.storedInGridFS = true;
      } catch (error) {
        console.error('Error storing first avatar image in GridFS:', error);
        // Keep original images if storage fails
      }
    }

    // Stream the first result
    res.write(JSON.stringify(firstResult) + '\n');

    // Use first image as reference for subsequent generations
    const firstReferenceImage = firstParsed.images[0];

    // Generate remaining angles
    for (let i = 1; i < plan.angles.length; i++) {
      const angle = plan.angles[i];
      
      try {
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: [{ 
            role: 'user', 
            parts: [
              { text: angle.prompt },
              { inlineData: firstReferenceImage }
            ] 
          }],
          responseModalities: ['IMAGE', 'TEXT'],
        });

        const parsed = parseGeminiParts(response.candidates?.[0]);
        
        let result: any = {
          angle: angle.name,
          prompt: angle.prompt,
          images: parsed.images,
          text: parsed.text,
        };

        // Store remaining images in GridFS if requested
        if (body.storeInGridFS && parsed.images && parsed.images.length > 0) {
          try {
            const storedImages = await convertGeminiImagesToStorage(parsed.images, {
              filenamePrefix: `avatar-${angle.name}`,
              userId: body.userId,
              metadata: {
                type: 'avatar-generation',
                angle: angle.name,
                subject: body.subject,
                style: body.style,
                background: body.background,
                aspect_ratio: body.aspect_ratio,
                generatedAt: new Date().toISOString()
              },
              expiry: '24h'
            });
            
            result.images = storedImages;
            result.storedInGridFS = true;
          } catch (error) {
            console.error('Error storing avatar image in GridFS:', error);
            // Keep original images if storage fails
          }
        }

        // Stream each result as it's generated
        res.write(JSON.stringify(result) + '\n');
      } catch (error) {
        const errorResult = {
          angle: angle.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        res.write(JSON.stringify(errorResult) + '\n');
      }
    }

    // End the stream
    res.end();

  } catch (error) {
    console.error('generateAvatar error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate avatar', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      const errorPayload = { error: `Failed to generate avatar: ${(error as Error).message}` };
      res.write(JSON.stringify(errorPayload) + '\n');
      res.end();
    }
  }
};

// Try-on endpoint with streaming
export const tryOn = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as TryOnRequestBody;
    
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: "'items' must be a non-empty array" });
      return;
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);
    const aspect = body.aspect_ratio || "3:4";
    const styleLine = body.style ? `The overall style should be: ${body.style}.` : "The style should be photorealistic.";
    const negLine = body.negative_prompt ? `Avoid the following: ${body.negative_prompt}.` : "";

    for (let idx = 0; idx < body.items.length; idx++) {
      const item = body.items[idx];
      const initialAvatarInput = item.avatar_image;
      const garmentInputs = Array.isArray(item.garment_images) ? item.garment_images : [];
      
      if (!initialAvatarInput || garmentInputs.length === 0) {
        const err = {
          item_index: idx,
          error: !initialAvatarInput ? 'Missing avatar_image' : 'No garment_images provided'
        };
        res.write(JSON.stringify(err) + '\n');
        continue;
      }

      // Convert avatar image to base64 format
      let currentAvatar: { mimeType: string; data: string };
      try {
        currentAvatar = await convertImageInputToBase64(initialAvatarInput);
      } catch (error) {
        const err = {
          item_index: idx,
          error: `Failed to process avatar image: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
        res.write(JSON.stringify(err) + '\n');
        continue;
      }

      for (let g = 0; g < garmentInputs.length; g++) {
        const garmentInput = garmentInputs[g];
        
        // Convert garment image to base64 format
        let garment: { mimeType: string; data: string };
        try {
          garment = await convertImageInputToBase64(garmentInput);
        } catch (error) {
          const err = {
            item_index: idx,
            step: g + 1,
            error: `Failed to process garment image: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
          res.write(JSON.stringify(err) + '\n');
          continue;
        }
        
        const isFirstGarment = (g === 0);
        let prompt = '';
        
        if (isFirstGarment) {
          // --- NEW, IMPROVED PROMPT FOR FIRST GARMENT ---
          prompt = [
            "You are an expert virtual stylist creating a professional e-commerce fashion photo.",
            "The first input image is the model. The second input image is a piece of clothing.",
            "Generate a photorealistic, full-body shot of the model from the first image wearing the garment from the second image.",
            "**Identity Preservation is Paramount:** The model's face, hair, skin tone, and physical features must remain completely unchanged. It must be the exact same person.",
            "**Garment Integration:** The new clothing should realistically replace whatever the model was originally wearing. Ensure a natural fit, drape, and texture, with accurate lighting and shadows that match a professional studio environment.",
            "The background must be a seamless, neutral light gray studio backdrop.",
            styleLine,
            negLine
          ].filter(Boolean).join(" ");
        } else {
          // --- NEW, IMPROVED PROMPT FOR SEQUENTIAL LAYERING ---
          prompt = [
            "You are an expert virtual stylist continuing a layering task.",
            "The first input image shows a model already wearing one or more items. The second input image is a new garment to add.",
            "Your task is to layer the new garment from the second image ON TOP of the clothing the model is already wearing in the first image.",
            "**CRITICAL RULE: DO NOT CHANGE ANYTHING FROM THE FIRST IMAGE.** The model's identity (face, hair), pose, and all existing clothing must be perfectly preserved. You are only adding the new item.",
            "Render the new garment with a realistic fit and drape over the existing clothes. For example, if adding a jacket, it should go over the shirt shown in the first image.",
            "The final image must show the model wearing all previous items PLUS the new one.",
            "Maintain the seamless, neutral light gray studio background and professional lighting.",
            styleLine,
            negLine
          ].filter(Boolean).join(" ");
        }

        const input_parts = [
          { inlineData: currentAvatar },
          { inlineData: garment },
          { text: prompt }
        ];

        // Add reference model images if provided
        if (item.reference_model_images) {
          for (const refImgInput of item.reference_model_images) {
            try {
              const refImg = await convertImageInputToBase64(refImgInput);
              input_parts.push({ inlineData: refImg });
            } catch (error) {
              console.warn(`Failed to process reference model image: ${error instanceof Error ? error.message : 'Unknown error'}`);
              // Continue without this reference image
            }
          }
        }

        try {
          const response = await gemini.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: [{ role: 'user', parts: input_parts }],
            responseModalities: ['IMAGE', 'TEXT'],
          });

          const parsed = parseGeminiParts(response.candidates?.[0]);
          if (parsed.images?.length) {
            currentAvatar = parsed.images[0]; // Update avatar for next loop

            let stepResult: any = {
              item_index: idx,
              step: g + 1,
              total_steps: garmentInputs.length,
              images: parsed.images,
              text: parsed.text,
              prompt: prompt,
            };

            // Store images in GridFS if requested
            if (body.storeInGridFS && parsed.images && parsed.images.length > 0) {
              try {
                const storedImages = await convertGeminiImagesToStorage(parsed.images, {
                  filenamePrefix: `tryon-item-${idx}-step-${g + 1}`,
                  userId: body.userId,
                  metadata: {
                    type: 'try-on-generation',
                    itemIndex: idx,
                    step: g + 1,
                    totalSteps: garmentInputs.length,
                    aspect_ratio: body.aspect_ratio,
                    style: body.style,
                    generatedAt: new Date().toISOString()
                  },
                  expiry: '24h'
                });
                
                stepResult.images = storedImages;
                stepResult.storedInGridFS = true;
              } catch (error) {
                console.error('Error storing try-on images in GridFS:', error);
                // Keep original images if storage fails
              }
            }

            // Stream the result for this step
            res.write(JSON.stringify(stepResult) + '\n');
          } else {
            const errorResult = { 
              item_index: idx, 
              step: g + 1, 
              error: `Generation returned no images for garment step ${g + 1}` 
            };
            res.write(JSON.stringify(errorResult) + '\n');
            break;
          }
        } catch (genErr: any) {
          const errorResult = { 
            item_index: idx, 
            step: g + 1, 
            error: genErr?.message || 'Unknown generation error' 
          };
          res.write(JSON.stringify(errorResult) + '\n');
          break;
        }
      }
    }

    res.end();

  } catch (error) {
    console.error('tryOn error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Try-on failed', message: (error as Error).message });
    } else {
      const errorPayload = { error: `Try-on failed: ${(error as Error).message}` };
      res.write(JSON.stringify(errorPayload) + '\n');
      res.end();
    }
  }
};

// Pose transfer endpoint with streaming
export const generatePoseTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as PoseRequestBody;
    
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: "Provide 'items' array" });
      return;
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);
    const aspect = body.aspect_ratio || "3:4";

    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      
      if (!item.image) {
        const errorResult = { item_index: i, error: 'Missing image data' };
        res.write(JSON.stringify(errorResult) + '\n');
        continue;
      }

      // Convert image URL to base64 format
      let imageData: { mimeType: string; data: string };
      try {
        imageData = await fetchImageAsBase64(item.image);
      } catch (error) {
        const errorResult = { 
          item_index: i, 
          error: `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
        res.write(JSON.stringify(errorResult) + '\n');
        continue;
      }

      // Convert pose reference URL to base64 format if it exists
      let poseRefData: { mimeType: string; data: string } | undefined;
      if (item.pose_reference) {
        try {
          poseRefData = await fetchImageAsBase64(item.pose_reference);
        } catch (error) {
          console.warn(`Failed to process pose reference for item ${i}:`, error);
          // Continue without pose reference rather than failing completely
        }
      }

      const hasPoseRef = !!poseRefData;
      const hasPosePrompt = !!item.pose_prompt && item.pose_prompt.trim().length > 0;
      const mode = hasPoseRef && hasPosePrompt ? "pose_both" : hasPoseRef ? "pose_reference" : "pose_prompt";

      // --- START: POSE PURIFICATION HACK ---
      console.log(`Starting Pose Purification for item ${i}`);

      // STEP 1: Create a "clean" pose reference image.
      const purificationPrompt = "Analyze the input image. Identify the exact pose of the person. Create a new image of a featureless, gender-neutral, gray mannequin in that exact same pose. The background must be solid black. Preserve the pose with perfect accuracy. Discard all clothing, facial features, and original background.";
      
      let purifiedPoseRef = poseRefData; // Fallback to original if purification fails
      if (poseRefData) {
        try {
          const purifiedResponse = await gemini.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: [{ 
              role: 'user', 
              parts: [
                { text: purificationPrompt },
                { inlineData: { mimeType: poseRefData.mimeType, data: poseRefData.data } }
              ] 
            }],
            responseModalities: ['IMAGE', 'TEXT'],
          });

          const purifiedParsed = parseGeminiParts(purifiedResponse.candidates?.[0]);
          if (purifiedParsed.images && purifiedParsed.images.length > 0) {
            purifiedPoseRef = purifiedParsed.images[0];
            console.log(`Pose Purification successful. Using new reference.`);
          } else {
            console.warn("Pose Purification returned no image. Using original pose reference.");
          }
        } catch (purifyError) {
          console.error("Pose Purification step failed:", purifyError);
          console.warn("Falling back to original pose reference.");
        }
      }
      // --- END: POSE PURIFICATION HACK ---

      // STEP 2: Use the (potentially purified) pose reference for the final transfer.
      const basePrompt = [
        "**Objective: High-Fidelity Pose Replication.**",
        "You will receive two images: [Image 1: The Subject], [Image 2: A Clean Pose Mannequin].",
        "Your mission is to generate a NEW image where the person and clothing from [Image 1] are perfectly rendered in the exact pose shown by the mannequin in [Image 2].",
        "**ATTENTION: Replicate the mannequin's pose with perfect precision. Details like shoulder angle, hand position, and head tilt are mandatory. It is a failure if you do not generate a new image based on the subject from Image 1.**",
        "**Execution Algorithm:**",
        "1. **Analyze [Image 1] (The Subject):** MEMORIZE the subject's face, hair, and complete outfit.",
        "2. **Analyze [Image 2] (The Mannequin):** EXTRACT the precise skeletal structure.",
        "3. **Synthesize the Final Image:** RENDER the person and outfit from [Image 1], arranged in the exact skeletal pose from [Image 2].",
        item.background_prompt 
          ? `**BACKGROUND OVERRIDE:** The final background MUST be: '${item.background_prompt}'.` 
          : `**BACKGROUND RULE:** Re-use the background from [Image 1].`,
      ].filter(Boolean).join(" ");

      const input_parts = [
        { inlineData: { mimeType: imageData.mimeType, data: imageData.data } },
        { text: basePrompt }
      ];
      
      if (hasPoseRef && purifiedPoseRef) {
        input_parts.splice(1, 0, { inlineData: { mimeType: purifiedPoseRef.mimeType, data: purifiedPoseRef.data } });
      }

      try {
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: [{ role: 'user', parts: input_parts }],
          responseModalities: ['IMAGE', 'TEXT'],
        });

        const parsed = parseGeminiParts(response.candidates?.[0]);
        if (parsed.images?.length) {
          let result: any = {
            item_index: i,
            mode,
            images: parsed.images,
            text: parsed.text,
            background_prompt: item.background_prompt || undefined,
            pose_prompt: item.pose_prompt || undefined,
          };

          // Store images in GridFS and return signed URLs
          try {
            const storedImages = await convertGeminiImagesToStorage(parsed.images, {
              filenamePrefix: `pose-transfer-item-${i}`,
              metadata: {
                type: 'pose-transfer',
                itemIndex: i,
                mode: mode,
                background_prompt: item.background_prompt,
                pose_prompt: item.pose_prompt,
                aspect_ratio: body.aspect_ratio,
                generatedAt: new Date().toISOString()
              },
              expiry: '24h'
            });
            
            result.images = storedImages;
            result.storedInGridFS = true;
          } catch (error) {
            console.error('Error storing pose transfer images in GridFS:', error);
            // Keep original images if storage fails
          }
          
          // Stream the result
          res.write(JSON.stringify(result) + '\n');
        } else {
          const errorResult = { 
            item_index: i, 
            error: 'Pose generation failed for this item.' 
          };
          res.write(JSON.stringify(errorResult) + '\n');
        }
      } catch (error) {
        const errorResult = { 
          item_index: i, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
        res.write(JSON.stringify(errorResult) + '\n');
      }
    }
    
    res.end();

  } catch (error) {
    console.error('generatePoseTransfer error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Pose transfer failed', message: (error as Error).message });
    } else {
      const errorPayload = { error: `Pose transfer failed: ${(error as Error).message}` };
      res.write(JSON.stringify(errorPayload) + '\n');
      res.end();
    }
  }
};

// Add accessories endpoint with streaming
export const addAccessories = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as AddAccessoriesRequestBody;
    
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: "Request body must contain a non-empty 'items' array" });
      return;
    }

    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      const { image, accessories } = item || ({} as AddAccessoriesItem);

      if (!image || !Array.isArray(accessories) || accessories.length === 0) {
        const errorResult = { item_index: i, error: "Each item must have a valid 'image' and a non-empty 'accessories' array." };
        res.write(JSON.stringify(errorResult) + '\n');
        continue;
      }

      // Improved System Prompt for the Planner
      const systemPromptForPlanner = [
        "You are a world-class creative director for a high-fashion magazine.",
        "Your task is to analyze a main subject image and a set of accessory images (like sunglasses, watches, bags) and then create a 5-shot photoshoot plan.",
        "The final images must look like **professional, dynamic, high-fashion campaign photographs** where the subject and products are the hero.",
        "Return STRICT JSON only. The schema is:",
        "{",
        "  \"subject\": \"The person from the reference photo, now styled with the provided accessories.\",",
        "  \"global_style\": \"High-fashion magazine editorial, dramatic lighting, professional model poses.\",",
        "  \"negative_prompt\": \"blurry, amateur, ugly, deformed, boring, static pose, plain background, text, watermark, cropped, out of frame\",",
        "  \"aspect_ratio\": string,",
        "  \"shots\": [",
        "    { \"name\": \"dynamic-portrait\", \"prompt\": string },",
        "    { \"name\": \"full-body-action\", \"prompt\": string },",
        "    { \"name\": \"close-up-detail\", \"prompt\": string },",
        "    { \"name\": \"candid-moment\", \"prompt\": string },",
        "    { \"name\": \"environmental-shot\", \"prompt\": string }",
        "  ]",
        "}",
        "**Prompt Generation Rules:**",
        "1. **Accessory Visibility is Paramount:** Every prompt must explicitly describe the person wearing ALL provided accessories. The description must ensure the accessories are a key focal point, **clearly visible, in sharp focus, and well-lit**.",
        "2. **Identity and Clarity:** Every prompt must state that the person's face, hair, and original clothing from the main image must be perfectly preserved. The final image of the person and the accessories must be **crystal clear and high-resolution**.",
        "3. **Focus on the Subject:** All prompts must describe poses and backgrounds that **do not distract from the main person and the accessories**. They should complement, not overwhelm.",
        "4. **Dynamic Poses:** Describe strong, engaging model poses suitable for a magazine (e.g., 'leaning against a wall', 'mid-stride walking towards camera', 'dramatic look over the shoulder').",
        "5. **Professional Setting:** Describe a compelling background and professional lighting that enhances the subject and products (e.g., 'on a sun-drenched street in Milan', 'in a minimalist brutalist architectural setting', 'dramatic chiaroscuro studio lighting')."
      ].join("\n");

      const userPromptForPlanner = [
        "The main subject image and accessory images are provided.",
        `Generate a 5-shot campaign plan. The person in the main image should be wearing all the accessories provided.`,
        body.prompt ? `Incorporate these user hints: ${body.prompt}` : "",
      ].filter(Boolean).join("\n");

      // Convert image URLs to base64 format
      let mainImageData: { mimeType: string; data: string };
      try {
        mainImageData = await fetchImageAsBase64(image);
      } catch (error) {
        const errorResult = { 
          item_index: i, 
          error: `Failed to process main image: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
        res.write(JSON.stringify(errorResult) + '\n');
        continue;
      }

      // Convert accessory images to base64 format
      const accessoryImagesData: Array<{ mimeType: string; data: string }> = [];
      for (const acc of accessories) {
        try {
          const accImageData = await fetchImageAsBase64(acc.url);
          accessoryImagesData.push(accImageData);
        } catch (error) {
          console.warn(`Failed to process accessory image: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Continue without this accessory rather than failing completely
        }
      }

      if (accessoryImagesData.length === 0) {
        const errorResult = { 
          item_index: i, 
          error: 'Failed to process any accessory images' 
        };
        res.write(JSON.stringify(errorResult) + '\n');
        continue;
      }

      const plannerInputFiles = [
        { inlineData: mainImageData },
        ...accessoryImagesData.map(accData => ({ inlineData: accData })),
      ];

      let plan: any;
      try {
        const planResponse = await gemini.generateContent({
          model: 'gemini-2.5-pro',
          contents: [{ 
            role: 'user', 
            parts: [
              { text: `${systemPromptForPlanner}\n\n${userPromptForPlanner}` },
              ...plannerInputFiles
            ] 
          }],
          responseModalities: ['TEXT'],
        });

        const jsonText = (planResponse.candidates?.[0]?.content?.parts?.[0]?.text || "")
          .replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
        
        plan = JSON.parse(jsonText);
        if (!plan.shots || !Array.isArray(plan.shots) || plan.shots.length === 0) {
          throw new Error("Gemini did not return a valid shot plan.");
        }
      } catch (e: any) {
        const errorResult = { item_index: i, error: `Failed to generate campaign plan: ${e.message}` };
        res.write(JSON.stringify(errorResult) + '\n');
        continue;
      }

      const finalAspect = body.aspect_ratio || plan.aspect_ratio || "3:4";
      const finalNegative = plan.negative_prompt || "blurry, low quality, cartoon";

      // Send ALL Images (Avatar + Accessories) to the Generator
      const imageGeneratorInputFiles = [
        { inlineData: mainImageData }, // The main avatar
        ...accessoryImagesData.map(accData => ({ inlineData: accData })) // The accessories
      ];

      for (const shot of plan.shots) {
        try {
          const response = await gemini.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: [{ 
              role: 'user', 
              parts: [
                { text: shot.prompt },
                ...imageGeneratorInputFiles
              ] 
            }],
            responseModalities: ['IMAGE', 'TEXT'],
          });

          const parsed = parseGeminiParts(response.candidates?.[0]);
          if (parsed.images && parsed.images.length > 0) {
            const result = { 
              item_index: i, 
              shot_name: shot.name, 
              prompt: shot.prompt, 
              images: parsed.images,
              text: parsed.text
            };
            res.write(JSON.stringify(result) + '\n');
          } else {
            throw new Error("Image generation returned no results.");
          }
        } catch (genError: any) {
          const errorResult = { item_index: i, shot_name: shot.name, error: genError.message || "Failed to generate image for this shot." };
          res.write(JSON.stringify(errorResult) + '\n');
        }
      }
    }

    res.end();

  } catch (error) {
    console.error('addAccessories error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to add accessories', message: (error as Error).message });
    } else {
      const errorPayload = { error: `Failed to add accessories: ${(error as Error).message}` };
      res.write(JSON.stringify(errorPayload) + '\n');
      res.end();
    }
  }
};