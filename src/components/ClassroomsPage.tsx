import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';

interface Classroom {
  id: number;
  name: string;
  description?: string;
  inviteCode?: string;
  memberCount?: number;
  assignmentCount?: number;
  createdAt: string;
  teacher?: {
    id: number;
    username: string;
  };
  joinedAt?: string;
}

interface Member {
  id: number;
  student: {
    id: number;
    username: string;
    email?: string;
    avatarUrl?: string;
  };
  joinedAt: string;
}

interface ClassroomsPageProps {
  authState: AuthState;
}

export const ClassroomsPage: React.FC<ClassroomsPageProps> = ({ authState }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: ''
  });
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isTeacher = authState.user?.role === 'TEACHER';

  useEffect(() => {
    loadClassrooms();
  }, [authState.token]);

  const loadClassrooms = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      setError('');

      const endpoint = isTeacher ? '/classrooms/teacher' : '/classrooms/student';
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setClassrooms(data.data);
        } else {
          setError(data.error || '获取班级列表失败');
        }
      } else {
        throw new Error('网络请求失败');
      }
    } catch (err) {
      console.error('加载班级失败:', err);
      setError('加载班级列表失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (classroomId: number) => {
    if (!authState.token || !isTeacher) return;

    try {
      const response = await fetch(`${API_BASE_URL}/classrooms/${classroomId}/members`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMembers(data.data);
        }
      }
    } catch (err) {
      console.error('加载班级成员失败:', err);
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.token || !createForm.name.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/classrooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(createForm)
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setCreateForm({ name: '', description: '' });
        await loadClassrooms();
      } else {
        setError(data.error || '创建班级失败');
      }
    } catch (err) {
      console.error('创建班级失败:', err);
      setError('创建班级失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.token || !joinCode.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/classrooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({ inviteCode: joinCode.trim().toUpperCase() })
      });

      const data = await response.json();
      if (data.success) {
        setShowJoinModal(false);
        setJoinCode('');
        await loadClassrooms();
      } else {
        setError(data.error || '加入班级失败');
      }
    } catch (err) {
      console.error('加入班级失败:', err);
      setError('加入班级失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      // 这里可以添加一个 toast 提示
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="classrooms-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="classrooms-page">
      <div className="page-header">
        <div className="header-content">
          <h1>{isTeacher ? '🏫 班级管理' : '🏫 我的班级'}</h1>
          <p className="page-description">
            {isTeacher ? '管理您的班级和学生' : '查看已加入的班级信息'}
          </p>
        </div>
        
        <div className="header-actions">
          {isTeacher ? (
            <button
              className="btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <span className="btn-icon">➕</span>
              <span>创建班级</span>
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => setShowJoinModal(true)}
            >
              <span className="btn-icon">🔗</span>
              <span>加入班级</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button className="error-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {classrooms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏫</div>
          <h3>{isTeacher ? '还没有创建任何班级' : '还没有加入任何班级'}</h3>
          <p>{isTeacher ? '创建您的第一个班级开始教学' : '使用邀请码加入班级开始学习'}</p>
        </div>
      ) : (
        <div className="classrooms-content">
          <div className="classrooms-grid">
            {classrooms.map(classroom => (
              <div key={classroom.id} className="classroom-card">
                <div className="card-header">
                  <div className="classroom-info">
                    <h3 className="classroom-name">{classroom.name}</h3>
                    {classroom.description && (
                      <p className="classroom-description">{classroom.description}</p>
                    )}
                  </div>
                  
                  {isTeacher && classroom.inviteCode && (
                    <div className="invite-code-section">
                      <span className="invite-label">邀请码</span>
                      <div className="invite-code">
                        <span className="code-text">{classroom.inviteCode}</span>
                        <button 
                          className="copy-btn"
                          onClick={() => copyInviteCode(classroom.inviteCode!)}
                          title="复制邀请码"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="classroom-stats">
                  <div className="stat-item">
                    <span className="stat-icon">👥</span>
                    <span className="stat-text">{classroom.memberCount || 0}名学生</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">📝</span>
                    <span className="stat-text">{classroom.assignmentCount || 0}个作业</span>
                  </div>
                  {!isTeacher && classroom.teacher && (
                    <div className="stat-item">
                      <span className="stat-icon">👨‍🏫</span>
                      <span className="stat-text">{classroom.teacher.username}</span>
                    </div>
                  )}
                </div>

                <div className="classroom-meta">
                  <span className="meta-text">
                    {isTeacher ? `创建于 ${formatDate(classroom.createdAt)}` : 
                     classroom.joinedAt ? `加入于 ${formatDate(classroom.joinedAt)}` : 
                     `创建于 ${formatDate(classroom.createdAt)}`}
                  </span>
                </div>

                <div className="card-actions">
                  {isTeacher ? (
                    <>
                      <button 
                        className="btn-secondary small"
                        onClick={() => {
                          setSelectedClassroom(classroom);
                          loadMembers(classroom.id);
                        }}
                      >
                        <span className="btn-icon">👥</span>
                        <span>查看学生</span>
                      </button>
                      <button className="btn-secondary small">
                        <span className="btn-icon">📊</span>
                        <span>班级统计</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn-secondary small">
                        <span className="btn-icon">📝</span>
                        <span>查看作业</span>
                      </button>
                      <button className="btn-secondary small">
                        <span className="btn-icon">📊</span>
                        <span>我的成绩</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 创建班级模态框 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>创建新班级</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreateClassroom} className="modal-form">
              <div className="form-group">
                <label htmlFor="className">班级名称 *</label>
                <input
                  id="className"
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                  placeholder="如：高等数学A班"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="classDescription">班级描述</label>
                <textarea
                  id="classDescription"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  placeholder="简单描述这个班级..."
                  rows={3}
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting || !createForm.name.trim()}
                >
                  {submitting ? '创建中...' : '创建班级'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 加入班级模态框 */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>加入班级</h2>
              <button className="close-btn" onClick={() => setShowJoinModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleJoinClassroom} className="modal-form">
              <div className="form-group">
                <label htmlFor="inviteCode">邀请码 *</label>
                <input
                  id="inviteCode"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="输入8位邀请码"
                  maxLength={8}
                  required
                />
                <small className="form-help">请向您的老师索取邀请码</small>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowJoinModal(false)}
                  disabled={submitting}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting || !joinCode.trim()}
                >
                  {submitting ? '加入中...' : '加入班级'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 班级成员模态框 */}
      {selectedClassroom && (
        <div className="modal-overlay" onClick={() => setSelectedClassroom(null)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedClassroom.name} - 班级成员</h2>
              <button className="close-btn" onClick={() => setSelectedClassroom(null)}>✕</button>
            </div>
            
            <div className="members-list">
              {members.length === 0 ? (
                <div className="empty-members">
                  <p>暂无学生加入</p>
                </div>
              ) : (
                members.map(member => (
                  <div key={member.id} className="member-item">
                    <div className="member-info">
                      <div className="member-avatar">
                        {member.student.avatarUrl ? (
                          <img src={member.student.avatarUrl} alt="头像" />
                        ) : (
                          <div className="avatar-placeholder">
                            {member.student.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="member-details">
                        <div className="member-name">{member.student.username}</div>
                        <div className="member-email">{member.student.email}</div>
                        <div className="member-date">加入于 {formatDate(member.joinedAt)}</div>
                      </div>
                    </div>
                    <div className="member-actions">
                      <button className="btn-secondary small">消息</button>
                      <button className="btn-secondary small danger">移除</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};