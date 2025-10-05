import { Request, Response } from 'express';
import multer from 'multer';
import { uploadFile, getFileInfo, deleteFile, listFiles } from './gridfs.service';
import { generateSignedUrl, generateSignedUrlWithPermissions, generateUserSignedUrl } from './signed-url.service';
import { connectToDatabase } from './database';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common image types
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Upload a file and return file info with signed URL
 */
export const uploadFileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: 'No file provided',
        message: 'Please upload a file'
      });
      return;
    }

    const { originalname, buffer, mimetype } = req.file;
    const { userId, metadata } = req.body;

    // Ensure database connection is established (important for serverless environments)
    console.log('🔌 Ensuring database connection...');
    await connectToDatabase();
    console.log('✅ Database connection confirmed');

    // Create a readable stream from buffer
    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Upload to GridFS
    const uploadResult = await uploadFile(stream, originalname, {
      contentType: mimetype,
      metadata: {
        ...metadata,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString()
      }
    });

    // Generate signed URL
    const signedUrl = generateSignedUrl(uploadResult.fileId, {
      userId,
      metadata: uploadResult
    });

    res.status(201).json({
      success: true,
      file: {
        id: uploadResult.fileId,
        filename: uploadResult.filename,
        size: uploadResult.size,
        contentType: uploadResult.contentType,
        signedUrl: signedUrl
      },
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * Generate a signed URL for an existing file
 */
export const generateSignedUrlHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;
    const { userId, permissions, expiry, metadata } = req.body;

    // Ensure database connection is established
    await connectToDatabase();

    // Check if file exists
    const fileInfo = await getFileInfo(fileId);
    if (!fileInfo) {
      res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist'
      });
      return;
    }

    // Generate signed URL based on parameters
    let signedUrl: string;
    
    if (userId) {
      signedUrl = generateUserSignedUrl(fileId, userId, {
        permissions: permissions ? permissions.split(',') : ['read'],
        expiry,
        metadata
      });
    } else if (permissions) {
      signedUrl = generateSignedUrlWithPermissions(fileId, permissions.split(','), {
        userId,
        expiry,
        metadata
      });
    } else {
      signedUrl = generateSignedUrl(fileId, {
        userId,
        permissions: ['read'],
        expiry,
        metadata
      });
    }

    res.json({
      success: true,
      fileId: fileId,
      signedUrl: signedUrl,
      expiresIn: expiry || '5m',
      permissions: permissions ? permissions.split(',') : ['read']
    });

  } catch (error) {
    console.error('Signed URL generation error:', error);
    res.status(500).json({
      error: 'Failed to generate signed URL',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * Get file information
 */
export const getFileInfoHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;
    
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
        metadata: fileInfo.metadata
      }
    });

  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({
      error: 'Failed to get file info',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * Delete a file
 */
export const deleteFileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;
    
    // Ensure database connection is established
    await connectToDatabase();
    
    const success = await deleteFile(fileId);
    if (!success) {
      res.status(404).json({
        error: 'File not found or deletion failed',
        message: 'The requested file does not exist or could not be deleted'
      });
      return;
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      error: 'Failed to delete file',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * List files with optional filtering
 */
export const listFilesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, limit = 50, skip = 0 } = req.query;
    
    // Ensure database connection is established
    await connectToDatabase();
    
    let filter: any = {};
    if (userId) {
      filter['metadata.uploadedBy'] = userId;
    }

    const files = await listFiles(filter);
    const paginatedFiles = files.slice(Number(skip), Number(skip) + Number(limit));

    res.json({
      success: true,
      files: paginatedFiles.map(file => ({
        id: file._id,
        filename: file.filename,
        size: file.length,
        contentType: file.contentType,
        uploadDate: file.uploadDate,
        metadata: file.metadata
      })),
      total: files.length,
      limit: Number(limit),
      skip: Number(skip)
    });

  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      error: 'Failed to list files',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

// Export multer middleware for use in routes
export { upload };
