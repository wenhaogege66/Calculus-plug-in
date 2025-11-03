import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { MathPixMarkdownRenderer } from './MathPixMarkdownRenderer';
import './KnowledgePointDetail.css';

interface KnowledgePointError {
  id: number;
  errorType: string;
  errorDescription: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  practiceFile: string;
}

interface RelatedQuestion {
  id: number;
  content: string;
  difficultyLevel: number;
  isCompleted: boolean;
  userRating?: number;
}

interface KnowledgePointDetailData {
  id: number;
  name: string;
  chapter: string;
  level: number;
  description: string;
  keywords: string[];
  functionExamples: string[];
  difficultyLevel: number;
  aiExplanation: string;
  parent?: {
    id: number;
    name: string;
  };
  children: Array<{
    id: number;
    name: string;
    masteryLevel: number;
  }>;
  userStats: {
    errorCount: number;
    masteryLevel: number;
    status: 'mastered' | 'learning' | 'weak';
    recentErrors: KnowledgePointError[];
  };
  relatedQuestions: RelatedQuestion[];
}

interface KnowledgePointDetailProps {
  knowledgePointId: number;
  authState: AuthState;
  onClose: () => void;
  onNavigateToChild: (childId: number) => void;
  onPracticeQuestion: (questionId: number) => void;
}

