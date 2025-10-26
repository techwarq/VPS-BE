import { Request, Response } from 'express';
import { Readable } from 'stream';
import { uploadFile } from '../services/gridfs.service';
import { generateSignedUrl } from '../services/signed-url.service';
import { connectToDatabase } from '../config/database';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, 
  },
  fileFilter: (req, file, cb) => {
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

    console.log('🔌 Ensuring database connection...');
    await connectToDatabase();
    console.log('✅ Database connection confirmed');

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

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

export { upload };
