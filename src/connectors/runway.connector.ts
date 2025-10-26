import { Request, Response } from 'express';

interface RunwayImageRequest {
  promptText: string;
  ratio: string;
  model: 'gen4_image' | 'gen4_image_turbo';
  seed?: number;
  referenceImages?: Array<{
    uri: string;
    tag?: string;
  }>;
  contentModeration?: {
    publicFigureThreshold?: 'auto' | 'low';
  };
}

interface RunwayTaskResponse {
  id: string;
}

interface RunwayTaskStatus {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  createdAt: string;
  output?: {
    uri: string;
  };
  error?: string;
}

class RunwayConnector {
  private apiKey: string;
  private baseUrl = 'https://api.dev.runwayml.com/v1';
  private version = '2024-11-06';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Runway-Version': this.version,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Runway API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async generateImage(request: RunwayImageRequest): Promise<RunwayTaskResponse> {
    return this.makeRequest('/text_to_image', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getTaskStatus(taskId: string): Promise<RunwayTaskStatus> {
    return this.makeRequest(`/tasks/${taskId}`);
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.makeRequest(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  async getOrganizationInfo(): Promise<any> {
    return this.makeRequest('/organization');
  }

  async getUsageData(startDate?: string, beforeDate?: string): Promise<any> {
    const body: any = {};
    if (startDate) body.startDate = startDate;
    if (beforeDate) body.beforeDate = beforeDate;

    return this.makeRequest('/organization/usage', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export const runwayImageGeneration = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'Runway API key not configured. Please set RUNWAY_API_KEY environment variable.'
      });
      return;
    }

    const connector = new RunwayConnector(apiKey);
    const { promptText, ratio, model, seed, referenceImages, contentModeration } = req.body;

    if (!promptText || !ratio || !model) {
      res.status(400).json({
        error: 'Missing required fields: promptText, ratio, and model are required'
      });
      return;
    }

    if (!['gen4_image', 'gen4_image_turbo'].includes(model)) {
      res.status(400).json({
        error: 'Invalid model. Must be either "gen4_image" or "gen4_image_turbo"'
      });
      return;
    }

    const validRatios = [
      '1920:1080', '1080:1920', '1024:1024', '1360:768', '1080:1080',
      '1168:880', '1440:1080', '1080:1440', '1808:768', '2112:912',
      '1280:720', '720:1280', '720:720', '960:720', '720:960', '1680:720'
    ];

    if (!validRatios.includes(ratio)) {
      res.status(400).json({
        error: `Invalid ratio. Must be one of: ${validRatios.join(', ')}`
      });
      return;
    }

    const request: RunwayImageRequest = {
      promptText,
      ratio,
      model,
      ...(seed && { seed }),
      ...(referenceImages && { referenceImages }),
      ...(contentModeration && { contentModeration })
    };

    const result = await connector.generateImage(request);
    
    res.json({
      success: true,
      taskId: result.id,
      message: 'Image generation task created successfully',
      status: 'PENDING'
    });

  } catch (error) {
    console.error('Runway API error:', error);
    res.status(500).json({
      error: 'Failed to create image generation task',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const runwayTaskStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'Runway API key not configured'
      });
      return;
    }

    const { taskId } = req.params;
    if (!taskId) {
      res.status(400).json({
        error: 'Task ID is required'
      });
      return;
    }

    const connector = new RunwayConnector(apiKey);
    const status = await connector.getTaskStatus(taskId);
    
    res.json({
      success: true,
      task: status
    });

  } catch (error) {
    console.error('Runway task status error:', error);
    res.status(500).json({
      error: 'Failed to get task status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const runwayCancelTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'Runway API key not configured'
      });
      return;
    }

    const { taskId } = req.params;
    if (!taskId) {
      res.status(400).json({
        error: 'Task ID is required'
      });
      return;
    }

    const connector = new RunwayConnector(apiKey);
    await connector.cancelTask(taskId);
    
    res.json({
      success: true,
      message: 'Task canceled successfully'
    });

  } catch (error) {
    console.error('Runway cancel task error:', error);
    res.status(500).json({
      error: 'Failed to cancel task',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const runwayOrganizationInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'Runway API key not configured'
      });
      return;
    }

    const connector = new RunwayConnector(apiKey);
    const info = await connector.getOrganizationInfo();
    
    res.json({
      success: true,
      organization: info
    });

  } catch (error) {
    console.error('Runway organization info error:', error);
    res.status(500).json({
      error: 'Failed to get organization info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export default RunwayConnector;



