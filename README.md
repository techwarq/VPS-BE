# Node.js TypeScript Express Project

A modern Node.js API built with TypeScript and Express.js.

## Features

- ⚡ **TypeScript** - Type-safe JavaScript
- 🚀 **Express.js** - Fast, unopinionated web framework
- 🔄 **Hot Reload** - Development with nodemon
- 📦 **Modern ES2020** - Latest JavaScript features
- 🛡️ **Error Handling** - Comprehensive error handling
- 📝 **API Documentation** - Built-in API examples

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gemini-test
```

2. Install dependencies:
```bash
npm install
```

## Development

### Start Development Server
```bash
npm run dev
```
This starts the server with hot reload using `ts-node`.

### Start with Watch Mode
```bash
npm run watch
```
This starts the server with nodemon for automatic restarts on file changes.

### Build for Production
```bash
npm run build
```
This compiles TypeScript to JavaScript in the `dist/` folder.

### Start Production Server
```bash
npm start
```
This runs the compiled JavaScript from the `dist/` folder.

## API Endpoints

### Base URL
- **Development**: `http://localhost:3000`
- **Production**: Set via `PORT` environment variable

### Available Routes

#### GET `/`
Welcome message and server info
```bash
curl http://localhost:3000/
```

#### GET `/health`
Health check endpoint
```bash
curl http://localhost:3000/health
```

#### GET `/api/hello`
Greeting endpoint with optional name parameter
```bash
curl http://localhost:3000/api/hello
curl http://localhost:3000/api/hello?name=YourName
```

#### POST `/api/data`
Data submission endpoint
```bash
curl -X POST http://localhost:3000/api/data \
  -H "Content-Type: application/json" \
  -d '{"data": "Hello World"}'
```

## Project Structure

```
gemini-test/
├── src/
│   └── index.ts          # Main application file
├── dist/                 # Compiled JavaScript (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── nodemon.json          # Nodemon configuration
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## Scripts

- `npm run dev` - Start development server
- `npm run watch` - Start with file watching
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run clean` - Clean build directory

## TypeScript Configuration

The project uses strict TypeScript configuration with:
- ES2020 target
- CommonJS modules
- Strict type checking
- Source maps for debugging
- Path mapping for clean imports

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
# VPS-BE
