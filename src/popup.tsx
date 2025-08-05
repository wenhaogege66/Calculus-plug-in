import React, { useState, useEffect, useRef } from 'react';
import { Storage } from '@plasmohq/storage';
import { supabase, API_BASE_URL, type User, type AuthState } from './common/config/supabase';
import { ProgressBar } from './components/ProgressBar';

import "./popup.css"

const storage = new Storage();

// 加载状态类型
interface LoadingStates {
  classrooms: boolean;
  assignments: boolean;
  students: boolean;
  submissions: boolean;
  userInfo: boolean;
}

// 界面状态类型
interface ViewStates {
  showCreateClass: boolean;
  showAssignWork: boolean;
  showJoinClass: boolean;
  showStudents: boolean;
  showInviteCode: boolean;
  showAssignmentManagement: boolean;
  showAssignmentDetails: boolean;
  showSubmissionHistory: boolean;
  teacherView: boolean;
  studentView: boolean;
}

function Popup() {
  // 错误状态管理
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 错误边界处理
  const handleError = (error: Error, errorInfo?: any) => {
    console.error('组件渲染错误:', error, errorInfo);
    setHasError(true);
    setErrorMessage(error.message || '未知错误');
    // 清理可能导致问题的状态
    clearGradingMonitor();
  };

  // 重置错误状态
  const resetError = () => {
    setHasError(false);
    setErrorMessage('');
  };

  // 加载状态组件
  const LoadingSpinner = ({ size = 'medium', text = '加载中...' }: { size?: 'small' | 'medium' | 'large', text?: string }) => (
    <div className={`loading-container ${size}`}>
      <div className={`loading-spinner ${size}`}></div>
      <span className="loading-text">{text}</span>
    </div>
  );

  // 骨架屏组件
  const SkeletonLoader = ({ lines = 3, height = '20px' }: { lines?: number, height?: string }) => (
    <div className="skeleton-container">
      {Array.from({ length: lines }).map((_, index) => (
        <div 
          key={index} 
          className="skeleton-line" 
          style={{ 
            height, 
            width: index === lines - 1 ? '70%' : '100%' 
          }}
        ></div>
      ))}
    </div>
  );

  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true
  });

  // 添加模式选择状态
  const [workMode, setWorkMode] = useState<'practice' | 'homework'>('practice');
  
  // 添加用户角色状态
  const [userRole, setUserRole] = useState<'student' | 'teacher'>('student');
  
  // 添加班级管理状态
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>('');
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<any[]>([]);
  
  // 教师端作业管理状态
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [currentInviteCode, setCurrentInviteCode] = useState('');
  
  // 表单状态
  const [className, setClassName] = useState('');
  const [classDescription, setClassDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  // 作业表单状态
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDescription, setAssignmentDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);

  // 统一的界面状态管理
  const [viewStates, setViewStates] = useState<ViewStates>({
    showCreateClass: false,
    showAssignWork: false,
    showJoinClass: false,
    showStudents: false,
    showInviteCode: false,
    showAssignmentManagement: false,
    showAssignmentDetails: false,
    showSubmissionHistory: false,
    teacherView: false,
    studentView: false,
  });

  // 统一的加载状态管理
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    classrooms: false,
    assignments: false,
    students: false,
    submissions: false,
    userInfo: false,
  });

  // 传统单文件上传状态（保留兼容性）
  const [uploadStatus, setUploadStatus] = useState<{
    uploading: boolean;
    progress: number;
    message: string;
  }>({
    uploading: false,
    progress: 0,
    message: ''
  });

  // 多文件上传状态管理
  interface FileUploadItem {
    id: string;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    message: string;
    fileId?: number;
    uploadType: 'assignments' | 'homework' | 'practice';
  }

  const [fileUploads, setFileUploads] = useState<FileUploadItem[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{
    assignments: FileUploadItem[];
    homework: FileUploadItem[];
    practice: FileUploadItem[];
  }>({
    assignments: [],
    homework: [],
    practice: []
  });

  // 新增：独立的下载状态管理
  const [downloadStatus, setDownloadStatus] = useState<{
    downloading: boolean;
    message: string;
  }>({
    downloading: false,
    message: ''
  });

  // 新增：批改进度状态管理
  const [gradingStatus, setGradingStatus] = useState<{
    processing: boolean;
    stage: 'ocr' | 'grading' | 'completed' | '';
    progress: number;
    message: string;
  }>({
    processing: false,
    stage: '',
    progress: 0,
    message: ''
  });

  // 新增：批改完成通知状态
  const [gradingNotification, setGradingNotification] = useState<{
    show: boolean;
    submissionId: number | null;
    message: string;
  }>({
    show: false,
    submissionId: null,
    message: ''
  });

  // 添加ref来追踪活跃的监控interval
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 检测是否在全屏模式（新标签页）
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 统一重置所有界面状态的函数
  const resetAllViews = () => {
    setViewStates({
      showCreateClass: false,
      showAssignWork: false,
      showJoinClass: false,
      showStudents: false,
      showInviteCode: false,
      showAssignmentManagement: false,
      showAssignmentDetails: false,
      showSubmissionHistory: false,
      teacherView: false,
      studentView: false,
    });
  };

  // 设置单个界面状态并关闭其他界面
  const setViewState = (viewKey: keyof ViewStates, value: boolean) => {
    if (value) {
      resetAllViews();
    }
    setViewStates(prev => ({
      ...prev,
      [viewKey]: value
    }));
  };

  // 设置加载状态
  const setLoadingState = (loadingKey: keyof LoadingStates, value: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [loadingKey]: value
    }));
  };

  // 清理监控interval
  const clearGradingMonitor = () => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
      console.log('已清理批改监控interval');
    }
  };

  // 开始批改进度监控
  const startGradingMonitor = async (submissionId: number) => {
    console.log('开始监控批改进度，提交ID:', submissionId);
    
    // 先清理可能存在的旧监控
    clearGradingMonitor();
    
    // 清理上传进度状态，避免与批改进度重复显示
    setFileUploads([]);
    
    setGradingStatus({
      processing: true,
      stage: 'ocr',
      progress: 10,
      message: '🔍 正在进行文字识别...'
    });

    // 轮询检查批改状态
    monitorIntervalRef.current = setInterval(async () => {
      try {
        // 检查组件是否还在活跃状态
        if (!monitorIntervalRef.current) {
          console.log('监控已停止，跳过请求');
          return;
        }

        const response = await fetch(`${API_BASE_URL}/submissions/${submissionId}/status`, {
          headers: {
            'Authorization': `Bearer ${authState.token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const submission = result.data;
            
            // 根据批改状态更新进度
            if (submission.myscriptResults && submission.myscriptResults.length > 0) {
              const myscriptResult = submission.myscriptResults[0];
              
              if (myscriptResult.status === 'processing') {
                setGradingStatus({
                  processing: true,
                  stage: 'ocr',
                  progress: 30,
                  message: '🔍 文字识别处理中...'
                });
              } else if (myscriptResult.status === 'completed') {
                setGradingStatus({
                  processing: true,
                  stage: 'grading',
                  progress: 60,
                  message: '🤖 AI智能批改中...'
                });
                
                // 检查Deepseek批改状态
                if (submission.deepseekResults && submission.deepseekResults.length > 0) {
                  const deepseekResult = submission.deepseekResults[0];
                  
                  if (deepseekResult.status === 'completed') {
                    setGradingStatus({
                      processing: false,
                      stage: 'completed',
                      progress: 100,
                      message: '✅ 批改完成！'
                    });
                    
                    // 显示完成通知
                    setGradingNotification({
                      show: true,
                      submissionId: submissionId,
                      message: `🎉 您的${workMode === 'homework' ? '作业' : '练习'}批改完成！点击查看详细结果`
                    });
                    
                    clearGradingMonitor();
                    
                    // 5秒后隐藏批改状态
                    setTimeout(() => {
                      setGradingStatus({
                        processing: false,
                        stage: '',
                        progress: 0,
                        message: ''
                      });
                    }, 5000);
                  }
                }
              } else if (myscriptResult.status === 'failed') {
                setGradingStatus({
                  processing: false,
                  stage: '',
                  progress: 0,
                  message: '❌ 文字识别失败'
                });
                clearGradingMonitor();
              }
            }
          }
        }
      } catch (error) {
        console.error('监控批改进度失败:', error);
      }
    }, 3000); // 每3秒检查一次

    // 5分钟后停止监控
    setTimeout(() => {
      clearGradingMonitor();
      if (gradingStatus.processing) {
        setGradingStatus({
          processing: false,
          stage: '',
          progress: 0,
          message: '⏰ 批改超时，请稍后查看侧边栏'
        });
      }
    }, 300000); // 5分钟
  };

  // 查看批改结果
  const handleViewGradingResult = async (submissionId: number) => {
    try {
      // 隐藏通知
      setGradingNotification({
        show: false,
        submissionId: null,
        message: ''
      });
      
      // 打开侧边栏显示详细结果
      await openSidePanel();
    } catch (error) {
      console.error('打开批改结果失败:', error);
    }
  };

  useEffect(() => {
    // 检测是否在新标签页中打开（全屏模式）
    const checkFullscreenMode = () => {
      // 如果URL包含chrome-extension://且路径是popup.html，且窗口尺寸大于popup限制，说明是全屏模式
      const isInTab = window.location.href.includes('chrome-extension://') && 
                      window.location.pathname.includes('popup.html') &&
                      (window.innerWidth > 600 || window.innerHeight > 580);
      setIsFullscreen(isInTab);
      
      // 在全屏模式下移除CSS尺寸限制
      if (isInTab) {
        const style = document.createElement('style');
        style.textContent = `
          html, body {
            width: 100% !important;
            height: 100% !important;
            min-width: 100% !important;
            min-height: 100% !important;
            max-width: none !important;
            max-height: none !important;
          }
          .popup-container {
            min-height: 100vh !important;
            max-height: none !important;
          }
        `;
        document.head.appendChild(style);
      }
    };
    
    checkFullscreenMode();
    window.addEventListener('resize', checkFullscreenMode);
    
    // 全局错误处理
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('未处理的Promise rejection:', event.reason);
      if (event.reason instanceof Error) {
        handleError(event.reason);
      } else {
        handleError(new Error('未处理的Promise rejection: ' + String(event.reason)));
      }
      event.preventDefault(); // 阻止默认错误显示
    };

    const handleWindowError = (event: ErrorEvent) => {
      console.error('全局JavaScript错误:', event.error);
      if (event.error instanceof Error) {
        handleError(event.error);
      } else {
        handleError(new Error(event.message || '未知JavaScript错误'));
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleWindowError);

    return () => {
      window.removeEventListener('resize', checkFullscreenMode);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleWindowError);
    };
  }, []);

  // 初始化认证状态
  useEffect(() => {
    initializeAuth();
    
    // 只保留 storage.onChanged 监听器，这是最稳健的模式
    const handleStorageChange = async (changes: any) => {
      if (changes.oauth_success) {
        const authData = changes.oauth_success.newValue;
        if (authData) {
          console.log('检测到认证成功信号，更新UI...');
          
          if (!authData.user || !authData.token) {
            console.error('收到的认证数据结构无效:', authData);
            return;
          }
          
          setAuthState({
            isAuthenticated: true,
            user: authData.user,
            token: authData.token,
            loading: false
          });

          setUploadStatus({
            uploading: false,
            progress: 0,
            message: '✅ 登录成功！'
          });

          setTimeout(() => {
            setUploadStatus(prev => ({ ...prev, message: '', progress: 0 }));
            // 清理旧的标记
            storage.remove('oauth_success');
          }, 3000);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      // 清理批改监控
      clearGradingMonitor();
    };
  }, []); // 依赖项为空，此 effect 只运行一次

  const initializeAuth = async () => {
    try {
      setLoadingState('userInfo', true);
      
      // 从 chrome.storage.local 获取保存的token（与background保持一致）
      const chromeStorage = await chrome.storage.local.get(['auth_token', 'user_info']);
      const savedToken = chromeStorage.auth_token;
      const savedUser = chromeStorage.user_info;
      
      // 从 plasmo storage 获取其他配置
      const savedWorkMode = await storage.get('work_mode') || 'practice';

      console.log('初始化认证状态 - Token:', savedToken ? '存在' : '不存在', 'User:', savedUser ? '存在' : '不存在');

      // 恢复工作模式
      setWorkMode(savedWorkMode === 'homework' ? 'homework' : 'practice');
      
      if (savedToken && savedUser) {
        // 立即设置认证状态，提升用户体验
        let user = typeof savedUser === 'string' ? JSON.parse(savedUser) : savedUser;
        
        // 标准化角色格式，优先使用用户对象中的角色
        let normalizedRole = 'student'; // 默认为学生
        const storedRole = user.role || await storage.get('user_role');
        if (storedRole) {
          normalizedRole = storedRole.toLowerCase() === 'teacher' ? 'teacher' : 'student';
        }
        
        console.log('初始化时恢复用户角色:', normalizedRole, '原始角色:', user.role);
        
        // 更新状态
        setUserRole(normalizedRole as 'student' | 'teacher');
        
        // 确保用户角色信息完整且格式正确
        user.role = normalizedRole;
        
        // 立即设置认证状态，确保用户信息不会消失
        setAuthState({
          isAuthenticated: true,
          user: user,
          token: savedToken,
          loading: false
        });

        // 根据角色初始化界面和加载数据
        console.log('初始化时根据角色设置界面:', normalizedRole);
        if (normalizedRole === 'teacher') {
          // 重置所有视图，显示教师界面
          resetAllViews();
          setViewState('teacherView', true);
          loadTeacherClassrooms(savedToken);
        } else {
          // 重置所有视图，显示学生界面
          resetAllViews(); 
          setViewState('studentView', true);
          loadStudentClassrooms(savedToken);
        }

        // 在后台静默验证token并获取最新用户信息
        verifyToken(savedToken).then(isValid => {
          if (!isValid) {
            console.log('Token已过期，需要重新登录');
            handleTokenExpired();
          } else {
            console.log('Token验证成功，获取最新用户信息');
            // 获取服务器端的用户信息（可能角色有变化）
            fetchUserInfo(savedToken);
          }
        }).catch(error => {
          console.warn('Token验证出错，但保持当前登录状态:', error);
        });
        
        setLoadingState('userInfo', false);
        return;
      }

      setAuthState(prev => ({ ...prev, loading: false }));
      setLoadingState('userInfo', false);
    } catch (error) {
      console.error('初始化认证状态失败:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
      setLoadingState('userInfo', false);
    }
  };

  const handleTokenExpired = async () => {
    // Token无效，清除storage并重置状态
    await chrome.storage.local.remove(['auth_token', 'user_info']);
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false
    });
    setUploadStatus({
      uploading: false,
      progress: 0,
      message: '⚠️ 登录已过期，请重新登录'
    });
    setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, message: '' }));
    }, 3000);
  };

  const handleModeChange = async (mode: 'practice' | 'homework') => {
    console.log('切换模式:', mode, '当前班级数量:', classrooms.length);
    
    // 如果切换到作业模式，检查是否已加入班级
    if (mode === 'homework') {
      if (classrooms.length === 0) {
        setUploadStatus({
          uploading: false,
          progress: 0,
          message: '⚠️ 请先加入班级才能使用作业模式'
        });
        
        setTimeout(() => {
          setUploadStatus(prev => ({ ...prev, message: '' }));
        }, 3000);
        return;
      }
    }
    
    console.log('设置工作模式为:', mode);
    setWorkMode(mode);
    await storage.set('work_mode', mode);
  };

  const handleRoleSwitch = async (role: 'student' | 'teacher') => {
    // 首先验证用户是否有权限切换到教师角色
    if (role === 'teacher' && authState.token) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${authState.token}`
          }
        });
        
        const result = await response.json();
        if (result.success && result.data.role !== 'teacher') {
          setUploadStatus({
            uploading: false,
            progress: 0,
            message: '❌ 您没有教师权限，无法切换到教师模式'
          });
          
          setTimeout(() => {
            setUploadStatus(prev => ({ ...prev, message: '' }));
          }, 3000);
          return;
        }
      } catch (error) {
        console.error('验证教师权限失败:', error);
        setUploadStatus({
          uploading: false,
          progress: 0,
          message: '❌ 权限验证失败，请重新登录'
        });
        
        setTimeout(() => {
          setUploadStatus(prev => ({ ...prev, message: '' }));
        }, 3000);
        return;
      }
    }
    
    setUserRole(role);
    await storage.set('user_role', role);
    
    // 更新用户信息中的角色（仅用于UI显示）
    if (authState.user) {
      const updatedUser = { ...authState.user, role };
      setAuthState(prev => ({ ...prev, user: updatedUser }));
      await chrome.storage.local.set({ 'user_info': updatedUser });
    }
    
    // 切换角色后加载对应数据
    if (role === 'teacher') {
      loadTeacherClassrooms();
    } else {
      loadStudentClassrooms();
    }
  };

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Token验证失败:', error);
      return false;
    }
  };

  // 获取用户信息（包括真实角色）
  const fetchUserInfo = async (token: string) => {
    try {
      console.log('fetchUserInfo: 开始获取最新用户信息');
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        const serverUser = result.data;
        
        // 标准化角色格式
        const normalizedRole = serverUser.role?.toLowerCase() === 'teacher' ? 'teacher' : 'student';
        console.log('fetchUserInfo: 服务器返回角色:', serverUser.role, '标准化后:', normalizedRole);
        
        // 构建完整的用户信息对象，避免覆盖现有信息
        const updatedUser: User = {
          id: serverUser.id || authState.user?.id,
          username: serverUser.username || authState.user?.username,
          email: serverUser.email || authState.user?.email,
          role: normalizedRole as 'student' | 'teacher',
          authType: authState.user?.authType || 'github',
          githubId: authState.user?.githubId,
          githubUsername: authState.user?.githubUsername,
          avatarUrl: serverUser.avatarUrl || authState.user?.avatarUrl
        };
        
        // 更新状态
        setUserRole(normalizedRole as 'student' | 'teacher');
        await storage.set('user_role', normalizedRole);
        
        // 原子性更新authState，避免竞态条件
        setAuthState(prev => {
          if (!prev.user) {
            console.warn('fetchUserInfo: authState.user为null，跳过更新');
            return prev;
          }
          return {
            ...prev,
            user: updatedUser
          };
        });
        
        // 更新本地存储
        await chrome.storage.local.set({ 
          'user_info': updatedUser,
          'user_role': normalizedRole
        });
        
        console.log('fetchUserInfo: 用户信息更新完成，最终角色:', normalizedRole);
        
        // 仅在角色发生变化时才重新加载数据和界面
        if (userRole !== normalizedRole) {
          console.log('fetchUserInfo: 角色变化，重新初始化界面');
          if (normalizedRole === 'teacher') {
            resetAllViews();
            setViewState('teacherView', true);
            await loadTeacherClassrooms(token);
          } else {
            resetAllViews();
            setViewState('studentView', true);
            await loadStudentClassrooms(token);
          }
        }
      }
    } catch (error) {
      console.error('fetchUserInfo: 获取用户信息失败:', error);
      // 获取失败时不要清空现有状态，保持当前登录状态
    }
  };

  const handleAuthMessage = async (event: MessageEvent) => {
    console.log('收到消息:', event.data);
    
    if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
      console.log('GitHub登录成功，处理认证信息...');
      const { token, user } = event.data;
      
      // 标准化角色格式：TEACHER -> teacher, STUDENT -> student
      let normalizedRole = 'student'; // 默认为学生
      if (user.role) {
        normalizedRole = user.role.toLowerCase() === 'teacher' ? 'teacher' : 'student';
      }
      
      // 更新用户对象的角色为标准化格式
      user.role = normalizedRole;
      
      console.log('登录用户角色:', normalizedRole);
      
      // 根据服务器返回的角色设置前端状态
      setUserRole(normalizedRole as 'student' | 'teacher');
      
      // 保存认证信息到 chrome.storage.local（与background保持一致）
      await chrome.storage.local.set({
        'auth_token': token,
        'user_info': user,
        'user_role': normalizedRole
      });
      
      setAuthState({
        isAuthenticated: true,
        user: user,
        token: token,
        loading: false
      });

      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '✅ 登录成功！'
      });

      // 根据用户角色加载对应数据和切换界面
      console.log('根据角色初始化界面:', normalizedRole);
      if (normalizedRole === 'teacher') {
        // 重置所有视图状态，显示教师界面
        resetAllViews();
        setViewState('teacherView', true);
        loadTeacherClassrooms();
      } else {
        // 重置所有视图状态，显示学生界面  
        resetAllViews();
        setViewState('studentView', true);
        loadStudentClassrooms();
      }

      // 3秒后清除消息
      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, message: '', progress: 0 }));
      }, 3000);
    } else {
      console.log('收到其他类型消息:', event.data?.type);
    }
  };

  const handleGitHubLogin = async () => {
    console.log('Popup: 用户点击登录按钮，准备发送消息到background...');
    setUploadStatus({
      uploading: true,
      progress: 50,
      message: '🚀 正在启动GitHub登录...'
    });

    chrome.runtime.sendMessage({ type: 'INITIATE_AUTH' }, (response) => {
      // 检查 sendMessage 是否成功发出。注意：这里的 response 是 background script 的同步响应
      if (chrome.runtime.lastError) {
        // 这种情况通常意味着 background script 没能成功建立消息通道
        const errorMsg = chrome.runtime.lastError.message || '与后台脚本通信失败';
        console.error('Popup: 发送认证请求失败:', errorMsg);
        setUploadStatus({
          uploading: false,
          progress: 0,
          message: `登录失败: ${errorMsg}`
        });
        setTimeout(() => setUploadStatus(prev => ({...prev, message: ''})), 3000);
        return;
      }
      
      // 消息已成功发出，等待用户在认证窗口中操作
      console.log('Popup: 认证请求已成功发送到后台，等待用户操作...');
      // 不设置上传状态，避免与文件上传状态冲突
    });
  };

  const handleLogout = async () => {
    try {
      // 清除本地存储
      await chrome.storage.local.remove(['auth_token', 'user_info']);
      
      // 从Supabase登出
      await supabase.auth.signOut();

      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });

      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '已退出登录'
      });

      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, message: '' }));
      }, 2000);
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  // 新的多文件上传函数
  const handleMultiFileUpload = async (files: FileList, uploadType: 'assignments' | 'homework' | 'practice') => {
    if (!authState.token) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 请先登录'
      });
      return;
    }

    const fileArray = Array.from(files);
    console.log(`开始处理${fileArray.length}个文件，类型: ${uploadType}`);
    
    // 使用更安全的ID生成方式，避免重复
    const newUploads: FileUploadItem[] = fileArray.map((file, index) => ({
      id: `${uploadType}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending' as const,
      message: '等待上传...',
      uploadType
    }));

    // 添加到上传队列
    setFileUploads(prev => {
      console.log('添加到上传队列:', newUploads.map(u => u.id));
      return [...prev, ...newUploads];
    });

    // 并发上传所有文件，而不是串行
    const uploadPromises = newUploads.map(uploadItem => uploadSingleFile(uploadItem));
    
    try {
      await Promise.all(uploadPromises);
      console.log(`所有文件上传完成，类型: ${uploadType}`);
    } catch (error) {
      console.error('批量上传出现错误:', error);
    }
  };

  const uploadSingleFile = async (uploadItem: FileUploadItem) => {
    const fileId = uploadItem.id;
    console.log(`开始上传文件: ${uploadItem.file.name} (ID: ${fileId})`);
    
    try {
      // 更新状态为上传中
      setFileUploads(prev => 
        prev.map(item => 
          item.id === fileId 
            ? { ...item, status: 'uploading', progress: 10, message: '准备上传...' }
            : item
        )
      );

      const formData = new FormData();
      formData.append('file', uploadItem.file);
      
      // 根据上传类型设置workMode
      const workMode = uploadItem.uploadType === 'assignments' ? 'practice' : 
                      uploadItem.uploadType === 'homework' ? 'homework' : 'practice';
      formData.append('workMode', workMode);
      
      if (workMode === 'homework' && selectedAssignment) {
        formData.append('assignmentId', selectedAssignment);
      }

      // 设置合理的超时时间 - 为小文件增加更多时间，因为Supabase上传可能需要时间
      const controller = new AbortController();
      const fileSizeMB = uploadItem.file.size / 1024 / 1024;
      const timeoutMs = Math.max(60000, fileSizeMB * 30000); // 最少60秒，每MB增加30秒
      
      console.log(`设置上传超时: ${uploadItem.file.name} - 文件大小: ${fileSizeMB.toFixed(2)}MB, 超时: ${timeoutMs/1000}秒`);
      
      const timeoutId = setTimeout(() => {
        console.log(`❌ 文件上传超时: ${uploadItem.file.name} (${timeoutMs/1000}秒)`);
        controller.abort();
      }, timeoutMs);

      setFileUploads(prev => 
        prev.map(item => 
          item.id === fileId 
            ? { ...item, progress: 30, message: '正在上传文件...' }
            : item
        )
      );

      console.log(`发送文件上传请求: ${uploadItem.file.name}`);
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/files`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.token}`
          },
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log(`文件上传HTTP响应: ${response.status} ${response.statusText}`);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error(`文件上传网络错误: ${uploadItem.file.name}`, fetchError);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.log(`💡 上传超时建议: 检查网络连接，或尝试上传更小的文件`);
          throw new Error(`上传超时 (${Math.round(timeoutMs/1000)}秒)，可能是网络慢或Supabase响应慢`);
        }
        throw new Error(`网络错误: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`);
      }

      setFileUploads(prev => 
        prev.map(item => 
          item.id === fileId 
            ? { ...item, progress: 60, message: '处理服务器响应...' }
            : item
        )
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `服务器错误 (${response.status})`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // 如果不是JSON，使用默认错误消息
        }
        console.error(`服务器错误响应: ${uploadItem.file.name}`, { status: response.status, error: errorMessage });
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(`文件上传成功，服务器返回:`, result);

      if (result.success) {
        setFileUploads(prev => 
          prev.map(item => 
            item.id === fileId 
              ? { ...item, progress: 80, message: '创建提交记录...' }
              : item
          )
        );

        // 创建提交记录
        const submissionPayload: any = {
          fileUploadId: result.data.fileId,
        };
        
        if (workMode === 'homework' && selectedAssignment) {
          submissionPayload.assignmentId = parseInt(selectedAssignment);
          submissionPayload.workMode = 'homework';
        }

        const submissionResponse = await fetch(`${API_BASE_URL}/submissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authState.token}`
          },
          body: JSON.stringify(submissionPayload)
        });

        const submissionResult = await submissionResponse.json();
        
        if (submissionResult.success) {
          console.log(`提交记录创建成功: ${uploadItem.file.name}`, submissionResult.data);
          
          // 上传成功，更新状态
          const completedItem = {
            ...uploadItem,
            progress: 100,
            status: 'completed' as const,
            message: '✅ 上传成功！',
            fileId: result.data.fileId
          };

          setFileUploads(prev => 
            prev.map(item => 
              item.id === fileId ? completedItem : item
            )
          );

          // 移动到已上传文件列表
          setTimeout(() => {
            setUploadedFiles(prev => ({
              ...prev,
              [uploadItem.uploadType]: [...prev[uploadItem.uploadType], completedItem]
            }));
            
            // 从上传队列中移除
            setFileUploads(prev => prev.filter(item => item.id !== fileId));
          }, 2000);

          // 开始监控批改进度
          if (submissionResult.data?.submissionId) {
            console.log(`开始监控批改进度: ${submissionResult.data.submissionId}`);
            startGradingMonitor(submissionResult.data.submissionId);
          }

          // 重新加载数据
          if (workMode === 'homework') {
            loadStudentClassrooms();
          }
        } else {
          console.error(`提交记录创建失败: ${uploadItem.file.name}`, submissionResult);
          throw new Error('创建提交记录失败');
        }
      } else {
        console.error(`文件上传结果失败: ${uploadItem.file.name}`, result);
        throw new Error(result.error || '文件上传失败');
      }
    } catch (error) {
      console.error(`文件上传完整流程失败: ${uploadItem.file.name}`, error);
      setFileUploads(prev => 
        prev.map(item => 
          item.id === fileId 
            ? { 
                ...item, 
                status: 'error', 
                progress: 0, 
                message: `❌ ${error instanceof Error ? error.message : '上传失败'}` 
              }
            : item
        )
      );
    }
  };

  // 删除已上传的文件
  const removeUploadedFile = (uploadType: 'assignments' | 'homework' | 'practice', fileId: string) => {
    setUploadedFiles(prev => ({
      ...prev,
      [uploadType]: prev[uploadType].filter(item => item.id !== fileId)
    }));
  };

  // 重试失败的上传
  const retryUpload = async (uploadId: string) => {
    const uploadItem = fileUploads.find(item => item.id === uploadId);
    if (uploadItem && uploadItem.status === 'error') {
      await uploadSingleFile(uploadItem);
    }
  };

  // 多文件上传组件
  const MultiFileUpload = ({ uploadType, title, accept }: { 
    uploadType: 'assignments' | 'homework' | 'practice',
    title: string,
    accept: string 
  }) => {
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadStartTime, setUploadStartTime] = React.useState<number | null>(null);
    
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || isUploading) {
        return;
      }
      
      // 防重复上传：检查最近是否有上传操作
      const now = Date.now();
      if (uploadStartTime && (now - uploadStartTime) < 3000) {
        console.log('防重复上传：操作太频繁，跳过');
        return;
      }
      
      setIsUploading(true);
      setUploadStartTime(now);
      
      try {
        await handleMultiFileUpload(files, uploadType);
      } finally {
        setIsUploading(false);
        // 3秒后才允许下次上传
        setTimeout(() => setUploadStartTime(null), 3000);
      }
      
      // 清空input，允许重复选择同一文件
      e.target.value = '';
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      
      if (!files || files.length === 0 || isUploading) {
        return;
      }
      
      // 防重复上传：检查最近是否有上传操作
      const now = Date.now();
      if (uploadStartTime && (now - uploadStartTime) < 3000) {
        console.log('防重复上传：拖拽操作太频繁，跳过');
        return;
      }
      
      setIsUploading(true);
      setUploadStartTime(now);
      
      try {
        await handleMultiFileUpload(files, uploadType);
      } finally {
        setIsUploading(false);
        // 3秒后才允许下次上传
        setTimeout(() => setUploadStartTime(null), 1000);
      }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const uploadingFiles = fileUploads.filter(item => item.uploadType === uploadType);
    const completedFiles = uploadedFiles[uploadType] || [];

    return (
      <div className="multi-file-upload">
        <h4>{title}</h4>
        
        {/* 文件拖拽上传区域 */}
        <div 
          className={`file-upload-zone multi ${isUploading ? 'uploading' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => !isUploading && document.getElementById(`file-input-${uploadType}`)?.click()}
        >
          <input
            id={`file-input-${uploadType}`}
            type="file"
            accept={accept}
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={isUploading}
          />
          
          <div className="upload-icon">
            {isUploading ? (
              <div className="loading-spinner medium">
                <div className="spinner"></div>
              </div>
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              </svg>
            )}
          </div>
          
          <div className="upload-text">
            {isUploading ? (
              <>
                <p><strong>正在上传文件...</strong></p>
                <p className="upload-hint">请稍候，文件正在处理中</p>
              </>
            ) : (
              <>
                <p><strong>点击选择文件</strong> 或拖拽文件到此处</p>
                <p className="upload-hint">支持 PDF, JPG, PNG 等格式，可选择多个文件</p>
              </>
            )}
          </div>
        </div>

        {/* 上传进度列表 */}
        {uploadingFiles.length > 0 && (
          <div className="upload-progress-list">
            <h5>上传中的文件：</h5>
            {uploadingFiles.map(item => (
              <div key={item.id} className={`upload-item ${item.status}`}>
                <div className="file-info">
                  <span className="file-name">{item.file.name}</span>
                  <span className="file-size">({(item.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                
                <div className="upload-status">
                  {item.status === 'uploading' && (
                    <div className="progress-container">
                      <ProgressBar progress={item.progress} />
                      <span className="progress-text">{item.progress}%</span>
                    </div>
                  )}
                  
                  <span className={`status-message ${item.status}`}>
                    {item.message}
                  </span>
                  
                  {item.status === 'error' && (
                    <button 
                      className="retry-btn"
                      onClick={() => retryUpload(item.id)}
                    >
                      重试
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 已上传文件列表 */}
        {completedFiles.length > 0 && (
          <div className="uploaded-files-list">
            <h5>已上传文件：</h5>
            {completedFiles.map(item => (
              <div key={item.id} className="uploaded-item">
                <div className="file-info">
                  <span className="file-name">{item.file.name}</span>
                  <span className="file-size">({(item.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                
                <div className="file-actions">
                  <span className="upload-time">
                    {new Date().toLocaleString()}
                  </span>
                  <button 
                    className="remove-btn"
                    onClick={() => removeUploadedFile(uploadType, item.id)}
                    title="移除文件"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const openSidePanel = async () => {
    try {
      // 使用Chrome扩展API打开侧边栏
      if (chrome?.sidePanel) {
        await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      } else {
        // 降级处理：在新标签页中打开
        await chrome.tabs.create({ 
          url: chrome.runtime.getURL('sidepanel.html'),
          active: true
        });
      }
    } catch (error) {
      console.error('打开侧边栏失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 打开侧边栏失败，请检查浏览器权限'
      });
    }
  };

  // 加载教师班级列表
  const loadTeacherClassrooms = async (token?: string) => {
    const authToken = token || authState.token;
    if (!authToken) {
      console.log('没有token，跳过加载教师班级');
      return;
    }
    
    try {
      setLoadingState('classrooms', true);
      console.log('开始加载教师班级列表...', 'Token:', authToken ? '存在' : '不存在');
      const response = await fetch(`${API_BASE_URL}/classrooms/teacher`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('教师班级列表加载成功:', result.data);
        setClassrooms(result.data);
      } else {
        console.error('教师班级列表加载失败:', result.error);
      }
    } catch (error) {
      console.error('加载教师班级列表失败:', error);
    } finally {
      setLoadingState('classrooms', false);
    }
  };

  // 加载学生班级列表
  const loadStudentClassrooms = async (token?: string) => {
    const authToken = token || authState.token;
    if (!authToken) {
      console.log('没有token，跳过加载学生班级');
      return;
    }
    
    try {
      setLoadingState('classrooms', true);
      console.log('开始加载学生班级列表...', 'Token:', authToken ? '存在' : '不存在');
      const response = await fetch(`${API_BASE_URL}/classrooms/student`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('学生班级列表加载成功:', result.data);
        setClassrooms(result.data);
        
        // 加载学生作业列表
        setLoadingState('assignments', true);
        const assignmentResponse = await fetch(`${API_BASE_URL}/assignments/student`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        const assignmentResult = await assignmentResponse.json();
        if (assignmentResult.success) {
          console.log('学生作业列表加载成功:', assignmentResult.data);
          console.log('作业数据详情:', assignmentResult.data.map(a => ({
            id: a.id, 
            title: a.title, 
            classroomId: a.classroomId, 
            classroom: a.classroom?.name
          })));
          setAssignments(assignmentResult.data || []);
        } else {
          console.error('学生作业列表加载失败:', assignmentResult.error);
          setAssignments([]);
        }
        setLoadingState('assignments', false);
        
        // 加载学生提交历史
        setLoadingState('submissions', true);
        const submissionResponse = await fetch(`${API_BASE_URL}/submissions`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (submissionResponse.ok) {
          const submissionResult = await submissionResponse.json();
          if (submissionResult.success) {
            setAssignmentSubmissions(submissionResult.data.submissions);
          }
        }
        setLoadingState('submissions', false);
      } else {
        console.error('学生班级列表加载失败:', result.error);
      }
    } catch (error) {
      console.error('加载学生班级列表失败:', error);
    } finally {
      setLoadingState('classrooms', false);
    }
  };

  // 创建班级
  const handleCreateClass = async () => {
    if (!className.trim()) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 请输入班级名称'
      });
      return;
    }

    try {
      setUploadStatus({
        uploading: true,
        progress: 50,
        message: '正在创建班级...'
      });

      const response = await fetch(`${API_BASE_URL}/classrooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          name: className,
          description: classDescription
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setUploadStatus({
          uploading: false,
          progress: 100,
          message: `✅ 班级创建成功！邀请码：${result.data.inviteCode}`
        });
        
        // 清空表单
        setClassName('');
        setClassDescription('');
        setViewState('showCreateClass', false);
        
        // 重新加载班级列表
        loadTeacherClassrooms();
        
        // 加载教师作业列表
        loadTeacherAssignments();
      } else {
        throw new Error(result.error || '创建班级失败');
      }
    } catch (error) {
      console.error('创建班级失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: `❌ 创建失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }

    setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, message: '' }));
    }, 5000);
  };

  // 学生加入班级
  const handleJoinClass = async () => {
    if (!inviteCode.trim()) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 请输入邀请码'
      });
      return;
    }

    try {
      setUploadStatus({
        uploading: true,
        progress: 50,
        message: '正在加入班级...'
      });

      const response = await fetch(`${API_BASE_URL}/classrooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          inviteCode: inviteCode.trim()
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setUploadStatus({
          uploading: false,
          progress: 100,
          message: `✅ 成功加入班级：${result.data.name}`
        });
        
        // 清空表单
        setInviteCode('');
        setViewState('showJoinClass', false);
        
        // 重新加载班级列表
        await loadStudentClassrooms();
      } else {
        throw new Error(result.error || '加入班级失败');
      }
    } catch (error) {
      console.error('加入班级失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: `❌ 加入失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }

    setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, message: '' }));
    }, 5000);
  };

  // 布置作业
  const handleAssignWork = async () => {
    if (!assignmentTitle.trim()) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 请输入作业标题'
      });
      return;
    }

    if (!selectedClassroom) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 请选择班级'
      });
      return;
    }

    if (!startDate || !dueDate) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 请设置开始和截止时间'
      });
      return;
    }

    try {
      setUploadStatus({
        uploading: true,
        progress: 50,
        message: '正在创建作业...'
      });

      // 获取最新上传的作业文件ID（可选）
      let fileUploadId = null;
      const assignmentFiles = uploadedFiles.assignments;
      if (assignmentFiles.length > 0) {
        // 使用最新上传的文件
        fileUploadId = assignmentFiles[assignmentFiles.length - 1].fileId;
        console.log('使用已上传的题目文件:', fileUploadId);
      }

      // 创建作业
      const response = await fetch(`${API_BASE_URL}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          title: assignmentTitle,
          description: assignmentDescription || null,
          classroomId: parseInt(selectedClassroom),
          fileUploadId: fileUploadId,
          startDate: startDate,
          dueDate: dueDate
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setUploadStatus({
          uploading: false,
          progress: 100,
          message: `✅ 作业布置成功！`
        });
        
        // 清空表单
        setAssignmentTitle('');
        setAssignmentDescription('');
        setStartDate('');
        setDueDate('');
        setViewState('showAssignWork', false);
        
        // 清空已上传的题目文件（因为已经用于创建作业了）
        setUploadedFiles(prev => ({
          ...prev,
          assignments: []
        }));
        
        // 重新加载教师班级和作业数据
        loadTeacherClassrooms();
        loadTeacherAssignments();
      } else {
        throw new Error(result.error || '创建作业失败');
      }
    } catch (error) {
      console.error('布置作业失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: `❌ 布置失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }

    setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, message: '' }));
    }, 5000);
  };

  // 查看班级学生
  const handleViewStudents = async () => {
    if (!selectedClassroom) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 请先选择班级'
      });
      return;
    }

    try {
      setLoadingState('students', true);
      setViewState('showStudents', true);

      const response = await fetch(`${API_BASE_URL}/classrooms/${selectedClassroom}/members`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setStudents(result.data);
        setUploadStatus({
          uploading: false,
          progress: 100,
          message: `✅ 成功加载${result.data.length}名学生`
        });
        setTimeout(() => {
          setUploadStatus(prev => ({ ...prev, message: '' }));
        }, 2000);
      } else {
        throw new Error(result.error || '加载学生列表失败');
      }
    } catch (error) {
      console.error('加载学生列表失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: `❌ 加载失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, message: '' }));
      }, 3000);
    } finally {
      setLoadingState('students', false);
    }
  };

  // 查看邀请码
  const handleViewInviteCode = async () => {
    if (!selectedClassroom) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 请先选择班级'
      });
      return;
    }

    const classroom = classrooms.find(c => c.id === parseInt(selectedClassroom));
    if (classroom && classroom.inviteCode) {
      setCurrentInviteCode(classroom.inviteCode);
      setViewState('showInviteCode', true);
      setUploadStatus({
        uploading: false,
        progress: 100,
        message: '✅ 邀请码已显示'
      });
      
      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, message: '' }));
      }, 2000);
    } else {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 未找到班级邀请码'
      });
      
      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, message: '' }));
      }, 3000);
    }
  };

  // 加载教师作业列表
  const loadTeacherAssignments = async (token?: string) => {
    const authToken = token || authState.token;
    if (!authToken || !selectedClassroom) return;
    
    try {
      setLoadingState('assignments', true);
      const response = await fetch(`${API_BASE_URL}/assignments/teacher?classroomId=${selectedClassroom}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        setTeacherAssignments(result.data);
      }
    } catch (error) {
      console.error('加载教师作业列表失败:', error);
    } finally {
      setLoadingState('assignments', false);
    }
  };

  // 学生选择作业后显示详情
  const handleSelectAssignment = (assignmentId: string) => {
    setSelectedAssignment(assignmentId);
    if (assignmentId) {
      setViewState('showAssignmentDetails', true);
    } else {
      setViewState('showAssignmentDetails', false);
    }
  };

  // 获取选中的作业详情
  const getSelectedAssignmentDetails = () => {
    if (!selectedAssignment) return null;
    return assignments.find(a => a.id === parseInt(selectedAssignment));
  };

  // 获取作业的提交记录
  const getAssignmentSubmissions = (assignmentId: number) => {
    return assignmentSubmissions.filter(s => s.assignmentId === assignmentId);
  };



  // 查看作业文件 - 使用独立的下载状态
  const handleViewAssignmentFile = async (fileId: number) => {
    try {
      setDownloadStatus({
        downloading: true,
        message: '🔄 正在下载文件...'
      });

      const response = await fetch(`${API_BASE_URL}/files/${fileId}/download`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        setDownloadStatus({
          downloading: false,
          message: '✅ 文件下载成功！'
        });
        
        setTimeout(() => {
          setDownloadStatus({ downloading: false, message: '' });
        }, 3000);
      } else {
        // 尝试解析错误信息
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `下载失败 (状态码: ${response.status})`;
        
        setDownloadStatus({
          downloading: false,
          message: `❌ ${errorMessage}`
        });
        
        setTimeout(() => {
          setDownloadStatus({ downloading: false, message: '' });
        }, 5000);
      }
    } catch (error) {
      console.error('文件下载失败:', error);
      setDownloadStatus({
        downloading: false,
        message: `❌ 网络错误: ${error instanceof Error ? error.message : '未知错误'}`
      });
      
      setTimeout(() => {
        setDownloadStatus({ downloading: false, message: '' });
      }, 5000);
    }
  };

  // 错误边界渲染
  if (hasError) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h2>AI微积分助教</h2>
        </div>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>出现了一些问题</h3>
          <p>错误信息: {errorMessage}</p>
          <div className="error-actions">
            <button className="btn btn-primary" onClick={resetError}>
              重新加载
            </button>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authState.loading) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h2>AI微积分助教</h2>
        </div>
        <div className="loading">
          <div className="spinner"></div>
          <p>正在加载...</p>
        </div>
      </div>
    );
  }

  const openFullscreen = async () => {
    try {
      // 在新标签页中打开完整的popup界面
      await chrome.tabs.create({ 
        url: chrome.runtime.getURL('popup.html'),
        active: true
      });
    } catch (error) {
      console.error('打开全屏模式失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 打开全屏模式失败，请检查浏览器权限'
      });
    }
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h2>AI微积分助教</h2>
        <p>基于Supabase的智能作业批改助手</p>
        {!isFullscreen && (
          <button 
            className="fullscreen-btn"
            onClick={openFullscreen}
            title="全屏显示"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7,14H5v5h5v-2H7V14z M5,10h2V7h3V5H5V10z M17,7h-3V5h5v5h-2V7z M14,14v2h3v3h2v-5H14z"/>
            </svg>
          </button>
        )}
      </div>

      {!authState.isAuthenticated ? (
        // 未登录状态
        <div className="auth-section">
          <div className="auth-prompt">
            <h3>🔐 请先登录</h3>
            <p>使用GitHub账户登录以上传作业</p>
          </div>
          
          <button
            className="github-login-btn"
            onClick={handleGitHubLogin}
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

          {/* 登录提示 */}
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
      ) : (
        // 已登录状态
        <div className="main-section">
          <div className="user-info">
            <div className="user-avatar">
              {loadingStates.userInfo ? (
                <div className="avatar-placeholder loading-pulse">
                  <div className="loading-spinner small"></div>
                </div>
              ) : authState.user?.avatarUrl ? (
                <img src={authState.user.avatarUrl} alt="头像" />
              ) : (
                <div className="avatar-placeholder">
                  {authState.user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className={`user-details ${loadingStates.userInfo ? 'loading' : ''}`}>
              {loadingStates.userInfo ? (
                <>
                  <SkeletonLoader lines={2} height="18px" />
                  <div className="role-switcher">
                    <div className="skeleton-line" style={{ height: '32px', width: '80px', display: 'inline-block', marginRight: '8px' }}></div>
                    <div className="skeleton-line" style={{ height: '32px', width: '80px', display: 'inline-block' }}></div>
                  </div>
                </>
              ) : (
                <>
                  <h3>{authState.user?.username}</h3>
                  <p>{authState.user?.email}</p>
                  <div className="role-switcher">
                    <button 
                      className={`role-btn ${userRole === 'student' ? 'active' : ''}`}
                      onClick={() => handleRoleSwitch('student')}
                    >
                      🎓 学生
                    </button>
                    <button 
                      className={`role-btn ${userRole === 'teacher' ? 'active' : ''}`}
                      onClick={() => handleRoleSwitch('teacher')}
                    >
                      👨‍🏫 教师
                    </button>
                  </div>
                </>
              )}
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              退出
            </button>
          </div>



          {userRole === 'student' && (
            <>
              {!viewStates.showJoinClass && (
                <>
                  <div className="student-class-info">
                    {loadingStates.classrooms ? (
                      <div className="loading-section">
                        <LoadingSpinner size="small" text="加载班级信息..." />
                        <SkeletonLoader lines={2} height="16px" />
                      </div>
                    ) : classrooms.length > 0 ? (
                      <div className="current-class">
                        <p>🏢 已加入班级：</p>
                        <div className="classroom-list">
                          {classrooms.map(classroom => (
                            <div key={classroom.id} className="classroom-item">
                              <span>{classroom.name}</span>
                              <small>教师：{classroom.teacher?.username || '未知'}</small>
                            </div>
                          ))}
                        </div>
                        <button 
                          className="btn-link"
                          onClick={() => setViewState('showJoinClass', true)}
                        >
                          加入其他班级
                        </button>
                      </div>
                    ) : (
                      <div className="no-class">
                        <p>💫 你还没有加入任何班级</p>
                        <button 
                          className="btn-primary"
                          onClick={() => setViewState('showJoinClass', true)}
                        >
                          加入班级
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="mode-selection">
                    <h3>📝 学习模式</h3>
                    <div className="mode-buttons">
                      <button 
                        className={`mode-btn ${workMode === 'practice' ? 'active' : ''}`}
                        onClick={() => handleModeChange('practice')}
                      >
                        <div className="mode-icon">📚</div>
                        <div className="mode-text">
                          <strong>刷题模式</strong>
                          <span>上传含题目的PDF/图片</span>
                        </div>
                      </button>
                      <button 
                        className={`mode-btn ${workMode === 'homework' ? 'active' : ''}`}
                        onClick={() => handleModeChange('homework')}
                      >
                        <div className="mode-icon">📝</div>
                        <div className="mode-text">
                          <strong>作业模式</strong>
                          <span>上传解题过程（已有题目）</span>
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  {workMode === 'homework' && classrooms.length > 0 && (
                    <div className="assignment-selector">
                      <label>选择班级：</label>
                      <select 
                        value={selectedClassroom} 
                        onChange={(e) => setSelectedClassroom(e.target.value)}
                      >
                        <option value="">请选择班级</option>
                        {classrooms.map(classroom => (
                          <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                        ))}
                      </select>
                      
                      {selectedClassroom && (
                        <>
                          <label style={{marginTop: '12px'}}>选择作业：</label>
                          {loadingStates.assignments ? (
                            <LoadingSpinner size="small" text="加载作业列表..." />
                          ) : (() => {
                            const classroomAssignments = assignments.filter(a => a.classroomId === parseInt(selectedClassroom));
                            
                            if (classroomAssignments.length === 0) {
                              return (
                                <div className="no-assignments">
                                  <p>📝 该班级暂无作业</p>
                                  <small>请等待老师布置作业</small>
                                </div>
                              );
                            }
                            
                            return (
                              <select 
                                value={selectedAssignment} 
                                onChange={(e) => handleSelectAssignment(e.target.value)}
                              >
                                <option value="">请选择作业</option>
                                {classroomAssignments.map(assignment => (
                                  <option key={assignment.id} value={assignment.id}>
                                    {assignment.title} (截止: {new Date(assignment.dueDate).toLocaleDateString()})
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                          

                        </>
                      )}
                    </div>
                  )}

                  {/* 作业详情显示 */}
                  {viewStates.showAssignmentDetails && getSelectedAssignmentDetails() && (
                    <div className="assignment-details">
                      <h4>📋 作业详情</h4>
                      {(() => {
                        const assignment = getSelectedAssignmentDetails();
                        const submissions = getAssignmentSubmissions(assignment.id);
                        const isOverdue = new Date() > new Date(assignment.dueDate);
                        
                        return (
                          <div className="assignment-info">
                            <div className="assignment-header">
                              <h5>{assignment.title}</h5>
                              <div className="assignment-meta">
                                <p><strong>班级：</strong>{assignment.classroom?.name}</p>
                                <p><strong>教师：</strong>{assignment.teacher?.username}</p>
                                <p><strong>开始时间：</strong>{new Date(assignment.startDate).toLocaleString()}</p>
                                <p className={isOverdue ? 'overdue' : 'due-date'}>
                                  <strong>截止时间：</strong>{new Date(assignment.dueDate).toLocaleString()}
                                  {isOverdue && <span> (已过期)</span>}
                                </p>
                              </div>
                            </div>
                            
                            {assignment.description && (
                              <div className="assignment-description">
                                <strong>作业描述：</strong>
                                <p>{assignment.description}</p>
                              </div>
                            )}
                            
                            {assignment.questionFile && (
                              <div className="assignment-file">
                                <strong>题目文件：</strong>
                                <button 
                                  className="btn-link"
                                  onClick={() => handleViewAssignmentFile(assignment.questionFile.id)}
                                >
                                  📎 {assignment.questionFile.originalName}
                                </button>
                              </div>
                            )}

                            {/* 提交状态 */}
                            <div className="submission-status">
                              <strong>提交状态：</strong>
                              {submissions.length > 0 ? (
                                <span className="submitted">
                                  ✅ 已提交 ({submissions.length} 次)
                                  <button 
                                    className="btn-link"
                                    onClick={() => setViewState('showSubmissionHistory', !viewStates.showSubmissionHistory)}
                                  >
                                    {viewStates.showSubmissionHistory ? '隐藏' : '查看'}历史记录
                                  </button>
                                </span>
                              ) : (
                                <span className="not-submitted">❌ 未提交</span>
                              )}
                            </div>

                            {/* 提交历史记录 */}
                            {viewStates.showSubmissionHistory && submissions.length > 0 && (
                              <div className="submission-history">
                                <h6>提交历史：</h6>
                                {submissions.map((submission, index) => (
                                  <div key={submission.id} className="submission-item">
                                    <span>第{index + 1}次提交</span>
                                    <span>{new Date(submission.createdAt).toLocaleString()}</span>
                                    <button 
                                      className="btn-link"
                                      onClick={() => handleViewAssignmentFile(submission.fileUpload?.id)}
                                    >
                                      查看文件
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="form-buttons">
                              <button 
                                className="btn-secondary"
                                onClick={() => setViewState('showAssignmentDetails', false)}
                              >
                                返回
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
              
              {viewStates.showJoinClass && (
                <div className="join-class-form">
                  <h4>加入班级</h4>
                  <input 
                    type="text" 
                    placeholder="输入邀请码" 
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                  <div className="form-buttons">
                    <button 
                      className="btn-primary"
                      onClick={handleJoinClass}
                      disabled={uploadStatus.uploading}
                    >
                      {uploadStatus.uploading ? '加入中...' : '加入'}
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => setViewState('showJoinClass', false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {userRole === 'teacher' && (
            <div className="teacher-section">
              <h3>👨‍🏫 教师功能</h3>
              
              {!viewStates.showCreateClass && !viewStates.showAssignWork && (
                <>
                  <div className="classroom-selector">
                    <label>选择班级：</label>
                    {loadingStates.classrooms ? (
                      <LoadingSpinner size="small" text="加载班级列表..." />
                    ) : (
                      <select 
                        value={selectedClassroom} 
                        onChange={(e) => setSelectedClassroom(e.target.value)}
                      >
                        <option value="">请选择班级</option>
                        {classrooms.map(cls => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div className="teacher-actions">
                    <button 
                      className="teacher-btn"
                      onClick={() => setViewState('showCreateClass', true)}
                    >
                      📋 创建班级
                    </button>
                    <button 
                      className="teacher-btn"
                      onClick={() => setViewState('showAssignWork', true)}
                      disabled={!selectedClassroom}
                    >
                      📤 布置作业
                    </button>
                    <button 
                      className="teacher-btn"
                      onClick={() => {
                        setViewState('showAssignmentManagement', true);
                        loadTeacherAssignments();
                      }}
                      disabled={!selectedClassroom}
                    >
                      📊 作业管理
                    </button>
                    <button 
                      className="teacher-btn"
                      onClick={handleViewStudents}
                      disabled={!selectedClassroom || uploadStatus.uploading}
                    >
                      👥 查看学生
                    </button>
                    <button 
                      className="teacher-btn"
                      onClick={handleViewInviteCode}
                      disabled={!selectedClassroom}
                    >
                      🔗 邀请码
                    </button>
                  </div>
                </>
              )}
              
              {viewStates.showCreateClass && (
                <div className="create-class-form">
                  <h4>创建新班级</h4>
                  <input 
                    type="text" 
                    placeholder="班级名称" 
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                  />
                  <textarea 
                    placeholder="班级描述（可选）"
                    value={classDescription}
                    onChange={(e) => setClassDescription(e.target.value)}
                  ></textarea>
                  <div className="form-buttons">
                    <button 
                      className="btn-primary"
                      onClick={handleCreateClass}
                      disabled={uploadStatus.uploading}
                    >
                      {uploadStatus.uploading ? '创建中...' : '创建'}
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => setViewState('showCreateClass', false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
              
              {viewStates.showAssignWork && (
                <div className="assign-work-form">
                  <h4>布置作业</h4>
                  <input 
                    type="text" 
                    placeholder="作业标题" 
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                  />
                  <textarea 
                    placeholder="作业描述（可选）"
                    value={assignmentDescription}
                    onChange={(e) => setAssignmentDescription(e.target.value)}
                  ></textarea>
                  <div className="date-inputs">
                    <label>
                      开始时间：
                      <input 
                        type="datetime-local" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </label>
                    <label>
                      截止时间：
                      <input 
                        type="datetime-local" 
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </label>
                  </div>
                  
                  <MultiFileUpload 
                    uploadType="assignments"
                    title="📋 题目文件"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  />
                  <div className="form-buttons">
                    <button 
                      className="btn-primary"
                      onClick={handleAssignWork}
                      disabled={uploadStatus.uploading}
                    >
                      {uploadStatus.uploading ? '布置中...' : '布置作业'}
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => setViewState('showAssignWork', false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
              
              {viewStates.showStudents && (
                <div className="students-list">
                  <h4>班级学生列表</h4>
                  <div className="students-container">
                    {loadingStates.students ? (
                      <div className="loading-section">
                        <LoadingSpinner text="加载学生信息..." />
                        <SkeletonLoader lines={3} height="60px" />
                      </div>
                    ) : students.length > 0 ? (
                      students.map(member => (
                        <div key={member.id} className="student-item">
                          <div className="student-avatar">
                            {member.student.avatarUrl ? (
                              <img src={member.student.avatarUrl} alt="头像" />
                            ) : (
                              <div className="avatar-placeholder">
                                {member.student.username?.charAt(0).toUpperCase() || 'S'}
                              </div>
                            )}
                          </div>
                          <div className="student-info">
                            <p><strong>{member.student.username}</strong></p>
                            <p>{member.student.email}</p>
                            <p>加入时间: {new Date(member.joinedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>该班级暂无学生</p>
                    )}
                  </div>
                  <button 
                    className="btn-secondary"
                    onClick={() => setViewState('showStudents', false)}
                  >
                    关闭
                  </button>
                </div>
              )}
              
              {viewStates.showInviteCode && (
                <div className="invite-code-display">
                  <h4>班级邀请码</h4>
                  <div className="invite-code-container">
                    <div className="invite-code">{currentInviteCode}</div>
                    <button 
                      className="btn-small"
                      onClick={() => navigator.clipboard.writeText(currentInviteCode)}
                    >
                      复制
                    </button>
                  </div>
                  <p>学生可使用此邀请码加入班级</p>
                  <button 
                    className="btn-secondary"
                    onClick={() => setViewState('showInviteCode', false)}
                  >
                    关闭
                  </button>
                </div>
              )}

              {/* 教师作业管理 */}
              {viewStates.showAssignmentManagement && (
                <div className="assignment-management">
                  <h4>📊 作业管理</h4>
                  <div className="assignments-list">
                    {loadingStates.assignments ? (
                      <div className="loading-section">
                        <LoadingSpinner text="加载作业列表..." />
                        <SkeletonLoader lines={3} height="80px" />
                      </div>
                    ) : teacherAssignments.length > 0 ? (
                      teacherAssignments.map(assignment => {
                        const isOverdue = new Date() > new Date(assignment.dueDate);
                        const isActive = new Date() >= new Date(assignment.startDate) && !isOverdue;
                        
                        return (
                          <div key={assignment.id} className="assignment-card">
                            <div className="assignment-header">
                              <h5>{assignment.title}</h5>
                              <div className={`status ${isOverdue ? 'overdue' : isActive ? 'active' : 'pending'}`}>
                                {isOverdue ? '已过期' : isActive ? '进行中' : '未开始'}
                              </div>
                            </div>
                            <div className="assignment-info">
                              <p><strong>开始：</strong>{new Date(assignment.startDate).toLocaleString()}</p>
                              <p><strong>截止：</strong>{new Date(assignment.dueDate).toLocaleString()}</p>
                              {assignment.description && <p><strong>描述：</strong>{assignment.description}</p>}
                              <p><strong>提交数：</strong>{assignment._count?.submissions || 0} 人</p>
                            </div>
                            <div className="assignment-actions">
                              <button className="btn-link">查看提交</button>
                              <button className="btn-link">修改时间</button>
                              {isActive && <button className="btn-link">提前结束</button>}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p>暂无作业</p>
                    )}
                  </div>
                  <button 
                    className="btn-secondary"
                    onClick={() => setViewState('showAssignmentManagement', false)}
                  >
                    返回
                  </button>
                </div>
              )}
            </div>
          )}

          {userRole === 'student' && (
            <div className="upload-section">
              <MultiFileUpload 
                uploadType={workMode === 'practice' ? 'practice' : 'homework'}
                title={`📤 上传${workMode === 'practice' ? '练习材料' : '作业答案'}`}
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
              />
              
              <div className="file-info">
                <p>📋 支持格式: PDF, JPG, PNG, GIF, WebP</p>
                <p>📏 最大大小: 100MB</p>
                {workMode === 'practice' ? (
                  <p>💡 刷题模式：请上传包含完整题目和您解答的文件</p>
                ) : (
                  <p>💡 作业模式：请上传您的解题过程，系统将自动批改</p>
                )}
                <p>🚀 <strong>选择文件后会立即上传并开始AI批改</strong></p>
              </div>

              {uploadStatus.message && (
                <div className={`status-message ${uploadStatus.message.includes('失败') || uploadStatus.message.includes('❌') || uploadStatus.message.includes('超时') || uploadStatus.message.includes('⚠️') ? 'error' : 'success'}`}>
                  {uploadStatus.message}
                </div>
              )}
            </div>
          )}

          {/* 下载状态显示 */}
          {downloadStatus.message && (
            <div className={`status-message ${downloadStatus.message.includes('失败') || downloadStatus.message.includes('❌') || downloadStatus.message.includes('网络错误') ? 'error' : 'success'}`}>
              {downloadStatus.downloading && <div className="spinner small"></div>}
              {downloadStatus.message}
            </div>
          )}

          {/* 批改进度显示 */}
          {gradingStatus.processing && (
            <div className="grading-progress-card">
              <div className="grading-header">
                <h4>🤖 AI批改进度</h4>
                <div className="progress-indicator">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${gradingStatus.progress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{gradingStatus.progress}%</span>
                </div>
              </div>
              <div className="grading-stage">
                <div className={`stage-item ${gradingStatus.stage === 'ocr' ? 'active' : gradingStatus.progress > 30 ? 'completed' : ''}`}>
                  🔍 文字识别
                </div>
                <div className={`stage-item ${gradingStatus.stage === 'grading' ? 'active' : gradingStatus.progress === 100 ? 'completed' : ''}`}>
                  🤖 智能批改
                </div>
                <div className={`stage-item ${gradingStatus.stage === 'completed' ? 'completed' : ''}`}>
                  ✅ 完成
                </div>
              </div>
              <p className="grading-message">{gradingStatus.message}</p>
            </div>
          )}

          {/* 批改完成通知 */}
          {gradingNotification.show && (
            <div className="grading-notification">
              <div className="notification-content">
                <div className="notification-icon">🎉</div>
                <div className="notification-text">
                  <h4>批改完成！</h4>
                  <p>{gradingNotification.message}</p>
                </div>
                <div className="notification-actions">
                  <button 
                    className="btn-primary btn-small"
                    onClick={() => handleViewGradingResult(gradingNotification.submissionId!)}
                  >
                    查看结果
                  </button>
                  <button 
                    className="btn-secondary btn-small"
                    onClick={() => setGradingNotification({ show: false, submissionId: null, message: '' })}
                  >
                    稍后查看
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 全局状态消息，用于教师操作反馈 */}
          {userRole === 'teacher' && uploadStatus.message && (
            <div className={`status-message ${uploadStatus.message.includes('失败') || uploadStatus.message.includes('❌') || uploadStatus.message.includes('超时') || uploadStatus.message.includes('⚠️') ? 'error' : 'success'}`}>
              {uploadStatus.message}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default Popup;
