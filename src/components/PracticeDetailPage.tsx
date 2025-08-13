import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { SimpleMarkdownRenderer } from './SimpleMarkdownRenderer';
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<{question: string, answer: string}[]>([]);

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

  const handleAskAI = async () => {
    if (!aiQuestion.trim() || aiThinking || !authState.token) return;

    try {
      setAiThinking(true);
      
      // 准备上下文信息
      const context = {
        ocrText: session?.ocrResult?.recognizedText || '',
        gradingResult: session?.gradingResult || null,
        question: aiQuestion.trim()
      };

      const response = await fetch(`${API_BASE_URL}/ai/question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          submissionId: sessionId,
          question: aiQuestion.trim(),
          context: context
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 添加到聊天历史
          setChatHistory(prev => [...prev, {
            question: aiQuestion.trim(),
            answer: result.data.answer || '抱歉，我无法回答这个问题。'
          }]);
          // 清空输入框
          setAiQuestion('');
        } else {
          // 如果API调用失败，提供通用回复
          setChatHistory(prev => [...prev, {
            question: aiQuestion.trim(),
            answer: '抱歉，当前AI服务暂时不可用，请稍后再试。'
          }]);
          setAiQuestion('');
        }
      } else {
        // 如果没有专门的questioning端点，提供通用回复
        setChatHistory(prev => [...prev, {
          question: aiQuestion.trim(),
          answer: '感谢你的提问！AI问答功能正在开发中，暂时无法提供详细回答。你可以查看上方的批改结果和改进建议。'
        }]);
        setAiQuestion('');
      }
    } catch (error) {
      console.error('AI提问失败:', error);
      // 提供友好的错误回复
      setChatHistory(prev => [...prev, {
        question: aiQuestion.trim(),
        answer: '抱歉，网络连接出现问题，请检查网络后重试。'
      }]);
      setAiQuestion('');
    } finally {
      setAiThinking(false);
    }
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
    <div className="practice-detail-fullpage">
      {/* 顶部导航栏 */}
      <div className="detail-navbar">
        <div className="navbar-left">
          <button className="back-button" onClick={onBack}>
            ← 返回
          </button>
          <div className="file-title">
            <span className="status-icon">{getStatusIcon(session.status)}</span>
            <h2>{session.fileInfo.originalName}</h2>
          </div>
        </div>
        <div className="navbar-right">
          <div className="score-display">
            {session.gradingResult && (
              <span className="score-badge">
                {session.gradingResult.score}/{session.gradingResult.maxScore}分
              </span>
            )}
          </div>
          <button 
            className="delete-button" 
            onClick={() => setShowDeleteDialog(true)}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 主内容区域 - 左右分栏 */}
      <div className="detail-content">
        {/* 左侧：识别结果 */}
        <div className="left-panel">
          <div className="panel-header">
            <h3>📋 作业识别</h3>
            <div className="file-meta">
              <span>{(session.fileInfo.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              <span>{new Date(session.submittedAt).toLocaleString('zh-CN')}</span>
            </div>
          </div>
          
          <div className="recognition-content">
            {session.progress.stage === 'ocr_processing' && (
              <div className="processing-indicator">
                <div className="loading-spinner"></div>
                <p>正在识别文档内容...</p>
              </div>
            )}
            
            {session.ocrResult ? (
              <div className="ocr-result">
                <div className="confidence-info">
                  <span>识别置信度: {(session.ocrResult.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="recognized-text">
                  <SimpleMarkdownRenderer 
                    content={session.ocrResult.recognizedText} 
                    className="ocr-content"
                  />
                </div>
              </div>
            ) : session.status === 'COMPLETED' || session.status === 'FAILED' ? (
              <div className="error-content">
                <div className="error-icon">⚠️</div>
                <h4>OCR识别失败</h4>
                <p>文档识别过程中出现问题，可能是文件格式不支持或内容包含特殊字符。</p>
                <div className="contact-info">
                  <p><strong>如需帮助，请联系管理员：</strong></p>
                  <p>📧 <a href="mailto:3220104512@zju.edu.cn">3220104512@zju.edu.cn</a></p>
                </div>
              </div>
            ) : (
              <div className="empty-content">
                <p>📄 OCR识别结果将在此显示</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：AI批改结果 */}
        <div className="right-panel">
          <div className="panel-header">
            <h3>🤖 AI批改解答</h3>
            {session.gradingResult && (
              <div className="grading-summary">
                <span className="question-count">题目数: {session.gradingResult.questionCount || 0}</span>
                <span className="correct-count">正确: {session.gradingResult.correctCount || 0}</span>
                <span className="incorrect-count">错误: {session.gradingResult.incorrectCount || 0}</span>
              </div>
            )}
          </div>

          <div className="grading-content">
            {session.progress.stage === 'ai_processing' && (
              <div className="processing-indicator">
                <div className="loading-spinner"></div>
                <p>AI正在智能批改...</p>
              </div>
            )}

            {session.gradingResult ? (
              <div className="grading-result">
                {/* 知识点 */}
                {session.gradingResult.knowledgePoints && session.gradingResult.knowledgePoints.length > 0 && (
                  <div className="knowledge-points-section">
                    <h4>📚 涉及知识点</h4>
                    <div className="knowledge-tags">
                      {session.gradingResult.knowledgePoints.map((point, index) => (
                        <span key={index} className="knowledge-tag">{point}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI反馈 */}
                <div className="feedback-section">
                  <h4>📝 AI分析反馈</h4>
                  <div className="feedback-text">
                    <SimpleMarkdownRenderer 
                      content={session.gradingResult.feedback} 
                      className="feedback-content"
                    />
                  </div>
                </div>

                {/* 错误分析 */}
                {session.gradingResult.detailedErrors && session.gradingResult.detailedErrors.length > 0 && 
                  renderErrorDetails(session.gradingResult.detailedErrors)
                }

                {/* 改进建议 */}
                {session.gradingResult.suggestions && session.gradingResult.suggestions.length > 0 && 
                  renderSuggestions(session.gradingResult.suggestions)
                }

                {/* 优点分析 */}
                {session.gradingResult.strengths && session.gradingResult.strengths.length > 0 && 
                  renderStrengths(session.gradingResult.strengths)
                }

                {/* AI问答区域 */}
                <div className="ai-chat-section">
                  <h4>💬 进一步提问</h4>
                  
                  {/* 聊天历史 */}
                  {chatHistory.length > 0 && (
                    <div className="chat-history">
                      {chatHistory.map((chat, index) => (
                        <div key={index} className="chat-pair">
                          <div className="user-question">
                            <strong>🙋 你：</strong> {chat.question}
                          </div>
                          <div className="ai-answer">
                            <strong>🤖 AI：</strong> {chat.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 问题输入 */}
                  <div className="question-input-area">
                    <textarea
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      placeholder="向AI提问关于这道题的任何问题..."
                      rows={3}
                      className="question-textarea"
                    />
                    <button 
                      className="ask-button"
                      onClick={handleAskAI}
                      disabled={!aiQuestion.trim() || aiThinking}
                    >
                      {aiThinking ? '🤔 思考中...' : '🚀 提问'}
                    </button>
                  </div>
                </div>
              </div>
            ) : session.status === 'COMPLETED' || session.status === 'FAILED' ? (
              <div className="error-content">
                <div className="error-icon">⚠️</div>
                <h4>AI批改失败</h4>
                <p>由于OCR识别失败，无法进行AI批改。请先解决文档识别问题。</p>
                <div className="contact-info">
                  <p><strong>如需帮助，请联系管理员：</strong></p>
                  <p>📧 <a href="mailto:3220104512@zju.edu.cn">3220104512@zju.edu.cn</a></p>
                </div>
              </div>
            ) : (
              <div className="empty-content">
                <p>🤖 AI批改结果将在此显示</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 全页面底部进度指示器 - 只在处理中显示 */}
      {session.status === 'PROCESSING' && (
        <div className="bottom-progress-bar">
          <div className="progress-info">
            <span className="progress-message">{session.progress.message}</span>
            <span className="progress-percent">{session.progress.percent}%</span>
          </div>
          <div className="progress-track">
            <div 
              className="progress-fill" 
              style={{ width: `${session.progress.percent}%` }}
            ></div>
          </div>
        </div>
      )}

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