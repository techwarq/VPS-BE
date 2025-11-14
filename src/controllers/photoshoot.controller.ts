import { Request, Response } from 'express';
import GeminiConnector from '../connectors/gemini.connector';
import { convertGeminiImagesToStorage, ImageStorageResult } from '../services/image-storage.helper';

interface GenerateModelsBody {
  gender: string;
  ethnicity: string;
  age: number;
  skinTone: string;
  eyeColor: string;
  hairStyle: string;
  hairColor: string;
  clothingStyle: string;
  count?: number; 
  aspect_ratio?: string;
  userId?: string;
  storeInGridFS?: boolean;
}


interface GeneratePoseBody {
  prompt: string;
  count: number;
  geminiImage?: { mimeType: string; data: string }; 
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
  count?: number; 
  userId?: string;
  storeInGridFS?: boolean;
}

interface ImageGroupItem {
  prompt: string;
  images: Array<{ mimeType: string; data: string }>; 
}

interface MultiImageBody {
  groups: ImageGroupItem[]; 
  userId?: string;
  storeInGridFS?: boolean;
}

interface ModelCharacteristics {
  subject?: string;
  hair_color?: string;
  eye_color?: string;
  hairstyle?: string;
  ethnicity?: string;
  age?: number;
  gender?: string;
  clothing?: string;
}

interface AvatarGenerateBody {
  // Single model (backward compatible)
  subject?: string;
  hair_color?: string;
  eye_color?: string;
  hairstyle?: string;
  ethnicity?: string;
  age?: number;
  gender?: string;
  clothing?: string;
  
  // Multiple models support
  models?: ModelCharacteristics[]; // Array of model characteristics
  count?: number; // Number of models to generate (if models array not provided)
  
  // Common settings for all models
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

interface AvatarAngleResult {
  name: string;
  prompt: string;
  images: Array<{
    fileId?: string;
    filename?: string;
    size?: number;
    contentType?: string;
    signedUrl?: string;
    mimeType?: string;
    data?: string;
  }>;
  text?: string;
  storedInGridFS?: boolean;
  error?: string;
}

interface AvatarModelResult {
  modelIndex: number;
  characteristics: ModelCharacteristics;
  angles: AvatarAngleResult[];
}

interface AvatarResponse {
  success: boolean;
  models: AvatarModelResult[];
  totalModels: number;
  totalAngles: number;
}

interface TryOnItem {
  avatar_image: string | { mimeType: string; data: string }; 
  garment_images: Array<string | { mimeType: string; data: string }>; 
  reference_model_images?: Array<string | { mimeType: string; data: string }>; 
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
    image: string;           
    pose_reference?: string; 
    background_prompt?: string;
    pose_prompt?: string;
  }>;
  aspect_ratio?: string;        
  negative_prompt?: string;     
}

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

export interface UserQuery {
  userQuery: string;
  query_id: number;
  userId?:string;
  createdAt: Date;
  credits?: number
}
export interface AiResponse {
  response: string;
  uiNode: string;
}
export interface AiResponseBody {
  success: boolean;
  aiResponse: AiResponse[];




}
export interface AddAccessoriesItem {
    image: string;
    accessories: { url: string }[];
}

export interface AddAccessoriesRequestBody {
    items: AddAccessoriesItem[];
    prompt?: string;
    aspect_ratio?: string;
}

