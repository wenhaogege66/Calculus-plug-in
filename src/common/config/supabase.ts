// 前端Supabase配置

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PLASMO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少Supabase环境变量配置');
}

// 创建Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// API Base URL
export const API_BASE_URL = process.env.PLASMO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';

// 用户类型定义
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'student' | 'teacher';
  authType: 'local' | 'github';
  githubId?: string;
  githubUsername?: string;
  avatarUrl?: string;
}

// 认证状态
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
} 