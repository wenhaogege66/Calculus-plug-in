import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { MathPixMarkdownRenderer } from './MathPixMarkdownRenderer';

const Icons = {
    Archive: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>,
    Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>,
    Bot: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>,
};

/** API 返回的错题条目（含关联的 submission 识别与批改结果） */
interface MistakeItemApi {
    id: number;
    submissionId: number;
    title: string | null;
    notes: string | null;
    tags: string[];
    priority?: string;
    submission?: {
        fileUpload?: { originalName?: string };
        mathpixResults?: Array<{ recognizedText: string | null; mathLatex?: string | null; confidence?: unknown }>;
        deepseekResults?: Array<{ score: number | null; maxScore: number; feedback: string | null; errors?: unknown }>;
    };
}

/** 前端展示用错题条目 */
interface MistakeItem {
    id: string;
    submissionId: number;
    title: string;
    content: string;
    tags: string[];
    ocrText: string;
    aiFeedback: string;
    score: number | null;
    maxScore: number;
}

export const MistakesPage: React.FC<{ authState: AuthState; onPageChange?: (page: string, params?: any) => void }> = ({ authState, onPageChange }) => {
    const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [selectedMistake, setSelectedMistake] = useState<MistakeItem | null>(null);

    useEffect(() => {
        loadMistakes();
    }, [authState.token]);

    function mapApiItemToMistake(api: MistakeItemApi): MistakeItem {
        const ocr = api.submission?.mathpixResults?.[0];
        const grading = api.submission?.deepseekResults?.[0];
        const ocrText = ocr?.recognizedText?.trim() || '';
        const aiFeedback = grading?.feedback?.trim() || '';
        const title = api.title || api.submission?.fileUpload?.originalName || '未命名错题';
        const contentPreview = api.notes || (ocrText ? (ocrText.slice(0, 200) + (ocrText.length > 200 ? '…' : '')) : '') || '暂无内容';
        return {
            id: String(api.id),
            submissionId: api.submissionId,
            title,
            content: contentPreview,
            tags: Array.isArray(api.tags) ? api.tags : [],
            ocrText,
            aiFeedback,
            score: grading?.score ?? null,
            maxScore: grading?.maxScore ?? 100
        };
    }

    const loadMistakes = async () => {
        if (!authState.token) return;
        try {
            setLoading(true);
            setError('');
            const response = await fetch(`${API_BASE_URL}/mistakes/items`, {
                headers: { 'Authorization': `Bearer ${authState.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const rawItems: MistakeItemApi[] = data.data?.items || [];
                const mapped = rawItems.map(mapApiItemToMistake);
                setMistakes(mapped);
            } else {
                const errBody = await response.json().catch(() => ({}));
                setError((errBody as any).error || '无法加载错题数据 (服务器内部错误)');
                setMistakes([]);
            }
        } catch (err) {
            console.error('Failed to load mistakes:', err);
            setError('网络连接失败');
            setMistakes([]);
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

                    {loading && (
                        <div className="text-center py-12 text-slate-500 text-sm">加载中...</div>
                    )}
                    {!loading && mistakes.length === 0 && !error && (
                        <div className="text-center py-12 text-slate-500 text-sm">暂无错题归档，习题练习中得分较低的题目会自动加入此处。</div>
                    )}
                    {!loading && mistakes.map(item => (
                        <div
                            key={item.id}
                            onClick={() => {
                                if (onPageChange) {
                                    onPageChange('practice', { sessionId: String(item.submissionId) });
                                } else {
                                    setSelectedMistake(item);
                                }
                            }}
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

                <div className="flex-1 bg-slate-50 p-5 overflow-y-auto">
                    {selectedMistake ? (
                        <div className="space-y-4">
                            {selectedMistake.score != null && (
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">得分</h4>
                                    <p className="text-lg font-bold text-slate-800">{selectedMistake.score} / {selectedMistake.maxScore} 分</p>
                                </div>
                            )}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">📋 题目识别结果</h4>
                                <div className="text-slate-600 text-sm leading-relaxed max-h-48 overflow-y-auto">
                                    {selectedMistake.ocrText ? (
                                        <MathPixMarkdownRenderer content={selectedMistake.ocrText} className="mistakes-ocr-content" />
                                    ) : (
                                        <p className="text-slate-400">暂无识别内容</p>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">🤖 AI 批改解答</h4>
                                <div className="text-slate-600 text-sm leading-relaxed max-h-64 overflow-y-auto">
                                    {selectedMistake.aiFeedback ? (
                                        <MathPixMarkdownRenderer content={selectedMistake.aiFeedback} className="mistakes-feedback-content" />
                                    ) : (
                                        <p className="text-slate-400">暂无批改反馈</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center">
                            <p>点击左侧错题，查看题目识别结果与 AI 批改解答。</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};