import React from 'react';
import type { AuthState } from '../common/config/supabase';

interface AuthSectionProps {
  authState: AuthState;
  uploadStatus: {
    uploading: boolean;
    progress: number;
    message: string;
  };
  onGitHubLogin: () => void;
  onLogout: () => void;
}

export const AuthSection: React.FC<AuthSectionProps> = ({
  authState,
  uploadStatus,
  onGitHubLogin,
  onLogout
}) => {
  if (authState.isAuthenticated) {
    return null; // 已登录状态不在这里处理
  }

  return (
    <div className="auth-section">
      {/* 项目介绍区域 */}
      <div className="project-intro">
        <div className="intro-header">
          <div className="intro-logo">🔬</div>
          <div className="intro-title">AI微积分助教</div>
          <div className="intro-subtitle">智能化数学学习与批改平台</div>
        </div>
        
        <div className="intro-description">
          <p>
            基于先进的AI技术，为师生提供智能化的微积分学习解决方案。
            集成OCR数学公式识别、智能批改、个性化学习建议等功能，
            让数学学习更加高效便捷。
          </p>
        </div>

        <div className="intro-highlights">
          <div className="highlight-item">
            <div className="highlight-icon">✨</div>
            <div className="highlight-text">
              <strong>智能识别</strong>
              <span>MathPix OCR精确识别手写数学公式</span>
            </div>
          </div>
          <div className="highlight-item">
            <div className="highlight-icon">🤖</div>
            <div className="highlight-text">
              <strong>AI批改</strong>
              <span>Deepseek AI提供详细的作业分析与建议</span>
            </div>
          </div>
          <div className="highlight-item">
            <div className="highlight-icon">👥</div>
            <div className="highlight-text">
              <strong>班级管理</strong>
              <span>完整的师生互动和作业管理系统</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-prompt">
        <div className="auth-title">🔐 开始体验</div>
        <div className="auth-subtitle">使用GitHub账户登录，立即开启智能学习之旅</div>
      </div>
      
      <button
        className="github-login-btn"
        onClick={onGitHubLogin}
        disabled={uploadStatus.uploading}
      >
        {uploadStatus.uploading ? (
          <>
            <div className="login-spinner"></div>
            <span>连接中...</span>
          </>
        ) : (
          <>
            <svg className="github-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>使用GitHub登录</span>
          </>
        )}
      </button>

      <div className="auth-features">
        <div className="feature-title">✨ 登录后即可使用</div>
        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon">📝</div>
            <div className="feature-text">作业批改</div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🔍</div>
            <div className="feature-text">OCR识别</div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🤖</div>
            <div className="feature-text">AI分析</div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">📊</div>
            <div className="feature-text">学习统计</div>
          </div>
        </div>
      </div>

      {uploadStatus.message && (
        <div className={`status-message ${
          uploadStatus.message.includes('失败') || 
          uploadStatus.message.includes('❌') || 
          uploadStatus.message.includes('超时') || 
          uploadStatus.message.includes('⚠️') ? 'error' : 'success'
        }`}>
          {uploadStatus.message}
        </div>
      )}
    </div>
  );
};