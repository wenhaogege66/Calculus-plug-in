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

interface SimilarQuestion {
  id: number;
  content: string;
  standardAnswer: string;
  difficultyLevel: number;
  knowledgePoints: string[];
  aiGradingResult?: {
    score: number;
    maxScore: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
  };
}

interface SimilarQuestionsParams {
  difficultyLevel: number;
  questionCount: number;
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
  
  // 类似题相关状态
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const [similarQuestionsParams, setSimilarQuestionsParams] = useState<SimilarQuestionsParams>({
    difficultyLevel: 3,
    questionCount: 3
  });
  const [generatingSimilar, setGeneratingSimilar] = useState(false);
  const [visibleAnswers, setVisibleAnswers] = useState<Set<number>>(new Set());
  const [questionAnswers, setQuestionAnswers] = useState<{[key: number]: string}>({});
  const [questionRatings, setQuestionRatings] = useState<{[key: number]: number}>({});

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
        // 尝试解析错误响应
        try {
          const errorResult = await response.json();
          setError(errorResult.error || `HTTP ${response.status}: 获取练习详情失败`);
        } catch {
          setError(`HTTP ${response.status}: 获取练习详情失败`);
        }
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

  // 类似题相关函数
  const generateSimilarQuestions = async () => {
    if (!authState.token || !session || generatingSimilar) return;

    try {
      setGeneratingSimilar(true);
      
      const response = await fetch(`${API_BASE_URL}/practice/${sessionId}/generate-similar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(similarQuestionsParams)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSimilarQuestions(result.data.generatedQuestions || []);
        } else {
          setError('生成类似题失败: ' + (result.error || '未知错误'));
        }
      } else {
        setError('生成类似题失败，请稍后重试');
      }
    } catch (error) {
      console.error('生成类似题出错:', error);
      setError('生成类似题失败，请检查网络连接');
    } finally {
      setGeneratingSimilar(false);
    }
  };

  const toggleAnswerVisibility = (questionId: number) => {
    setVisibleAnswers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  // 下载DOCX文件功能
  const downloadDocx = async () => {
    if (!session || !authState.token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/ocr/download/docx/${session.submissionId}`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ocr-result-${session.submissionId}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('下载DOCX失败:', response.statusText);
      }
    } catch (error) {
      console.error('下载DOCX出错:', error);
    }
  };