const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);

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

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string }> {
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
    console.error('Error fetching image from URL:', url, error);
    throw new Error(`Failed to fetch image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function convertImageInputToBase64(input: string | { mimeType: string; data: string } | { signedUrl: string }): Promise<{ mimeType: string; data: string }> {
  if (typeof input === 'string') {
    return await fetchImageAsBase64(input);
  } else if ('signedUrl' in input) {
    return await fetchImageAsBase64(input.signedUrl);
  } else {
    return input;
  }
}


export const chatQuery = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    console.log('🎯 Chat query endpoint hit');
    console.log('👤 User:', req.user?.userId || 'anonymous');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    const body = req.body as UserQuery;
    const userId = req.user?.userId || body.userId;
    
    const initTime = Date.now();
    const gemini = new GeminiConnector(geminiApiKey);
    console.log(`⏱️  Initialization took: ${Date.now() - initTime}ms`);

    // Optimized shorter prompt for faster response
    const prompt = `You are VirtuShoot AI assistant. Understand user intent and return JSON only.

Rules:
- Return JSON: {"type":"message"|"question","content":"text","next":"uiNode","data":{...}}
- Keep replies short and friendly
- Never render UI components
- Progress workflow logically

Example: User: "I want photoshoot" → {"type":"message","content":"Let's set up your avatar.","next":"selectAvatarModal"}

User query: ${body.userQuery}`;
    
    const geminiStartTime = Date.now();
    console.log('🤖 Sending query to Gemini:', body.userQuery);
    
    const response = await gemini.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const geminiTime = Date.now() - geminiStartTime;
    console.log(`⏱️  Gemini API call took: ${geminiTime}ms`);
    
    const parseStartTime = Date.now();
    const parsed = parseGeminiParts(response.candidates?.[0]);
    console.log(`⏱️  Parsing took: ${Date.now() - parseStartTime}ms`);
    
    console.log('✅ Gemini response received');
    console.log('📄 Response text length:', parsed.text?.length || 0);
    console.log('🖼️  Response images count:', parsed.images?.length || 0);
    
    const totalTime = Date.now() - startTime;
    console.log(`⏱️  Total request time: ${totalTime}ms`);
    
    res.json({
      success: true,
      text: parsed.text,
      images: parsed.images || [],
      userId: userId,
      query_id: body.query_id,
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('❌ Chat query error:', error);
    console.error('📝 Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error(`⏱️  Failed after: ${totalTime}ms`);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to process chat query',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const generateModels = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as GenerateModelsBody;
    
    // Auto-inject userId from bearer token if available
    const userId = req.user?.userId || body.userId;
    
    
    const gemini = new GeminiConnector(geminiApiKey);

    const count = body.count ?? 4;
    const prompt = buildModelPrompt(body);

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < count; i++) {
      try {
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image',
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

        if (body.storeInGridFS && parsed.images && parsed.images.length > 0) {
          try {
            const storedImages = await convertGeminiImagesToStorage(parsed.images, {
              filenamePrefix: `model-${i}`,
              userId: userId,
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
          }
        }

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
    
    // Auto-inject userId from bearer token if available
    const userId = req.user?.userId || body.userId;
    
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

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < body.count; i++) {
      try {
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image',
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

        if (body.storeInGridFS && parsed.images && parsed.images.length > 0) {
          try {
            const storedImages = await convertGeminiImagesToStorage(parsed.images, {
              filenamePrefix: `pose-${i}`,
              userId: userId,
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
    
    // Auto-inject userId from bearer token if available
    const userId = req.user?.userId || body.userId;
    
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

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < count; i++) {
      try {
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image',
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

        if (body.storeInGridFS && parsed.images && parsed.images.length > 0) {
          try {
            const storedImages = await convertGeminiImagesToStorage(parsed.images, {
              filenamePrefix: `background-${i}`,
              userId: userId,
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

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < body.groups.length; i++) {
      const group = body.groups[i];
      try {
        const parts: any[] = [{ text: group.prompt }];
        for (const img of group.images) parts.push({ inlineData: img });
        
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image',
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

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (let i = 0; i < body.groups.length; i++) {
      const group = body.groups[i];
      try {
        const parts: any[] = [{ text: group.prompt }];
        for (const img of group.images) parts.push({ inlineData: img });
        
        const response = await gemini.generateContent({
          model: 'gemini-2.5-flash-image',
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

// Helper function to build subject from model characteristics
function buildSubjectFromCharacteristics(char: ModelCharacteristics): string {
  let descriptionParts: string[] = [];
  if (char.age) descriptionParts.push(`${Number(char.age)}-year-old`);
  if (char.gender) descriptionParts.push(String(char.gender).toLowerCase());
  if (char.ethnicity) descriptionParts.push(String(char.ethnicity).toLowerCase());
  let baseDescription = descriptionParts.join(" ") || "A person";

  const featureParts: string[] = [];
  if (char.hairstyle) featureParts.push(String(char.hairstyle).toLowerCase());
  if (char.hair_color) featureParts.push(`${String(char.hair_color).toLowerCase()} hair`);
  if (char.eye_color) featureParts.push(`${String(char.eye_color).toLowerCase()} eyes`);
  
  let features = "";
  if (featureParts.length > 0) {
    features = ` with ${featureParts.join(", ")}`;
  }

  let clothingDesc = "";
  if (char.clothing) {
    clothingDesc = ` wearing ${String(char.clothing).toLowerCase()}`;
  }

  // Build subject: if provided, enhance it with specific attributes; otherwise build from fields
  if (char.subject) {
    const subjectParts: string[] = [char.subject];
    if (baseDescription !== "A person") {
      subjectParts.push(baseDescription);
    }
    if (features) {
      subjectParts.push(features.replace(/^ with /, ""));
    }
    if (clothingDesc) {
      subjectParts.push(clothingDesc.replace(/^ wearing /, "wearing"));
    }
    return subjectParts.join(", ") + ".";
  } else {
    return `${baseDescription}${features}${clothingDesc}.`;
  }
}

// Helper function to generate angles for a single model
async function generateModelAngles(
  gemini: GeminiConnector,
  modelChar: ModelCharacteristics,
  modelIndex: number,
  commonSettings: {
    framing: "headshot" | "half-body" | "full-body";
    style: string;
    background?: string;
    aspect_ratio: string;
    negative_prompt?: string;
  },
  userId?: string,
  storeInGridFS: boolean = true
): Promise<AvatarAngleResult[]> {
  const subject = buildSubjectFromCharacteristics(modelChar);
  const styleText = `Style: ${commonSettings.style}. The shot framing is ${commonSettings.framing}.`;
  const aspectText = `Preferred aspect_ratio: ${commonSettings.aspect_ratio}.`;
  const bgText = commonSettings.background ? `Background: ${commonSettings.background}.` : "";

  const geminiSystemPrompt = [
    "You are an expert photography director creating a 5-shot avatar photoshoot plan. Your output MUST be a single, clean JSON object and nothing else.",
    "The final images must look like **real photographs of the same human**, not 3D renders or illustrations.",
    "The first prompt you generate is for the Imagen 4 model. The subsequent four are for Gemini 2.5 Flash, which will use the first generated image as an identity reference.",
    "",
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
    "",
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
    commonSettings.negative_prompt ? `Negative prompt hints: ${commonSettings.negative_prompt}.` : "",
    "Produce the JSON plan now.",
  ].filter(Boolean).join("\n");

  // Generate plan
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
    throw new Error("Failed to parse prompt plan JSON from Gemini");
  }

  if (!plan.angles || !Array.isArray(plan.angles) || plan.angles.length !== 5) {
    throw new Error("Gemini did not return exactly 5 angles");
  }

  const angles: AvatarAngleResult[] = [];

  // Generate first angle (front)
  const firstPrompt = plan.angles[0].prompt;
  const firstResponse = await gemini.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts: [{ text: firstPrompt }] }],
    responseModalities: ['IMAGE', 'TEXT'],
  });

  const firstParsed = parseGeminiParts(firstResponse.candidates?.[0]);
  if (!firstParsed.images || firstParsed.images.length === 0) {
    throw new Error("Gemini did not return first image");
  }

  let firstAngleResult: AvatarAngleResult = {
    name: plan.angles[0].name,
    prompt: firstPrompt,
    images: firstParsed.images,
    text: firstParsed.text,
    storedInGridFS: false,
  };

  // Store first image if needed
  if (storeInGridFS && firstParsed.images && firstParsed.images.length > 0) {
    try {
      const storedImages = await convertGeminiImagesToStorage(firstParsed.images, {
        filenamePrefix: `avatar-model-${modelIndex}-${plan.angles[0].name}`,
        userId: userId,
        metadata: {
          type: 'avatar-generation',
          modelIndex: modelIndex,
          angle: plan.angles[0].name,
          characteristics: modelChar,
          generatedAt: new Date().toISOString()
        },
        expiry: '24h'
      });
      firstAngleResult.images = storedImages;
      firstAngleResult.storedInGridFS = true;
    } catch (error) {
      console.error(`Error storing first avatar image for model ${modelIndex}:`, error);
      firstAngleResult.images = firstParsed.images;
    }
  }

  angles.push(firstAngleResult);
  const firstReferenceImage = firstParsed.images[0];

  // Generate remaining 4 angles
  for (let i = 1; i < plan.angles.length; i++) {
    const angle = plan.angles[i];
    
    try {
      const response = await gemini.generateContent({
        model: 'gemini-2.5-flash-image',
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
      
      let angleResult: AvatarAngleResult = {
        name: angle.name,
        prompt: angle.prompt,
        images: parsed.images,
        text: parsed.text,
        storedInGridFS: false,
      };

      // Store image if needed
      if (storeInGridFS && parsed.images && parsed.images.length > 0) {
        try {
          const storedImages = await convertGeminiImagesToStorage(parsed.images, {
            filenamePrefix: `avatar-model-${modelIndex}-${angle.name}`,
            userId: userId,
            metadata: {
              type: 'avatar-generation',
              modelIndex: modelIndex,
              angle: angle.name,
              characteristics: modelChar,
              generatedAt: new Date().toISOString()
            },
            expiry: '24h'
          });
          angleResult.images = storedImages;
          angleResult.storedInGridFS = true;
        } catch (error) {
          console.error(`Error storing avatar image for model ${modelIndex}, angle ${angle.name}:`, error);
          angleResult.images = parsed.images;
        }
      }

      angles.push(angleResult);
    } catch (error) {
      console.error(`Error generating angle ${angle.name} for model ${modelIndex}:`, error);
      angles.push({
        name: angle.name,
        prompt: angle.prompt,
        images: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return angles;
}

export const generateAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as AvatarGenerateBody;
    
    // Auto-inject userId from bearer token if available
    const userId = req.user?.userId || body.userId;
    
    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);
    
    // Determine framing
    const framingNorm = String(
      (body.framing || body.body_scope || body.bodyScope || "headshot")
    ).toLowerCase().replace(/_/g, "-");
    
    const framing: "headshot" | "half-body" | "full-body" =
      framingNorm === "full-body" ? "full-body" :
      framingNorm === "half-body" ? "half-body" : "headshot";

    // Common settings for all models
    const baseStyle = body.style || "studio photo, soft diffused lighting, realistic skin texture";
    const consistentStyle = (framing === 'headshot') ? baseStyle : baseStyle.replace(/headshot/ig, 'photo').trim();
    const defaultAR = framing === "full-body" ? "9:16" : framing === "half-body" ? "3:4" : "3:4";
    const finalAspectForPlanner = body.aspect_ratio || defaultAR;

    const commonSettings = {
      framing,
      style: consistentStyle,
      background: body.background,
      aspect_ratio: finalAspectForPlanner,
      negative_prompt: body.negative_prompt,
    };

    // Determine models to generate
    let modelsToGenerate: ModelCharacteristics[] = [];
    
    if (body.models && Array.isArray(body.models) && body.models.length > 0) {
      // Use provided models array
      modelsToGenerate = body.models;
    } else if (body.count && body.count > 0) {
      // Generate models from base characteristics
      const baseChar: ModelCharacteristics = {
        subject: body.subject,
        hair_color: body.hair_color,
        eye_color: body.eye_color,
        hairstyle: body.hairstyle,
        ethnicity: body.ethnicity,
        age: body.age,
        gender: body.gender,
        clothing: body.clothing,
      };
      
      // Create array of models (for now, all same characteristics - can be enhanced later)
      for (let i = 0; i < body.count; i++) {
        modelsToGenerate.push({ ...baseChar });
      }
    } else {
      // Single model (backward compatible)
      modelsToGenerate = [{
        subject: body.subject,
        hair_color: body.hair_color,
        eye_color: body.eye_color,
        hairstyle: body.hairstyle,
        ethnicity: body.ethnicity,
        age: body.age,
        gender: body.gender,
        clothing: body.clothing,
      }];
    }

    const shouldStoreInGridFS = body.storeInGridFS !== false;
    const results: AvatarModelResult[] = [];

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Generate angles for each model
    for (let modelIndex = 0; modelIndex < modelsToGenerate.length; modelIndex++) {
      const modelChar = modelsToGenerate[modelIndex];
      
      try {
        console.log(`🎯 Generating avatar for model ${modelIndex + 1}/${modelsToGenerate.length}`);
        
        const angles = await generateModelAngles(
          gemini,
          modelChar,
          modelIndex,
          commonSettings,
          userId,
          shouldStoreInGridFS
        );

        const modelResult: AvatarModelResult = {
          modelIndex: modelIndex,
          characteristics: modelChar,
          angles: angles,
        };

        results.push(modelResult);
        
        // Stream result as NDJSON
        res.write(JSON.stringify({
          modelIndex: modelIndex,
          characteristics: modelChar,
          angles: angles,
        }) + '\n');

      } catch (error) {
        console.error(`❌ Error generating avatar for model ${modelIndex}:`, error);
        
        // Stream error result
        res.write(JSON.stringify({
          modelIndex: modelIndex,
          characteristics: modelChar,
          angles: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        }) + '\n');
      }
    }

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

export const tryOn = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as TryOnRequestBody;
    
    // Auto-inject userId from bearer token if available
    const userId = req.user?.userId || body.userId;

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: "'items' must be a non-empty array" });
      return;
    }

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
      const avatarInput = item.avatar_image;
      const garmentInputs = Array.isArray(item.garment_images) ? item.garment_images : [];

      if (!avatarInput || garmentInputs.length === 0) {
        const err = {
          item_index: idx,
          error: !avatarInput ? 'Missing avatar_image' : 'No garment_images provided'
        };
        res.write(JSON.stringify(err) + '\n');
        continue;
      }

      try {
        const avatar = await convertImageInputToBase64(avatarInput);
        
        const garments = await Promise.all(
          garmentInputs.map(gInput => convertImageInputToBase64(gInput))
        );

        const garmentCount = garments.length;
        const prompt = [
          "You are an expert virtual stylist creating a professional e-commerce fashion photo from multiple inputs.",
          `**Task:** Create a single, photorealistic, full-body image of the model from the first image wearing a complete outfit composed of the ${garmentCount} garments from the subsequent images.`,
          "**Inputs:**",
          "- The VERY FIRST image is the model.",
          `- The NEXT ${garmentCount} images are the individual clothing items (e.g., a shirt, pants, etc.).`,
          "**Instructions:**",
          "1. **Combine the Garments:** Accurately dress the model in ALL the provided clothing items to form a coherent outfit. The clothes must fit and layer naturally (e.g., shirt tucked into pants).",
          "2. **Identity Preservation is CRITICAL:** The model's face, hair, skin tone, and body shape must remain IDENTICAL to the first input image. It must be the exact same person.",
          "3. **Background:** The background must be a seamless, neutral light gray studio backdrop.",
          "4. **Realism:** Ensure natural fit, drape, and texture for all clothes, with realistic lighting and shadows.",
          styleLine,
          negLine
        ].filter(Boolean).join(" ");

        const input_parts = [
          { inlineData: avatar },
          ...garments.map(g => ({ inlineData: g })), 
          { text: prompt }
        ];
        
        if (item.reference_model_images) {
           for (const refImgInput of item.reference_model_images) {
            try {
              const refImg = await convertImageInputToBase64(refImgInput);
              input_parts.push({ inlineData: refImg });
            } catch (error) {
              console.warn(`Failed to process reference model image.`);
            }
          }
        }
        
         const response = await gemini.generateContent({
           model: 'gemini-2.5-flash-image',
           contents: [{ role: 'user', parts: input_parts }],
           responseModalities: ['IMAGE', 'TEXT'],
         });

        const parsed = parseGeminiParts(response.candidates?.[0]);
        if (parsed.images?.length) {
          let result: any = {
            item_index: idx,
            images: parsed.images,
            text: parsed.text,
            prompt: prompt,
          };

          if (body.storeInGridFS && parsed.images && parsed.images.length > 0) {
            try {
              const storedImages = await convertGeminiImagesToStorage(parsed.images, {
                filenamePrefix: `tryon-item-${idx}`,
                userId: userId,
                metadata: {
                  type: 'tryon-generation',
                  itemIndex: idx,
                  aspect_ratio: body.aspect_ratio,
                  style: body.style,
                  generatedAt: new Date().toISOString()
                },
                expiry: '24h'
              });
              result.images = storedImages;
              result.storedInGridFS = true;
            } catch (error) {
              console.error('Error storing try-on images in GridFS:', error);
            }
          }
          
          res.write(JSON.stringify(result) + '\n');
        } else {
          throw new Error("Generation returned no images for the outfit.");
        }

      } catch (genErr: any) {
        const errorResult = { 
          item_index: idx,
          error: genErr?.message || 'Unknown error during outfit generation' 
        };
        res.write(JSON.stringify(errorResult) + '\n');
        continue; 
      }
    }

    res.end();

  } catch (error) {
    console.error('tryOn error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Try-on failed', message: (error as Error).message });
    } else {
      res.end();
    }
  }
};

export const generatePoseTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as PoseRequestBody;
    
    // Auto-inject userId from bearer token if available
    const userId = req.user?.userId;
    
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: "Provide 'items' array" });
      return;
    }

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

      let poseRefData: { mimeType: string; data: string } | undefined;
      if (item.pose_reference) {
        try {
          poseRefData = await fetchImageAsBase64(item.pose_reference);
        } catch (error) {
          console.warn(`Failed to process pose reference for item ${i}:`, error);
        }
      }

      const hasPoseRef = !!poseRefData;
      const hasPosePrompt = !!item.pose_prompt && item.pose_prompt.trim().length > 0;
      const mode = hasPoseRef && hasPosePrompt ? "pose_both" : hasPoseRef ? "pose_reference" : "pose_prompt";

      console.log(`Starting Pose Purification for item ${i}`);

      const purificationPrompt = "Analyze the input image. Identify the exact pose of the person. Create a new image of a featureless, gender-neutral, gray mannequin in that exact same pose. The background must be solid black. Preserve the pose with perfect accuracy. Discard all clothing, facial features, and original background.";
      
      let purifiedPoseRef = poseRefData; 
      if (poseRefData) {
        try {
          const purifiedResponse = await gemini.generateContent({
            model: 'gemini-2.5-flash-image',
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

      const basePrompt = [
        "**Objective: Precise Pose Transfer.**",
        "You will receive two primary images: [Image 1: The Subject] and [Image 2: The Pose Reference]. Your task is to generate a new photorealistic image where the person and their complete outfit from [Image 1] are perfectly transferred into the exact pose from [Image 2].",
        
        "**CRITICAL RULES - NON-NEGOTIABLE:**",
        "1. **IDENTITY & CLOTHING PRESERVATION IS THE #1 PRIORITY.**",
        "2. **DO NOT CHANGE THE SUBJECT:** The person's face, hair, body type, and skin tone from [Image 1] must be preserved with 100% accuracy. It must be the exact same person.",
        "3. **DO NOT CHANGE THE OUTFIT:** The clothing, including its type, color, texture, and fit from [Image 1], must be transferred exactly as is. Do not add, remove, or alter any part of the outfit.",
        "4. **POSE ACCURACY IS MANDATORY:** The final pose must be an exact match to the pose in [Image 2].",

        "**Execution Algorithm:**",
        "1. **Analyze [Image 1] (The Subject):** Extract all appearance data (face, body, clothes). This is the source for appearance ONLY.",
        "2. **Analyze [Image 2] (The Pose):** Extract the precise skeletal structure. This is the source for the pose ONLY.",
        "3. **Synthesize Final Image:** Apply the full appearance data from Step 1 onto the skeletal pose from Step 2.",

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
          model: 'gemini-2.5-flash-image',
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

          try {
            const storedImages = await convertGeminiImagesToStorage(parsed.images, {
              filenamePrefix: `pose-transfer-item-${i}`,
              userId: userId,
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
          }
          
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

export const addAccessories = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as AddAccessoriesRequestBody;
    
    // Auto-inject userId from bearer token if available
    const userId = req.user?.userId;
    
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: "Request body must contain a non-empty 'items' array" });
      return;
    }

    const geminiApiKey = ensureApiKey('GEMINI_API_KEY', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    const gemini = new GeminiConnector(geminiApiKey);

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

      const accessoryImagesData: Array<{ mimeType: string; data: string }> = [];
      for (const acc of accessories) {
        try {
          const accImageData = await fetchImageAsBase64(acc.url);
          accessoryImagesData.push(accImageData);
        } catch (error) {
          console.warn(`Failed to process accessory image: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      const imageGeneratorInputFiles = [
        { inlineData: mainImageData }, 
        ...accessoryImagesData.map(accData => ({ inlineData: accData })) 
      ];

      for (const shot of plan.shots) {
        try {
          const response = await gemini.generateContent({
            model: 'gemini-2.5-flash-image',
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
            let result: any = { 
              item_index: i, 
              shot_name: shot.name, 
              prompt: shot.prompt, 
              images: parsed.images,
              text: parsed.text
            };

            try {
              const storedImages = await convertGeminiImagesToStorage(parsed.images, {
                filenamePrefix: `accessories-item-${i}-${shot.name}`,
                userId: userId,
                metadata: {
                  type: 'add-accessories',
                  itemIndex: i,
                  shotName: shot.name,
                  prompt: shot.prompt,
                  aspect_ratio: body.aspect_ratio,
                  generatedAt: new Date().toISOString()
                },
                expiry: '24h'
              });
              
              result.images = storedImages;
              result.storedInGridFS = true;
            } catch (error) {
              console.error('Error storing accessories images in GridFS:', error);
            }

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