export const KnowledgePointDetail: React.FC<KnowledgePointDetailProps> = ({
  knowledgePointId,
  authState,
  onClose,
  onNavigateToChild,
  onPracticeQuestion
}) => {
  const [data, setData] = useState<KnowledgePointDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    explanation: true,
    hierarchy: true,
    errors: false,
    questions: false
  });

  useEffect(() => {
    loadKnowledgePointDetail();
  }, [knowledgePointId, authState.token]);

  const loadKnowledgePointDetail = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/knowledge/${knowledgePointId}/details`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || '获取知识点详情失败');
        }
      } else {
        setError('获取知识点详情失败');
      }
    } catch (err) {
      console.error('加载知识点详情失败:', err);
      setError('加载知识点详情失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'mastered': return '#10b981';
      case 'learning': return '#f59e0b';
      case 'weak': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return '#ef4444';
      case 'MEDIUM': return '#f59e0b';
      case 'LOW': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="knowledge-detail-container">
        <div className="detail-loading">
          <div className="loading-spinner"></div>
          <p>加载知识点详情...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="knowledge-detail-container">
        <div className="detail-error">
          <div className="error-icon">⚠️</div>
          <h3>加载失败</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button className="retry-btn" onClick={loadKnowledgePointDetail}>
              重试
            </button>
            <button className="close-btn" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="knowledge-detail-container">
      <div className="detail-modal">
        {/* 头部 */}
        <div className="detail-header">
          <div className="header-content">
            <div className="breadcrumb">
              {data.parent && (
                <>
                  <span className="breadcrumb-item">{data.parent.name}</span>
                  <span className="breadcrumb-separator">›</span>
                </>
              )}
              <span className="breadcrumb-current">{data.name}</span>
            </div>
            <h2>{data.name}</h2>
            <div className="knowledge-meta">
              <span className="chapter-tag">{data.chapter}</span>
              <span className="level-tag">第 {data.level} 级</span>
              <span className="difficulty-tag">
                难度: {'★'.repeat(data.difficultyLevel)}{'☆'.repeat(5 - data.difficultyLevel)}
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* 掌握度状态 */}
        <div className="mastery-status">
          <div className="status-card">
            <div className="status-header">
              <h4>掌握程度</h4>
              <span 
                className="status-badge"
                style={{ backgroundColor: getStatusColor(data.userStats.status) }}
              >
                {data.userStats.status === 'mastered' ? '已掌握' : 
                 data.userStats.status === 'learning' ? '学习中' : '需加强'}
              </span>
            </div>
            <div className="mastery-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${data.userStats.masteryLevel}%`,
                    backgroundColor: getStatusColor(data.userStats.status)
                  }}
                />
              </div>
              <span className="progress-text">{data.userStats.masteryLevel}%</span>
            </div>
            <div className="status-stats">
              <div className="stat-item">
                <span className="stat-value">{data.userStats.errorCount}</span>
                <span className="stat-label">错误次数</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{data.children.length}</span>
                <span className="stat-label">子知识点</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{data.relatedQuestions.length}</span>
                <span className="stat-label">相关练习</span>
              </div>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="detail-content">
          {/* AI解释 */}
          <div className="content-section">
            <div 
              className="section-header"
              onClick={() => toggleSection('explanation')}
            >
              <h3>🤖 AI智能解释</h3>
              <span className={`expand-icon ${expandedSections.explanation ? 'expanded' : ''}`}>
                ▼
              </span>
            </div>
            {expandedSections.explanation && (
              <div className="section-content">
                <div className="ai-explanation">
                  <MathPixMarkdownRenderer
                    content={data.aiExplanation || ''}
                    className="explanation-content"
                  />
                </div>
                <div className="knowledge-keywords">
                  <h4>关键词</h4>
                  <div className="keyword-tags">
                    {data.keywords.map((keyword, idx) => (
                      <span key={idx} className="keyword-tag">{keyword}</span>
                    ))}
                  </div>
                </div>
                {data.functionExamples.length > 0 && (
                  <div className="function-examples">
                    <h4>函数示例</h4>
                    <div className="example-list">
                      {data.functionExamples.map((example, idx) => (
                        <code key={idx} className="example-code">{example}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 知识层次 */}
          {data.children.length > 0 && (
            <div className="content-section">
              <div 
                className="section-header"
                onClick={() => toggleSection('hierarchy')}
              >
                <h3>🌳 知识层次</h3>
                <span className={`expand-icon ${expandedSections.hierarchy ? 'expanded' : ''}`}>
                  ▼
                </span>
              </div>
              {expandedSections.hierarchy && (
                <div className="section-content">
                  <div className="children-grid">
                    {data.children.map(child => (
                      <div 
                        key={child.id} 
                        className="child-card"
                        onClick={() => onNavigateToChild(child.id)}
                      >
                        <h4>{child.name}</h4>
                        <div className="child-progress">
                          <div className="mini-progress-bar">
                            <div 
                              className="mini-progress-fill"
                              style={{ 
                                width: `${child.masteryLevel}%`,
                                backgroundColor: child.masteryLevel > 80 ? '#10b981' : 
                                                child.masteryLevel > 50 ? '#f59e0b' : '#ef4444'
                              }}
                            />
                          </div>
                          <span className="progress-percent">{child.masteryLevel}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 错误分析 */}
          {data.userStats.recentErrors.length > 0 && (
            <div className="content-section">
              <div 
                className="section-header"
                onClick={() => toggleSection('errors')}
              >
                <h3>⚠️ 错误分析</h3>
                <span className={`expand-icon ${expandedSections.errors ? 'expanded' : ''}`}>
                  ▼
                </span>
              </div>
              {expandedSections.errors && (
                <div className="section-content">
                  <div className="error-list">
                    {data.userStats.recentErrors.map(error => (
                      <div key={error.id} className="error-item">
                        <div className="error-header">
                          <span className="error-type">{error.errorType}</span>
                          <span 
                            className="severity-badge"
                            style={{ backgroundColor: getSeverityColor(error.severity) }}
                          >
                            {error.severity}
                          </span>
                          <span className="error-date">{formatDate(error.createdAt)}</span>
                        </div>
                        <p className="error-description">{error.errorDescription}</p>
                        <span className="error-file">来源: {error.practiceFile}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 相关练习 */}
          {data.relatedQuestions.length > 0 && (
            <div className="content-section">
              <div 
                className="section-header"
                onClick={() => toggleSection('questions')}
              >
                <h3>📚 相关练习</h3>
                <span className={`expand-icon ${expandedSections.questions ? 'expanded' : ''}`}>
                  ▼
                </span>
              </div>
              {expandedSections.questions && (
                <div className="section-content">
                  <div className="questions-grid">
                    {data.relatedQuestions.map(question => (
                      <div 
                        key={question.id} 
                        className={`question-card ${question.isCompleted ? 'completed' : 'pending'}`}
                        onClick={() => onPracticeQuestion(question.id)}
                      >
                        <div className="question-header">
                          <span className="difficulty-stars">
                            {'★'.repeat(question.difficultyLevel)}
                            {'☆'.repeat(5 - question.difficultyLevel)}
                          </span>
                          {question.isCompleted && <span className="completed-badge">✓</span>}
                        </div>
                        <p className="question-content">{question.content}</p>
                        {question.userRating && (
                          <div className="question-rating">
                            评分: {'⭐'.repeat(question.userRating)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="detail-footer">
          <button 
            className="action-btn practice-btn"
            onClick={() => {
              // 导航到练习模式，专门练习此知识点
              window.location.hash = '#/practice';
            }}
          >
            🎯 专项练习
          </button>
          {data.parent && (
            <button 
              className="action-btn parent-btn"
              onClick={() => onNavigateToChild(data.parent!.id)}
            >
              ⬆️ 返回上级
            </button>
          )}
          <button className="action-btn close-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};