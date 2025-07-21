import React, { useState, useRef, useEffect } from 'react';
import './sidepanel.css';

// 定义文件类型
interface FileItem {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

interface Submission {
  id: string;
  fileUpload: {
    originalName: string;
    size: number;
    uploadedAt: string;
  };
  status: string;
  submittedAt: string;
  score?: number;
  feedback?: string;
}

const SidePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'results' | 'history'>('upload');
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' }>({ message: '', type: 'info' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Submission[]>([]);
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 组件加载时初始化
    checkUserStatus();
    loadRecentResults();
  }, []);

  // 检查用户状态
  const checkUserStatus = async () => {
    try {
      const response = await sendMessageToBackground({ type: 'GET_USER_STATUS' });
      if (response.success && response.data.isLoggedIn) {
        showStatus('欢迎回来！', 'success');
      } else {
        showStatus('欢迎使用AI微积分助教', 'info');
      }
    } catch (error) {
      showStatus('欢迎使用AI微积分助教', 'info');
    }
  };

  // 加载最近结果
  const loadRecentResults = async () => {
    // 暂时使用模拟数据
    const mockResults: Submission[] = [
      {
        id: '1',
        fileUpload: {
          originalName: '微积分作业1.pdf',
          size: 1024000,
          uploadedAt: new Date().toISOString()
        },
        status: 'completed',
        submittedAt: new Date().toISOString(),
        score: 85,
        feedback: '解答正确，步骤清楚。'
      }
    ];
    setResults(mockResults);
  };

  // 发送消息到background脚本
  const sendMessageToBackground = (message: any): Promise<any> => {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(message, (response: any) => {
          resolve(response || { success: false, error: 'No response' });
        });
      } else {
        resolve({ success: false, error: 'Chrome runtime not available' });
      }
    });
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
    console.log('处理文件:', files);
    showStatus('正在上传文件...', 'info');

    // 验证文件类型
    const supportedTypes = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png'];
    const validFiles = files.filter(file => supportedTypes.includes(file.type));

    if (validFiles.length === 0) {
      showStatus('请选择支持的文件格式 (PDF, TXT, JPG, PNG)', 'error');
      return;
    }

    // 检查文件大小
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = validFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      showStatus('文件大小不能超过10MB', 'error');
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
        const result = await sendMessageToBackground({
          type: 'UPLOAD_FILE',
          data: { file, type: 'sidepanel' }
        });

        if (result.success) {
          showStatus(`${file.name} 上传成功！`, 'success');
          
          // 添加到结果显示
          const newSubmission: Submission = {
            id: Date.now().toString(),
            fileUpload: {
              originalName: file.name,
              size: file.size,
              uploadedAt: new Date().toISOString()
            },
            status: 'uploaded',
            submittedAt: new Date().toISOString()
          };
          setResults(prev => [newSubmission, ...prev]);
          
          // 切换到结果标签页
          setActiveTab('results');
        } else {
          showStatus(`${file.name} 上传失败: ${result.error}`, 'error');
        }
      } catch (error) {
        console.error('上传文件失败:', error);
        showStatus(`${file.name} 上传失败`, 'error');
      }
    }
    
    setIsProcessing(false);
  };

  // 渲染结果项
  const renderResultItem = (submission: Submission) => {
    const score = submission.score || 0;
    const scoreColor = score >= 80 ? '#4caf50' : score >= 60 ? '#ff9800' : '#f44336';

    return (
      <div key={submission.id} className="result-item">
        <div className="result-header">
          <div className="result-title">{submission.fileUpload.originalName}</div>
          {submission.score && (
            <div className="result-score" style={{ color: scoreColor }}>
              {submission.score}分
            </div>
          )}
        </div>
        <div className="result-content">
          {submission.feedback && (
            <div className="feedback">
              <strong>批改反馈:</strong><br />
              {submission.feedback}
            </div>
          )}
          <div className="result-time">
            {new Date(submission.submittedAt).toLocaleString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="sidepanel-container">
      {/* 头部 */}
      <div className="header">
        <h1>📚 AI微积分助教</h1>
        <p>智能批改 · 错题分析 · 学习建议</p>
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
                <div className="upload-hint">支持 PDF、TXT、JPG、PNG 格式，最大10MB</div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef}
                className="file-input" 
                accept=".pdf,.txt,.jpg,.jpeg,.png" 
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
              </div>
              
              <div className="results-container">
                {results.length > 0 ? (
                  results.map(renderResultItem)
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📝</div>
                    <p>还没有批改结果</p>
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
              
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <p>历史记录功能开发中</p>
                <p>敬请期待...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidePanel; 