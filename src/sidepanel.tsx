import React, { useState, useRef, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { API_BASE_URL, type User, type AuthState } from './common/config/supabase';

import "./sidepanel.css"

const storage = new Storage();

// 定义文件类型
interface FileUpload {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

interface Submission {
  id: string;
  fileUpload: FileUpload;
  status: 'UPLOADED' | 'OCR_PROCESSING' | 'AI_PROCESSING' | 'COMPLETED' | 'FAILED';
  submittedAt: string;
  myscriptResults?: Array<{
    id: string;
    recognizedText: string;
    confidence: number;
  }>;
  deepseekResults?: Array<{
    id: string;
    grade: number;
    feedback: string;
    suggestions: string;
    strengths: string;
  }>;
}

const SidePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'results' | 'history'>('results');
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' }>({ message: '', type: 'info' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true
  });
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 组件加载时初始化
    initializeAuth();
  }, []);

  useEffect(() => {
    if (authState.isAuthenticated) {
      loadSubmissions();
    }
  }, [authState.isAuthenticated]);

  // 初始化认证状态
  const initializeAuth = async () => {
    try {
      const savedToken = await storage.get('auth_token');
      const savedUser = await storage.get('user_info');

      if (savedToken && savedUser) {
        const isValid = await verifyToken(savedToken);
        if (isValid) {
          setAuthState({
            isAuthenticated: true,
            user: savedUser,
            token: savedToken,
            loading: false
          });
          return;
        } else {
          await storage.remove('auth_token');
          await storage.remove('user_info');
        }
      }

      setAuthState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      console.error('初始化认证状态失败:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  };

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Token验证失败:', error);
      return false;
    }
  };

  // 加载提交记录
  const loadSubmissions = async () => {
    if (!authState.token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/submissions`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSubmissions(result.data.submissions || []);
        }
      }
    } catch (error) {
      console.error('加载提交记录失败:', error);
      showStatus('加载提交记录失败', 'error');
    }
  };

  // 显示状态信息
  const showStatus = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatus({ message, type });
    
    // 3秒后自动隐藏（除非是错误）
    if (type !== 'error') {
      setTimeout(() => {
        setStatus({ message: '', type: 'info' });
      }, 3000);
    }
  };

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  // 处理拖拽事件
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  // 处理文件
  const handleFiles = (files: File[]) => {
    if (!authState.isAuthenticated || !authState.token) {
      showStatus('⚠️ 请先登录后再上传文件', 'error');
      return;
    }

    console.log('处理文件:', files);
    showStatus('正在上传文件...', 'info');

    // 验证文件类型
    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const validFiles = files.filter(file => supportedTypes.includes(file.type));

    if (validFiles.length === 0) {
      showStatus('请选择支持的文件格式 (PDF, JPG, PNG, GIF, WebP)', 'error');
      return;
    }

    // 检查文件大小
    const maxSize = 100 * 1024 * 1024; // 100MB
    const oversizedFiles = validFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      showStatus('文件大小不能超过100MB', 'error');
      return;
    }

    // 上传文件
    uploadFiles(validFiles);
  };

  // 上传文件到后端
  const uploadFiles = async (files: File[]) => {
    setIsProcessing(true);
    
    for (const file of files) {
      try {
        showStatus(`正在上传 ${file.name}...`, 'info');

        // 上传文件
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch(`${API_BASE_URL}/files`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.token}`
          },
          body: formData
        });

        const uploadResult = await uploadResponse.json();

        if (uploadResult.success) {
          // 创建提交记录
          const submissionResponse = await fetch(`${API_BASE_URL}/submissions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authState.token}`
            },
            body: JSON.stringify({
              fileUploadId: uploadResult.data.fileId
            })
          });

          const submissionResult = await submissionResponse.json();
          
          if (submissionResult.success) {
            showStatus(`✅ ${file.name} 上传成功！`, 'success');
            
            // 重新加载提交记录
            await loadSubmissions();
            
            // 切换到结果标签页
            setActiveTab('results');
          } else {
            showStatus(`⚠️ ${file.name} 上传成功，但创建提交记录失败`, 'error');
          }
        } else {
          showStatus(`❌ ${file.name} 上传失败: ${uploadResult.error}`, 'error');
        }
      } catch (error) {
        console.error('上传文件失败:', error);
        showStatus(`❌ ${file.name} 上传失败`, 'error');
      }
    }
    
    setIsProcessing(false);
  };

  // 触发OCR处理
  const triggerOCR = async (submissionId: string) => {
    if (!authState.token) return;

    try {
      setIsProcessing(true);
      showStatus('正在进行OCR识别...', 'info');

      const response = await fetch(`${API_BASE_URL}/ocr/myscript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          submissionId: submissionId
        })
      });

      const result = await response.json();

      if (result.success) {
        showStatus('✅ OCR识别完成！', 'success');
        await loadSubmissions();
      } else {
        showStatus(`❌ OCR识别失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('OCR处理失败:', error);
      showStatus('❌ OCR处理失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 触发AI批改
  const triggerAIGrading = async (submissionId: string) => {
    if (!authState.token) return;

    try {
      setIsProcessing(true);
      showStatus('正在进行AI批改...', 'info');

      const response = await fetch(`${API_BASE_URL}/ai/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          submissionId: submissionId
        })
      });

      const result = await response.json();

      if (result.success) {
        showStatus('🎉 AI批改完成！', 'success');
        await loadSubmissions();
      } else {
        showStatus(`❌ AI批改失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('AI批改失败:', error);
      showStatus('❌ AI批改失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 渲染提交项
  const renderSubmissionItem = (submission: Submission) => {
    const statusText = {
      'UPLOADED': '📤 已上传',
      'OCR_PROCESSING': '🔍 OCR处理中',
      'AI_PROCESSING': '🤖 AI批改中',
      'COMPLETED': '✅ 已完成',
      'FAILED': '❌ 处理失败'
    };

    const hasOCRResults = submission.myscriptResults && submission.myscriptResults.length > 0;
    const hasAIResults = submission.deepseekResults && submission.deepseekResults.length > 0;

    return (
      <div key={submission.id} className="result-item">
        <div className="result-header">
          <div className="result-title">{submission.fileUpload.originalName}</div>
          <div className="result-status">
            {statusText[submission.status]}
          </div>
        </div>

        <div className="result-content">
          <div className="result-time">
            提交时间: {new Date(submission.submittedAt).toLocaleString()}
          </div>

          {hasOCRResults && (
            <div className="ocr-results">
              <h4>🔍 OCR识别结果:</h4>
              {submission.myscriptResults!.map(result => (
                <div key={result.id} className="ocr-result">
                  <p><strong>识别文本:</strong> {result.recognizedText}</p>
                  <p><strong>置信度:</strong> {(result.confidence * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}

          {hasAIResults && (
            <div className="ai-results">
              <h4>🤖 AI批改结果:</h4>
              {submission.deepseekResults!.map(result => (
                <div key={result.id} className="ai-result">
                  <div className="grade">
                    <strong>得分:</strong> 
                    <span className={`score ${result.grade >= 80 ? 'good' : result.grade >= 60 ? 'medium' : 'poor'}`}>
                      {result.grade}分
                    </span>
                  </div>
                  <div className="feedback">
                    <strong>批改反馈:</strong><br />
                    {result.feedback}
                  </div>
                  {result.suggestions && (
                    <div className="suggestions">
                      <strong>改进建议:</strong><br />
                      {result.suggestions}
                    </div>
                  )}
                  {result.strengths && (
                    <div className="strengths">
                      <strong>优点:</strong><br />
                      {result.strengths}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="result-actions">
            {submission.status === 'UPLOADED' && (
              <button 
                className="btn btn-small" 
                onClick={() => triggerOCR(submission.id)}
                disabled={isProcessing}
              >
                开始OCR识别
              </button>
            )}
            {hasOCRResults && !hasAIResults && (
              <button 
                className="btn btn-small" 
                onClick={() => triggerAIGrading(submission.id)}
                disabled={isProcessing}
              >
                开始AI批改
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (authState.loading) {
    return (
      <div className="sidepanel-container">
        <div className="header">
          <h1>📚 AI微积分助教</h1>
        </div>
        <div className="loading">
          <div className="spinner"></div>
          <p>正在加载...</p>
        </div>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="sidepanel-container">
        <div className="header">
          <h1>📚 AI微积分助教</h1>
          <p>智能批改 · 错题分析 · 学习建议</p>
        </div>
        <div className="auth-required">
          <div className="auth-icon">🔐</div>
          <h3>需要登录</h3>
          <p>请在插件popup中登录GitHub账户后使用侧边栏功能。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sidepanel-container">
      {/* 头部 */}
      <div className="header">
        <h1>📚 AI微积分助教</h1>
        <p>智能批改 · 错题分析 · 学习建议</p>
        <div className="user-info-small">
          👋 欢迎，{authState.user?.username}
        </div>
      </div>

      <div className="container">
        {/* 状态显示 */}
        {status.message && (
          <div className={`status status-${status.type}`}>
            {status.message}
          </div>
        )}

        {/* 标签页 */}
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            📤 上传作业
          </button>
          <button 
            className={`tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            📊 批改结果
          </button>
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📋 历史记录
          </button>
        </div>

        {/* 上传作业标签页 */}
        {activeTab === 'upload' && (
          <div className="tab-content">
            <div className="upload-section">
              <div className="section-title">
                <span>📝</span>
                上传作业文件
              </div>
              
              <div 
                className={`upload-area ${dragOver ? 'dragover' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="upload-icon">📄</div>
                <div className="upload-text">点击上传或拖拽文件到这里</div>
                <div className="upload-hint">支持 PDF、JPG、PNG、GIF、WebP 格式，最大100MB</div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef}
                className="file-input" 
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" 
                multiple
                onChange={handleFileSelect}
              />
              
              <button 
                className="btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? '处理中...' : '选择文件'}
              </button>
            </div>
          </div>
        )}

        {/* 批改结果标签页 */}
        {activeTab === 'results' && (
          <div className="tab-content">
            <div className="results-section">
              <div className="section-title">
                <span>🎯</span>
                最新批改结果
                <button 
                  className="btn btn-small refresh-btn" 
                  onClick={loadSubmissions}
                  disabled={isProcessing}
                >
                  🔄 刷新
                </button>
              </div>
              
              <div className="results-container">
                {submissions.length > 0 ? (
                  submissions.map(renderSubmissionItem)
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📝</div>
                    <p>还没有提交记录</p>
                    <p>上传作业开始AI批改吧！</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 历史记录标签页 */}
        {activeTab === 'history' && (
          <div className="tab-content">
            <div className="upload-section">
              <div className="section-title">
                <span>📚</span>
                历史记录
              </div>
              
              <div className="results-container">
                {submissions.filter(s => s.status === 'COMPLETED').length > 0 ? (
                  submissions
                    .filter(s => s.status === 'COMPLETED')
                    .map(renderSubmissionItem)
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <p>还没有完成的批改记录</p>
                    <p>完成批改后会在这里显示</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidePanel; 