import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import './PracticePage.css';

interface PracticeSession {
  id: string;
  originalName: string;
  uploadedAt: string;
  status: 'UPLOADED' | 'OCR_PROCESSING' | 'AI_PROCESSING' | 'COMPLETED' | 'FAILED';
  score?: number;
  feedback?: string;
  suggestions?: string;
  ocrText?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

interface PracticePageProps {
  authState: AuthState;
}

export const PracticePage: React.FC<PracticePageProps> = ({ authState }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'analytics'>('upload');
  const [practiceHistory, setPracticeHistory] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState({ text: '', type: '' as 'success' | 'error' | 'info' });
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPracticeHistory();
  }, [authState.token]);

  const loadPracticeHistory = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/practice/history`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setPracticeHistory(result.data || []);
        }
      }
    } catch (error) {
      console.error('加载练习记录失败:', error);
      showMessage('加载练习记录失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'info' }), 3000);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

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

  const handleFiles = async (files: File[]) => {
    if (!authState.token) {
      showMessage('请先登录', 'error');
      return;
    }

    const supportedTypes = [
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'image/bmp', 'image/tiff', 'image/tif', 'image/svg+xml',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    const validFiles = files.filter(file => supportedTypes.includes(file.type));

    if (validFiles.length === 0) {
      showMessage('请选择支持的文件格式 (PDF, 图片文件, Word文档)', 'error');
      return;
    }

    for (const file of validFiles) {
      await uploadAndProcessFile(file);
    }
  };

  const uploadAndProcessFile = async (file: File) => {
    try {
      setLoading(true);
      setUploadProgress(0);
      showMessage(`正在上传 ${file.name}...`, 'info');

      // 上传文件
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'self_practice');

      setUploadProgress(30);

      const uploadResponse = await fetch(`${API_BASE_URL}/files`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.token}` },
        body: formData
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResult.success) {
        setUploadProgress(60);
        showMessage('文件上传成功，开始AI处理...', 'info');

        // 创建自主练习记录
        const practiceResponse = await fetch(`${API_BASE_URL}/practice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authState.token}`
          },
          body: JSON.stringify({
            fileUploadId: uploadResult.data.fileId,
            practiceType: 'SELF_STUDY'
          })
        });

        const practiceResult = await practiceResponse.json();
        
        if (practiceResult.success) {
          setUploadProgress(100);
          showMessage(`✅ ${file.name} 处理完成！`, 'success');
          
          // 重新加载练习记录
          await loadPracticeHistory();
          
          // 切换到历史记录标签页
          setActiveTab('history');
        } else {
          showMessage(`❌ 处理失败: ${practiceResult.error}`, 'error');
        }
      } else {
        showMessage(`❌ 上传失败: ${uploadResult.error}`, 'error');
      }
    } catch (error) {
      console.error('处理文件失败:', error);
      showMessage(`❌ 处理 ${file.name} 失败`, 'error');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const getDifficultyLabel = (difficulty?: string) => {
    switch (difficulty) {
      case 'EASY': return '简单';
      case 'MEDIUM': return '中等';
      case 'HARD': return '困难';
      default: return '未评估';
    }
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'EASY': return '#10b981';
      case 'MEDIUM': return '#f59e0b';
      case 'HARD': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'UPLOADED': return '📤';
      case 'OCR_PROCESSING': return '🔍';
      case 'AI_PROCESSING': return '🤖';
      case 'COMPLETED': return '✅';
      case 'FAILED': return '❌';
      default: return '📝';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10b981';
    if (score >= 80) return '#3b82f6';
    if (score >= 70) return '#f59e0b';
    if (score >= 60) return '#f97316';
    return '#ef4444';
  };

  const calculateAverageScore = () => {
    const completedSessions = practiceHistory.filter(session => 
      session.status === 'COMPLETED' && session.score !== undefined
    );
    if (completedSessions.length === 0) return 0;
    
    const total = completedSessions.reduce((sum, session) => sum + (session.score || 0), 0);
    return Math.round(total / completedSessions.length);
  };

  const renderPracticeSession = (session: PracticeSession) => (
    <div key={session.id} className="practice-session-card">
      <div className="session-header">
        <div className="session-title">
          <span className="status-icon">{getStatusIcon(session.status)}</span>
          <span className="file-name">{session.originalName}</span>
        </div>
        <div className="session-meta">
          <span className="upload-time">
            {new Date(session.uploadedAt).toLocaleString('zh-CN')}
          </span>
          {session.difficulty && (
            <span 
              className="difficulty-badge"
              style={{ color: getDifficultyColor(session.difficulty) }}
            >
              {getDifficultyLabel(session.difficulty)}
            </span>
          )}
        </div>
      </div>

      {session.status === 'COMPLETED' && session.score !== undefined && (
        <div className="session-results">
          <div className="score-section">
            <div className="score-display">
              <span 
                className="score-number"
                style={{ color: getScoreColor(session.score) }}
              >
                {session.score}
              </span>
              <span className="score-label">分</span>
            </div>
            <div className="score-level">
              {session.score >= 90 ? '优秀' : 
               session.score >= 80 ? '良好' : 
               session.score >= 70 ? '中等' : 
               session.score >= 60 ? '及格' : '待提升'}
            </div>
          </div>

          {session.feedback && (
            <div className="feedback-section">
              <h5>📝 AI批改反馈</h5>
              <p className="feedback-text">{session.feedback}</p>
            </div>
          )}

          {session.suggestions && (
            <div className="suggestions-section">
              <h5>💡 改进建议</h5>
              <p className="suggestions-text">{session.suggestions}</p>
            </div>
          )}
        </div>
      )}

      {(session.status === 'OCR_PROCESSING' || session.status === 'AI_PROCESSING') && (
        <div className="processing-indicator">
          <div className="loading-spinner"></div>
          <span>{session.status === 'OCR_PROCESSING' ? '正在识别内容...' : '正在AI批改...'}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="practice-page">
      <div className="page-header">
        <h1>💪 自主练习</h1>
        <p>上传练习题目，获得AI智能批改和学习建议</p>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="practice-tabs">
        <button
          className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📤 上传练习
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📚 练习记录
        </button>
        <button
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📊 学习分析
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'upload' && (
          <div className="upload-section">
            <div 
              className={`upload-area ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="upload-icon">📁</div>
              <h3>上传练习文件</h3>
              <p>点击选择文件或拖拽文件到这里</p>
              <div className="upload-hint">
                支持 PDF、图片文件(JPG/PNG/GIF/WebP/BMP/TIFF/SVG)、Word文档，最大100MB
              </div>
              
              {uploadProgress > 0 && (
                <div className="upload-progress">
                  <div 
                    className="progress-bar"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                  <span className="progress-text">{uploadProgress}%</span>
                </div>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="file-input"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.svg,.docx,.doc"
              multiple
              onChange={handleFileSelect}
            />

            <div className="practice-tips">
              <h4>💡 练习建议</h4>
              <ul>
                <li>上传清晰的题目图片或PDF文件</li>
                <li>确保数学公式和文字清晰可见</li>
                <li>可以上传手写或打印的练习题</li>
                <li>AI会对您的解答进行详细分析和建议</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>加载练习记录中...</p>
              </div>
            ) : practiceHistory.length > 0 ? (
              <div className="practice-sessions">
                {practiceHistory.map(renderPracticeSession)}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>还没有练习记录</h3>
                <p>开始上传练习题目，获得AI智能批改吧！</p>
                <button 
                  className="start-practice-btn"
                  onClick={() => setActiveTab('upload')}
                >
                  开始练习
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-section">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-content">
                  <div className="stat-number">{practiceHistory.length}</div>
                  <div className="stat-label">总练习次数</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <div className="stat-number">{calculateAverageScore()}</div>
                  <div className="stat-label">平均得分</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <div className="stat-number">
                    {practiceHistory.filter(s => s.status === 'COMPLETED').length}
                  </div>
                  <div className="stat-label">已完成</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <div className="stat-number">
                    {practiceHistory.filter(s => 
                      s.status === 'OCR_PROCESSING' || s.status === 'AI_PROCESSING'
                    ).length}
                  </div>
                  <div className="stat-label">处理中</div>
                </div>
              </div>
            </div>

            <div className="progress-chart">
              <h4>📊 最近学习进展</h4>
              <div className="chart-placeholder">
                <p>学习数据分析图表</p>
                <p className="chart-note">完成更多练习后将显示详细的进步趋势</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};