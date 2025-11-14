import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import { DatabaseService } from '../services/database.service';
import { generateAuthToken } from '../middleware/auth.middleware';
import { User } from '../types/schemas';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '830525870730-26k9e3g8clnkhrh6oi9en1rg55i69d4h.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const dbService = new DatabaseService();

// ============================================
// Username/Password Authentication
// ============================================

export const registerWithPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required'
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
      return;
    }

    // Check if user already exists
    const existingUser = await dbService.getUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = await dbService.createUser({
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      password: hashedPassword,
      authProvider: 'local',
      emailVerified: false,
      usage: {
        totalGenerations: 0,
        totalImages: 0,
        lastActive: new Date()
      },
      
    });

    // Generate token
    const token = generateAuthToken({
      userId: userId.toString(),
      email: email.toLowerCase(),
      role: 'user',
      permissions: []
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: userId.toString(),
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

export const loginWithPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required'
      });
      return;
    }

    // Find user
    const user = await dbService.getUserByEmail(email);
    if (!user) {
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
      return;
    }

    // Check if user has password (might be Google-only user)
    if (!user.password) {
      res.status(401).json({
        error: 'Invalid login method',
        message: 'This account uses Google Sign-In. Please use Google to login.'
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
      return;
    }

    // Update last login
    await dbService.updateUserLastLogin(user._id!);

    // Generate token
    const token = generateAuthToken({
      userId: user._id!.toString(),
      email: user.email,
      role: 'user',
      permissions: []
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user._id!.toString(),
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// ============================================
// Google OAuth Authentication
// ============================================

export const loginWithGoogle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({
        error: 'Missing ID token',
        message: 'Google ID token is required'
      });
      return;
    }

    // Verify Google token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      res.status(401).json({
        error: 'Invalid Google token',
        message: 'The provided Google ID token is invalid or expired'
      });
      return;
    }

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(401).json({
        error: 'Invalid token payload',
        message: 'Unable to extract user information from Google token'
      });
      return;
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      res.status(400).json({
        error: 'Missing email',
        message: 'Email not provided by Google'
      });
      return;
    }

    // Check if user exists
    let user = await dbService.getUserByGoogleId(googleId);

    if (!user) {
      // Check if email exists with different provider
      user = await dbService.getUserByEmail(email);

      if (user) {
        // Link Google account to existing user
        await dbService.linkGoogleAccount(user._id!, googleId, picture);
        user = await dbService.getUserById(user._id!);
      } else {
        // Create new user
        const userId = await dbService.createUser({
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          googleId,
          profilePicture: picture,
          authProvider: 'google',
          emailVerified: true, // Google emails are pre-verified
          usage: {
            totalGenerations: 0,
            totalImages: 0,
            lastActive: new Date()
          }
        });

        user = await dbService.getUserById(userId);
      }
    }

    if (!user) {
      res.status(500).json({
        error: 'User creation failed',
        message: 'Failed to create or retrieve user'
      });
      return;
    }

    // Update last login
    await dbService.updateUserLastLogin(user._id!);

    // Generate token
    const token = generateAuthToken({
      userId: user._id!.toString(),
      email: user.email,
      role: 'user',
      permissions: []
    });

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      data: {
        userId: user._id!.toString(),
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        token
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      error: 'Google login failed',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// ============================================
// User Profile & Management
// ============================================

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Not authenticated',
        message: 'User must be authenticated to access this resource'
      });
      return;
    }

    const user = await dbService.getUserById(new ObjectId(req.user.userId));
    
    if (!user) {
      res.status(404).json({
        error: 'User not found',
        message: 'The authenticated user could not be found'
      });
      return;
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Not authenticated',
        message: 'User must be authenticated to access this resource'
      });
      return;
    }

    const { name, preferences } = req.body;
    const userId = new ObjectId(req.user.userId);

    const updates: Partial<User> = {};
    if (name !== undefined) updates.name = name;
    if (preferences !== undefined) updates.preferences = preferences;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        error: 'No updates provided',
        message: 'Please provide fields to update'
      });
      return;
    }

    await dbService.updateUser(userId, updates);
    const updatedUser = await dbService.getUserById(userId);

    if (!updatedUser) {
      res.status(404).json({
        error: 'User not found',
        message: 'The authenticated user could not be found'
      });
      return;
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Not authenticated',
        message: 'User must be authenticated to access this resource'
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        error: 'Missing required fields',
        message: 'Current password and new password are required'
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        error: 'Invalid password',
        message: 'New password must be at least 8 characters long'
      });
      return;
    }

    const userId = new ObjectId(req.user.userId);
    const user = await dbService.getUserById(userId);

    if (!user) {
      res.status(404).json({
        error: 'User not found',
        message: 'The authenticated user could not be found'
      });
      return;
    }

    if (!user.password) {
      res.status(400).json({
        error: 'Password not set',
        message: 'This account uses Google Sign-In and does not have a password'
      });
      return;
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Invalid password',
        message: 'Current password is incorrect'
      });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbService.updateUser(userId, { password: hashedPassword });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Not authenticated',
        message: 'User must be authenticated to access this resource'
      });
      return;
    }

    const userId = new ObjectId(req.user.userId);
    await dbService.deleteUser(userId);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

