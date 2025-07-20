// 共用类型定义

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'student' | 'teacher';
  avatar?: string;
  profile?: {
    school?: string;
    grade?: string;
    class?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FileUpload {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface MyScriptResult {
  id: string;
  text: string;
  mathml: string;
  latex: string;
  confidence: number;
  expressions: Array<{
    id: string;
    content: string;
    type: 'text' | 'math';
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  processedAt: string;
}

export interface DeepseekResult {
  id: string;
  score: number;
  maxScore: number;
  feedback: string;
  errors: Array<{
    id: string;
    type: 'calculation' | 'concept' | 'method' | 'format';
    description: string;
    suggestion: string;
    severity: 'low' | 'medium' | 'high';
    location?: {
      expressionId: string;
      position: number;
    };
  }>;
  suggestions: string[];
  strengths: string[];
  gradedAt: string;
}

export interface Submission {
  id: string;
  userId: string;
  fileUpload: FileUpload;
  myScriptResult?: MyScriptResult;
  deepseekResult?: DeepseekResult;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  submittedAt: string;
  completedAt?: string;
  metadata?: {
    subject?: string;
    chapter?: string;
    difficulty?: number;
    tags?: string[];
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BackgroundMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage: 'upload' | 'ocr' | 'grading' | 'saving';
  message: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'zh' | 'en';
  notifications: boolean;
  autoGrade: boolean;
  detailedFeedback: boolean;
}

// 教师端专用类型
export interface Class {
  id: string;
  name: string;
  teacherId: string;
  students: User[];
  subject: string;
  grade: string;
  createdAt: string;
}

export interface StudentAnalytics {
  studentId: string;
  totalSubmissions: number;
  averageScore: number;
  commonErrors: Array<{
    type: string;
    count: number;
    examples: string[];
  }>;
  progressTrend: Array<{
    date: string;
    score: number;
    submissionCount: number;
  }>;
  strengths: string[];
  weaknesses: string[];
}

export interface ClassAnalytics {
  classId: string;
  overallPerformance: {
    averageScore: number;
    totalSubmissions: number;
    activeStudents: number;
  };
  commonMistakes: Array<{
    type: string;
    frequency: number;
    affectedStudents: number;
    suggestions: string[];
  }>;
  topicDifficulty: Array<{
    topic: string;
    averageScore: number;
    submissionCount: number;
  }>;
} 