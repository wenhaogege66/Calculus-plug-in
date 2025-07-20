"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const DEEPSEEK_CONFIG = {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxTokens: 4000
};
router.post('/deepseek/grade', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { recognizedContent, originalFileId } = req.body;
    if (!recognizedContent) {
        return res.status(400).json({
            success: false,
            error: '识别内容是必填项'
        });
    }
    if (!DEEPSEEK_CONFIG.apiKey) {
        return res.status(500).json({
            success: false,
            error: 'Deepseek API密钥未配置'
        });
    }
    try {
        const prompt = `
请作为一名微积分老师，对以下学生作业进行批改和评分：

学生答案：
${recognizedContent}

请按照以下JSON格式返回批改结果：
{
  "score": 85,
  "maxScore": 100,
  "feedback": "整体评价...",
  "errors": [
    {
      "type": "calculation|concept|method|format",
      "description": "错误描述",
      "suggestion": "改进建议",
      "severity": "low|medium|high"
    }
  ],
  "suggestions": ["建议1", "建议2"],
  "strengths": ["优点1", "优点2"]
}

请严格按照JSON格式返回，不要包含其他内容。
    `;
        const mockResult = {
            id: `ai_${Date.now()}`,
            score: Math.floor(Math.random() * 30) + 70,
            maxScore: 100,
            feedback: '解题思路基本正确，但在某些计算步骤上需要更加仔细。建议加强对基础概念的理解，特别是积分的基本性质。',
            errors: [
                {
                    id: `error_${Date.now()}_1`,
                    type: 'calculation',
                    description: '第二步积分计算中符号处理有误',
                    suggestion: '请注意积分常数的正确写法，应该是+C而不是-C',
                    severity: 'medium',
                    location: {
                        expressionId: 'expr_1',
                        position: 15
                    }
                }
            ],
            suggestions: [
                '建议多练习基础积分公式',
                '加强对积分几何意义的理解',
                '注意计算过程中的符号变化'
            ],
            strengths: [
                '解题步骤清晰明了',
                '基本公式运用正确',
                '书写格式规范'
            ],
            gradedAt: new Date().toISOString(),
            originalFileId,
            recognizedContent
        };
        res.json({
            success: true,
            data: mockResult
        });
    }
    catch (error) {
        console.error('Deepseek批改失败:', error);
        res.status(500).json({
            success: false,
            error: 'AI批改失败',
            details: error instanceof Error ? error.message : '未知错误'
        });
    }
}));
router.post('/deepseek/grade/batch', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            error: '批改项目列表是必填项'
        });
    }
    if (items.length > 5) {
        return res.status(400).json({
            success: false,
            error: '批量批改最多支持5个项目'
        });
    }
    try {
        const results = [];
        for (const item of items) {
            if (!item.recognizedContent) {
                results.push({
                    success: false,
                    error: '识别内容为空',
                    originalFileId: item.originalFileId
                });
                continue;
            }
            const result = {
                id: `ai_batch_${Date.now()}_${Math.random()}`,
                score: Math.floor(Math.random() * 30) + 70,
                maxScore: 100,
                feedback: `对"${item.recognizedContent.substring(0, 20)}..."的批改：基本正确，有待改进。`,
                errors: [],
                suggestions: ['继续努力'],
                strengths: ['态度认真'],
                gradedAt: new Date().toISOString(),
                originalFileId: item.originalFileId,
                recognizedContent: item.recognizedContent
            };
            results.push({
                success: true,
                data: result
            });
        }
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        res.json({
            success: true,
            data: {
                results,
                summary: {
                    total: items.length,
                    successful: successCount,
                    failed: failureCount
                }
            }
        });
    }
    catch (error) {
        console.error('批量AI批改失败:', error);
        res.status(500).json({
            success: false,
            error: '批量AI批改失败',
            details: error instanceof Error ? error.message : '未知错误'
        });
    }
}));
router.post('/analysis', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { submissionIds, analysisType = 'individual' } = req.body;
    if (!submissionIds || !Array.isArray(submissionIds)) {
        return res.status(400).json({
            success: false,
            error: '提交ID列表是必填项'
        });
    }
    try {
        const analysis = {
            id: `analysis_${Date.now()}`,
            type: analysisType,
            submissionIds,
            commonErrors: [
                {
                    type: 'calculation',
                    frequency: 3,
                    description: '积分计算中常数项处理错误',
                    examples: ['缺少积分常数C', '符号计算错误'],
                    suggestions: ['加强基础积分公式练习', '注意符号变化']
                },
                {
                    type: 'concept',
                    frequency: 2,
                    description: '对定积分与不定积分概念混淆',
                    examples: ['定积分结果包含常数C'],
                    suggestions: ['复习定积分与不定积分的区别']
                }
            ],
            strengthAreas: [
                '基本积分公式掌握良好',
                '解题步骤清晰'
            ],
            improvementAreas: [
                '计算准确性有待提高',
                '概念理解需要加强'
            ],
            recommendations: [
                '增加基础练习题量',
                '定期复习概念定义',
                '注意检查计算结果'
            ],
            analyzedAt: new Date().toISOString()
        };
        res.json({
            success: true,
            data: analysis
        });
    }
    catch (error) {
        console.error('错题分析失败:', error);
        res.status(500).json({
            success: false,
            error: '错题分析失败',
            details: error instanceof Error ? error.message : '未知错误'
        });
    }
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const result = {
        id,
        score: 88,
        maxScore: 100,
        feedback: '解答正确，步骤清楚，建议继续保持。',
        errors: [],
        suggestions: ['可以尝试更复杂的题目'],
        strengths: ['基础扎实', '思路清晰'],
        gradedAt: new Date().toISOString(),
        originalFileId: 'file_123',
        recognizedContent: '∫x²dx = x³/3 + C'
    };
    res.json({
        success: true,
        data: result
    });
}));
router.get('/config/check', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const config = {
        baseURL: DEEPSEEK_CONFIG.baseURL,
        model: DEEPSEEK_CONFIG.model,
        maxTokens: DEEPSEEK_CONFIG.maxTokens,
        hasApiKey: !!DEEPSEEK_CONFIG.apiKey,
        configured: !!DEEPSEEK_CONFIG.apiKey
    };
    res.json({
        success: true,
        data: config
    });
}));
exports.default = router;
//# sourceMappingURL=ai.js.map