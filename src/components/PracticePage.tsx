import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { PracticeDetailPage } from './PracticeDetailPage';
import { MathPixMarkdownRenderer } from './MathPixMarkdownRenderer';
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
  // 新增的结构化信息
  questionCount?: number;
  incorrectCount?: number;
  correctCount?: number;
  knowledgePoints?: string[];
  detailedErrors?: any[];
  improvementAreas?: string[];
  nextStepRecommendations?: string[];
  // 错题本相关
  isInErrorBook?: boolean;
  // 进度信息
  progress?: {
    percent: number;
    stage: string;
    message: string;
  };
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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showErrorBookModal, setShowErrorBookModal] = useState<string | null>(null);
  const [errorBookCategories, setErrorBookCategories] = useState<string[]>(['微分基础', '积分计算', '极限问题', '应用题']);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPracticeHistory();
  }, [authState.token]);

  // 自动刷新处理中的练习会话
  useEffect(() => {
    if (!authState.token) return;

    // 检查是否有处理中的会话
    const hasProcessingSessions = practiceHistory.some(session =>
      session.status === 'UPLOADED' ||
      session.status === 'OCR_PROCESSING' ||
      session.status === 'AI_PROCESSING'
    );

    if (!hasProcessingSessions) return;

    // 每5秒刷新一次处理中的会话
    const intervalId = setInterval(async () => {
      await loadProcessingSessionsProgress();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [authState.token, practiceHistory]);

  const loadProcessingSessionsProgress = async () => {
    if (!authState.token) return;

    // 筛选出所有处理中的会话
    const processingSessions = practiceHistory.filter(session =>
      session.status === 'UPLOADED' ||
      session.status === 'OCR_PROCESSING' ||
      session.status === 'AI_PROCESSING'
    );

    if (processingSessions.length === 0) return;

    try {
      // 并发获取所有处理中会话的最新状态
      const updates = await Promise.all(
        processingSessions.map(async (session) => {
          try {
            const response = await fetch(`${API_BASE_URL}/practice/${session.id}/status`, {
              headers: { 'Authorization': `Bearer ${authState.token}` }
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                return {
                  id: session.id,
                  status: result.data.status,
                  progress: result.data.progress,
                  score: result.data.gradingResult?.score,
                  feedback: result.data.gradingResult?.feedback,
                  questionCount: result.data.gradingResult?.questionCount,
                  incorrectCount: result.data.gradingResult?.incorrectCount,
                  correctCount: result.data.gradingResult?.correctCount,
                  knowledgePoints: result.data.gradingResult?.knowledgePoints,
                  detailedErrors: result.data.gradingResult?.detailedErrors
                };
              }
            }
            return null;
          } catch (error) {
            return null;
          }
        })
      );

      // 更新本地状态
      const validUpdates = updates.filter(update => update !== null);
      if (validUpdates.length > 0) {
        setPracticeHistory(prev => prev.map(session => {
          const update = validUpdates.find(u => u && u.id === session.id);
          if (update) {
            return { ...session, ...update };
          }
          return session;
        }));
      }
    } catch (error) {
    }
  };

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
        } else {
          showMessage(result.error || '获取练习记录失败', 'error');
        }
      } else {
        // 尝试解析错误响应
        try {
          const errorResult = await response.json();
          showMessage(errorResult.error || `HTTP ${response.status}: 获取练习记录失败`, 'error');
        } catch {
          showMessage(`HTTP ${response.status}: 获取练习记录失败`, 'error');
        }
      }
    } catch (error) {
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
    if (score >= 90) return '#10b981';      // 90+ 绿色 (优秀)
    if (score >= 75) return '#3b82f6';      // 75-89 蓝色 (良好)
    if (score >= 60) return '#f59e0b';      // 60-74 黄色 (及格)
    return '#ef4444';                       // <60 红色 (不及格)
  };

  const calculateAverageScore = () => {
    const completedSessions = practiceHistory.filter(session => 
      session.status === 'COMPLETED' && session.score !== undefined
    );
    if (completedSessions.length === 0) return 0;
    
    const total = completedSessions.reduce((sum, session) => sum + (session.score || 0), 0);
    return Math.round(total / completedSessions.length);
  };

  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleBackToList = () => {
    setSelectedSessionId(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!authState.token) {
      showMessage('请先登录', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/practice/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      const result = await response.json();

      if (result.success) {
        showMessage('练习记录已删除', 'success');
        // 重新加载练习记录
        await loadPracticeHistory();
        setShowDeleteDialog(null);
      } else {
        showMessage(`删除失败: ${result.error}`, 'error');
      }
    } catch (error) {
      showMessage('删除练习记录失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (sessionId: string) => {
    setShowDeleteDialog(sessionId);
  };

  const cancelDelete = () => {
    setShowDeleteDialog(null);
  };

  const showAddToErrorBookModal = (sessionId: string) => {
    setShowErrorBookModal(sessionId);
    setSelectedCategory('');
    setNewCategory('');
  };

  const handleAddToErrorBook = async () => {
    if (!authState.token || !showErrorBookModal) {
      showMessage('请先登录', 'error');
      return;
    }

    const categoryToUse = newCategory.trim() || selectedCategory;
    if (!categoryToUse) {
      showMessage('请选择或输入分类', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // 获取选中的练习记录
      const selectedSession = practiceHistory.find(s => s.id === showErrorBookModal);
      if (!selectedSession) {
        showMessage('练习记录不存在', 'error');
        return;
      }

      // 首先创建或获取分类
      let categoryId = null;
      if (categoryToUse) {
        // 创建分类（如果是新分类）
        if (newCategory.trim()) {
          const createCategoryResponse = await fetch(`${API_BASE_URL}/mistakes/categories`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authState.token}`
            },
            body: JSON.stringify({
              name: newCategory.trim(),
              description: '从练习页面创建的分类'
            })
          });
          
          if (createCategoryResponse.ok) {
            const categoryResult = await createCategoryResponse.json();
            if (categoryResult.success) {
              categoryId = categoryResult.data.category.id;
            }
          }
        } else {
          // 如果是已存在分类，需要获取分类ID（暂时使用分类名称）
          // 在实际实现中，应该从分类列表API获取正确的ID
          // 这里简化处理
        }
      }

      // 添加到错题本
      const response = await fetch(`${API_BASE_URL}/mistakes/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          submissionId: parseInt(selectedSession.id),
          categoryId,
          title: selectedSession.originalName,
          notes: `从练习记录手动添加（得分：${selectedSession.score}分）`,
          tags: ['手动添加', '练习记录'],
          priority: selectedSession.score && selectedSession.score < 60 ? 'high' : 'medium'
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        showMessage(`已添加到错题本"${categoryToUse}"分类`, 'success');
        
        // 更新本地状态
        setPracticeHistory(prev => prev.map(session => 
          session.id === showErrorBookModal 
            ? { ...session, isInErrorBook: true }
            : session
        ));
        
        // 添加新分类到分类列表
        if (newCategory.trim() && !errorBookCategories.includes(newCategory.trim())) {
          setErrorBookCategories(prev => [...prev, newCategory.trim()]);
        }
        
        setShowErrorBookModal(null);
      } else {
        showMessage(result.error || '添加到错题本失败', 'error');
      }
    } catch (error) {
      showMessage('添加到错题本失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderPracticeSession = (session: PracticeSession) => (
    <div 
      key={session.id} 
      className="practice-session-card clickable"
      onClick={() => handleSessionClick(session.id)}
    >
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
          {session.status === 'COMPLETED' && (
            <button
              className={`error-book-btn ${session.isInErrorBook ? 'added' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!session.isInErrorBook) {
                  showAddToErrorBookModal(session.id);
                }
              }}
              title={session.isInErrorBook ? '已添加到错题本' : '添加到错题本'}
            >
              <span className="btn-icon">{session.isInErrorBook ? '📚✓' : '📚+'}</span>
              <span className="btn-text">{session.isInErrorBook ? '已在错题本' : '加入错题本'}</span>
            </button>
          )}
          <button
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              confirmDelete(session.id);
            }}
            title="删除练习记录"
          >
            <span className="btn-icon">🗑️</span>
            <span className="btn-text">删除练习</span>
          </button>
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
              <span className="level-label">作答评估:</span>
              <span className="level-value">
                {session.score >= 90 ? '优秀' : 
                 session.score >= 80 ? '良好' : 
                 session.score >= 70 ? '中等' : 
                 session.score >= 60 ? '及格' : '待提升'}
              </span>
            </div>
          </div>

          {/* 统计信息 - 紧凑格式 */}
          <div className="stats-summary compact">
            <div className="stat-item">
              <span className="stat-label">题目数:</span>
              <span className="stat-value">{session.questionCount || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">正确:</span>
              <span className="stat-value correct">{session.correctCount || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">错误:</span>
              <span className="stat-value incorrect">{session.incorrectCount || 0}</span>
            </div>
          </div>

          {/* OCR预览 */}
          {session.ocrText && (
            <div className="ocr-preview">
              <h5>📄 识别内容预览</h5>
              <div className="ocr-text-preview">
                <MathPixMarkdownRenderer
                  content={session.ocrText}
                  className="preview compact"
                  maxLength={150}
                />
              </div>
            </div>
          )}

          {/* 知识点标签 */}
          {session.knowledgePoints && session.knowledgePoints.length > 0 && (
            <div className="knowledge-points">
              <h5>📚 涉及知识点</h5>
              <div className="knowledge-tags">
                {session.knowledgePoints.map((point, index) => (
                  <span key={index} className="knowledge-tag">
                    {point}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {(session.status === 'UPLOADED' ||
        session.status === 'OCR_PROCESSING' ||
        session.status === 'AI_PROCESSING') && (
        <div className="processing-indicator">
          <div className="loading-spinner"></div>
          <div className="processing-info">
            <div className="processing-message">
              {session.progress?.message ||
               (session.status === 'UPLOADED' ? '等待处理中...' :
                session.status === 'OCR_PROCESSING' ? '正在识别内容...' : '正在AI批改...')}
            </div>
            {session.progress && (
              <div className="progress-bar-container">
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${session.progress.percent}%` }}
                  >
                    <span className="progress-percent">{session.progress.percent}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // If a session is selected, show the detail page
  if (selectedSessionId) {
    return (
      <PracticeDetailPage
        sessionId={selectedSessionId}
        authState={authState}
        onBack={handleBackToList}
      />
    );
  }

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

        {/* 删除确认对话框 */}
        {showDeleteDialog && (
          <div className="delete-dialog-overlay">
            <div className="delete-dialog">
              <div className="delete-dialog-header">
                <h3>确认删除</h3>
              </div>
              <div className="delete-dialog-body">
                <p>确定要删除这条练习记录吗？此操作不可撤销。</p>
              </div>
              <div className="delete-dialog-footer">
                <button 
                  className="cancel-btn"
                  onClick={cancelDelete}
                  disabled={loading}
                >
                  取消
                </button>
                <button 
                  className="confirm-delete-btn"
                  onClick={() => handleDeleteSession(showDeleteDialog)}
                  disabled={loading}
                >
                  {loading ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 添加到错题本对话框 */}
        {showErrorBookModal && (
          <div className="delete-dialog-overlay">
            <div className="delete-dialog error-book-dialog">
              <div className="delete-dialog-header">
                <h3>📚 添加到错题本</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowErrorBookModal(null)}
                >
                  ✕
                </button>
              </div>
              <div className="delete-dialog-body">
                <p>选择错题分类或创建新分类：</p>
                <div className="category-selection">
                  <div className="existing-categories">
                    <label>现有分类：</label>
                    <select 
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="category-select"
                    >
                      <option value="">请选择分类</option>
                      {errorBookCategories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="or-divider">或</div>
                  <div className="new-category">
                    <label>新建分类：</label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="输入新分类名称"
                      className="category-input"
                    />
                  </div>
                </div>
              </div>
              <div className="delete-dialog-footer">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowErrorBookModal(null)}
                  disabled={loading}
                >
                  取消
                </button>
                <button 
                  className="confirm-add-btn"
                  onClick={handleAddToErrorBook}
                  disabled={loading || (!selectedCategory && !newCategory.trim())}
                >
                  {loading ? '添加中...' : '添加到错题本'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};