import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { geminiRoute } from './routes';
import { 
  runwayImageGeneration, 
  runwayTaskStatus, 
  runwayCancelTask, 
  runwayOrganizationInfo 
} from './runway.connector';
import { geminiGenerate, geminiGenerateStream } from './gemini.connector';
import { fluxCreate, fluxPoll } from './flux.connector';
import { 
  generateModels, 
  generatePose, 
  generateBackground, 
  generatePhotoshoot, 
  generateFinalPhoto 
} from './photoshoot.controller';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req: Request, res: Response): void => {
  res.json({
    message: 'Welcome to Node.js TypeScript Express API!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check route
app.get('/health', (req: Request, res: Response): void => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Example API route
app.get('/api/hello', (req: Request, res: Response): void => {
  const name = req.query.name as string || 'World';
  res.json({
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString()
  });
});

// Example POST route
app.post('/api/data', (req: Request, res: Response): void => {
  const { data } = req.body;
  
  if (!data) {
    res.status(400).json({
      error: 'Data is required'
    });
    return;
  }
  
  res.json({
    message: 'Data received successfully',
    receivedData: data,
    timestamp: new Date().toISOString()
  });
});

// Gemini recipe comparison route
app.post('/api/gemini/compare', geminiRoute);

// Gemini content routes
app.post('/api/gemini/generate', geminiGenerate);
app.post('/api/gemini/generate-stream', geminiGenerateStream);

// Runway AI routes
app.post('/api/runway/generate-image', runwayImageGeneration);
app.get('/api/runway/task/:taskId', runwayTaskStatus);
app.delete('/api/runway/task/:taskId', runwayCancelTask);
app.get('/api/runway/organization', runwayOrganizationInfo);

// FLUX.1 Kontext routes
app.post('/api/flux/create', fluxCreate);
app.get('/api/flux/poll', fluxPoll);

// Photoshoot routes
app.post('/api/photoshoot/models', generateModels);
app.post('/api/photoshoot/pose', generatePose);
app.post('/api/photoshoot/background', generateBackground);
app.post('/api/photoshoot/shoot', generatePhotoshoot);
app.post('/api/photoshoot/final', generateFinalPhoto);

// 404 handler
app.use('*', (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

export default app;
