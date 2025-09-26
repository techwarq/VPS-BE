import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connectToDatabase, closeDatabaseConnection } from './database';
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
  generateFinalPhoto,
  generateAvatar,
  addAccessories
} from './photoshoot.controller';
import {
  getGeneration,
  getUserStats,
  getGlobalStats,
  getUserSessions,
  createSession,
  getSession
} from './database.controller';

const app = express();
const PORT = process.env.PORT || 4000;

// Add CORS middleware BEFORE other middleware - Allow all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests for all routes
app.options('*', (req: Request, res: Response): void => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Set CORS headers on all responses
app.use((req: Request, res: Response, next: NextFunction): void => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Your existing middleware
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

// Avatar generation route with detailed logging
app.post('/api/photoshoot/avatar', (req: Request, res: Response): void => {
  console.log('🎯 Avatar generation endpoint hit');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  console.log('🌐 Request headers:', req.headers);
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  // Call the actual generateAvatar function
  generateAvatar(req, res);
});

// Add accessories route with detailed logging
app.post('/api/photoshoot/add-accessories', (req: Request, res: Response): void => {
  console.log('🎯 Add accessories endpoint hit');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  console.log('🌐 Request headers:', req.headers);
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  // Call the actual addAccessories function
  addAccessories(req, res);
});

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

// Initialize database and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🔍 Health check: http://localhost:${PORT}/health`);
      console.log(`🗄️  MongoDB connected successfully`);
      console.log(`🌍 CORS enabled for localhost:3000 and localhost:3001`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      await closeDatabaseConnection();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down server...');
      await closeDatabaseConnection();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;