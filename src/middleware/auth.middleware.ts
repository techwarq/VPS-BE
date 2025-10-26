import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export interface AuthUser {
  userId: string;
  email?: string;
  role?: string;
  permissions?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7); 

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };
    next();
  } catch (error) {
    console.warn('Invalid token in optional auth:', error);
    next();
  }
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide a valid Authorization header with Bearer token'
    });
    return;
  }

  const token = authHeader.substring(7); 

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid or expired'
    });
  }
};

export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to access this resource'
      });
      return;
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `This resource requires one of the following roles: ${allowedRoles.join(', ')}`
      });
      return;
    }

    next();
  };
};

export const requirePermission = (permissions: string | string[]) => {
  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to access this resource'
      });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `This resource requires the following permissions: ${requiredPermissions.join(', ')}`
      });
      return;
    }

    next();
  };
};

export function generateAuthToken(user: AuthUser, expiresIn: string = '24h'): string {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    },
    JWT_SECRET,
    { expiresIn } as jwt.SignOptions
  );
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };
  } catch (error) {
    return null;
  }
}
