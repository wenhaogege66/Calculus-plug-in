import React, { useState, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { MainLayout } from '../components/MainLayout';
import { HomePage } from '../components/HomePage';
import { AuthSection } from '../components/AuthSection';

// 引入 Tailwind CSS
import '../style.css';

const storage = new Storage();

function FullApp() {
    const [authState, setAuthState] = useState<AuthState>({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: true
    });

    const [uploadStatus, setUploadStatus] = useState({
        uploading: false,
        progress: 0,
        message: ''
    });

    // 1. 修复 ReferenceError：明确定义 isDarkMode 状态
    const [isDarkMode, setIsDarkMode] = useState(false);

    // 获取URL hash来确定初始页面
    const [initialPage, setInitialPage] = useState('home');

    useEffect(() => {
        // 2. 修复路由问题：将旧的 URL hash 映射到新的页面 ID
        const hash = window.location.hash.slice(1);
        if (hash) {
            if (hash === 'homework') {
                setInitialPage('assignments'); // 映射 homework -> assignments
            } else if (hash === 'practice') {
                setInitialPage('practice');
            } else {
                setInitialPage(hash);
            }
        }

        initializeAuth();

        // 初始化主题设置
        const initTheme = async () => {
            try {
                const savedTheme = await storage.get('darkMode');
                if (savedTheme !== undefined) {
                    setIsDarkMode(!!savedTheme);
                }
            } catch (error) {
                console.error("Theme init failed", error);
            }
        };
        initTheme();

        // 监听认证状态变化
        const handleStorageChange = async (changes: any, area: string) => {
            if (area === 'local' && (changes.auth_token || changes.user_info)) {
                await initializeAuth();
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);

        const handleMessage = async (message: any) => {
            if (message.type === 'AUTH_SUCCESS') {
                await initializeAuth();
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);

        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    const initializeAuth = async () => {
        try {
            let savedToken = await storage.get('auth_token');
            let savedUser = await storage.get('user_info');

            if (!savedToken || !savedUser) {
                const chromeData = await chrome.storage.local.get(['auth_token', 'user_info']);
                savedToken = savedToken || chromeData.auth_token;
                savedUser = savedUser || chromeData.user_info;
            }

            if (savedToken && savedUser) {
                const isValid = await verifyToken(savedToken);

                if (isValid) {
                    setAuthState({
                        isAuthenticated: true,
                        user: savedUser,
                        token: savedToken,
                        loading: false
                    });
                    return;
                } else {
                    await Promise.all([
                        storage.remove('auth_token'),
                        storage.remove('user_info'),
                        chrome.storage.local.remove(['auth_token', 'user_info'])
                    ]);
                }
            }

            setAuthState(prev => ({ ...prev, loading: false }));
        } catch (error) {
            setAuthState(prev => ({ ...prev, loading: false }));
        }
    };

    const verifyToken = async (token: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    };

    const handleGitHubLogin = async () => {
        try {
            setUploadStatus({
                uploading: true,
                progress: 0,
                message: '正在启动GitHub认证...'
            });

            const response = await chrome.runtime.sendMessage({ type: 'INITIATE_AUTH' });

            if (!response.success) {
                throw new Error(response.error || '认证启动失败');
            }

            setUploadStatus({
                uploading: false,
                progress: 100,
                message: '认证成功！'
            });

        } catch (error) {
            setUploadStatus({
                uploading: false,
                progress: 0,
                message: `登录失败: ${error instanceof Error ? error.message : '未知错误'}`
            });
        }
    };

    const handleLogout = async () => {
        try {
            await storage.remove('auth_token');
            await storage.remove('user_info');
            await chrome.storage.local.remove(['oauth_success', 'auth_token', 'user_info']);
            await chrome.storage.sync.remove(['isLoggedIn', 'userProfile']);

            setAuthState({
                isAuthenticated: false,
                user: null,
                token: null,
                loading: false
            });
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    if (authState.loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600"></div>
                    <p className="text-slate-500">正在加载...</p>
                </div>
            </div>
        );
    }

    if (!authState.isAuthenticated) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-[#F8FAFC]">
                <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20 mx-auto mb-4">
                            <span className="text-3xl">🔬</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">AI 微积分助教</h1>
                        <p className="text-slate-500 mt-2">智能学习助手</p>
                    </div>

                    <AuthSection
                        authState={authState}
                        uploadStatus={uploadStatus}
                        onGitHubLogin={handleGitHubLogin}
                        onLogout={handleLogout}
                    />
                </div>
            </div>
        );
    }

    return (
        <MainLayout
            authState={authState}
            onLogout={handleLogout}
            initialPage={initialPage}
        >
            <HomePage
                authState={authState}
                isDarkMode={isDarkMode}
            />
        </MainLayout>
    );
}

export default FullApp;