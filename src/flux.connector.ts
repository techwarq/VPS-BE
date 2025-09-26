import { Request, Response } from 'express';

interface FluxCreateRequestBody {
  prompt: string;
  aspect_ratio?: string | null;
  seed?: number | null;
  prompt_upsampling?: boolean;
  safety_tolerance?: number;
  output_format?: 'jpeg' | 'png';
  webhook_url?: string | null;
  webhook_secret?: string | null;
  input_image?: string; // base64 for editing
}

interface FluxCreateResponse {
  id: string;
  polling_url: string;
  image_url?: string;
}

interface FluxPollResponse {
  status: 'Queued' | 'Processing' | 'Ready' | 'Error' | 'Failed';
  result?: { sample?: string };
  error?: string;
}

class FluxConnector {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.bfl.ai/v1/flux-kontext-pro';
  }

  async createRequest(body: FluxCreateRequestBody): Promise<FluxCreateResponse> {
    // Always keep seed random by omitting it from the payload
    const { seed: _omitSeed, ...rest } = body;
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'x-key': this.apiKey,
      },
      body: JSON.stringify(rest),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`FLUX create error ${response.status}: ${text}`);
    }
    const json = await response.json();
    return json as FluxCreateResponse;
  }

  async poll(pollingUrl: string): Promise<FluxPollResponse> {
    const response = await fetch(pollingUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-key': this.apiKey,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`FLUX poll error ${response.status}: ${text}`);
    }
    const json = await response.json();
    return json as FluxPollResponse;
  }
}

export const fluxCreate = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.BFL_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'BFL API key not configured. Set BFL_API_KEY.' });
      return;
    }

    const { prompt, aspect_ratio, seed, prompt_upsampling, safety_tolerance, output_format, webhook_url, webhook_secret, input_image } = req.body as FluxCreateRequestBody;

    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    const connector = new FluxConnector(apiKey);
    const createBody: FluxCreateRequestBody = {
      prompt,
      ...(aspect_ratio !== undefined ? { aspect_ratio } : {}),
      ...(seed !== undefined ? { seed } : {}),
      ...(prompt_upsampling !== undefined ? { prompt_upsampling } : {}),
      ...(safety_tolerance !== undefined ? { safety_tolerance } : {}),
      ...(output_format !== undefined ? { output_format } : {}),
      ...(webhook_url !== undefined ? { webhook_url } : {}),
      ...(webhook_secret !== undefined ? { webhook_secret } : {}),
      ...(input_image ? { input_image } : {}),
    };

    const result = await connector.createRequest(createBody);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('FLUX create error:', error);
    res.status(500).json({ error: 'Failed to create FLUX request', message: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const fluxPoll = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.BFL_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'BFL API key not configured. Set BFL_API_KEY.' });
      return;
    }

    const { pollingUrl } = req.query as { pollingUrl?: string };
    if (!pollingUrl) {
      res.status(400).json({ error: 'pollingUrl query parameter is required' });
      return;
    }

    const connector = new FluxConnector(apiKey);
    const result = await connector.poll(pollingUrl);
    res.json({ success: true, result });
  } catch (error) {
    console.error('FLUX poll error:', error);
    res.status(500).json({ error: 'Failed to poll FLUX request', message: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export default FluxConnector;


