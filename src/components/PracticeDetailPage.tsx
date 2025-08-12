import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import './PracticeDetailPage.css';

interface PracticeDetailProps {
  sessionId: string;
  authState: AuthState;
  onBack: () => void;
}

interface DetailedSession {
  sessionId: number;
  status: string;
  progress: {
    percent: number;
    stage: string;
    message: string;
  };
  fileInfo: {
    originalName: string;
    fileSize: number;
    mimeType: string;
  };
  ocrResult: {
    recognizedText: string;
    confidence: number;
  } | null;
  gradingResult: {
    score: number;
    maxScore: number;
    feedback: string;
    suggestions: any[];
    strengths: any[];
    questionCount?: number;
    incorrectCount?: number;
    correctCount?: number;
    knowledgePoints?: string[];
    detailedErrors?: any[];
    improvementAreas?: string[];
    nextStepRecommendations?: string[];
  } | null;
  submittedAt: string;
  completedAt?: string;
}

export const PracticeDetailPage: React.FC<PracticeDetailProps> = ({ 
  sessionId, 
  authState, 
  onBack 
}) => {
  const [session, setSession] = useState<DetailedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'recognition' | 'grading'>('recognition');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSessionDetails();
  }, [sessionId, authState.token]);

  const loadSessionDetails = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/practice/${sessionId}/status`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSession(result.data);
        } else {
          setError(result.error || '获取练习详情失败');
        }
      } else {
        setError('获取练习详情失败');
      }
    } catch (err) {
      console.error('加载练习详情失败:', err);
      setError('加载练习详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!authState.token) return;

    try {
      setDeleting(true);
      const response = await fetch(`${API_BASE_URL}/practice/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      const result = await response.json();

      if (result.success) {
        // 删除成功，返回到列表页面
        onBack();
      } else {
        setError(`删除失败: ${result.error}`);
      }
    } catch (err) {
      console.error('删除练习记录失败:', err);
      setError('删除练习记录失败');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'UPLOADED': return '📤';
      case 'PROCESSING': return '🔄';
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

  const renderErrorDetails = (errors: any[]) => {
    if (!errors || errors.length === 0) return null;

    return (
      <div className="error-details">
        <h5>🔍 错误详情</h5>
        {errors.map((error, index) => (
          <div key={index} className="error-item">
            <div className="error-header">
              <span className="error-type">{error.errorType || '错误'}</span>
              {error.severity && (
                <span className={`error-severity ${error.severity}`}>
                  {error.severity === 'major' ? '严重' : 
                   error.severity === 'minor' ? '轻微' : '中等'}
                </span>
              )}
            </div>
            {error.content && (
              <div className="error-content">
                <strong>问题内容：</strong>{error.content}
              </div>
            )}
            {error.correction && (
              <div className="error-correction">
                <strong>正确答案：</strong>{error.correction}
              </div>
            )}
            {error.explanation && (
              <div className="error-explanation">
                <strong>解释：</strong>{error.explanation}
              </div>
            )}
            {error.knowledgePoint && (
              <div className="error-knowledge">
                <strong>知识点：</strong>
                <span className="knowledge-tag-inline">{error.knowledgePoint}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSuggestions = (suggestions: any[]) => {
    if (!suggestions || suggestions.length === 0) return null;

    return (
      <div className="suggestions-details">
        <h5>💡 改进建议</h5>
        {suggestions.map((suggestion, index) => (
          <div key={index} className="suggestion-item">
            <div className="suggestion-aspect">
              <strong>{suggestion.aspect || '建议'}</strong>
              {suggestion.priority && (
                <span className={`priority-badge ${suggestion.priority}`}>
                  {suggestion.priority === 'high' ? '高优先级' : 
                   suggestion.priority === 'medium' ? '中优先级' : '低优先级'}
                </span>
              )}
            </div>
            <div className="suggestion-content">
              {suggestion.recommendation || suggestion.description || suggestion}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStrengths = (strengths: any[]) => {
    if (!strengths || strengths.length === 0) return null;

    return (
      <div className="strengths-details">
        <h5>🌟 优点分析</h5>
        {strengths.map((strength, index) => (
          <div key={index} className="strength-item">
            <div className="strength-aspect">
              <strong>{strength.aspect || '优点'}</strong>
              {strength.importance && (
                <span className={`importance-badge ${strength.importance}`}>
                  {strength.importance === 'high' ? '非常重要' : 
                   strength.importance === 'medium' ? '比较重要' : '一般重要'}
                </span>
              )}
            </div>
            <div className="strength-content">
              {strength.description || strength}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="practice-detail-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载练习详情中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="practice-detail-page">
        <div className="error-container">
          <div className="error-icon">❌</div>
          <h3>加载失败</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={loadSessionDetails}>
            重试
          </button>
          <button className="back-btn" onClick={onBack}>
            返回
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="practice-detail-page">
        <div className="error-container">
          <div className="error-icon">📝</div>
          <h3>练习记录不存在</h3>
          <button className="back-btn" onClick={onBack}>
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="practice-detail-page">
      {/* 头部信息 */}
      <div className="detail-header">
        <div className="header-actions">
          <button className="back-button" onClick={onBack}>
            ← 返回练习记录
          </button>
          <button 
            className="delete-button" 
            onClick={() => setShowDeleteDialog(true)}
            title="删除此练习记录"
          >
            🗑️ 删除记录
          </button>
        </div>
        <div className="file-info">
          <div className="file-title">
            <span className="status-icon">{getStatusIcon(session.status)}</span>
            <h1>{session.fileInfo.originalName}</h1>
          </div>
          <div className="file-meta">
            <span>提交时间：{new Date(session.submittedAt).toLocaleString('zh-CN')}</span>
            {session.completedAt && (
              <span>完成时间：{new Date(session.completedAt).toLocaleString('zh-CN')}</span>
            )}
            <span>文件大小：{(session.fileInfo.fileSize / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        </div>
      </div>

      {/* 进度指示器 */}
      {session.status !== 'COMPLETED' && (
        <div className="progress-section">
          <div className="progress-info">
            <h4>{session.progress.message}</h4>
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${session.progress.percent}%` }}
              ></div>
              <span className="progress-text">{session.progress.percent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 标签页导航 */}
      <div className="detail-tabs">
        <button
          className={`tab ${activeTab === 'recognition' ? 'active' : ''}`}
          onClick={() => setActiveTab('recognition')}
        >
          🔍 作业识别
        </button>
        <button
          className={`tab ${activeTab === 'grading' ? 'active' : ''}`}
          onClick={() => setActiveTab('grading')}
          disabled={!session.gradingResult}
        >
          🤖 AI批改解答
        </button>
      </div>

      {/* 标签页内容 */}
      <div className="detail-content">
        {activeTab === 'recognition' && (
          <div className="recognition-section">
            <div className="section-header">
              <h3>📄 OCR识别结果</h3>
              {session.ocrResult && (
                <div className="confidence-badge">
                  置信度：{(session.ocrResult.confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>

            {session.ocrResult ? (
              <div className="ocr-content">
                <div className="recognized-text">
                  <h4>识别文本</h4>
                  <div className="text-content">
                    {session.ocrResult.recognizedText}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-result">
                <div className="empty-icon">🔍</div>
                <p>OCR识别尚未完成或识别失败</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'grading' && (
          <div className="grading-section">
            {session.gradingResult ? (
              <>
                {/* 分数总览 */}
                <div className="score-overview">
                  <div className="score-display">
                    <span 
                      className="score-number"
                      style={{ color: getScoreColor(session.gradingResult.score) }}
                    >
                      {session.gradingResult.score}
                    </span>
                    <span className="score-separator">/</span>
                    <span className="max-score">{session.gradingResult.maxScore}</span>
                  </div>
                  <div className="score-level">
                    {session.gradingResult.score >= 90 ? '优秀' : 
                     session.gradingResult.score >= 80 ? '良好' : 
                     session.gradingResult.score >= 70 ? '中等' : 
                     session.gradingResult.score >= 60 ? '及格' : '待提升'}
                  </div>
                </div>

                {/* 统计信息 */}
                {(session.gradingResult.questionCount || session.gradingResult.correctCount || session.gradingResult.incorrectCount) && (
                  <div className="stats-overview">
                    <div className="stat-card">
                      <span className="stat-icon">📊</span>
                      <div className="stat-content">
                        <div className="stat-number">{session.gradingResult.questionCount || 0}</div>
                        <div className="stat-label">题目数</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon">✅</span>
                      <div className="stat-content">
                        <div className="stat-number correct">{session.gradingResult.correctCount || 0}</div>
                        <div className="stat-label">正确</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon">❌</span>
                      <div className="stat-content">
                        <div className="stat-number incorrect">{session.gradingResult.incorrectCount || 0}</div>
                        <div className="stat-label">错误</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 知识点 */}
                {session.gradingResult.knowledgePoints && session.gradingResult.knowledgePoints.length > 0 && (
                  <div className="knowledge-section">
                    <h4>📚 涉及知识点</h4>
                    <div className="knowledge-tags">
                      {session.gradingResult.knowledgePoints.map((point, index) => (
                        <span key={index} className="knowledge-tag">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI反馈 */}
                {session.gradingResult.feedback && (
                  <div className="feedback-section">
                    <h4>📝 AI总体反馈</h4>
                    <div className="feedback-content">
                      {session.gradingResult.feedback}
                    </div>
                  </div>
                )}

                {/* 错误详情 */}
                {session.gradingResult.detailedErrors && renderErrorDetails(session.gradingResult.detailedErrors)}

                {/* 改进建议 */}
                {session.gradingResult.suggestions && renderSuggestions(session.gradingResult.suggestions)}

                {/* 优点分析 */}
                {session.gradingResult.strengths && renderStrengths(session.gradingResult.strengths)}

                {/* 改进领域 */}
                {session.gradingResult.improvementAreas && session.gradingResult.improvementAreas.length > 0 && (
                  <div className="improvement-section">
                    <h4>🎯 需要改进的方面</h4>
                    <ul className="improvement-list">
                      {session.gradingResult.improvementAreas.map((area, index) => (
                        <li key={index} className="improvement-item">
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 下步建议 */}
                {session.gradingResult.nextStepRecommendations && session.gradingResult.nextStepRecommendations.length > 0 && (
                  <div className="recommendations-section">
                    <h4>🚀 下步学习建议</h4>
                    <ul className="recommendations-list">
                      {session.gradingResult.nextStepRecommendations.map((recommendation, index) => (
                        <li key={index} className="recommendation-item">
                          {recommendation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-result">
                <div className="empty-icon">🤖</div>
                <p>AI批改尚未完成</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      {showDeleteDialog && (
        <div className="delete-dialog-overlay">
          <div className="delete-dialog">
            <div className="delete-dialog-header">
              <h3>确认删除练习记录</h3>
            </div>
            <div className="delete-dialog-body">
              <p>确定要删除这条练习记录吗？此操作不可撤销，包括所有的OCR结果和AI批改内容都将被永久删除。</p>
            </div>
            <div className="delete-dialog-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
              >
                取消
              </button>
              <button 
                className="confirm-delete-btn"
                onClick={handleDeleteSession}
                disabled={deleting}
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};