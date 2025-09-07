import { Request, Response } from 'express';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "" });

export const geminiRoute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { urls } = req.body;
    
    

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        `eract everuthing list teh stuffs dont leave anything${urls}`,
      ],
      config: {
        tools: [{urlContext: {}}],
      },
    });

    res.json({
      comparison: response.text,
      metadata: response.candidates?.[0]?.urlContextMetadata,
      urls: urls
    });

  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({
      error: 'Failed to process request with Gemini API',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
