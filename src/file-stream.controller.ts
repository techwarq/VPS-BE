import { Request, Response } from 'express';
import { downloadFile, getFileInfo } from './gridfs.service';
import { validateFileAccess } from './signed-url.service';
import { connectToDatabase } from './database';

/**
 * Stream a file with token validation
 * This is the main endpoint that serves files with signed URLs
 */
export const streamFileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: fileId } = req.params;
    console.log('🔍 StreamFileHandler: Looking for file ID:', fileId);
    console.log('🔍 StreamFileHandler: req.params:', req.params);
    
    // Ensure database connection is established
    await connectToDatabase();
    
    // Get file information first
    const fileInfo = await getFileInfo(fileId);
    console.log('📄 StreamFileHandler: File info result:', fileInfo ? 'FOUND' : 'NOT FOUND');
    
    if (!fileInfo) {
      console.log('❌ StreamFileHandler: File not found for ID:', fileId);
      
      // List all files to help debug
      try {
        const { listFiles } = require('./gridfs.service');
        const allFiles = await listFiles();
        console.log('❌ File not found. Available files:', 
          allFiles.map((f: any) => f._id.toString())
        );
        
        res.status(404).json({
          error: 'File not found',
          message: 'The requested file does not exist',
          requestedId: fileId,
          availableFiles: allFiles.slice(0, 10).map((f: any) => ({
            id: f._id.toString(),
            filename: f.filename
          }))
        });
      } catch (listError) {
        res.status(404).json({
          error: 'File not found',
          message: 'The requested file does not exist',
          requestedId: fileId
        });
      }
      return;
    }

    // Set appropriate headers
    res.set({
      'Content-Type': fileInfo.contentType || 'application/octet-stream',
      'Content-Length': fileInfo.length,
      'Content-Disposition': `inline; filename="${fileInfo.filename}"`,
      'Cache-Control': 'private, max-age=300', // 5 minutes cache
      'ETag': `"${fileInfo._id}"`
    });

    // Create download stream
    const downloadStream = await downloadFile(fileId);
    
    // Handle stream errors
    downloadStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Stream error',
          message: 'Failed to stream file'
        });
      }
    });

    // Pipe the stream to response
    downloadStream.pipe(res);

    // Log successful access
    console.log(`📁 File served: ${fileInfo.filename} (${fileInfo._id}) to user: ${req.fileAccess?.userId || 'anonymous'}`);

  } catch (error) {
    console.error('Stream file error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to stream file',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
};

/**
 * Download a file (forces download instead of inline display)
 */
export const downloadFileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: fileId } = req.params;
    
    // Ensure database connection is established
    await connectToDatabase();
    
    // Get file information first
    const fileInfo = await getFileInfo(fileId);
    if (!fileInfo) {
      res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist'
      });
      return;
    }

    // Set headers for download
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileInfo.length,
      'Content-Disposition': `attachment; filename="${fileInfo.filename}"`,
      'Cache-Control': 'private, max-age=300',
      'ETag': `"${fileInfo._id}"`
    });

    // Create download stream
    const downloadStream = await downloadFile(fileId);
    
    // Handle stream errors
    downloadStream.on('error', (error) => {
      console.error('Download stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Download error',
          message: 'Failed to download file'
        });
      }
    });

    // Pipe the stream to response
    downloadStream.pipe(res);

    // Log successful download
    console.log(`⬇️ File downloaded: ${fileInfo.filename} (${fileInfo._id}) by user: ${req.fileAccess?.userId || 'anonymous'}`);

  } catch (error) {
    console.error('Download file error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to download file',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
};

/**
 * Get file metadata without downloading the file
 */
export const getFileMetadataHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: fileId } = req.params;
    
    // Ensure database connection is established
    await connectToDatabase();
    
    const fileInfo = await getFileInfo(fileId);
    if (!fileInfo) {
      res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist'
      });
      return;
    }

    res.json({
      success: true,
      file: {
        id: fileInfo._id,
        filename: fileInfo.filename,
        size: fileInfo.length,
        contentType: fileInfo.contentType,
        uploadDate: fileInfo.uploadDate,
        metadata: fileInfo.metadata,
        // Don't include the actual file data
        hasFile: true
      }
    });

  } catch (error) {
    console.error('Get file metadata error:', error);
    res.status(500).json({
      error: 'Failed to get file metadata',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * Health check for file service
 */
export const fileServiceHealthHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    // Try to access GridFS bucket
    const { getGridFSBucket } = require('./gridfs.service');
    const bucket = getGridFSBucket();
    
    // Simple health check - try to list files with limit 1
    await bucket.find({}).limit(1).toArray();
    
    res.json({
      status: 'healthy',
      service: 'file-service',
      timestamp: new Date().toISOString(),
      message: 'File service is operational'
    });

  } catch (error) {
    console.error('File service health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'file-service',
      timestamp: new Date().toISOString(),
      error: 'File service is not operational',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
