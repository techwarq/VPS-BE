import { Request, Response } from 'express';
import multer from 'multer';
import { uploadFile, getFileInfo, deleteFile, listFiles } from '../services/gridfs.service';
import { generateSignedUrl, generateSignedUrlWithPermissions, generateUserSignedUrl } from '../services/signed-url.service';
import { connectToDatabase } from '../config/database';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
  fileFilter: (req, file, cb) => {
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

    console.log('🔌 Ensuring database connection...');
    await connectToDatabase();
    console.log('✅ Database connection confirmed');

    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const uploadResult = await uploadFile(stream, originalname, {
      contentType: mimetype,
      metadata: {
        ...metadata,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString()
      }
    });

    const signedUrl = generateSignedUrl(uploadResult.fileId, {
      userId,
      metadata: uploadResult,
      req
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

export const generateSignedUrlHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;
    const { userId, permissions, expiry, metadata } = req.body;

    await connectToDatabase();

    const fileInfo = await getFileInfo(fileId);
    if (!fileInfo) {
      res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist'
      });
      return;
    }

    let signedUrl: string;
    
    if (userId) {
      signedUrl = generateUserSignedUrl(fileId, userId, {
        permissions: permissions ? permissions.split(',') : ['read'],
        expiry,
        metadata,
        req
      });
    } else if (permissions) {
      signedUrl = generateSignedUrlWithPermissions(fileId, permissions.split(','), {
        userId,
        expiry,
        metadata,
        req
      });
    } else {
      signedUrl = generateSignedUrl(fileId, {
        userId,
        permissions: ['read'],
        expiry,
        metadata,
        req
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

export const getFileInfoHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;
    
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

export const deleteFileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;
    
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

export const listFilesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, type, limit = 50, skip = 0 } = req.query;
    
    await connectToDatabase();
    
    let filter: any = {};
    if (userId) {
      filter['metadata.uploadedBy'] = userId;
    }
    if (type) {
      filter['metadata.type'] = type;
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

export const bulkDeleteFilesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileIds } = req.body;
    
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'fileIds must be a non-empty array'
      });
      return;
    }

    await connectToDatabase();
    
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const fileId of fileIds) {
      try {
        const success = await deleteFile(fileId);
        if (success) {
          successCount++;
          results.push({ fileId, status: 'deleted' });
        } else {
          failCount++;
          results.push({ fileId, status: 'not_found' });
        }
      } catch (error) {
        failCount++;
        results.push({ 
          fileId, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk delete completed: ${successCount} deleted, ${failCount} failed`,
      results: {
        total: fileIds.length,
        deleted: successCount,
        failed: failCount,
        details: results
      }
    });

  } catch (error) {
    console.error('Bulk delete files error:', error);
    res.status(500).json({
      error: 'Failed to bulk delete files',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const deleteFilesByFilterHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, type, olderThan, limit = 100 } = req.body;
    
    await connectToDatabase();
    
    let filter: any = {};
    if (userId) {
      filter['metadata.uploadedBy'] = userId;
    }
    if (type) {
      filter['metadata.type'] = type;
    }
    if (olderThan) {
      const cutoffDate = new Date(olderThan);
      filter['uploadDate'] = { $lt: cutoffDate };
    }

    const files = await listFiles(filter);
    const filesToDelete = files.slice(0, Number(limit));

    if (filesToDelete.length === 0) {
      res.json({
        success: true,
        message: 'No files found matching the criteria',
        results: {
          total: 0,
          deleted: 0,
          failed: 0
        }
      });
      return;
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const file of filesToDelete) {
      try {
        const success = await deleteFile(file._id.toString());
        if (success) {
          successCount++;
          results.push({ 
            fileId: file._id.toString(), 
            filename: file.filename,
            size: file.length,
            status: 'deleted' 
          });
        } else {
          failCount++;
          results.push({ 
            fileId: file._id.toString(), 
            filename: file.filename,
            status: 'delete_failed' 
          });
        }
      } catch (error) {
        failCount++;
        results.push({ 
          fileId: file._id.toString(), 
          filename: file.filename,
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    res.json({
      success: true,
      message: `Filtered delete completed: ${successCount} deleted, ${failCount} failed`,
      filter: filter,
      results: {
        total: filesToDelete.length,
        deleted: successCount,
        failed: failCount,
        details: results
      }
    });

  } catch (error) {
    console.error('Delete files by filter error:', error);
    res.status(500).json({
      error: 'Failed to delete files by filter',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export { upload };
