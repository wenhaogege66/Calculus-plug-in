import React, { useState, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { MathPixMarkdownRenderer } from './MathPixMarkdownRenderer';
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
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [recentGrade, setRecentGrade] = useState<RecentGrade | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState({
    completed: 0,
    urgent: 0,
    unread: 0
  });
  const [dashboardData, setDashboardData] = useState<any>(null);
  
  // AI搜索功能状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

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

      if (!isTeacher) {
        // 学生端：使用新的dashboard API
        const dashboardRes = await fetch(`${API_BASE_URL}/dashboard/student/stats`, {
          headers: { 'Authorization': `Bearer ${authState.token}` }
        });

        if (dashboardRes.ok) {
          const dashboardData = await dashboardRes.json();
          if (dashboardData.success) {
            setDashboardData(dashboardData.data);
            
            // 设置动态统计数据
            setStats({
              completed: dashboardData.data.overview?.completedPractices || 0,
              urgent: dashboardData.data.learningRecommendations?.filter((r: any) => r.priority === 'high').length || 0,
              unread: dashboardData.data.learningRecommendations?.filter((r: any) => !r.isRead).length || 0
            });

            // 更新课程进度（基于知识点掌握度）
            const knowledgeProgress = dashboardData.data.knowledgePointMastery || [];
            const courseProgressData = knowledgeProgress.slice(0, 3).map((point: any, index: number) => ({
              subject: point.knowledgePoint,
              progress: point.masteryLevel || 0,
              color: ['#3b82f6', '#10b981', '#f59e0b'][index % 3]
            }));
            setCourseProgress(courseProgressData);

            // 设置最近成绩
            const recentActivities = dashboardData.data.recentActivities || [];
            if (recentActivities.length > 0) {
              const latestActivity = recentActivities[0];
              if (latestActivity.score !== null) {
                setRecentGrade({
                  score: latestActivity.score,
                  subject: '最近练习',
                  date: new Date(latestActivity.date).toLocaleDateString('zh-CN'),
                  status: latestActivity.score >= 90 ? 'excellent' : latestActivity.score >= 70 ? 'good' : 'pass'
                });
              }
            }

            // 设置动态通知（基于学习建议）
            const recommendations = dashboardData.data.learningRecommendations || [];
            const dynamicNotifications = recommendations.slice(0, 3).map((rec: any) => ({
              type: rec.type === 'knowledge_point' ? 'homework' : 'system',
              title: rec.title,
              time: new Date(rec.createdAt).toLocaleString('zh-CN'),
              urgent: rec.priority === 'high'
            }));
            setNotifications(dynamicNotifications);
          }
        }

        // 学生端仍需要班级信息
        const classroomsRes = await fetch(`${API_BASE_URL}/classrooms/student`, {
          headers: { 'Authorization': `Bearer ${authState.token}` }
        });
        if (classroomsRes.ok) {
          const classroomsData = await classroomsRes.json();
          if (classroomsData.success) {
            setClassrooms(classroomsData.data || []);
          }
        }

        // 学生端仍需要作业信息
        const assignmentsRes = await fetch(`${API_BASE_URL}/assignments/student`, {
          headers: { 'Authorization': `Bearer ${authState.token}` }
        });
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
          }
        }
      } else {
        // 教师端：使用新的dashboard API + 原有数据
        const promises = [];
        
        // 获取教师班级分析数据
        promises.push(
          fetch(`${API_BASE_URL}/dashboard/teacher/class-analytics`, {
            headers: { 'Authorization': `Bearer ${authState.token}` }
          })
        );

        // 获取班级信息
        promises.push(
          fetch(`${API_BASE_URL}/classrooms/teacher`, {
            headers: { 'Authorization': `Bearer ${authState.token}` }
          })
        );

        // 获取作业信息
        promises.push(
          fetch(`${API_BASE_URL}/assignments/teacher`, {
            headers: { 'Authorization': `Bearer ${authState.token}` }
          })
        );

        const [dashboardRes, classroomsRes, assignmentsRes] = await Promise.all(promises);

        // 处理教师分析数据
        if (dashboardRes.ok) {
          const teacherDashboardData = await dashboardRes.json();
          if (teacherDashboardData.success) {
            setDashboardData(teacherDashboardData.data);
            
            // 设置动态统计数据（基于AI分析结果）
            setStats({
              completed: teacherDashboardData.data.overview?.totalSubmissions || 0,
              urgent: teacherDashboardData.data.studentsNeedingAttention?.length || 0,
              unread: teacherDashboardData.data.teachingRecommendations?.filter((r: any) => r.priority === 'high').length || 0
            });
          }
        }


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

        // 教师端设置基于AI分析的动态数据
        if (dashboardData && dashboardData.knowledgePointAnalysis) {
          const knowledgeProgress = dashboardData.knowledgePointAnalysis.slice(0, 3).map((point: any, index: number) => ({
            subject: point.knowledgePoint,
            progress: Math.max(0, 100 - point.errorRate), // 错误率转换为掌握度
            color: ['#3b82f6', '#10b981', '#f59e0b'][index % 3]
          }));
          setCourseProgress(knowledgeProgress.length > 0 ? knowledgeProgress : [
            { subject: '极限与连续', progress: 85, color: '#3b82f6' },
            { subject: '导数与微分', progress: 72, color: '#10b981' },
            { subject: '积分学', progress: 68, color: '#f59e0b' }
          ]);

          // 基于AI教学建议和学生关注情况设置通知
          const dynamicNotifications = [];
          
          if (dashboardData.teachingRecommendations && dashboardData.teachingRecommendations.length > 0) {
            const highPriorityRecs = dashboardData.teachingRecommendations.filter((r: any) => r.priority === 'high');
            if (highPriorityRecs.length > 0) {
              dynamicNotifications.push({
                type: 'system',
                title: `AI建议：${highPriorityRecs[0].title}`,
                time: '刚刚',
                urgent: true
              });
            }
          }

          if (dashboardData.studentsNeedingAttention && dashboardData.studentsNeedingAttention.length > 0) {
            dynamicNotifications.push({
              type: 'homework',
              title: `${dashboardData.studentsNeedingAttention.length}名学生需要关注`,
              time: '1小时前',
              urgent: dashboardData.studentsNeedingAttention.length > 3
            });
          }

          dynamicNotifications.push(
            { type: 'deadline', title: '《导数应用》作业即将截止', time: '1天前' }
          );

          setNotifications(dynamicNotifications.length > 0 ? dynamicNotifications : [
            { type: 'homework', title: '新的作业提交需要批改', time: '2小时前', urgent: true },
            { type: 'deadline', title: '《导数应用》作业即将截止', time: '1天前' },
            { type: 'system', title: 'AI助教系统更新完成', time: '3天前' }
          ]);
        } else {
          // 如果没有AI分析数据，使用默认值
          setCourseProgress([
            { subject: '极限与连续', progress: 85, color: '#3b82f6' },
            { subject: '导数与微分', progress: 72, color: '#10b981' },
            { subject: '积分学', progress: 68, color: '#f59e0b' }
          ]);

          setNotifications([
            { type: 'homework', title: '新的作业提交需要批改', time: '2小时前', urgent: true },
            { type: 'deadline', title: '《导数应用》作业即将截止', time: '1天前' },
            { type: 'system', title: 'AI助教系统更新完成', time: '3天前' }
          ]);
        }
      }
    } catch (err) {
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

  // AI智能搜索功能
  const handleAISearch = async (query: string) => {
    if (!query.trim() || !authState.token) return;
    
    setIsSearching(true);
    setShowSearchResults(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/ai/follow-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          submissionId: 0, // 占位ID，用于智能搜索
          question: `基于微积分学习，请回答或解释：${query}`
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.answer) {
          // 保持完整的AI回答，不要分割
          setSearchResults([result.data.answer]);
        } else {
          setSearchResults(['AI搜索暂时不可用，请稍后重试']);
        }
      } else {
        setSearchResults(['搜索失败，请稍后重试']);
      }
    } catch (error) {
      setSearchResults(['搜索遇到问题，请检查网络连接']);
    } finally {
      setIsSearching(false);
    }
  };

  // 处理搜索输入
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleAISearch(searchQuery.trim());
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
    <div className={`homepage ${isDarkMode ? 'dark' : ''}`}>
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
                {getGreeting()}，<span className="rainbow-text">{authState.user?.username || '用户'}</span>
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
                <div className="student-classrooms-grid">
                  {classrooms.slice(0, 3).map((classroom, index) => (
                    <div key={classroom.id} className="classroom-card-item compact">
                      <div className="classroom-card-content">
                        <h4 className="classroom-name">{classroom.name}</h4>
                        {classroom.teacher && (
                          <p className="teacher-name">{classroom.teacher.username}</p>
                        )}
                        <div className="classroom-stats">
                          <span className="stat-text">{(classroom.memberCount || 0) + 1}名同学</span>
                          <span className="stat-divider">•</span>
                          <span className="stat-text">{classroom.assignmentCount || 0}个作业</span>
                        </div>
                      </div>
                      <div className="classroom-card-footer">
                        <button 
                          className="classroom-enter-btn"
                          onClick={() => onPageChange?.('classrooms')}
                        >
                          进入
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {classrooms.length > 3 && (
                    <div className="more-classrooms-card">
                      <div className="more-content">
                        <div className="more-icon">⭐</div>
                        <div className="more-text">
                          <span className="more-count">还有 {classrooms.length - 3} 个班级</span>
                          <span className="more-hint">点击查看全部</span>
                        </div>
                      </div>
                      <button 
                        className="view-all-btn"
                        onClick={() => onPageChange?.('classrooms')}
                      >
                        查看全部
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-classroom-state">
                  <div className="empty-icon">🏫</div>
                  <div className="empty-content">
                    <h3>尚未加入班级</h3>
                    <p>请联系教师获取邀请码，开始您的学习之旅</p>
                    <button 
                      className="join-class-btn primary"
                      onClick={() => onPageChange?.('classrooms')}
                    >
                      <span>➕</span>
                      加入班级
                    </button>
                  </div>
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
          /* 教师端 - AI学习分析 */
          <div className="content-card analytics-card teacher-analytics">
            <div className="card-header">
              <div className="card-title">
                <span className="card-icon">📊</span>
                AI学习分析
              </div>
            </div>
            <div className="analytics-content">
              <div className="analytics-summary">
                <div className="summary-item">
                  <span className="summary-label">班级平均分</span>
                  <span className="summary-value highlight">
                    {dashboardData?.overview?.classAverage || 82.5}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">提交率</span>
                  <span className="summary-value">
                    {dashboardData?.overview?.submitRate || 94}%
                  </span>
                </div>
              </div>
              <div className="difficulty-analysis">
                <h5>AI错题难点分析</h5>
                {dashboardData?.knowledgePointAnalysis?.slice(0, 3).map((point: any, index: number) => (
                  <div key={index} className="difficulty-item">
                    <span className="difficulty-topic">{point.knowledgePoint}</span>
                    <div className="difficulty-bar">
                      <div className="difficulty-fill" style={{width: `${point.errorRate}%`}}></div>
                    </div>
                    <span className="difficulty-rate">{point.errorRate}%错误</span>
                  </div>
                )) || (
                  <>
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
                  </>
                )}
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
              {recentGrade ? (
                <>
                  <div className="grade-score">
                    <span className="score-number">{recentGrade.score}分</span>
                    <span 
                      className="score-status"
                      style={{ color: getGradeColor(recentGrade.status) }}
                    >
                      {recentGrade.status === 'excellent' ? '优秀' : 
                       recentGrade.status === 'good' ? '良好' : '通过'}
                    </span>
                  </div>
                  <div className="grade-info">
                    <p className="grade-subject">{recentGrade.subject}</p>
                    <p className="grade-date">批改时间: {recentGrade.date}</p>
                  </div>
                </>
              ) : (
                <div className="empty-state-mini">
                  <p>暂无批改记录</p>
                  <span className="empty-hint">开始练习来获得AI批改反馈</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 教师端专用卡片 - AI学生表现分析 */}
        {isTeacher && (
          <div className="content-card performance-card teacher-performance">
            <div className="card-header">
              <div className="card-title">
                <span className="card-icon">🤖</span>
                AI学生表现分析
              </div>
            </div>
            <div className="performance-content">
              <div className="top-students">
                <h5>班级概况</h5>
                <div className="student-list">
                  <div className="student-item">
                    <div className="student-avatar">👥</div>
                    <div className="student-details">
                      <span className="student-name">总学生数</span>
                      <span className="student-score">{dashboardData?.overview?.totalStudents || 0}人</span>
                    </div>
                    <div className="performance-badge">活跃学生: {dashboardData?.overview?.activeStudents || 0}</div>
                  </div>
                  <div className="student-item">
                    <div className="student-avatar">📊</div>
                    <div className="student-details">
                      <span className="student-name">总练习次数</span>
                      <span className="student-score">{dashboardData?.overview?.totalSubmissions || 0}次</span>
                    </div>
                    <div className="performance-badge good">班级平均: {dashboardData?.overview?.classAverage || 0}分</div>
                  </div>
                </div>
              </div>
              <div className="need-attention">
                <h5>AI识别需要关注的学生</h5>
                <div className="attention-list">
                  {dashboardData?.studentsNeedingAttention?.slice(0, 3).map((student: any, index: number) => (
                    <span key={index} className="attention-item">
                      {student.username}: {student.issues.join(', ')}
                    </span>
                  )) || (
                    <>
                      <span className="attention-item">2名学生连续3次作业未提交</span>
                      <span className="attention-item">5名学生最近成绩下降明显</span>
                    </>
                  )}
                  {(!dashboardData?.studentsNeedingAttention || dashboardData.studentsNeedingAttention.length === 0) && (
                    <span className="attention-item success">🎉 所有学生表现良好，无需特别关注</span>
                  )}
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


        {/* AI智能搜索 - 长条样式 */}
        <div className="ai-search-bar-container">
          <form onSubmit={handleSearchSubmit} className="ai-search-form">
            <div className="ai-search-bar">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="问我任何微积分问题... 我会使用AI为您解答"
                className="ai-search-input"
                disabled={isSearching}
              />
              <button 
                type="submit" 
                className={`ai-search-btn ${isSearching ? 'searching' : ''}`}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <>
                    <span className="loading-spinner-small"></span>
                    AI思考中...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    AI搜索
                  </>
                )}
              </button>
            </div>
          </form>
          
          {/* AI搜索结果 */}
          {showSearchResults && (
            <div className="ai-search-results">
              <div className="search-results-header">
                <span>🧠 AI助手回答</span>
                <button 
                  className="close-results-btn"
                  onClick={() => setShowSearchResults(false)}
                >
                  ✕
                </button>
              </div>
              <div className="search-results-content">
                {searchResults.length > 0 ? (
                  searchResults.map((result, index) => (
                    <div key={index} className="search-result-item">
                      <span className="result-icon">💡</span>
                      <div className="result-content">
                        <MathPixMarkdownRenderer
                          content={result}
                          className="search-result-markdown"
                          maxLength={2000}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="search-result-item">
                    <span className="result-icon">🔍</span>
                    <span className="result-text">正在搜索中...</span>
                  </div>
                )}
              </div>
              
              {/* 快速建议 */}
              <div className="quick-suggestions">
                <span className="suggestions-label">试试这些:</span>
                <button 
                  className="suggestion-btn" 
                  onClick={() => {setSearchQuery('什么是极限？'); handleAISearch('什么是极限？')}}
                >
                  什么是极限？
                </button>
                <button 
                  className="suggestion-btn"
                  onClick={() => {setSearchQuery('导数的几何意义'); handleAISearch('导数的几何意义')}}
                >
                  导数的几何意义
                </button>
                <button 
                  className="suggestion-btn"
                  onClick={() => {setSearchQuery('积分的应用'); handleAISearch('积分的应用')}}
                >
                  积分的应用
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};