  const submitSimilarQuestionAnswer = async (questionId: number) => {
    const userAnswer = questionAnswers[questionId];
    if (!userAnswer?.trim() || !authState.token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/practice/similar-questions/${questionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          userAnswer: userAnswer.trim(),
          requestFeedback: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.aiGradingResult) {
          // 更新题目的AI评分结果
          setSimilarQuestions(prev => prev.map(q => 
            q.id === questionId 
              ? { ...q, aiGradingResult: result.data.aiGradingResult }
              : q
          ));
        }
      } else {
        setError('提交答案失败，请稍后重试');
      }
    } catch (error) {
      console.error('提交答案出错:', error);
      setError('提交答案失败，请检查网络连接');
    }
  };

  const rateQuestion = async (questionId: number, rating: number) => {
    if (!authState.token) return;

    try {
      setQuestionRatings(prev => ({ ...prev, [questionId]: rating }));
      
      await fetch(`${API_BASE_URL}/practice/similar-questions/${questionId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({ rating })
      });
    } catch (error) {
      console.error('评分失败:', error);
      // 静默处理评分错误，不影响用户体验
    }
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim() || aiThinking || !authState.token) return;

    try {
      setAiThinking(true);
      
      const response = await fetch(`${API_BASE_URL}/ai/follow-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          submissionId: parseInt(sessionId),
          question: aiQuestion.trim()
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
      <div className="error-details enhanced">
        <div className="section-header">
          <h4>🔍 错误详情分析</h4>
          <span className="count-badge error">{errors.length}</span>
        </div>
        <div className="error-list">
          {errors.map((error, index) => (
            <div key={index} className="error-item enhanced">
              <div className="error-icon">
                {error.severity === 'major' ? '🔴' : 
                 error.severity === 'minor' ? '🟢' : '🟡'}
              </div>
              <div className="error-content">
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
                  <div className="error-section">
                    <span className="section-label">问题内容：</span>
                    <span className="section-content">{error.content}</span>
                  </div>
                )}
                {error.correction && (
                  <div className="error-section correction">
                    <span className="section-label">正确答案：</span>
                    <span className="section-content">{error.correction}</span>
                  </div>
                )}
                {error.explanation && (
                  <div className="error-section explanation">
                    <span className="section-label">解释：</span>
                    <span className="section-content">{error.explanation}</span>
                  </div>
                )}
                {error.knowledgePoint && (
                  <div className="error-section knowledge">
                    <span className="section-label">相关知识点：</span>
                    <span className="knowledge-tag-inline enhanced">{error.knowledgePoint}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSuggestions = (suggestions: any[]) => {
    if (!suggestions || suggestions.length === 0) return null;

    return (
      <div className="suggestions-details enhanced">
        <div className="section-header">
          <h4>💡 改进建议</h4>
          <span className="count-badge suggestion">{suggestions.length}</span>
        </div>
        <div className="suggestion-list">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="suggestion-item enhanced">
              <div className="suggestion-icon">
                {suggestion.priority === 'high' ? '🔥' : 
                 suggestion.priority === 'medium' ? '⚡' : '💭'}
              </div>
              <div className="suggestion-content">
                <div className="suggestion-header">
                  <span className="suggestion-aspect">{suggestion.aspect || '建议'}</span>
                  {suggestion.priority && (
                    <span className={`priority-badge ${suggestion.priority}`}>
                      {suggestion.priority === 'high' ? '高优先级' : 
                       suggestion.priority === 'medium' ? '中优先级' : '低优先级'}
                    </span>
                  )}
                </div>
                <div className="suggestion-description">
                  {suggestion.recommendation || suggestion.description || suggestion}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStrengths = (strengths: any[]) => {
    if (!strengths || strengths.length === 0) return null;

    return (
      <div className="strengths-details enhanced">
        <div className="section-header">
          <h4>🌟 优点分析</h4>
          <span className="count-badge strength">{strengths.length}</span>
        </div>
        <div className="strength-list">
          {strengths.map((strength, index) => (
            <div key={index} className="strength-item enhanced">
              <div className="strength-icon">
                {strength.importance === 'high' ? '⭐' : 
                 strength.importance === 'medium' ? '✨' : '💫'}
              </div>
              <div className="strength-content">
                <div className="strength-header">
                  <span className="strength-aspect">{strength.aspect || '优点'}</span>
                  {strength.importance && (
                    <span className={`importance-badge ${strength.importance}`}>
                      {strength.importance === 'high' ? '非常重要' : 
                       strength.importance === 'medium' ? '比较重要' : '一般重要'}
                    </span>
                  )}
                </div>
                <div className="strength-description">
                  {strength.description || strength}
                </div>
              </div>
            </div>
          ))}
        </div>
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
              <div className="score-card">
                <div className="score-circle">
                  <div className="score-number">{session.gradingResult.score}</div>
                  <div className="score-divider">/</div>
                  <div className="score-max">{session.gradingResult.maxScore}</div>
                </div>
                <div className="score-label">
                  {session.gradingResult.score >= 90 ? '优秀' :
                   session.gradingResult.score >= 80 ? '良好' :
                   session.gradingResult.score >= 70 ? '中等' :
                   session.gradingResult.score >= 60 ? '及格' : '需改进'}
                </div>
              </div>
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
                  <button 
                    className="download-docx-btn"
                    onClick={downloadDocx}
                    title="下载Word格式文档"
                  >
                    📄 下载DOCX
                  </button>
                </div>
                <div className="recognized-text">
                  <SimpleMarkdownRenderer 
                    content={session.ocrResult?.recognizedText || ''} 
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
                  <div className="knowledge-points-section enhanced">
                    <div className="section-header">
                      <h4>📚 涉及知识点</h4>
                      <span className="count-badge">{session.gradingResult.knowledgePoints.length}</span>
                    </div>
                    <div className="knowledge-tags enhanced">
                      {session.gradingResult.knowledgePoints.map((point, index) => (
                        <span key={index} className="knowledge-tag enhanced">
                          <span className="tag-icon">📖</span>
                          <span className="tag-text">{point}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI反馈 */}
                <div className="feedback-section enhanced">
                  <div className="section-header">
                    <h4>📝 AI分析反馈</h4>
                    <div className="feedback-stats">
                      <span className="stat-item">
                        <span className="stat-icon">✅</span>
                        <span>正确 {session.gradingResult.correctCount || 0}</span>
                      </span>
                      <span className="stat-item">
                        <span className="stat-icon">❌</span>
                        <span>错误 {session.gradingResult.incorrectCount || 0}</span>
                      </span>
                    </div>
                  </div>
                  <div className="feedback-content-wrapper">
                    <SimpleMarkdownRenderer 
                      content={session.gradingResult?.feedback || ''} 
                      className="feedback-content enhanced"
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

                {/* 类似题生成区域 */}
                <div className="similar-questions-section">
                  <h4>🔄 AI智能练习</h4>
                  <div className="similar-questions-controls">
                    <div className="generation-options">
                      <div className="option-group">
                        <label>难度等级:</label>
                        <select 
                          value={similarQuestionsParams.difficultyLevel} 
                          onChange={(e) => setSimilarQuestionsParams({
                            ...similarQuestionsParams,
                            difficultyLevel: parseInt(e.target.value)
                          })}
                        >
                          <option value={1}>⭐ 简单</option>
                          <option value={2}>⭐⭐ 较易</option>
                          <option value={3}>⭐⭐⭐ 中等</option>
                          <option value={4}>⭐⭐⭐⭐ 较难</option>
                          <option value={5}>⭐⭐⭐⭐⭐ 困难</option>
                        </select>
                      </div>
                      <div className="option-group">
                        <label>生成数量:</label>
                        <select 
                          value={similarQuestionsParams.questionCount} 
                          onChange={(e) => setSimilarQuestionsParams({
                            ...similarQuestionsParams,
                            questionCount: parseInt(e.target.value)
                          })}
                        >
                          <option value={1}>1题</option>
                          <option value={2}>2题</option>
                          <option value={3}>3题</option>
                          <option value={5}>5题</option>
                        </select>
                      </div>
                    </div>
                    <button 
                      className="generate-similar-btn" 
                      onClick={generateSimilarQuestions}
                      disabled={generatingSimilar}
                    >
                      {generatingSimilar ? (
                        <>
                          <div className="loading-spinner-small"></div>
                          AI生成中...
                        </>
                      ) : (
                        <>🎯 生成针对性练习题</>
                      )}
                    </button>
                  </div>

                  {/* 类似题显示区域 */}
                  {similarQuestions.length > 0 && (
                    <div className="generated-questions">
                      <h5>🎯 基于你的错误生成的针对性练习题</h5>
                      {similarQuestions.map((question, index) => (
                        <div key={question.id} className="similar-question-card">
                          <div className="question-header">
                            <span className="question-number">第 {index + 1} 题</span>
                            <div className="question-meta">
                              <span className="difficulty-badge difficulty-{question.difficultyLevel}">
                                {'⭐'.repeat(question.difficultyLevel)}
                              </span>
                              {question.knowledgePoints.map((kp, idx) => (
                                <span key={idx} className="knowledge-point-tag">{kp}</span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="question-content">
                            <SimpleMarkdownRenderer 
                              content={question.content || ''} 
                              className="question-text"
                            />
                          </div>

                          <div className="question-actions">
                            <button 
                              className="show-answer-btn"
                              onClick={() => toggleAnswerVisibility(question.id)}
                            >
                              {visibleAnswers.has(question.id) ? '隐藏答案' : '查看答案'}
                            </button>
                            
                            <div className="answer-input-section">
                              <textarea
                                placeholder="在此输入你的解答..."
                                value={questionAnswers[question.id] || ''}
                                onChange={(e) => setQuestionAnswers({
                                  ...questionAnswers,
                                  [question.id]: e.target.value
                                })}
                                className="answer-input"
                                rows={4}
                              />
                              <button
                                className="submit-answer-btn"
                                onClick={() => submitSimilarQuestionAnswer(question.id)}
                                disabled={!questionAnswers[question.id]?.trim()}
                              >
                                📋 提交并获得AI反馈
                              </button>
                            </div>
                          </div>

                          {visibleAnswers.has(question.id) && (
                            <div className="standard-answer">
                              <h6>📚 标准答案：</h6>
                              <SimpleMarkdownRenderer 
                                content={question.standardAnswer || ''} 
                                className="answer-content"
                              />
                            </div>
                          )}

                          {question.aiGradingResult && (
                            <div className="ai-feedback">
                              <h6>🤖 AI评分反馈：</h6>
                              <div className="feedback-score">
                                得分：{question.aiGradingResult.score}/{question.aiGradingResult.maxScore}分
                              </div>
                              <div className="feedback-text">
                                <SimpleMarkdownRenderer 
                                  content={question.aiGradingResult?.feedback || ''} 
                                  className="feedback-content"
                                />
                              </div>
                            </div>
                          )}

                          <div className="question-rating">
                            <span>题目质量评分：</span>
                            {[1, 2, 3, 4, 5].map(rating => (
                              <button
                                key={rating}
                                className={`rating-star ${(questionRatings[question.id] || 0) >= rating ? 'filled' : ''}`}
                                onClick={() => rateQuestion(question.id, rating)}
                              >
                                ⭐
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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