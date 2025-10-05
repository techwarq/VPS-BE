import { Request, Response } from 'express';
import { Readable } from 'stream';
import { uploadFile } from './gridfs.service';
import { generateSignedUrl } from './signed-url.service';
import { connectToDatabase } from './database';
import multer from 'multer';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all image types
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|bmp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp, svg, bmp)'));
    }
  }
});

/**
 * Simple upload endpoint that returns a signed URL
 */
export const simpleUploadHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file provided',
        message: 'Please upload a file using the "file" field in form-data'
      });
      return;
    }

    const { originalname, buffer, mimetype } = req.file;
    const userId = req.body.userId || 'anonymous';
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    const expiry = req.body.expiry || '24h';

    console.log('📤 Upload request received:', {
      filename: originalname,
      size: buffer.length,
      mimetype: mimetype,
      userId: userId
    });

    // Ensure database connection is established (important for serverless environments)
    console.log('🔌 Ensuring database connection...');
    await connectToDatabase();
    console.log('✅ Database connection confirmed');

    // Create a readable stream from buffer
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    // Upload to GridFS
    const uploadResult = await uploadFile(stream, originalname, {
      contentType: mimetype,
      metadata: {
        ...metadata,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        source: 'direct-upload'
      }
    });

    console.log('✅ File uploaded successfully:', uploadResult.fileId);

    // Generate signed URL
    const signedUrl = generateSignedUrl(uploadResult.fileId, {
      userId,
      metadata: uploadResult,
      expiry: expiry
    });

    console.log('🔗 Signed URL generated:', signedUrl);

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        fileId: uploadResult.fileId,
        filename: uploadResult.filename,
        size: uploadResult.size,
        contentType: uploadResult.contentType,
        signedUrl: signedUrl,
        expiresIn: expiry
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

// Export multer middleware
export { upload };
