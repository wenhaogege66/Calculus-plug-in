# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI微积分助教 (AI Calculus Assistant) - A Chrome extension built with Plasmo framework for intelligent calculus homework grading. The system provides OCR recognition using MyScript API and AI grading using Deepseek API, supporting both student practice mode and homework mode with teacher-student role management.

## Architecture

### Frontend (Chrome Extension)
- **Framework**: Plasmo + React 18 + TypeScript
- **Authentication**: GitHub OAuth via Supabase
- **State Management**: React Hooks + Chrome Storage API
- **Entry Points**: `popup.tsx` (main interface), `sidepanel.tsx` (detailed view), `background.ts` (service worker)

### Backend (API Server)
- **Framework**: Fastify + TypeScript
- **Database**: Supabase PostgreSQL with Prisma ORM
- **Authentication**: Supabase built-in OAuth with GitHub Provider
- **File Storage**: Supabase Storage (S3-like) for assignments, questions, and graded files
- **AI Services**: MyScript (handwriting OCR) + Deepseek (scoring, future: grading/annotation)

### Database Schema (Prisma)
Key models: `User`, `FileUpload`, `Submission`, `MyScriptResult`, `DeepseekResult`, `Classroom`, `Assignment`
- Supports both GitHub OAuth and local authentication
- Role-based access (STUDENT/TEACHER)
- Submission tracking with status management
- Classroom and assignment management for teachers

## Development Commands

### Frontend (Plasmo Extension)
```bash
pnpm dev          # Development mode with hot reload
pnpm build        # Production build for Chrome
pnpm build:firefox # Firefox build
pnpm package      # Package extension
```

### Backend (Fastify + Prisma)
```bash
npm run dev           # Development server with auto-restart
npm run build         # TypeScript compilation
npm run start         # Production server
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run database migrations
npm run db:push       # Push schema changes
npm run db:reset      # Reset database (dev only)
npm run db:studio     # Open Prisma Studio
npm run lint          # ESLint
npm run format        # Prettier formatting
```

### Workspace Management
```bash
pnpm install      # Install all dependencies (root + backend)
cd backend && npm install  # Backend only
```

## Supabase Configuration

### Database Setup
Project uses fresh Supabase instance with empty schema. Database migrations via Prisma will create all necessary tables.

### Storage Buckets
Required Supabase Storage buckets (create manually in Supabase Dashboard):
- `assignments` - Student submissions (PDF/images)
- `questions` - Teacher uploaded question files  
- `annotated` - AI-processed files with grading annotations
- `avatars` - User profile images

### Authentication
Uses Supabase built-in GitHub OAuth provider (no custom JWT implementation needed).

## Key Configuration

### Environment Variables
Backend requires:
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (e.g., https://yourproject.supabase.co)
- `SUPABASE_ANON_KEY` - Supabase anonymous key  
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)
- `DEEPSEEK_API_KEY` - AI scoring service
- `MYSCRIPT_APPLICATION_KEY` - MyScript app key
- `MYSCRIPT_HMAC_KEY` - MyScript HMAC key

Frontend (Plasmo) requires:
- `PLASMO_PUBLIC_SUPABASE_URL` - Same as backend SUPABASE_URL
- `PLASMO_PUBLIC_SUPABASE_ANON_KEY` - Same as backend SUPABASE_ANON_KEY
- `PLASMO_PUBLIC_API_BASE_URL` - Backend API endpoint (default: http://localhost:3000/api)

Note: Storage endpoints are handled automatically by Supabase client - no additional configuration needed.

### Database Workflow
1. Modify `backend/prisma/schema.prisma`
2. Run `npm run db:migrate` to create migration
3. Run `npm run db:generate` to update Prisma client

### Chrome Extension Loading
1. Build with `pnpm build`
2. Load `build/chrome-mv3-prod` in Chrome Developer Mode

## Important Files and Locations

### Core Components
- `src/popup.tsx` - Main popup interface with login and mode selection
- `src/components/AuthSection.tsx` - GitHub OAuth authentication
- `src/components/TeacherSection.tsx` - Teacher-specific functionality
- `backend/src/app.ts` - Fastify server setup
- `backend/src/routes/` - API route handlers
- `backend/src/middleware/auth.ts` - JWT authentication middleware

### API Endpoints
- `/api/auth/github` - GitHub OAuth flow
- `/api/files` - File upload (multipart)
- `/api/submissions` - Submission management
- `/api/ocr/myscript` - OCR processing
- `/api/ai/deepseek/grade` - AI grading
- `/api/assignments` - Assignment management (teachers)
- `/api/classrooms` - Classroom management

### File Storage
- Test files available at `/Users/wenhao/XLab/Calculus/homework/test.pdf`
- Course materials in `/Users/wenhao/XLab/Calculus/book/` (PDF textbooks)
- Files stored in Supabase Storage buckets:
  - `assignments` - Student homework submissions
  - `questions` - Teacher uploaded question images
  - `annotated` - AI-graded files with annotations
  - `avatars` - User profile pictures

## Development Workflow

### Adding New Features
1. Backend: Create route in `backend/src/routes/`
2. Database: Update Prisma schema if needed
3. Frontend: Add UI components and API calls
4. Ensure proper authentication middleware usage

### Testing API Endpoints
Use backend's built-in endpoints or Prisma Studio (`npm run db:studio`) for database inspection.

### AI Service Usage
**MyScript OCR:**
- Teachers: Upload and recognize handwritten questions from images
- Students: Convert handwritten homework solutions to text for AI processing

**DeepSeek AI:**
- Currently: Basic scoring of student submissions (0-100 points)
- Planned: Detailed grading, error annotation, learning suggestions, mistake analysis

### Working with Submissions
The system supports two modes:
- **Practice Mode** (`workMode: "practice"`) - Student uploads complete problems with solutions
- **Homework Mode** (`workMode: "homework"`) - Student uploads solutions, matched against assignment questions

## Key Constraints

- Uses pnpm workspace configuration
- Supabase for authentication and file storage
- MyScript API for handwriting OCR recognition
- No test files should be committed - delete after testing
- Follow existing TypeScript and React patterns
- Maintain Prisma migration history