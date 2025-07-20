// AI批改路由（Deepseek）

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Deepseek配置
const DEEPSEEK_CONFIG = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  maxTokens: 4000
};

// Deepseek作业批改
router.post('/deepseek/grade', asyncHandler(async (req: Request, res: Response) => {
  const { recognizedContent, originalFileId } = req.body;

  if (!recognizedContent) {
    return res.status(400).json({
      success: false,
      error: '识别内容是必填项'
    });
  }

  // 检查Deepseek配置
  if (!DEEPSEEK_CONFIG.apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Deepseek API密钥未配置'
    });
  }

  try {
    // 构造批改提示词
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

    // 这里应该调用真实的Deepseek API
    // const response = await axios.post(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
    //   model: DEEPSEEK_CONFIG.model,
    //   messages: [
    //     {
    //       role: 'system',
    //       content: '你是一名专业的微积分老师，负责批改学生作业。'
    //     },
    //     {
    //       role: 'user',
    //       content: prompt
    //     }
    //   ],
    //   max_tokens: DEEPSEEK_CONFIG.maxTokens,
    //   temperature: 0.7
    // }, {
    //   headers: {
    //     'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
    //     'Content-Type': 'application/json'
    //   }
    // });

    // 临时返回模拟结果
    const mockResult = {
      id: `ai_${Date.now()}`,
      score: Math.floor(Math.random() * 30) + 70, // 70-100分
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

  } catch (error) {
    console.error('Deepseek批改失败:', error);
    res.status(500).json({
      success: false,
      error: 'AI批改失败',
      details: error instanceof Error ? error.message : '未知错误'
    });
  }
}));

// 批量AI批改
router.post('/deepseek/grade/batch', asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body; // [{recognizedContent, originalFileId}, ...]

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

      // 模拟批改结果
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

  } catch (error) {
    console.error('批量AI批改失败:', error);
    res.status(500).json({
      success: false,
      error: '批量AI批改失败',
      details: error instanceof Error ? error.message : '未知错误'
    });
  }
}));

// 错题分析
router.post('/analysis', asyncHandler(async (req: Request, res: Response) => {
  const { submissionIds, analysisType = 'individual' } = req.body;

  if (!submissionIds || !Array.isArray(submissionIds)) {
    return res.status(400).json({
      success: false,
      error: '提交ID列表是必填项'
    });
  }

  try {
    // 模拟错题分析结果
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

  } catch (error) {
    console.error('错题分析失败:', error);
    res.status(500).json({
      success: false,
      error: '错题分析失败',
      details: error instanceof Error ? error.message : '未知错误'
    });
  }
}));

// 获取AI批改结果
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // 这里应该从数据库查询AI批改结果
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

// Deepseek配置检查
router.get('/config/check', asyncHandler(async (req: Request, res: Response) => {
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

export default router; 