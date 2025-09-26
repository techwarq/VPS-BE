import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { DatabaseService } from './database.service';

// Get generation by ID
export const getGeneration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid generation ID' });
      return;
    }

    const objectId = new ObjectId(id);
    const dbService = new DatabaseService();
    let generation: any = null;

    switch (type) {
      case 'model':
        generation = await dbService.getModelGeneration(objectId);
        break;
      case 'pose':
        generation = await dbService.getPoseGeneration(objectId);
        break;
      case 'background':
        generation = await dbService.getBackgroundGeneration(objectId);
        break;
      case 'photoshoot':
        generation = await dbService.getPhotoshootGeneration(objectId);
        break;
      case 'final':
        generation = await dbService.getFinalPhotoGeneration(objectId);
        break;
      default:
        res.status(400).json({ error: 'Invalid generation type. Must be: model, pose, background, photoshoot, or final' });
        return;
    }

    if (!generation) {
      res.status(404).json({ error: 'Generation not found' });
      return;
    }

    res.json({ success: true, generation });
  } catch (error) {
    console.error('getGeneration error:', error);
    res.status(500).json({ 
      error: 'Failed to get generation', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Get user statistics
export const getUserStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const dbService = new DatabaseService();
    const stats = await dbService.getGenerationStats(userId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('getUserStats error:', error);
    res.status(500).json({ 
      error: 'Failed to get user statistics', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Get global statistics
export const getGlobalStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const dbService = new DatabaseService();
    const stats = await dbService.getGenerationStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('getGlobalStats error:', error);
    res.status(500).json({ 
      error: 'Failed to get global statistics', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Get user sessions
export const getUserSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const dbService = new DatabaseService();
    const sessions = await dbService.getSessionsByUser(userId, limit);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('getUserSessions error:', error);
    res.status(500).json({ 
      error: 'Failed to get user sessions', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Create a new session
export const createSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, sessionName, description } = req.body;
    
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const dbService = new DatabaseService();
    const sessionId = await dbService.createSession({
      userId,
      sessionName,
      description,
      status: 'active',
    });

    res.json({ 
      success: true, 
      sessionId: sessionId.toString(),
      message: 'Session created successfully' 
    });
  } catch (error) {
    console.error('createSession error:', error);
    res.status(500).json({ 
      error: 'Failed to create session', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Get session by ID
export const getSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    
    if (!ObjectId.isValid(sessionId)) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    const objectId = new ObjectId(sessionId);
    const dbService = new DatabaseService();
    const session = await dbService.getSession(objectId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('getSession error:', error);
    res.status(500).json({ 
      error: 'Failed to get session', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

