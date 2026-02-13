import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { PracticeDetailPage } from './PracticeDetailPage';
import { MathPixMarkdownRenderer } from './MathPixMarkdownRenderer';

interface PracticeSession {
    id: string;
    originalName: string;
    uploadedAt: string;
    status: 'UPLOADED' | 'OCR_PROCESSING' | 'AI_PROCESSING' | 'COMPLETED' | 'FAILED';
    score?: number;
    feedback?: string;
    suggestions?: string;
    ocrText?: string;
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
    // 新增的结构化信息
    questionCount?: number;
    incorrectCount?: number;
    correctCount?: number;
    knowledgePoints?: string[];
    detailedErrors?: any[];
    improvementAreas?: string[];
    nextStepRecommendations?: string[];
    // 错题本相关
    isInErrorBook?: boolean;
    // 进度信息
    progress?: {
        percent: number;
        stage: string;
        message: string;
    };
}

interface PracticePageProps {
    authState: AuthState;
    onPageChange?: (page: string, params?: any) => void;
    params?: { sessionId?: string };
}

export const PracticePage: React.FC<PracticePageProps> = ({ authState, params }) => {
    const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'analytics'>('upload');
    const [practiceHistory, setPracticeHistory] = useState<PracticeSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [message, setMessage] = useState({ text: '', type: '' as 'success' | 'error' | 'info' });
    const [dragOver, setDragOver] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
    const [showErrorBookModal, setShowErrorBookModal] = useState<string | null>(null);
    const [errorBookCategories, setErrorBookCategories] = useState<string[]>(['微分基础', '积分计算', '极限问题', '应用题']);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [newCategory, setNewCategory] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadPracticeHistory();
    }, [authState.token]);

    // 从错题归档跳转过来时，直接打开对应练习详情
    useEffect(() => {
        const sessionId = params?.sessionId;
        if (sessionId) {
            setSelectedSessionId(sessionId);
            setActiveTab('history');
        }
    }, [params?.sessionId]);

    // 自动刷新处理中的练习会话
    useEffect(() => {
        if (!authState.token) return;

        // 检查是否有处理中的会话
        const hasProcessingSessions = practiceHistory.some(session =>
            session.status === 'UPLOADED' ||
            session.status === 'OCR_PROCESSING' ||
            session.status === 'AI_PROCESSING'
        );

        if (!hasProcessingSessions) return;

        // 每5秒刷新一次处理中的会话
        const intervalId = setInterval(async () => {
            await loadProcessingSessionsProgress();
        }, 5000);

        return () => clearInterval(intervalId);
    }, [authState.token, practiceHistory]);

    const loadProcessingSessionsProgress = async () => {
        if (!authState.token) return;

        // 筛选出所有处理中的会话
        const processingSessions = practiceHistory.filter(session =>
            session.status === 'UPLOADED' ||
            session.status === 'OCR_PROCESSING' ||
            session.status === 'AI_PROCESSING'
        );

        if (processingSessions.length === 0) return;

        try {
            // 并发获取所有处理中会话的最新状态
            const updates = await Promise.all(
                processingSessions.map(async (session) => {
                    try {
                        const response = await fetch(`${API_BASE_URL}/practice/${session.id}/status`, {
                            headers: { 'Authorization': `Bearer ${authState.token}` }
                        });

                        if (response.ok) {
                            const result = await response.json();
                            if (result.success) {
                                return {
                                    id: session.id,
                                    status: result.data.status,
                                    progress: result.data.progress,
                                    score: result.data.gradingResult?.score,
                                    feedback: result.data.gradingResult?.feedback,
                                    questionCount: result.data.gradingResult?.questionCount,
                                    incorrectCount: result.data.gradingResult?.incorrectCount,
                                    correctCount: result.data.gradingResult?.correctCount,
                                    knowledgePoints: result.data.gradingResult?.knowledgePoints,
                                    detailedErrors: result.data.gradingResult?.detailedErrors
                                };
                            }
                        }
                        return null;
                    } catch (error) {
                        return null;
                    }
                })
            );

            // 更新本地状态
            const validUpdates = updates.filter(update => update !== null);
            if (validUpdates.length > 0) {
                setPracticeHistory(prev => prev.map(session => {
                    const update = validUpdates.find(u => u && u.id === session.id);
                    if (update) {
                        return { ...session, ...update };
                    }
                    return session;
                }));
            }
        } catch (error) {
        }
    };

    const loadPracticeHistory = async () => {
        if (!authState.token) return;

        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/practice/history`, {
                headers: { 'Authorization': `Bearer ${authState.token}` }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    setPracticeHistory(result.data || []);
                } else {
                    showMessage(result.error || '获取练习记录失败', 'error');
                }
            } else {
                // 尝试解析错误响应
                try {
                    const errorResult = await response.json();
                    showMessage(errorResult.error || `HTTP ${response.status}: 获取练习记录失败`, 'error');
                } catch {
                    showMessage(`HTTP ${response.status}: 获取练习记录失败`, 'error');
                }
            }
        } catch (error) {
            showMessage('加载练习记录失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: 'info' }), 3000);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            handleFiles(Array.from(files));
        }
    };

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(false);
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(false);

        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            handleFiles(Array.from(files));
        }
    };

    const handleFiles = async (files: File[]) => {
        if (!authState.token) {
            showMessage('请先登录', 'error');
            return;
        }

        const supportedTypes = [
            'application/pdf',
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/tiff', 'image/tif', 'image/svg+xml',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];
        const validFiles = files.filter(file => supportedTypes.includes(file.type));

        if (validFiles.length === 0) {
            showMessage('请选择支持的文件格式 (PDF, 图片文件, Word文档)', 'error');
            return;
        }

        for (const file of validFiles) {
            await uploadAndProcessFile(file);
        }
    };

    const uploadAndProcessFile = async (file: File) => {
        try {
            setLoading(true);
            setUploadProgress(0);
            showMessage(`正在上传 ${file.name}...`, 'info');

            // 上传文件
            const formData = new FormData();
            formData.append('file', file);
            formData.append('purpose', 'self_practice');

            setUploadProgress(30);

            const uploadResponse = await fetch(`${API_BASE_URL}/files`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authState.token}` },
                body: formData
            });

            const uploadResult = await uploadResponse.json();

            if (uploadResult.success) {
                setUploadProgress(60);
                showMessage('文件上传成功，开始AI处理...', 'info');

                // 创建自主练习记录
                const practiceResponse = await fetch(`${API_BASE_URL}/practice`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authState.token}`
                    },
                    body: JSON.stringify({
                        fileUploadId: uploadResult.data.fileId,
                        practiceType: 'SELF_STUDY'
                    })
                });

                const practiceResult = await practiceResponse.json();

                if (practiceResult.success) {
                    setUploadProgress(100);
                    showMessage(`✅ ${file.name} 处理完成！`, 'success');

                    // 重新加载练习记录
                    await loadPracticeHistory();

                    // 切换到历史记录标签页
                    setActiveTab('history');
                } else {
                    showMessage(`❌ 处理失败: ${practiceResult.error}`, 'error');
                }
            } else {
                showMessage(`❌ 上传失败: ${uploadResult.error}`, 'error');
            }
        } catch (error) {
            showMessage(`❌ 处理 ${file.name} 失败`, 'error');
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    const getDifficultyLabel = (difficulty?: string) => {
        switch (difficulty) {
            case 'EASY': return '简单';
            case 'MEDIUM': return '中等';
            case 'HARD': return '困难';
            default: return '未评估';
        }
    };

    const getDifficultyColor = (difficulty?: string) => {
        switch (difficulty) {
            case 'EASY': return '#10b981';
            case 'MEDIUM': return '#f59e0b';
            case 'HARD': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'UPLOADED': return '📤';
            case 'OCR_PROCESSING': return '🔍';
            case 'AI_PROCESSING': return '🤖';
            case 'COMPLETED': return '✅';
            case 'FAILED': return '❌';
            default: return '📝';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return '#10b981';      // 90+ 绿色 (优秀)
        if (score >= 75) return '#3b82f6';      // 75-89 蓝色 (良好)
        if (score >= 60) return '#f59e0b';      // 60-74 黄色 (及格)
        return '#ef4444';                       // <60 红色 (不及格)
    };

    const calculateAverageScore = () => {
        const completedSessions = practiceHistory.filter(session =>
            session.status === 'COMPLETED' && session.score !== undefined
        );
        if (completedSessions.length === 0) return 0;

        const total = completedSessions.reduce((sum, session) => sum + (session.score || 0), 0);
        return Math.round(total / completedSessions.length);
    };

    const handleSessionClick = (sessionId: string) => {
        setSelectedSessionId(sessionId);
    };

    const handleBackToList = () => {
        setSelectedSessionId(null);
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (!authState.token) {
            showMessage('请先登录', 'error');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/practice/${sessionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authState.token}` }
            });

            const result = await response.json();

            if (result.success) {
                showMessage('练习记录已删除', 'success');
                // 重新加载练习记录
                await loadPracticeHistory();
                setShowDeleteDialog(null);
            } else {
                showMessage(`删除失败: ${result.error}`, 'error');
            }
        } catch (error) {
            showMessage('删除练习记录失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (sessionId: string) => {
        setShowDeleteDialog(sessionId);
    };

    const cancelDelete = () => {
        setShowDeleteDialog(null);
    };

    const showAddToErrorBookModal = (sessionId: string) => {
        setShowErrorBookModal(sessionId);
        setSelectedCategory('');
        setNewCategory('');
    };

    const handleAddToErrorBook = async () => {
        if (!authState.token || !showErrorBookModal) {
            showMessage('请先登录', 'error');
            return;
        }

        const categoryToUse = newCategory.trim() || selectedCategory;
        if (!categoryToUse) {
            showMessage('请选择或输入分类', 'error');
            return;
        }

        try {
            setLoading(true);

            // 获取选中的练习记录
            const selectedSession = practiceHistory.find(s => s.id === showErrorBookModal);
            if (!selectedSession) {
                showMessage('练习记录不存在', 'error');
                return;
            }

            // 首先创建或获取分类
            let categoryId = null;
            if (categoryToUse) {
                // 创建分类（如果是新分类）
                if (newCategory.trim()) {
                    const createCategoryResponse = await fetch(`${API_BASE_URL}/mistakes/categories`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authState.token}`
                        },
                        body: JSON.stringify({
                            name: newCategory.trim(),
                            description: '从练习页面创建的分类'
                        })
                    });

                    if (createCategoryResponse.ok) {
                        const categoryResult = await createCategoryResponse.json();
                        if (categoryResult.success) {
                            categoryId = categoryResult.data.category.id;
                        }
                    }
                } else {
                    // 如果是已存在分类，需要获取分类ID（暂时使用分类名称）
                    // 在实际实现中，应该从分类列表API获取正确的ID
                    // 这里简化处理
                }
            }

            // 添加到错题本
            const response = await fetch(`${API_BASE_URL}/mistakes/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authState.token}`
                },
                body: JSON.stringify({
                    submissionId: parseInt(selectedSession.id),
                    categoryId,
                    title: selectedSession.originalName,
                    notes: `从练习记录手动添加（得分：${selectedSession.score}分）`,
                    tags: ['手动添加', '练习记录'],
                    priority: selectedSession.score && selectedSession.score < 60 ? 'high' : 'medium'
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showMessage(`已添加到错题本"${categoryToUse}"分类`, 'success');

                // 更新本地状态
                setPracticeHistory(prev => prev.map(session =>
                    session.id === showErrorBookModal
                        ? { ...session, isInErrorBook: true }
                        : session
                ));

                // 添加新分类到分类列表
                if (newCategory.trim() && !errorBookCategories.includes(newCategory.trim())) {
                    setErrorBookCategories(prev => [...prev, newCategory.trim()]);
                }

                setShowErrorBookModal(null);
            } else {
                showMessage(result.error || '添加到错题本失败', 'error');
            }
        } catch (error) {
            showMessage('添加到错题本失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    const renderPracticeSession = (session: PracticeSession) => (
        <div
            key={session.id}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group relative overflow-hidden"
            onClick={() => handleSessionClick(session.id)}
        >
            {/* Top gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 to-primary-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xl flex-shrink-0">{getStatusIcon(session.status)}</span>
                    <span className="text-sm font-semibold text-slate-800 truncate">{session.originalName}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(session.uploadedAt).toLocaleString('zh-CN')}
                    </span>
                    {session.difficulty && (
                        <span
                            className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white border"
                            style={{ color: getDifficultyColor(session.difficulty), borderColor: getDifficultyColor(session.difficulty) }}
                        >
                            {getDifficultyLabel(session.difficulty)}
                        </span>
                    )}
                    {session.status === 'COMPLETED' && (
                        <button
                            className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${session.isInErrorBook
                                ? 'bg-green-50 text-green-600 border-green-200 cursor-default'
                                : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                                }`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!session.isInErrorBook) {
                                    showAddToErrorBookModal(session.id);
                                }
                            }}
                            title={session.isInErrorBook ? '已添加到错题本' : '添加到错题本'}
                        >
                            <span>{session.isInErrorBook ? '📚✓' : '📚+'}</span>
                            <span>{session.isInErrorBook ? '已在错题本' : '加入错题本'}</span>
                        </button>
                    )}
                    <button
                        className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all flex items-center gap-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(session.id);
                        }}
                        title="删除练习记录"
                    >
                        <span>🗑️</span>
                        <span>删除练习</span>
                    </button>
                </div>
            </div>

            {session.status === 'COMPLETED' && session.score !== undefined && (
                <div className="space-y-3">
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-baseline gap-1">
                            <span
                                className="text-3xl font-bold"
                                style={{ color: getScoreColor(session.score) }}
                            >
                                {session.score}
                            </span>
                            <span className="text-sm text-slate-500 font-medium">分</span>
                        </div>
                        <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold border border-green-200">
                            <span className="opacity-80">作答评估: </span>
                            <span className="font-bold">
                                {session.score >= 90 ? '优秀' :
                                    session.score >= 80 ? '良好' :
                                        session.score >= 70 ? '中等' :
                                            session.score >= 60 ? '及格' : '待提升'}
                            </span>
                        </div>
                    </div>

                    {/* 统计信息 */}
                    <div className="flex gap-3 p-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-lg">
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-600 font-medium">题目数:</span>
                            <span className="font-bold text-slate-900">{session.questionCount || 0}</span>
                        </div>
                        <div className="w-px h-4 bg-blue-200"></div>
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-600 font-medium">正确:</span>
                            <span className="font-bold text-green-600">{session.correctCount || 0}</span>
                        </div>
                        <div className="w-px h-4 bg-blue-200"></div>
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-600 font-medium">错误:</span>
                            <span className="font-bold text-red-600">{session.incorrectCount || 0}</span>
                        </div>
                    </div>

                    {/* OCR预览 */}
                    {session.ocrText && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <h5 className="text-xs font-semibold text-slate-700 mb-2">📄 识别内容预览</h5>
                            <div className="max-h-20 overflow-hidden relative">
                                <MathPixMarkdownRenderer
                                    content={session.ocrText}
                                    className="text-xs"
                                    maxLength={150}
                                />
                                <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none"></div>
                            </div>
                        </div>
                    )}

                    {/* 知识点标签 */}
                    {session.knowledgePoints && session.knowledgePoints.length > 0 && (
                        <div>
                            <h5 className="text-xs font-semibold text-slate-700 mb-2">📚 涉及知识点</h5>
                            <div className="flex flex-wrap gap-2">
                                {session.knowledgePoints.map((point, index) => (
                                    <span
                                        key={index}
                                        className="inline-block px-2.5 py-1 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-600 text-xs font-medium rounded-full border border-purple-200"
                                    >
                                        {point}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {(session.status === 'UPLOADED' ||
                session.status === 'OCR_PROCESSING' ||
                session.status === 'AI_PROCESSING') && (
                    <div className="flex items-start gap-3 p-6 text-slate-600">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-primary-600 rounded-full animate-spin flex-shrink-0 mt-0.5"></div>
                        <div className="flex-1 space-y-3">
                            <div className="text-sm font-medium text-slate-700 text-center">
                                {session.progress?.message ||
                                    (session.status === 'UPLOADED' ? '等待处理中...' :
                                        session.status === 'OCR_PROCESSING' ? '正在识别内容...' : '正在AI批改...')}
                            </div>
                            {session.progress && (
                                <div className="w-full">
                                    <div className="w-full h-6 bg-slate-200 rounded-full overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500 flex items-center justify-center min-w-[40px]"
                                            style={{ width: `${session.progress.percent}%` }}
                                        >
                                            <span className="text-xs font-bold text-white relative z-10">{session.progress.percent}%</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
        </div>
    );

    // If a session is selected, show the detail page
    if (selectedSessionId) {
        return (
            <PracticeDetailPage
                sessionId={selectedSessionId}
                authState={authState}
                onBack={handleBackToList}
            />
        );
    }

    return (
        <div className="w-full h-full overflow-y-auto p-6 lg:p-8 bg-[#F1F5F9]">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
                    💪 自主练习
                </h1>
                <p className="text-slate-600 text-sm">上传练习题目，获得AI智能批改和学习建议</p>
            </div>

            {message.text && (
                <div className={`mb-6 p-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
                    message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
                        'bg-blue-50 border border-blue-200 text-blue-800'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="flex gap-2 p-1 bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
                <button
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'upload'
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/30'
                        : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    onClick={() => setActiveTab('upload')}
                >
                    📤 上传练习
                </button>
                <button
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/30'
                        : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    onClick={() => setActiveTab('history')}
                >
                    📚 练习记录
                </button>
                <button
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'analytics'
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/30'
                        : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    onClick={() => setActiveTab('analytics')}
                >
                    📊 学习分析
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]">
                {activeTab === 'upload' && (
                    <div className="space-y-6">
                        <div
                            className={`relative rounded-2xl p-12 text-center cursor-pointer transition-all border-2 border-dashed ${dragOver
                                ? 'border-primary-400 bg-gradient-to-br from-primary-50/50 to-primary-100/30 scale-[1.02]'
                                : 'border-slate-300 bg-gradient-to-br from-slate-50/50 to-slate-100/30 hover:border-primary-400 hover:bg-gradient-to-br hover:from-primary-50/50 hover:to-primary-100/30'
                                }`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className="text-5xl mb-4 animate-bounce">📁</div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">上传练习文件</h3>
                            <p className="text-slate-600 mb-2">点击选择文件或拖拽文件到这里</p>
                            <div className="text-xs text-slate-400 mt-4">
                                支持 PDF、图片文件(JPG/PNG/GIF/WebP/BMP/TIFF/SVG)、Word文档，最大100MB
                            </div>

                            {uploadProgress > 0 && (
                                <div className="mt-6 relative">
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                    <span className="absolute top-3 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-primary-600">
                                        {uploadProgress}%
                                    </span>
                                </div>
                            )}
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.svg,.docx,.doc"
                            multiple
                            onChange={handleFileSelect}
                        />

                        <div className="bg-gradient-to-br from-green-50/50 to-blue-50/50 rounded-xl p-6 border border-green-100">
                            <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                💡 练习建议
                            </h4>
                            <ul className="space-y-2 text-sm text-slate-700">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                                    <span>上传清晰的题目图片或PDF文件</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                                    <span>确保数学公式和文字清晰可见</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                                    <span>可以上传手写或打印的练习题</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                                    <span>AI会对您的解答进行详细分析和建议</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="min-h-[400px]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <div className="w-10 h-10 border-4 border-slate-300 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                                <p>加载练习记录中...</p>
                            </div>
                        ) : practiceHistory.length > 0 ? (
                            <div className="space-y-3">
                                {practiceHistory.map(renderPracticeSession)}
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <div className="text-6xl mb-6 opacity-60">📝</div>
                                <h3 className="text-xl font-semibold text-slate-700 mb-2">还没有练习记录</h3>
                                <p className="text-slate-500 mb-8">开始上传练习题目，获得AI智能批改吧！</p>
                                <button
                                    className="px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 transition-all active:scale-95"
                                    onClick={() => setActiveTab('upload')}
                                >
                                    开始练习
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-2xl p-6 border border-blue-100 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-1">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                                    📈
                                </div>
                                <div className="flex-1">
                                    <div className="text-3xl font-bold text-slate-800 mb-1">{practiceHistory.length}</div>
                                    <div className="text-sm text-slate-600 font-medium">总练习次数</div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 rounded-2xl p-6 border border-emerald-100 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-1">
                                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                                    🎯
                                </div>
                                <div className="flex-1">
                                    <div className="text-3xl font-bold text-slate-800 mb-1">{calculateAverageScore()}</div>
                                    <div className="text-sm text-slate-600 font-medium">平均得分</div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-green-50/50 to-lime-50/50 rounded-2xl p-6 border border-green-100 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-1">
                                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-lime-600 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                                    ✅
                                </div>
                                <div className="flex-1">
                                    <div className="text-3xl font-bold text-slate-800 mb-1">
                                        {practiceHistory.filter(s => s.status === 'COMPLETED').length}
                                    </div>
                                    <div className="text-sm text-slate-600 font-medium">已完成</div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 rounded-2xl p-6 border border-amber-100 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-1">
                                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                                    ⏱️
                                </div>
                                <div className="flex-1">
                                    <div className="text-3xl font-bold text-slate-800 mb-1">
                                        {practiceHistory.filter(s =>
                                            s.status === 'OCR_PROCESSING' || s.status === 'AI_PROCESSING'
                                        ).length}
                                    </div>
                                    <div className="text-sm text-slate-600 font-medium">处理中</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                            <h4 className="text-xl font-semibold text-slate-800 mb-6">📊 最近学习进展</h4>
                            <div className="text-center py-16 border-2 border-dashed border-slate-300 rounded-xl bg-white/50">
                                <p className="text-slate-600 mb-2">学习数据分析图表</p>
                                <p className="text-sm text-slate-400">完成更多练习后将显示详细的进步趋势</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 删除确认对话框 */}
                {showDeleteDialog && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-[90%] overflow-hidden transform transition-all duration-200 scale-100">
                            <div className="px-6 py-5 border-b border-slate-100">
                                <h3 className="text-lg font-semibold text-slate-800">确认删除</h3>
                            </div>
                            <div className="px-6 py-5">
                                <p className="text-sm text-slate-600 leading-relaxed">确定要删除这条练习记录吗？此操作不可撤销。</p>
                            </div>
                            <div className="px-6 py-5 flex gap-3 justify-end border-t border-slate-100">
                                <button
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    onClick={cancelDelete}
                                    disabled={loading}
                                >
                                    取消
                                </button>
                                <button
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    onClick={() => handleDeleteSession(showDeleteDialog)}
                                    disabled={loading}
                                >
                                    {loading ? '删除中...' : '确认删除'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 添加到错题本对话框 */}
                {showErrorBookModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-[90%] overflow-hidden transform transition-all duration-200 scale-100">
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-slate-800">📚 添加到错题本</h3>
                                <button
                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors text-xl leading-none"
                                    onClick={() => setShowErrorBookModal(null)}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="px-6 py-5">
                                <p className="text-sm text-slate-600 mb-4">选择错题分类或创建新分类：</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">现有分类：</label>
                                        <select
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                        >
                                            <option value="">请选择分类</option>
                                            {errorBookCategories.map(category => (
                                                <option key={category} value={category}>
                                                    {category}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="relative flex items-center my-4">
                                        <div className="flex-1 border-t border-slate-200"></div>
                                        <span className="px-3 text-sm text-slate-500 bg-white">或</span>
                                        <div className="flex-1 border-t border-slate-200"></div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">新建分类：</label>
                                        <input
                                            type="text"
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value)}
                                            placeholder="输入新分类名称"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-5 flex gap-3 justify-end border-t border-slate-100">
                                <button
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    onClick={() => setShowErrorBookModal(null)}
                                    disabled={loading}
                                >
                                    取消
                                </button>
                                <button
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    onClick={handleAddToErrorBook}
                                    disabled={loading || (!selectedCategory && !newCategory.trim())}
                                >
                                    {loading ? '添加中...' : '添加到错题本'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};