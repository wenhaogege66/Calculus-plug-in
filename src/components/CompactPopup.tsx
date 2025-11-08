import React, { useState, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';

interface CompactPopupProps {
  authState: AuthState;
  onLogout: () => void;
}

interface ClassroomInfo {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
}

export const CompactPopup: React.FC<CompactPopupProps> = ({ authState, onLogout }) => {
  const [currentClassroom, setCurrentClassroom] = useState<ClassroomInfo | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClassroomManager, setShowClassroomManager] = useState(false);
  const storage = new Storage();

  const isTeacher = authState.user?.role === 'TEACHER';

  useEffect(() => {
    if (authState.isAuthenticated) {
      if (isTeacher) {
        loadTeacherClassrooms();
      } else {
        loadUserClassroom();
      }
    }
  }, [authState.isAuthenticated, isTeacher]);

  const loadUserClassroom = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/classrooms/my-classroom`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.classroom) {
          setCurrentClassroom(result.data.classroom);
        }
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherClassrooms = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/classrooms`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.classrooms) {
          setClassrooms(result.data.classrooms);
          if (result.data.classrooms.length > 0) {
            setCurrentClassroom(result.data.classrooms[0]);
          }
        }
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const openFullApp = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html')
    });
    window.close();
  };

  const openHomeworkMode = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#homework')
    });
    window.close();
  };

  const openPracticeMode = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#practice')
    });
    window.close();
  };

  const openSettings = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#settings')
    });
    window.close();
  };

  const openProfile = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#profile')
    });
    window.close();
  };

  const openHelp = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#help')
    });
    window.close();
  };

  const openFeedback = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#feedback')
    });
    window.close();
  };

  const openMessages = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#messages')
    });
    window.close();
  };

  const joinClassroom = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#classrooms')
    });
    window.close();
  };

  const openMistakes = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#mistakes')
    });
    window.close();
  };

  const openKnowledge = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#knowledge')
    });
    window.close();
  };

  const openClassroomManager = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#classroom-manager')
    });
    window.close();
  };

  const openCreateAssignment = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#create-assignment')
    });
    window.close();
  };

  const openViewAssignments = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#assignments')
    });
    window.close();
  };

  const openViewStudents = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/fullapp.html#students')
    });
    window.close();
  };

  return (
    <div className="compact-popup">
      {/* 头部用户信息 */}
      <div className="popup-header">
        <div className="user-info" onClick={openProfile}>
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
            <div className="username">{authState.user?.username}</div>
            <div className={`user-role ${isTeacher ? 'teacher' : 'student'}`}>
              {isTeacher ? '👨‍🏫 教师' : '🎓 学生'}
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="help-btn" onClick={openHelp} title="帮助">
            ❓
          </button>
          <button className="settings-btn" onClick={openSettings} title="设置">
            ⚙️
          </button>
        </div>
      </div>

      {/* 班级信息 */}
      <div className="classroom-section">
        {loading ? (
          <div className="loading-text">加载中...</div>
        ) : (
          <>
            {isTeacher ? (
              // 教师班级管理
              <div className="teacher-classroom">
                <div className="classroom-header">
                  <span className="classroom-title">📚 我的班级</span>
                  <button className="manage-btn" onClick={openClassroomManager}>
                    管理
                  </button>
                </div>
                {classrooms.length > 0 ? (
                  <div className="classroom-selector">
                    <select 
                      value={currentClassroom?.id || ''} 
                      onChange={(e) => {
                        const selected = classrooms.find(c => c.id === e.target.value);
                        setCurrentClassroom(selected || null);
                      }}
                      className="classroom-select"
                    >
                      {classrooms.map(classroom => (
                        <option key={classroom.id} value={classroom.id}>
                          {classroom.name} ({classroom.memberCount || 0}人)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="no-classroom">
                    <div className="no-classroom-icon">🏫</div>
                    <div className="no-classroom-text">
                      <div>还没有创建班级</div>
                      <button className="create-class-btn" onClick={openClassroomManager}>
                        创建班级
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // 学生班级信息
              <>
                {currentClassroom ? (
                  <div className="classroom-info">
                    <div className="classroom-icon">🏫</div>
                    <div className="classroom-details">
                      <div className="classroom-name">{currentClassroom.name}</div>
                      <div className="classroom-meta">
                        {currentClassroom.memberCount ? `${currentClassroom.memberCount}名成员` : '班级成员'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-classroom">
                    <div className="no-classroom-icon">👥</div>
                    <div className="no-classroom-text">
                      <div>未加入班级</div>
                      <button className="join-class-btn" onClick={joinClassroom}>
                        加入班级
                      </button>
                    </div>
                  </div>
                )}
                <div className="join-more-classes">
                  <button className="add-class-btn" onClick={joinClassroom} title="加入更多班级">
                    ➕
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* 主要功能按钮 */}
      <div className="main-actions">
        {isTeacher ? (
          // 教师功能
          <>
            <button className="action-btn primary" onClick={openCreateAssignment}>
              <div className="action-icon">📝</div>
              <div className="action-text">
                <div className="action-title">布置作业</div>
                <div className="action-desc">创建新的作业任务</div>
              </div>
            </button>

            <div className="teacher-actions-row">
              <button className="action-btn secondary small" onClick={openViewAssignments}>
                <div className="action-icon">📊</div>
                <div className="action-text">
                  <div className="action-title">查看作业</div>
                </div>
              </button>
              <button className="action-btn secondary small" onClick={openViewStudents}>
                <div className="action-icon">👥</div>
                <div className="action-text">
                  <div className="action-title">班级学生</div>
                </div>
              </button>
            </div>
          </>
        ) : (
          // 学生功能
          <>
            <button className="action-btn primary" onClick={openHomeworkMode}>
              <div className="action-icon">📝</div>
              <div className="action-text">
                <div className="action-title">作业模式</div>
                <div className="action-desc">提交班级作业</div>
              </div>
            </button>

            <button className="action-btn secondary" onClick={openPracticeMode}>
              <div className="action-icon">🎯</div>
              <div className="action-text">
                <div className="action-title">练习模式</div>
                <div className="action-desc">自主练习题目</div>
              </div>
            </button>

            <div className="student-tools">
              <button className="tool-btn" onClick={openMistakes}>
                <div className="tool-icon">📚</div>
                <div className="tool-text">错题本</div>
              </button>
              <button className="tool-btn" onClick={openKnowledge}>
                <div className="tool-icon">🧠</div>
                <div className="tool-text">知识图谱</div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 底部操作 */}
      <div className="popup-footer">
        <button className="footer-btn" onClick={openFeedback}>
          <span>💬</span>
          反馈
        </button>
        <button className="footer-btn" onClick={openMessages}>
          <span>📢</span>
          消息
        </button>
        <button className="footer-btn" onClick={openFullApp}>
          <span>🔍</span>
          完整界面
        </button>
        <button className="logout-btn" onClick={onLogout}>
          <span>🚪</span>
          退出
        </button>
      </div>
    </div>
  );
};