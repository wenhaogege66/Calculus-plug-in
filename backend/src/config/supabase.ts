// Supabase配置和客户端实例

import { createClient } from '@supabase/supabase-js';

// 环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少Supabase环境变量配置');
}

// 公共客户端 - 用于前端和基本操作
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 管理员客户端 - 用于后端操作，绕过RLS
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// 数据库类型定义
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          username: string;
          email: string;
          password_hash?: string;
          auth_type: 'local' | 'github';
          github_id?: string;
          github_username?: string;
          avatar_url?: string;
          role: 'student' | 'teacher';
          profile: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          username: string;
          email: string;
          password_hash?: string;
          auth_type?: 'local' | 'github';
          github_id?: string;
          github_username?: string;
          avatar_url?: string;
          role?: 'student' | 'teacher';
          profile?: any;
        };
        Update: {
          username?: string;
          email?: string;
          password_hash?: string;
          auth_type?: 'local' | 'github';
          github_id?: string;
          github_username?: string;
          avatar_url?: string;
          role?: 'student' | 'teacher';
          profile?: any;
        };
      };
      file_uploads: {
        Row: {
          id: number;
          user_id: number;
          filename: string;
          original_name: string;
          file_path: string;
          mime_type: string;
          file_size: number;
          upload_type: string;
          metadata: any;
          created_at: string;
        };
        Insert: {
          user_id: number;
          filename: string;
          original_name: string;
          file_path: string;
          mime_type: string;
          file_size: number;
          upload_type?: string;
          metadata?: any;
        };
        Update: {
          user_id?: number;
          filename?: string;
          original_name?: string;
          file_path?: string;
          mime_type?: string;
          file_size?: number;
          upload_type?: string;
          metadata?: any;
        };
      };
      submissions: {
        Row: {
          id: number;
          user_id: number;
          file_upload_id: number;
          status: 'uploaded' | 'processing' | 'completed' | 'failed';
          submitted_at: string;
          completed_at?: string;
          metadata: any;
        };
        Insert: {
          user_id: number;
          file_upload_id: number;
          status?: 'uploaded' | 'processing' | 'completed' | 'failed';
          metadata?: any;
        };
        Update: {
          user_id?: number;
          file_upload_id?: number;
          status?: 'uploaded' | 'processing' | 'completed' | 'failed';
          completed_at?: string;
          metadata?: any;
        };
      };
      myscript_results: {
        Row: {
          id: number;
          submission_id: number;
          recognized_text?: string;
          confidence_score?: number;
          processing_time?: number;
          raw_result?: any;
          created_at: string;
        };
        Insert: {
          submission_id: number;
          recognized_text?: string;
          confidence_score?: number;
          processing_time?: number;
          raw_result?: any;
        };
        Update: {
          submission_id?: number;
          recognized_text?: string;
          confidence_score?: number;
          processing_time?: number;
          raw_result?: any;
        };
      };
      deepseek_results: {
        Row: {
          id: number;
          submission_id: number;
          score?: number;
          max_score: number;
          feedback?: string;
          errors: any;
          suggestions: any;
          strengths: any;
          processing_time?: number;
          raw_result?: any;
          created_at: string;
        };
        Insert: {
          submission_id: number;
          score?: number;
          max_score?: number;
          feedback?: string;
          errors?: any;
          suggestions?: any;
          strengths?: any;
          processing_time?: number;
          raw_result?: any;
        };
        Update: {
          submission_id?: number;
          score?: number;
          max_score?: number;
          feedback?: string;
          errors?: any;
          suggestions?: any;
          strengths?: any;
          processing_time?: number;
          raw_result?: any;
        };
      };
    };
  };
}

// Storage bucket名称
export const STORAGE_BUCKETS = {
  ASSIGNMENTS: 'assignments',  // 作业文件
  AVATARS: 'avatars',         // 用户头像
  ANNOTATED: 'annotated'      // 批改后的文件
} as const; 