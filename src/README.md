# VPS-BE Source Code Structure

This document outlines the organized folder structure of the Virtual Photoshoot Backend (VPS-BE) project.

## 📁 Folder Organization

### `/config/`
Configuration files and database setup
- `database.ts` - MongoDB connection and database configuration

### `/connectors/`
External API connectors and integrations
- `flux.connector.ts` - FLUX AI image generation service connector
- `gemini.connector.ts` - Google Gemini AI service connector
- `runway.connector.ts` - Runway ML AI service connector

### `/controllers/`
Express route handlers and API endpoints
- `database.controller.ts` - Database management endpoints
- `file-stream.controller.ts` - File streaming and download endpoints
- `file.controller.ts` - File upload and management endpoints
- `photoshoot.controller.ts` - Main photoshoot generation endpoints
- `upload.controller.ts` - Simple file upload endpoints

### `/middleware/`
Express middleware functions
- `auth.middleware.ts` - Authentication and authorization middleware

### `/services/`
Business logic and data services
- `database.service.ts` - Database operations and data management
- `gridfs.service.ts` - MongoDB GridFS file storage operations
- `image-storage.helper.ts` - Image processing and storage utilities
- `signed-url.service.ts` - JWT-based signed URL generation and validation

### `/types/`
TypeScript type definitions and schemas
- `schemas.ts` - Database schemas and TypeScript interfaces

### `/utils/`
Utility functions and helper modules
- `gemini.ts` - Gemini AI utility functions
- `routes.ts` - Route definitions and handlers

## 🏗️ Architecture Benefits

### **Separation of Concerns**
- **Controllers**: Handle HTTP requests/responses and route logic
- **Services**: Contain business logic and data operations
- **Connectors**: Manage external API integrations
- **Middleware**: Handle cross-cutting concerns like authentication
- **Types**: Centralized type definitions for better maintainability

### **Scalability**
- Easy to add new controllers for additional features
- Services can be easily extended or replaced
- Clear boundaries between different layers
- Modular design supports team collaboration

### **Maintainability**
- Related files are grouped together
- Clear import paths make dependencies obvious
- Easy to locate specific functionality
- Reduces cognitive load when navigating the codebase

## 🔄 Import Paths

All import paths have been updated to reflect the new structure:

```typescript
// Before
import { DatabaseService } from './database.service';

// After
import { DatabaseService } from '../services/database.service';
```

## 📋 File Responsibilities

### **Controllers** (`/controllers/`)
- Handle HTTP requests and responses
- Validate input parameters
- Call appropriate services
- Return formatted responses

### **Services** (`/services/`)
- Implement business logic
- Handle data operations
- Manage external service integrations
- Provide reusable functionality

### **Connectors** (`/connectors/`)
- Abstract external API calls
- Handle API-specific error handling
- Provide consistent interfaces
- Manage API rate limiting and retries

### **Middleware** (`/middleware/`)
- Authentication and authorization
- Request validation
- Error handling
- Logging and monitoring

### **Types** (`/types/`)
- Database schemas
- API request/response interfaces
- Shared type definitions
- Enum definitions

### **Utils** (`/utils/`)
- Helper functions
- Common utilities
- Route definitions
- Shared constants

## 🚀 Getting Started

The main entry point remains `index.ts` in the root of the `/src` directory. All import paths have been updated to work with the new folder structure.

To add new functionality:
1. **New API endpoint**: Add controller in `/controllers/`
2. **New business logic**: Add service in `/services/`
3. **New external API**: Add connector in `/connectors/`
4. **New middleware**: Add to `/middleware/`
5. **New types**: Add to `/types/`

This structure provides a clean, maintainable, and scalable foundation for the VPS-BE project.
