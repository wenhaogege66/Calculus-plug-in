import React, { useState, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { supabase, API_BASE_URL, type User, type AuthState } from './common/config/supabase';
import { ProgressBar } from './components/ProgressBar';

import "./popup.css"

const storage = new Storage();

function Popup() {
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
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<any[]>([]);
  const [showSubmissionHistory, setShowSubmissionHistory] = useState(false);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  
  // 教师端作业管理状态
  const [showAssignmentManagement, setShowAssignmentManagement] = useState(false);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showAssignWork, setShowAssignWork] = useState(false);
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [showStudents, setShowStudents] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
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

  const [uploadStatus, setUploadStatus] = useState<{
    uploading: boolean;
    progress: number;
    message: string;
  }>({
    uploading: false,
    progress: 0,
    message: ''
  });

  // 检测是否在全屏模式（新标签页）
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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
    
    return () => {
      window.removeEventListener('resize', checkFullscreenMode);
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
    };
  }, []); // 依赖项为空，此 effect 只运行一次

  const initializeAuth = async () => {
    try {
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
        
        // 恢复用户角色，优先使用用户对象中的角色
        const userRole = user.role || await storage.get('user_role') || 'student';
        setUserRole(userRole === 'teacher' ? 'teacher' : 'student');
        
        // 确保用户角色信息完整
        if (!user.role) {
          user.role = userRole;
        }
        
        setAuthState({
          isAuthenticated: true,
          user: user,
          token: savedToken,
          loading: false
        });

        // 立即根据当前角色加载数据，不等待服务器验证
        const currentRole = user.role || 'student';
        console.log('初始化时加载数据，当前角色:', currentRole, 'Token:', savedToken ? '存在' : '不存在');
        if (currentRole === 'teacher') {
          loadTeacherClassrooms(savedToken);
        } else {
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
        
        return;
      }

      setAuthState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      console.error('初始化认证状态失败:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
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
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        const serverUser = result.data;
        
        // 更新用户状态，使用服务器端的角色信息
        setUserRole(serverUser.role);
        await storage.set('user_role', serverUser.role);
        
        // 更新authState中的用户信息
        setAuthState(prev => ({
          ...prev,
          user: {
            ...prev.user,
            role: serverUser.role
          }
        }));
        
        // 更新本地存储
        await chrome.storage.local.set({ 
          'user_info': {
            ...authState.user,
            role: serverUser.role
          }
        });
        
        // 根据真实角色加载数据
        console.log('根据服务器角色加载数据:', serverUser.role);
        if (serverUser.role === 'teacher') {
          await loadTeacherClassrooms(token);
        } else {
          await loadStudentClassrooms(token);
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };

  const handleAuthMessage = async (event: MessageEvent) => {
    console.log('收到消息:', event.data);
    
    if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
      console.log('GitHub登录成功，处理认证信息...');
      const { token, user } = event.data;
      
      // 设置用户角色，如果服务器没有返回角色则默认为学生
      if (!user.role) {
        user.role = 'student';
      }
      
      // 根据服务器返回的角色设置前端状态
      setUserRole(user.role);
      
      // 保存认证信息到 chrome.storage.local（与background保持一致）
      await chrome.storage.local.set({
        'auth_token': token,
        'user_info': user
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

      // 根据用户角色加载对应数据
      if (user.role === 'teacher') {
        loadTeacherClassrooms();
      } else {
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 强制检查认证状态
    if (!authState.isAuthenticated || !authState.token) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '⚠️ 请先登录后再上传文件'
      });
      
      // 清空文件选择
      event.target.value = '';
      return;
    }

    try {
      setUploadStatus({
        uploading: true,
        progress: 20,
        message: '正在上传文件...'
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('workMode', workMode);

      setUploadStatus(prev => ({ ...prev, progress: 50 }));

      const response = await fetch(`${API_BASE_URL}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setUploadStatus({
          uploading: false,
          progress: 100,
          message: '✅ 文件上传成功！正在创建提交记录...'
        });

        // 创建提交记录
        const submissionResponse = await fetch(`${API_BASE_URL}/submissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authState.token}`
          },
          body: JSON.stringify({
            fileUploadId: result.data.fileId
          })
        });

        const submissionResult = await submissionResponse.json();
        
        if (submissionResult.success) {
          setUploadStatus({
            uploading: false,
            progress: 100,
            message: '🎉 提交成功！点击侧边栏查看处理进度'
          });
        } else {
          setUploadStatus({
            uploading: false,
            progress: 100,
            message: '⚠️ 文件上传成功，但创建提交记录失败'
          });
        }
      } else {
        throw new Error(result.error || '文件上传失败');
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: `❌ 上传失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }

    // 清空文件输入
    event.target.value = '';

    // 5秒后清除消息
    setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, message: '' }));
    }, 5000);
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
        const assignmentResponse = await fetch(`${API_BASE_URL}/assignments/student`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        const assignmentResult = await assignmentResponse.json();
        if (assignmentResult.success) {
          console.log('学生作业列表加载成功:', assignmentResult.data);
          setAssignments(assignmentResult.data);
        }
        
        // 加载学生提交历史
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
      } else {
        console.error('学生班级列表加载失败:', result.error);
      }
    } catch (error) {
      console.error('加载学生班级列表失败:', error);
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
        setShowCreateClass(false);
        
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
        setShowJoinClass(false);
        
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
        progress: 30,
        message: '正在处理作业文件...'
      });

      let fileUploadId = null;
      
      // 如果有文件，先上传文件
      if (assignmentFile) {
        const formData = new FormData();
        formData.append('file', assignmentFile);
        formData.append('workMode', 'practice'); // 题目文件使用practice模式

        const fileResponse = await fetch(`${API_BASE_URL}/files`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.token}`
          },
          body: formData
        });

        const fileResult = await fileResponse.json();
        if (!fileResult.success) {
          throw new Error(fileResult.error || '文件上传失败');
        }
        
        fileUploadId = fileResult.data.fileId;
      }

      setUploadStatus({
        uploading: true,
        progress: 70,
        message: '正在创建作业...'
      });

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
        setAssignmentFile(null);
        setShowAssignWork(false);
        
        // 可以在此处刷新作业列表（如果需要的话）
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
      setUploadStatus({
        uploading: true,
        progress: 50,
        message: '正在加载学生列表...'
      });

      const response = await fetch(`${API_BASE_URL}/classrooms/${selectedClassroom}/members`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setStudents(result.data);
        setShowStudents(true);
        setUploadStatus({
          uploading: false,
          progress: 100,
          message: `✅ 成功加载${result.data.length}名学生`
        });
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
    }

    setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, message: '' }));
    }, 3000);
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
      setShowInviteCode(true);
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
    }
  };

  // 学生选择作业后显示详情
  const handleSelectAssignment = (assignmentId: string) => {
    setSelectedAssignment(assignmentId);
    if (assignmentId) {
      setShowAssignmentDetails(true);
    } else {
      setShowAssignmentDetails(false);
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

  // 提交作业
  const handleSubmitAssignment = async () => {
    if (!submissionFile || !selectedAssignment) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '⚠️ 请选择要提交的文件'
      });
      return;
    }

    try {
      setUploadStatus({
        uploading: true,
        progress: 20,
        message: '📤 上传文件中...'
      });

      // 1. 先上传文件
      const formData = new FormData();
      formData.append('file', submissionFile);
      formData.append('workMode', 'homework');
      formData.append('assignmentId', selectedAssignment);

      const uploadResponse = await fetch(`${API_BASE_URL}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('文件上传失败');
      }

      const uploadResult = await uploadResponse.json();
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '文件上传失败');
      }

      setUploadStatus({
        uploading: true,
        progress: 60,
        message: '📝 创建提交记录...'
      });

      // 2. 创建提交记录
      const submissionResponse = await fetch(`${API_BASE_URL}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({
          fileUploadId: uploadResult.data.fileId,
          assignmentId: parseInt(selectedAssignment),
          workMode: 'homework'
        })
      });

      if (!submissionResponse.ok) {
        throw new Error('创建提交记录失败');
      }

      const submissionResult = await submissionResponse.json();
      if (!submissionResult.success) {
        throw new Error(submissionResult.error || '创建提交记录失败');
      }

      setUploadStatus({
        uploading: false,
        progress: 100,
        message: '✅ 作业提交成功！'
      });

      // 清空文件选择
      setSubmissionFile(null);
      
      // 重新加载提交历史
      loadStudentClassrooms();

      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, message: '', progress: 0 }));
      }, 3000);

    } catch (error) {
      console.error('提交作业失败:', error);
      setUploadStatus({
        uploading: false,
        progress: 0,
        message: '❌ 提交失败: ' + (error as Error).message
      });
      
      setTimeout(() => {
        setUploadStatus(prev => ({ ...prev, message: '', progress: 0 }));
      }, 5000);
    }
  };

  // 查看作业文件
  const handleViewAssignmentFile = async (fileId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${fileId}/download`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('打开文件失败:', error);
    }
  };

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

            </div>
            <button className="logout-btn" onClick={handleLogout}>
              退出
            </button>
          </div>



          {userRole === 'student' && (
            <>
              {!showJoinClass && (
                <>
                  <div className="student-class-info">
                    {classrooms.length > 0 ? (
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
                          onClick={() => setShowJoinClass(true)}
                        >
                          加入其他班级
                        </button>
                      </div>
                    ) : (
                      <div className="no-class">
                        <p>💫 你还没有加入任何班级</p>
                        <button 
                          className="btn-primary"
                          onClick={() => setShowJoinClass(true)}
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
                        disabled={!selectedClassroom}
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
                          <select 
                            value={selectedAssignment} 
                            onChange={(e) => handleSelectAssignment(e.target.value)}
                          >
                            <option value="">请选择作业</option>
                            {assignments.filter(a => a.classroomId === parseInt(selectedClassroom)).map(assignment => (
                              <option key={assignment.id} value={assignment.id}>
                                {assignment.title} (截止: {new Date(assignment.dueDate).toLocaleDateString()})
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  )}

                  {/* 作业详情显示 */}
                  {showAssignmentDetails && getSelectedAssignmentDetails() && (
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
                                    onClick={() => setShowSubmissionHistory(!showSubmissionHistory)}
                                  >
                                    {showSubmissionHistory ? '隐藏' : '查看'}历史记录
                                  </button>
                                </span>
                              ) : (
                                <span className="not-submitted">❌ 未提交</span>
                              )}
                            </div>

                            {/* 提交历史记录 */}
                            {showSubmissionHistory && submissions.length > 0 && (
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

                            {/* 提交表单 */}
                            {!isOverdue && (
                              <div className="submit-assignment">
                                <h6>{submissions.length > 0 ? '重新提交：' : '提交作业：'}</h6>
                                <div className="upload-area">
                                  <input 
                                    type="file" 
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                                  />
                                  <p>选择您的作业文件 (PDF/图片)</p>
                                </div>
                                
                                <div className="form-buttons">
                                  <button 
                                    className="btn-primary"
                                    onClick={handleSubmitAssignment}
                                    disabled={!submissionFile || uploadStatus.uploading}
                                  >
                                    {uploadStatus.uploading ? (
                                      <div className="upload-progress">
                                        <ProgressBar progress={uploadStatus.progress} />
                                        <span>提交中...</span>
                                      </div>
                                    ) : (
                                      '📤 提交作业'
                                    )}
                                  </button>
                                  <button 
                                    className="btn-secondary"
                                    onClick={() => setShowAssignmentDetails(false)}
                                  >
                                    返回
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
              
              {showJoinClass && (
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
                      onClick={() => setShowJoinClass(false)}
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
              
              {!showCreateClass && !showAssignWork && (
                <>
                  <div className="classroom-selector">
                    <label>选择班级：</label>
                    <select 
                      value={selectedClassroom} 
                      onChange={(e) => setSelectedClassroom(e.target.value)}
                    >
                      <option value="">请选择班级</option>
                      {classrooms.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="teacher-actions">
                    <button 
                      className="teacher-btn"
                      onClick={() => setShowCreateClass(true)}
                    >
                      📋 创建班级
                    </button>
                    <button 
                      className="teacher-btn"
                      onClick={() => setShowAssignWork(true)}
                      disabled={!selectedClassroom}
                    >
                      📤 布置作业
                    </button>
                    <button 
                      className="teacher-btn"
                      onClick={() => {
                        setShowAssignmentManagement(true);
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
              
              {showCreateClass && (
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
                      onClick={() => setShowCreateClass(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
              
              {showAssignWork && (
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
                  <div className="upload-area">
                    <label>题目文件：</label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png" 
                      onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                      required
                    />
                    <p>请上传题目的PDF文件或图片</p>
                  </div>
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
                      onClick={() => setShowAssignWork(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
              
              {showStudents && (
                <div className="students-list">
                  <h4>班级学生列表</h4>
                  <div className="students-container">
                    {students.length > 0 ? (
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
                    onClick={() => setShowStudents(false)}
                  >
                    关闭
                  </button>
                </div>
              )}
              
              {showInviteCode && (
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
                    onClick={() => setShowInviteCode(false)}
                  >
                    关闭
                  </button>
                </div>
              )}

              {/* 教师作业管理 */}
              {showAssignmentManagement && (
                <div className="assignment-management">
                  <h4>📊 作业管理</h4>
                  <div className="assignments-list">
                    {teacherAssignments.length > 0 ? (
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
                    onClick={() => setShowAssignmentManagement(false)}
                  >
                    返回
                  </button>
                </div>
              )}
            </div>
          )}

          {userRole === 'student' && (
            <div className="upload-section">
              <h3>📤 上传{workMode === 'practice' ? '练习材料' : '作业答案'}</h3>
              <div className="upload-area">
                <input
                  type="file"
                  id="file-input"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={handleFileUpload}
                  disabled={uploadStatus.uploading}
                />
                <label htmlFor="file-input" className="upload-label">
                  {uploadStatus.uploading ? (
                    <div className="upload-progress">
                      <ProgressBar progress={uploadStatus.progress} />
                      <span>上传中...</span>
                    </div>
                  ) : (
                    <>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                      点击上传PDF或图片文件
                    </>
                  )}
                </label>
              </div>
              
              <div className="file-info">
                <p>📋 支持格式: PDF, JPG, PNG, GIF, WebP</p>
                <p>📏 最大大小: 100MB</p>
                {workMode === 'practice' ? (
                  <p>💡 刷题模式：请上传包含完整题目和您解答的文件</p>
                ) : (
                  <p>💡 作业模式：请上传您的解题过程，系统将匹配对应题目</p>
                )}
              </div>

              {uploadStatus.message && (
                <div className={`status-message ${uploadStatus.message.includes('失败') || uploadStatus.message.includes('❌') || uploadStatus.message.includes('超时') || uploadStatus.message.includes('⚠️') ? 'error' : 'success'}`}>
                  {uploadStatus.message}
                </div>
              )}
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
