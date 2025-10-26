import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '5m'; 
const BASE_URL = process.env.BASE_URL || 'https://vps-be.vercel.app';

export interface SignedUrlPayload {
  fileId: string;
  userId?: string;
  permissions?: string[];
  metadata?: any;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: SignedUrlPayload;
  error?: string;
}

export function generateSignedUrl(
  fileId: string,
  options?: {
    userId?: string;
    permissions?: string[];
    metadata?: any;
    expiry?: string;
  }
): string {
  const payload: SignedUrlPayload = {
    fileId,
    userId: options?.userId,
    permissions: options?.permissions || ['read'],
    metadata: options?.metadata
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: options?.expiry || JWT_EXPIRY
  } as jwt.SignOptions);

  return `${BASE_URL}/api/files/${fileId}?token=${token}`;
}

export function validateToken(token: string): TokenValidationResult {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SignedUrlPayload;
    return {
      valid: true,
      payload: decoded
    };
  } catch (error) {
    let errorMessage = 'Invalid token';
    
    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token has expired';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Invalid token format';
    }
    
    return {
      valid: false,
      error: errorMessage
    };
  }
}

export function validateFileAccess(req: Request, res: Response, next: any): void {
  console.log('🔍 validateFileAccess: MIDDLEWARE CALLED');
  const { token } = req.query;
  console.log('🔍 validateFileAccess: Request params:', req.params);
  console.log('🔍 validateFileAccess: Request query:', req.query);
  
  if (!token || typeof token !== 'string') {
    res.status(401).json({
      error: 'Access token required',
      message: 'Please provide a valid token in the query parameters'
    });
    return;
  }

  const validation = validateToken(token);
  
  if (!validation.valid) {
    res.status(401).json({
      error: 'Invalid or expired token',
      message: validation.error
    });
    return;
  }

  const requestedFileId = req.params.id || req.params.fileId;
  
  console.log('🔍 Requested file ID:', requestedFileId);
  console.log('🔍 Token file ID:', validation.payload?.fileId);
  
  if (!requestedFileId) {
    res.status(400).json({
      error: 'Missing file ID',
      message: 'File ID not found in request parameters'
    });
    return;
  }

  if (validation.payload?.fileId !== requestedFileId) {
    res.status(403).json({
      error: 'Token file mismatch',
      message: `Token is not valid for the requested file. Token: ${validation.payload?.fileId}, Requested: ${requestedFileId}`
    });
    return;
  }

  req.fileAccess = validation.payload;
  console.log('🔍 validateFileAccess: About to call next(), params:', req.params);
  next();
}

export function generateSignedUrlWithPermissions(
  fileId: string,
  permissions: string[],
  options?: {
    userId?: string;
    metadata?: any;
    expiry?: string;
  }
): string {
  return generateSignedUrl(fileId, {
    ...options,
    permissions
  });
}

export function generateUserSignedUrl(
  fileId: string,
  userId: string,
  options?: {
    permissions?: string[];
    metadata?: any;
    expiry?: string;
  }
): string {
  return generateSignedUrl(fileId, {
    ...options,
    userId
  });
}

declare global {
  namespace Express {
    interface Request {
      fileAccess?: SignedUrlPayload;
    }
  }
}
