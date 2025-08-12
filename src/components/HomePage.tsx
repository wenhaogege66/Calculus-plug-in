import React, { useState, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import './HomePage.css';

interface HomePageProps {
  authState: AuthState;
  isDarkMode: boolean;
  onPageChange?: (page: string) => void;
}

interface CourseProgress {
  subject: string;
  progress: number;
  color: string;
}

interface Assignment {
  id: number;
  title: string;
  dueDate: string;
  startDate?: string;
  status: 'pending' | 'urgent' | 'completed';
  isSubmitted?: boolean;
  isOverdue?: boolean;
  classroom?: {
    id: number;
    name: string;
  };
  teacher?: {
    id: number;
    username: string;
  };
}

interface Classroom {
  id: number;
  name: string;
  description?: string;
  memberCount?: number;
  assignmentCount?: number;
  inviteCode?: string;
  teacher?: {
    id: number;
    username: string;
  };
}

interface RecentGrade {
  score: number;
  subject: string;
  date: string;
  status: 'pass' | 'good' | 'excellent';
}

interface NotificationItem {
  type: 'homework' | 'deadline' | 'system';
  title: string;
  time: string;
  urgent?: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({ authState, isDarkMode, onPageChange }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([
    { subject: '高等数学A', progress: 78, color: '#3b82f6' },
    { subject: '线性代数', progress: 65, color: '#8b5cf6' },
    { subject: '概率论', progress: 42, color: '#06b6d4' }
  ]);

  const [recentGrade, setRecentGrade] = useState<RecentGrade>({
    score: 85,
    subject: '微积分作业',
    date: '2024-01-08',
    status: 'good'
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { type: 'homework', title: '作业截止提醒', time: '1小时前', urgent: true },
    { type: 'system', title: '系统更新通知', time: '2小时前' },
    { type: 'deadline', title: '期末考试安排', time: '1天前' }
  ]);

  const [stats, setStats] = useState({
    completed: 0,
    urgent: 0,
    unread: 1
  });

  const isTeacher = authState.user?.role?.toLowerCase() === 'teacher';

  useEffect(() => {
    if (authState.token && authState.user) {
      loadData();
    }
  }, [authState.token, authState.user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // 并行获取班级和作业数据
      const promises = [];
      
      // 获取班级信息
      if (isTeacher) {
        promises.push(
          fetch(`${API_BASE_URL}/classrooms/teacher`, {
            headers: { 'Authorization': `Bearer ${authState.token}` }
          })
        );
      } else {
        promises.push(
          fetch(`${API_BASE_URL}/classrooms/student`, {
            headers: { 'Authorization': `Bearer ${authState.token}` }
          })
        );
      }

      // 获取作业信息
      const assignmentEndpoint = isTeacher ? '/assignments/teacher' : '/assignments/student';
      promises.push(
        fetch(`${API_BASE_URL}${assignmentEndpoint}`, {
          headers: { 'Authorization': `Bearer ${authState.token}` }
        })
      );

      const [classroomsRes, assignmentsRes] = await Promise.all(promises);

      // 处理班级数据
      if (classroomsRes.ok) {
        const classroomsData = await classroomsRes.json();
        if (classroomsData.success) {
          setClassrooms(classroomsData.data || []);
        }
      }

      // 处理作业数据
      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        if (assignmentsData.success) {
          const processedAssignments = (assignmentsData.data || []).map((assignment: any) => {
            const now = new Date();
            const dueDate = new Date(assignment.dueDate);
            const isOverdue = now > dueDate;
            const isSubmitted = assignment.isSubmitted || false;
            
            let status: 'pending' | 'urgent' | 'completed';
            if (isSubmitted) {
              status = 'completed';
            } else if (isOverdue) {
              status = 'urgent';
            } else {
              const timeUntilDue = dueDate.getTime() - now.getTime();
              const hoursUntilDue = timeUntilDue / (1000 * 60 * 60);
              status = hoursUntilDue <= 24 ? 'urgent' : 'pending';
            }

            return {
              ...assignment,
              status,
              isOverdue
            };
          });
          
          setAssignments(processedAssignments);

          // 更新统计数据
          const completedCount = processedAssignments.filter((a: Assignment) => a.status === 'completed').length;
          const urgentCount = processedAssignments.filter((a: Assignment) => a.status === 'urgent').length;
          
          setStats({
            completed: completedCount,
            urgent: urgentCount,
            unread: 1
          });
        }
      }
    } catch (err) {
      console.error('加载首页数据失败:', err);
      setError('加载数据失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  };

  const formatDueDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    if (diffTime < 0) {
      return '已过期';
    } else if (diffHours <= 24) {
      return `${diffHours}小时内截止`;
    } else if (diffDays <= 7) {
      return `${diffDays}天后截止`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent': return '#ef4444';
      case 'pending': return '#f59e0b';
      case 'completed': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getGradeColor = (status: string) => {
    switch (status) {
      case 'excellent': return '#10b981';
      case 'good': return '#3b82f6';
      case 'pass': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="homepage">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在加载首页数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="homepage">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <p className="error-message">{error}</p>
          <button className="retry-btn" onClick={loadData}>重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage">
      {/* 欢迎区域 */}
      <div className="welcome-section">
        <div className="welcome-content">
          <div className="user-profile-section">
            <div className="user-avatar">
              <img 
                src={authState.user?.avatarUrl || `https://avatars.githubusercontent.com/${authState.user?.username}`}
                alt={`${authState.user?.username}的头像`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNEM0Q5RUYiLz4KPHBhdGggZD0iTTIwIDEwQzE2LjY4NjMgMTAgMTQgMTIuNjg2MyAxNCAxNkMxNCAxOS4zMTM3IDE2LjY4NjMgMjIgMjAgMjJDMjMuMzEzNyAyMiAyNiAxOS4zMTM3IDI2IDE2QzI2IDEyLjY4NjMgMjMuMzEzNyAxMCAyMCAxMFoiIGZpbGw9IiM2QjczODAiLz4KPHBhdGggZD0iTTggMzJDOCAyNi40NzcyIDEyLjQ3NzIgMjIgMTggMjJIMjJDMjcuNTIyOCAyMiAzMiAyNi40NzcyIDMyIDMyVjQwSDhWMzJaIiBmaWxsPSIjNkI3MzgwIi8+Cjwvc3ZnPgo=';
                }}
              />
            </div>
            <div className="user-info">
              <h1 className="welcome-title">
                {getGreeting()}，{authState.user?.username || '用户'}
              </h1>
              <div className="user-info-display">
                <div className="user-role-badge">
                  <span className="role-icon">
                    {isTeacher ? '👨‍🏫' : '🎓'}
                  </span>
                  <span className="role-text">
                    {isTeacher ? '教师' : '学生'}
                  </span>
                </div>
                <p className="welcome-subtitle">
                  {isTeacher ? '管理您的班级和作业' : '继续您的微积分学习之旅'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="welcome-stats">
          <div className="stat-item">
            <span className="stat-number">{stats.completed}</span>
            <span className="stat-label">已完成</span>
          </div>
          <div className="stat-item urgent">
            <span className="stat-number">{stats.urgent}</span>
            <span className="stat-label">截止提醒</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.unread}</span>
            <span className="stat-label">未读消息</span>
          </div>
        </div>
      </div>

      <div className="content-grid">
        {/* 教师端和学生端显示不同的班级卡片 */}
        {isTeacher ? (
          /* 教师端 - 班级管理 */
          <div className="content-card classroom-card teacher-classroom">
            <div className="card-header">
              <div className="card-title">
                <span className="card-icon">🏫</span>
                班级管理
              </div>
              <button 
                className="card-action-btn"
                onClick={() => onPageChange?.('classrooms')}
              >
                <span>➕</span>
                创建班级
              </button>
            </div>
            <div className="classroom-content">
              <div className="classroom-stats-grid">
                <div className="classroom-stat">
                  <div className="stat-number">{classrooms.length}</div>
                  <div className="stat-label">管理班级</div>
                </div>
                <div className="classroom-stat">
                  <div className="stat-number">
                    {classrooms.reduce((total, classroom) => total + (classroom.memberCount || 0), 0)}
                  </div>
                  <div className="stat-label">学生总数</div>
                </div>
                <div className="classroom-stat">
                  <div className="stat-number">
                    {classrooms.reduce((total, classroom) => total + (classroom.assignmentCount || 0), 0)}
                  </div>
                  <div className="stat-label">活跃作业</div>
                </div>
              </div>
              {classrooms.length > 0 ? (
                <div className="recent-classrooms">
                  {classrooms.slice(0, 2).map((classroom) => (
                    <div key={classroom.id} className="classroom-item">
                      <div className="classroom-info">
                        <h4>{classroom.name}</h4>
                        <p>{classroom.memberCount || 0}名学生 • {classroom.assignmentCount || 0}个作业</p>
                      </div>
                      <div className="classroom-actions">
                        <button 
                          className="mini-btn"
                          onClick={() => onPageChange?.('classrooms')}
                        >
                          管理
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-mini">
                  <p>还没有创建班级</p>
                  <span className="create-hint">点击上方按钮创建第一个班级</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 学生端 - 我的班级 */
          <div className="content-card classroom-card student-classroom">
            <div className="card-header">
              <div className="card-title">
                <span className="card-icon">👥</span>
                我的班级
              </div>
              <button 
                className="card-action-btn"
                onClick={() => onPageChange?.('classrooms')}
              >
                <span>🏫</span>
                班级管理
              </button>
            </div>
            <div className="classroom-content">
              {classrooms.length > 0 ? (
                <div className="classroom-banner">
                  <div className="classroom-info">
                    <h3>{classrooms[0].name}</h3>
                    <p>{classrooms[0].description || '班级描述'}</p>
                    {classrooms[0].teacher && (
                      <small>教师: {classrooms[0].teacher.username}</small>
                    )}
                  </div>
                  {classrooms.length > 1 && (
                    <div className="more-classrooms">
                      <span>+{classrooms.length - 1} 个其他班级</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="classroom-banner">
                  <div className="classroom-info">
                    <h3>未加入班级</h3>
                    <p>请联系教师获取邀请码</p>
                  </div>
                  <button 
                    className="join-class-btn"
                    onClick={() => onPageChange?.('classrooms')}
                  >
                    <span>➕</span>
                    加入班级
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 当前课程进度 */}
        <div className="content-card progress-card">
          <div className="card-header">
            <div className="card-title">
              <span className="card-icon">📈</span>
              当前课程进度
            </div>
          </div>
          <div className="progress-content">
            {courseProgress.map((course, index) => (
              <div key={index} className="progress-item">
                <div className="progress-info">
                  <span className="course-name">{course.subject}</span>
                  <span className="progress-percent">{course.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${course.progress}%`,
                      backgroundColor: course.color
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 教师端和学生端显示不同的作业卡片 */}
        {isTeacher ? (
          /* 教师端 - 批改工作台 */
          <div className="content-card assignments-card teacher-assignments">
            <div className="card-header">
              <div className="card-title">
                <span className="card-icon">📝</span>
                批改工作台
              </div>
              <button 
                className="card-action-btn"
                onClick={() => onPageChange?.('assignments')}
              >
                <span>➕</span>
                布置作业
              </button>
            </div>
            <div className="assignments-content">
              <div className="grading-stats">
                <div className="grading-stat urgent">
                  <div className="stat-number">23</div>
                  <div className="stat-label">待批改</div>
                </div>
                <div className="grading-stat">
                  <div className="stat-number">156</div>
                  <div className="stat-label">已批改</div>
                </div>
                <div className="grading-stat">
                  <div className="stat-number">8</div>
                  <div className="stat-label">需重审</div>
                </div>
              </div>
              <div className="recent-submissions">
                <div className="submission-item">
                  <div className="submission-info">
                    <span className="student-name">张三 - 极限与连续</span>
                    <span className="submission-time">2小时前提交</span>
                  </div>
                  <button 
                    className="mini-btn urgent"
                    onClick={() => onPageChange?.('grading')}
                  >
                    批改
                  </button>
                </div>
                <div className="submission-item">
                  <div className="submission-info">
                    <span className="student-name">李四 - 导数计算</span>
                    <span className="submission-time">5小时前提交</span>
                  </div>
                  <button 
                    className="mini-btn urgent"
                    onClick={() => onPageChange?.('grading')}
                  >
                    批改
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 学生端 - 剩余作业 */
          <div className="content-card assignments-card student-assignments">
            <div className="card-header">
              <div className="card-title">
                <span className="card-icon">⏰</span>
                剩余作业: {assignments.filter(a => a.status !== 'completed').length} 份
              </div>
              {assignments.filter(a => a.status === 'urgent').length > 0 && (
                <span className="urgency-notice">请及时完成，避免影响成绩</span>
              )}
            </div>
            <div className="assignments-content">
              {assignments.length > 0 ? (
                assignments.slice(0, 3).map((assignment) => (
                  <div key={assignment.id} className="assignment-item">
                    <div className="assignment-info">
                      <span className="assignment-title">{assignment.title}</span>
                      <span 
                        className="assignment-status"
                        style={{ color: getStatusColor(assignment.status) }}
                      >
                        {assignment.status === 'completed' ? '已完成' : formatDueDate(assignment.dueDate)}
                      </span>
                      {assignment.classroom && (
                        <small className="assignment-classroom">{assignment.classroom.name}</small>
                      )}
                    </div>
                    <div className="assignment-indicator">
                      <span className={`status-dot ${assignment.status}`}></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state-mini">
                  <p>暂无作业</p>
                  <span className="empty-hint">老师还没有布置作业</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 教师端和学生端显示不同的成绩/分析卡片 */}
        {isTeacher ? (
          /* 教师端 - 学习分析 */
          <div className="content-card analytics-card teacher-analytics">
            <div className="card-header">
              <div className="card-title">
                <span className="card-icon">📊</span>
                学习分析
              </div>
            </div>
            <div className="analytics-content">
              <div className="analytics-summary">
                <div className="summary-item">
                  <span className="summary-label">班级平均分</span>
                  <span className="summary-value highlight">82.5</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">提交率</span>
                  <span className="summary-value">94%</span>
                </div>
              </div>
              <div className="difficulty-analysis">
                <h5>题目难点分析</h5>
                <div className="difficulty-item">
                  <span className="difficulty-topic">极限计算</span>
                  <div className="difficulty-bar">
                    <div className="difficulty-fill" style={{width: '75%'}}></div>
                  </div>
                  <span className="difficulty-rate">75%错误</span>
                </div>
                <div className="difficulty-item">
                  <span className="difficulty-topic">导数应用</span>
                  <div className="difficulty-bar">
                    <div className="difficulty-fill" style={{width: '45%'}}></div>
                  </div>
                  <span className="difficulty-rate">45%错误</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 学生端 - 最近批改结果 */
          <div className="content-card grade-card student-grade">
            <div className="card-header">
              <div className="card-title">
                <span className="card-icon">✅</span>
                最近批改结果
              </div>
            </div>
            <div className="grade-content">
              <div className="grade-score">
                <span className="score-number">{recentGrade.score}分</span>
                <span 
                  className="score-status"
                  style={{ color: getGradeColor(recentGrade.status) }}
                >
                  通过
                </span>
              </div>
              <div className="grade-info">
                <p className="grade-subject">得分: {recentGrade.subject}</p>
                <p className="grade-date">批改时间: {recentGrade.date}</p>
              </div>
            </div>
          </div>
        )}

        {/* 教师端专用卡片 - 学生表现 */}
        {isTeacher && (
          <div className="content-card performance-card teacher-performance">
            <div className="card-header">
              <div className="card-title">
                <span className="card-icon">🌟</span>
                学生表现
              </div>
            </div>
            <div className="performance-content">
              <div className="top-students">
                <h5>本周优秀学生</h5>
                <div className="student-list">
                  <div className="student-item">
                    <div className="student-avatar">👨‍🎓</div>
                    <div className="student-details">
                      <span className="student-name">王小明</span>
                      <span className="student-score">95分</span>
                    </div>
                    <div className="performance-badge excellent">优秀</div>
                  </div>
                  <div className="student-item">
                    <div className="student-avatar">👩‍🎓</div>
                    <div className="student-details">
                      <span className="student-name">李小红</span>
                      <span className="student-score">92分</span>
                    </div>
                    <div className="performance-badge good">良好</div>
                  </div>
                </div>
              </div>
              <div className="need-attention">
                <h5>需要关注</h5>
                <div className="attention-list">
                  <span className="attention-item">2名学生连续3次作业未提交</span>
                  <span className="attention-item">5名学生最近成绩下降明显</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 最新动态 */}
        <div className="content-card notifications-card">
          <div className="card-header">
            <div className="card-title">
              <span className="card-icon">🔔</span>
              最新动态
              <span className="notification-badge">1 条新消息</span>
            </div>
          </div>
          <div className="notifications-content">
            {notifications.map((notification, index) => (
              <div key={index} className={`notification-item ${notification.urgent ? 'urgent' : ''}`}>
                <div className="notification-content">
                  <div className="notification-header">
                    <span className="notification-icon">
                      {notification.type === 'homework' ? '📝' : 
                       notification.type === 'deadline' ? '⏰' : '⚙️'}
                    </span>
                    <span className="notification-title">{notification.title}</span>
                    {notification.urgent && <span className="urgent-badge">紧急</span>}
                  </div>
                  <span className="notification-time">{notification.time}</span>
                </div>
                <button className="notification-action">
                  <span>→</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 快速搜索 */}
        <div className="content-card search-card">
          <div className="card-header">
            <div className="card-title">
              <span className="card-icon">🔍</span>
              快速搜索
            </div>
          </div>
          <div className="search-content">
            <div className="search-box">
              <input
                type="text"
                placeholder="搜索作业、题目、知识点..."
                className="search-input"
              />
              <button className="search-btn">
                <span>🔍</span>
              </button>
            </div>
            <div className="search-suggestions">
              <span className="suggestion-tag">极限计算</span>
              <span className="suggestion-tag">导数应用</span>
              <span className="suggestion-tag">积分技巧</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};