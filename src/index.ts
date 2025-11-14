import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connectToDatabase, closeDatabaseConnection } from './config/database';
import { geminiRoute } from './utils/routes';
import { 
  runwayImageGeneration, 
  runwayTaskStatus, 
  runwayCancelTask, 
  runwayOrganizationInfo 
} from './connectors/runway.connector';
import { geminiGenerate, geminiGenerateStream } from './connectors/gemini.connector';
import { fluxCreate, fluxPoll } from './connectors/flux.connector';
import { 
  generateModels, 
  generatePose, 
  generateBackground, 
  generatePhotoshoot, 
  generateFinalPhoto,
  generateAvatar,
  addAccessories,
  tryOn,
  generatePoseTransfer,
  chatQuery
} from './controllers/photoshoot.controller';
import {
  getGeneration,
  getUserStats,
  getGlobalStats,
  getUserSessions,
  createSession,
  getSession
} from './controllers/database.controller';
import {
  uploadFileHandler,
  generateSignedUrlHandler,
  getFileInfoHandler,
  deleteFileHandler,
  listFilesHandler,
  bulkDeleteFilesHandler,
  deleteFilesByFilterHandler,
  upload
} from './controllers/file.controller';
import {
  streamFileHandler,
  downloadFileHandler,
  getFileMetadataHandler,
  fileServiceHealthHandler
} from './controllers/file-stream.controller';
import {
  registerWithPassword,
  loginWithPassword,
  loginWithGoogle,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  deleteAccount
} from './controllers/auth.controller';
import { validateFileAccess } from './services/signed-url.service';
import { optionalAuth, requireAuth } from './middleware/auth.middleware';
import { simpleUploadHandler, upload as simpleUpload } from './controllers/upload.controller';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  maxAge: 86400
}));

app.options('*', (req: Request, res: Response): void => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use((req: Request, res: Response, next: NextFunction): void => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response): void => {
  res.json({
    message: 'Welcome to Node.js TypeScript Express API!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req: Request, res: Response): void => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/hello', (req: Request, res: Response): void => {
  const name = req.query.name as string || 'World';
  res.json({
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString()
  });
});

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

app.post('/api/gemini/compare', geminiRoute);

app.post('/api/gemini/generate', geminiGenerate);
app.post('/api/gemini/generate-stream', geminiGenerateStream);

// Authentication routes
app.post('/api/auth/register', registerWithPassword);
app.post('/api/auth/login', loginWithPassword);
app.post('/api/auth/google', loginWithGoogle);
app.get('/api/auth/me', requireAuth, getCurrentUser);
app.put('/api/auth/profile', requireAuth, updateUserProfile);
app.put('/api/auth/password', requireAuth, changePassword);
app.delete('/api/auth/account', requireAuth, deleteAccount);

app.post('/api/runway/generate-image', runwayImageGeneration);
app.get('/api/runway/task/:taskId', runwayTaskStatus);
app.delete('/api/runway/task/:taskId', runwayCancelTask);
app.get('/api/runway/organization', runwayOrganizationInfo);

app.post('/api/flux/create', optionalAuth, fluxCreate);
app.get('/api/flux/poll', optionalAuth, fluxPoll);

// Photoshoot routes - all with optional authentication to auto-inject userId
app.post('/api/photoshoot/models', optionalAuth, generateModels);
app.post('/api/photoshoot/pose', optionalAuth, generatePose);
app.post('/api/photoshoot/background', optionalAuth, generateBackground);
app.post('/api/photoshoot/shoot', optionalAuth, generatePhotoshoot);
app.post('/api/photoshoot/final', optionalAuth, generateFinalPhoto);
app.post('/api/photoshoot/chat', requireAuth, chatQuery);

app.post('/api/photoshoot/avatar', optionalAuth, (req: Request, res: Response): void => {
  console.log('🎯 Avatar generation endpoint hit');
  console.log('👤 User:', req.user?.userId || 'anonymous');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  generateAvatar(req, res);
});

app.post('/api/photoshoot/add-accessories', optionalAuth, (req: Request, res: Response): void => {
  console.log('🎯 Add accessories endpoint hit');
  console.log('👤 User:', req.user?.userId || 'anonymous');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  addAccessories(req, res);
});

app.post('/api/photoshoot/tryon', optionalAuth, (req: Request, res: Response): void => {
  console.log('🎯 Try-on endpoint hit');
  console.log('👤 User:', req.user?.userId || 'anonymous');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  tryOn(req, res);
});

app.post('/api/photoshoot/pose-transfer', optionalAuth, (req: Request, res: Response): void => {
  console.log('🎯 Pose transfer endpoint hit');
  console.log('👤 User:', req.user?.userId || 'anonymous');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  generatePoseTransfer(req, res);
});

app.get('/api/files/health', fileServiceHealthHandler);

app.get('/api/debug/files', async (req: Request, res: Response): Promise<void> => {
  try {
    const files = await listFilesHandler;
    const { listFiles } = require('./services/gridfs.service');
    const allFiles = await listFiles();
    res.json({
      count: allFiles.length,
      files: allFiles.map((f: any) => ({
        _id: f._id.toString(),
        filename: f.filename,
        length: f.length,
        uploadDate: f.uploadDate,
        contentType: f.contentType
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to list files', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/debug/token', (req: Request, res: Response): void => {
  const { token } = req.query;
  
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token required' });
    return;
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    res.json({ decoded, token });
  } catch (error) {
    res.status(400).json({ 
      error: 'Invalid token', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/files/:id/debug', (req: Request, res: Response): void => {
  res.json({
    params: req.params,
    query: req.query,
    url: req.url,
    originalUrl: req.originalUrl,
    method: req.method
  });
});

app.post('/api/upload', simpleUpload.single('file'), simpleUploadHandler);

app.post('/api/files/upload', optionalAuth, upload.single('file'), uploadFileHandler);
app.get('/api/files', optionalAuth, listFilesHandler);
app.post('/api/files/:fileId/signed-url', optionalAuth, generateSignedUrlHandler);
app.get('/api/files/:fileId/info', optionalAuth, getFileInfoHandler);
app.delete('/api/files/:fileId', optionalAuth, deleteFileHandler);

app.post('/api/files/bulk-delete', optionalAuth, bulkDeleteFilesHandler);
app.post('/api/files/delete-by-filter', optionalAuth, deleteFilesByFilterHandler);

app.get('/api/files/:id/download', validateFileAccess, downloadFileHandler);
app.get('/api/files/:id/metadata', validateFileAccess, getFileMetadataHandler);
app.get('/api/files/:id', validateFileAccess, streamFileHandler);

app.use('*', (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went REALLY WRONG'
  });
});

async function startServer() {
  try {
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🔍 Health check: http://localhost:${PORT}/health`);
      console.log(`🗄️  MongoDB connected successfully`);
      console.log(`🌍 CORS enabled for localhost:3000 and localhost:3001`);
    });

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