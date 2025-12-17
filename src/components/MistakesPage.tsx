import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';

const Icons = {
    Archive: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>,
    Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>,
    Bot: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>,
};

interface MistakeItem {
    id: string;
    title: string;
    content: string;
    tags: string[];
}

export const MistakesPage: React.FC<{ authState: AuthState }> = ({ authState }) => {
    const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [selectedMistake, setSelectedMistake] = useState<MistakeItem | null>(null);

    useEffect(() => {
        loadMistakes();
    }, []);

    const loadMistakes = async () => {
        if (!authState.token) return;
        try {
            setLoading(true);
            setError('');
            // 注意：这里可能会报 500 错误，我们捕获它
            const response = await fetch(`${API_BASE_URL}/mistakes/items`, {
                headers: { 'Authorization': `Bearer ${authState.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setMistakes(data.data?.items || []);
            } else {
                // 如果后端 500，我们可以显示一个空状态或模拟数据，防止页面白屏
                console.warn(`Backend returned ${response.status}`);
                setError('无法加载错题数据 (服务器内部错误)');
                // 模拟数据用于演示 UI
                setMistakes([
                    { id: '1', title: '极限计算错误', content: '求 lim(x->0) sinx/x', tags: ['极限', '高频'] },
                    { id: '2', title: '导数定义理解偏差', content: 'f(x)在x=0处连续但不可导的例子', tags: ['导数'] }
                ]);
            }
        } catch (err) {
            console.error('Failed to load mistakes:', err);
            setError('网络连接失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full w-full bg-[#F8FAFC]">
            {/* 左侧：错题列表 */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white/50 backdrop-blur-sm">
                <header className="px-8 py-6 border-b border-slate-100 bg-white">
                    <h1 className="text-xl font-bold text-slate-900">错题归档</h1>
                    <p className="text-slate-500 text-sm mt-1">AI已为您自动整理并留存所有错题</p>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 mb-4">
                            <Icons.Alert /> {error}
                        </div>
                    )}

                    {mistakes.map(item => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedMistake(item)}
                            className={`bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-all cursor-pointer ${selectedMistake?.id === item.id ? 'border-primary-500 ring-1 ring-primary-500' : 'border-slate-200 hover:border-primary-200'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-3">
                                {item.tags.map(tag => (
                                    <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                            <h4 className="font-medium text-slate-800 mb-2">{item.title}</h4>
                            <p className="text-sm text-slate-500 font-mono bg-slate-50 p-2 rounded">{item.content}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 右侧：错题分析助手 */}
            <div className="w-[380px] bg-white flex flex-col z-10 shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                        <span className="text-purple-600"><Icons.Bot /></span>
                        <span className="font-semibold text-sm text-slate-800">错题分析助手</span>
                    </div>
                </div>

                <div className="flex-1 bg-slate-50 p-5 flex items-center justify-center text-slate-400 text-sm">
                    {selectedMistake ? (
                        <div className="w-full h-full flex flex-col">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                                <h3 className="font-bold text-slate-700 mb-2">AI 分析: {selectedMistake.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    这个问题主要考察了... (此处为 AI 针对该错题的详细解析占位符)
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p>点击左侧错题，我来为您详细讲解。</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};