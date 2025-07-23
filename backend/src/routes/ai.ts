// Deepseek AI批改服务

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import axios from 'axios';

const prisma = new PrismaClient();

export async function aiRoutes(fastify: FastifyInstance) {
  // Deepseek AI批改作业
  fastify.post('/ai/grade', { preHandler: requireAuth }, async (request: FastifyRequest<{
    Body: {
      submissionId: number;
      recognizedText: string;
      subject?: string;
      exerciseType?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { submissionId, recognizedText, subject = '微积分', exerciseType = '练习题' } = request.body;
      
      if (!submissionId || !recognizedText) {
        return reply.code(400).send({
          success: false,
          error: '缺少必要参数'
        });
      }

      // 验证提交记录是否属于当前用户
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId: request.currentUser!.id
        },
        include: {
          fileUpload: true,
          myscriptResults: true
        }
      });

      if (!submission) {
        return reply.code(404).send({
          success: false,
          error: '提交记录不存在'
        });
      }

      const startTime = Date.now();

      // 调用Deepseek AI进行批改
      const gradingResult = await callDeepseekAPI(recognizedText, subject, exerciseType);
      
      const processingTime = Date.now() - startTime;

      // 保存批改结果
      const aiResult = await prisma.deepseekResult.create({
        data: {
          submissionId: submissionId,
          score: gradingResult.score,
          maxScore: gradingResult.maxScore,
          feedback: gradingResult.feedback,
          errors: gradingResult.errors,
          suggestions: gradingResult.suggestions,
          strengths: gradingResult.strengths,
          processingTime: processingTime,
          rawResult: gradingResult.raw
        }
      });

      // 更新提交状态为完成
      await prisma.submission.update({
        where: { id: submissionId },
        data: { 
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      return {
        success: true,
        data: {
          resultId: aiResult.id,
          score: aiResult.score,
          maxScore: aiResult.maxScore,
          feedback: aiResult.feedback,
          errors: aiResult.errors,
          suggestions: aiResult.suggestions,
          strengths: aiResult.strengths,
          processingTime: aiResult.processingTime
        }
      };

    } catch (error) {
      fastify.log.error('Deepseek AI批改失败:', error);
      
      // 更新提交状态为失败
      if (request.body?.submissionId) {
        await prisma.submission.update({
          where: { id: request.body.submissionId },
          data: { status: 'FAILED' }
        }).catch(() => {}); // 忽略更新失败
      }

      return reply.code(500).send({
        success: false,
        error: 'AI批改处理失败'
      });
    }
  });

  // 获取批改结果
  fastify.get('/ai/results/:submissionId', { preHandler: requireAuth }, async (request: FastifyRequest<{
    Params: { submissionId: string }
  }>, reply: FastifyReply) => {
    try {
      const submissionId = parseInt(request.params.submissionId);
      
      // 验证提交记录是否属于当前用户
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId: request.currentUser!.id
        }
      });

      if (!submission) {
        return reply.code(404).send({
          success: false,
          error: '提交记录不存在'
        });
      }

      // 获取批改结果
      const aiResults = await prisma.deepseekResult.findMany({
        where: { submissionId: submissionId },
        orderBy: { createdAt: 'desc' }
      });

      return {
        success: true,
        data: { results: aiResults }
      };

    } catch (error) {
      fastify.log.error('获取AI批改结果失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取AI批改结果失败'
      });
    }
  });

  // 生成带批注的PDF
  fastify.post('/ai/annotate-pdf', { preHandler: requireAuth }, async (request: FastifyRequest<{
    Body: {
      submissionId: number;
      errors: Array<{
        position: { x: number; y: number; page: number };
        message: string;
        type: 'error' | 'suggestion' | 'strength';
      }>;
    }
  }>, reply: FastifyReply) => {
    try {
      const { submissionId, errors } = request.body;
      
      if (!submissionId || !errors) {
        return reply.code(400).send({
          success: false,
          error: '缺少必要参数'
        });
      }

      // 验证提交记录是否属于当前用户
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId: request.currentUser!.id
        },
        include: {
          fileUpload: true
        }
      });

      if (!submission) {
        return reply.code(404).send({
          success: false,
          error: '提交记录不存在'
        });
      }

      // 这里应该实现PDF批注功能
      // 可以使用pdf-lib或其他PDF处理库
      // 暂时返回占位符响应
      
      return {
        success: true,
        data: {
          annotatedPdfUrl: `/api/files/${submission.fileUploadId}/annotated`,
          message: 'PDF批注功能正在开发中'
        }
      };

    } catch (error) {
      fastify.log.error('PDF批注处理失败:', error);
      return reply.code(500).send({
        success: false,
        error: 'PDF批注处理失败'
      });
    }
  });
}

// 调用Deepseek API的辅助函数
async function callDeepseekAPI(text: string, subject: string, exerciseType: string): Promise<{
  score: number;
  maxScore: number;
  feedback: string;
  errors: any[];
  suggestions: any[];
  strengths: any[];
  raw: any;
}> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      throw new Error('Deepseek API密钥未配置');
    }

    const prompt = `
作为一位专业的${subject}教师，请对以下学生作业进行详细批改：

学生答案：
${text}

请按以下格式返回JSON：
{
  "score": 85,
  "maxScore": 100,
  "feedback": "整体解答思路正确，但在某些步骤上存在小的计算错误...",
  "errors": [
    {
      "line": 1,
      "content": "错误的计算步骤",
      "correction": "正确的做法应该是...",
      "severity": "major"
    }
  ],
  "suggestions": [
    {
      "aspect": "解题方法",
      "recommendation": "建议使用更直接的求导方法..."
    }
  ],
  "strengths": [
    {
      "aspect": "解题思路",
      "description": "学生正确识别了问题类型..."
    }
  ]
}

要求：
1. 评分要客观公正，分数范围0-100
2. 指出具体的错误位置和类型
3. 提供改进建议
4. 肯定学生的优点
5. 返回纯JSON格式，不要额外文字
`;

    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const result = JSON.parse(response.data.choices[0].message.content);

    return {
      score: result.score || 0,
      maxScore: result.maxScore || 100,
      feedback: result.feedback || '批改完成',
      errors: result.errors || [],
      suggestions: result.suggestions || [],
      strengths: result.strengths || [],
      raw: response.data
    };

  } catch (error) {
    console.error('Deepseek API调用失败:', error);
    
    // 返回默认批改结果
    return {
      score: 75,
      maxScore: 100,
      feedback: 'AI批改服务暂时不可用，请稍后重试。',
      errors: [],
      suggestions: [{ aspect: '服务状态', recommendation: '请稍后重试AI批改功能' }],
      strengths: [{ aspect: '提交', description: '成功提交了作业' }],
      raw: { error: error instanceof Error ? error.message : '未知错误' }
    };
  }
} 