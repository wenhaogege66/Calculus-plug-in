import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { useNotificationContext } from '../contexts/NotificationContext';
import { MathPixMarkdownRenderer } from './MathPixMarkdownRenderer';
import { ErrorHighlightedOCRText, type DetailedError } from './ErrorHighlightedOCRText';
import { wrapLatexContent } from '../utils/errorHighlighter';

// 图标组件
const Icons = {
    Upload: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M12 12v9" /><path d="m16 16-4-4-4 4" /></svg>,
    Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>,
    Sparkles: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M9 3v4" /><path d="M3 7h4" /><path d="M3 5h4" /></svg>,
    Bot: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>,
    Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 3 3 9-3 9 19-9Z" /><path d="M6 12h16" /></svg>
};

interface Assignment {
    id: number;
    title: string;
    dueDate: string;
    status: 'pending' | 'submitted' | 'graded';
    grade?: string;
    updatedAt: string;
}

interface AssignmentsPageProps {
    authState: AuthState;
    onPageChange?: (page: string) => void;
    params?: any;
}

export const AssignmentsPage: React.FC<AssignmentsPageProps> = ({ authState }) => {
    const { showSuccess, showError } = useNotificationContext();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [chatMessage, setChatMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([
        { role: 'ai', content: '同学你好！我是你的课程AI助教。关于刚才上传的作业，或者其他课程问题，随时问我。' }
    ]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 加载数据
    useEffect(() => {
        loadAssignments();
    }, []);

    const loadAssignments = async () => {
        if (!authState.token) return;
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/assignments/student`, {
                headers: { 'Authorization': `Bearer ${authState.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                // 简单的数据映射，防止结构不匹配导致崩溃
                const mappedData = (data.data || []).map((item: any) => ({
                    id: item.id,
                    title: item.title || '未命名作业',
                    dueDate: item.dueDate,
                    status: item.isSubmitted ? 'submitted' : 'pending',
                    grade: item.grade || '未评分',
                    updatedAt: item.updatedAt || new Date().toISOString()
                }));
                setAssignments(mappedData);
            } else {
                // 捕获 API 错误但不崩溃
                console.error("Failed to load assignments");
            }
        } catch (err) {
            console.error("Network error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !authState.token) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('purpose', 'assignment_submission');

            const response = await fetch(`${API_BASE_URL}/files`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authState.token}` },
                body: formData
            });

            if (response.ok) {
                showSuccess('作业上传成功，AI 正在解析...');
                // 模拟添加一条新记录
                setAssignments(prev => [{
                    id: Date.now(),
                    title: file.name,
                    dueDate: new Date().toISOString(),
                    status: 'submitted',
                    updatedAt: new Date().toISOString()
                }, ...prev]);
            } else {
                showError('上传失败，请重试');
            }
        } catch (err) {
            showError('网络错误');
        }
    };

    return (
        <div className="flex h-full w-full bg-[#F8FAFC]">
            {/* 左侧：作业列表与上传 (Flex-1) */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white/50 backdrop-blur-sm">
                <header className="px-8 py-6 border-b border-slate-100 bg-white">
                    <h1 className="text-xl font-bold text-slate-900">课程作业管理</h1>
                    <p className="text-slate-500 text-sm mt-1">上传您的作业文件，AI将会进行智能批改</p>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    {/* 上传区域 */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-100 hover:border-primary-400 transition-all duration-300 group mb-8"
                    >
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <span className="text-primary-600"><Icons.Upload /></span>
                        </div>
                        <h3 className="text-slate-700 font-medium">点击上传作业 PDF/图片</h3>
                        <p className="text-slate-400 text-xs mt-2">支持拖拽上传</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            accept=".pdf,.jpg,.png"
                        />
                    </div>

                    {/* 历史作业列表 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">历史作业</h3>

                        {loading ? (
                            <div className="text-center py-8 text-slate-400">加载中...</div>
                        ) : assignments.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">暂无作业记录</div>
                        ) : (
                            assignments.map(assignment => (
                                <div key={assignment.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${assignment.status === 'submitted' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                                            }`}>
                                            <Icons.Check />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-800 group-hover:text-primary-600 transition-colors">
                                                {assignment.title}
                                            </h4>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {new Date(assignment.updatedAt).toLocaleDateString()} · {assignment.grade || '待评分'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-500 font-medium">
                                        {assignment.status === 'submitted' ? '已提交' : '待处理'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* 右侧：AI 助手 (固定宽度) */}
            <div className="w-[380px] bg-white flex flex-col z-10 border-l border-slate-200 shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                        <span className="text-primary-600"><Icons.Sparkles /></span>
                        <span className="font-semibold text-sm text-slate-800">作业辅导助手</span>
                    </div>
                </div>

                <div className="flex-1 bg-slate-50 p-5 space-y-4 overflow-y-auto">
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className="flex gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border ${msg.role === 'ai' ? 'bg-white border-slate-200 text-primary-600' : 'bg-primary-600 border-primary-600 text-white'
                                }`}>
                                {msg.role === 'ai' ? <Icons.Bot /> : <span className="text-xs">我</span>}
                            </div>
                            <div className={`p-3 rounded-2xl text-sm shadow-sm max-w-[85%] ${msg.role === 'ai'
                                    ? 'bg-white border border-slate-200 text-slate-600 rounded-tl-none'
                                    : 'bg-primary-600 text-white rounded-tr-none'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white border-t border-slate-100">
                    <div className="flex gap-2 bg-slate-100 p-2 rounded-xl focus-within:ring-1 focus-within:ring-primary-200 transition-all">
                        <input
                            type="text"
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            placeholder="输入您的问题..."
                            className="flex-1 bg-transparent border-none text-sm focus:outline-none px-2 text-slate-700 placeholder:text-slate-400"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && chatMessage.trim()) {
                                    setChatHistory(prev => [...prev, { role: 'user', content: chatMessage }]);
                                    setChatMessage('');
                                    setTimeout(() => {
                                        setChatHistory(prev => [...prev, { role: 'ai', content: '我已收到你的问题，正在思考中...' }]);
                                    }, 1000);
                                }
                            }}
                        />
                        <button className="p-2 text-primary-600 hover:bg-white rounded-lg transition-colors">
                            <Icons.Send />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};