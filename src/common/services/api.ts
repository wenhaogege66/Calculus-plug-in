// 共用API服务

import { ApiResponse, User, Submission, FileUpload } from '../types';

export class ApiService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
  }

  // 设置API密钥
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  // 通用请求方法
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      console.error('API请求失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络请求失败',
      };
    }
  }

  // 用户相关API
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/me');
  }

  async login(email: string, password: string): Promise<ApiResponse<{token: string, user: User}>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    role: 'student' | 'teacher';
  }): Promise<ApiResponse<{token: string, user: User}>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // 文件上传API
  async uploadFile(file: File): Promise<ApiResponse<FileUpload>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseUrl}/files/upload`, {
        method: 'POST',
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || '文件上传失败',
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      console.error('文件上传失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '文件上传失败',
      };
    }
  }

  // 提交相关API
  async createSubmission(submissionData: {
    fileUploadId: string;
    metadata?: any;
  }): Promise<ApiResponse<Submission>> {
    return this.request<Submission>('/submissions', {
      method: 'POST',
      body: JSON.stringify(submissionData),
    });
  }

  async getSubmission(id: string): Promise<ApiResponse<Submission>> {
    return this.request<Submission>(`/submissions/${id}`);
  }

  async getSubmissions(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    userId?: string;
  }): Promise<ApiResponse<{submissions: Submission[], total: number}>> {
    let queryString = '';
    if (params) {
      const queryParts: string[] = [];
      for (const key in params) {
        if (params.hasOwnProperty(key)) {
          const value = (params as any)[key];
          if (value !== undefined) {
            queryParts.push(`${key}=${encodeURIComponent(String(value))}`);
          }
        }
      }
      queryString = queryParts.length > 0 ? '?' + queryParts.join('&') : '';
    }
    
    return this.request<{submissions: Submission[], total: number}>(`/submissions${queryString}`);
  }

  async updateSubmission(id: string, updates: Partial<Submission>): Promise<ApiResponse<Submission>> {
    return this.request<Submission>(`/submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // MyScript OCR API
  async processWithMyScript(fileUploadId: string): Promise<ApiResponse<any>> {
    return this.request('/ocr/myscript', {
      method: 'POST',
      body: JSON.stringify({ fileUploadId }),
    });
  }

  // Deepseek AI API
  async processWithDeepseek(data: {
    recognizedContent: string;
    originalFileId: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/ai/deepseek/grade', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // RAG相关API（预留）
  async searchKnowledge(query: string): Promise<ApiResponse<any>> {
    return this.request('/rag/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async askQuestion(question: string, context?: string): Promise<ApiResponse<any>> {
    return this.request('/rag/ask', {
      method: 'POST',
      body: JSON.stringify({ question, context }),
    });
  }

  // 健康检查
  async healthCheck(): Promise<ApiResponse<{status: string}>> {
    return this.request<{status: string}>('/health');
  }
}

// 导出单例实例
export const apiService = new ApiService(); 