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
    return (
      <div className="user-info">
        <div className="user-avatar">
          {authState.user?.avatarUrl ? (
            <img src={authState.user.avatarUrl} alt="头像" />
          ) : (
            <div className="avatar-placeholder">
              {authState.user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </div>
        <div className="user-details">
          <h3>{authState.user?.username}</h3>
          <p>{authState.user?.email}</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="auth-section">
      <div className="auth-prompt">
        <h3>🔐 请先登录</h3>
        <p>使用GitHub账户登录以上传作业</p>
      </div>
      
      <button
        className="github-login-btn"
        onClick={onGitHubLogin}
        disabled={uploadStatus.uploading}
      >
        {uploadStatus.uploading ? (
          <>
            <div className="spinner small"></div>
            连接中...
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            使用GitHub登录
          </>
        )}
      </button>

      <div className="auth-notice">
        <h4>⚠️ 登录后才能使用的功能：</h4>
        <ul>
          <li>📤 上传作业文件</li>
          <li>🔍 OCR手写识别</li>
          <li>🤖 AI智能批改</li>
          <li>📊 查看批改历史</li>
        </ul>
      </div>

      {uploadStatus.message && (
        <div className={`status-message ${uploadStatus.message.includes('失败') || uploadStatus.message.includes('❌') || uploadStatus.message.includes('超时') || uploadStatus.message.includes('⚠️') ? 'error' : 'success'}`}>
          {uploadStatus.message}
        </div>
      )}
    </div>
  );
}; 