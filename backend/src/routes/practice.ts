// 练习模式API路由
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const prisma = new PrismaClient();

const practiceRoutes: FastifyPluginAsync = async (fastify) => {
  // 获取练习历史记录
  fastify.get('/practice/history', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      
      // 获取用户的练习提交记录
      const practiceSubmissions = await prisma.submission.findMany({
        where: {
          userId: userId,
          workMode: 'practice'
        },
        include: {
          fileUpload: {
            select: {
              id: true,
              originalName: true,
              fileSize: true,
              mimeType: true
            }
          },
          mathpixResults: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              recognizedText: true,
              confidence: true,
              processingTime: true,
              createdAt: true
            }
          },
          deepseekResults: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              score: true,
              maxScore: true,
              feedback: true,
              suggestions: true,
              strengths: true,
              processingTime: true,
              createdAt: true
            }
          }
        },
        orderBy: { submittedAt: 'desc' },
        take: 20 // 最近20次练习
      });

      // 转换为前端期望的格式
      const practiceHistory = practiceSubmissions.map(submission => {
        const latestOCR = submission.mathpixResults[0];
        const latestGrading = submission.deepseekResults[0];
        
        // 确定练习难度（基于AI评分结果）
        let difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM';
        if (latestGrading && latestGrading.score !== null && latestGrading.maxScore) {
          const percentage = (latestGrading.score / latestGrading.maxScore) * 100;
          if (percentage >= 85) {
            difficulty = 'EASY';
          } else if (percentage < 60) {
            difficulty = 'HARD';
          }
        }

        // 处理建议和优点数组转换为字符串
        const suggestions = latestGrading?.suggestions;
        const strengths = latestGrading?.strengths;
        
        const suggestionsText = suggestions ? (
          Array.isArray(suggestions) 
            ? suggestions.map((s: any) => 
                typeof s === 'string' ? s : `${s.aspect || '建议'}: ${s.recommendation || s.description || s}`
              ).join('; ')
            : suggestions.toString()
        ) : undefined;

        // 从rawResult中提取增强数据
        const enhancedData = (latestGrading?.rawResult as any)?.enhancedData || {};
        
        return {
          id: submission.id.toString(),
          originalName: submission.fileUpload.originalName,
          uploadedAt: submission.submittedAt.toISOString(),
          status: submission.status,
          score: latestGrading?.score || undefined,
          feedback: latestGrading?.feedback || undefined,
          suggestions: suggestionsText,
          ocrText: latestOCR?.recognizedText || undefined,
          difficulty: difficulty,
          // 新增的结构化信息
          questionCount: enhancedData.questionCount || 0,
          incorrectCount: enhancedData.incorrectCount || 0,
          correctCount: enhancedData.correctCount || 0,
          knowledgePoints: enhancedData.knowledgePoints || [],
          detailedErrors: enhancedData.detailedErrors || [],
          improvementAreas: enhancedData.improvementAreas || [],
          nextStepRecommendations: enhancedData.nextStepRecommendations || []
        };
      });

      return {
        success: true,
        data: practiceHistory
      };
    } catch (error) {
      fastify.log.error('获取练习历史失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取练习历史失败'
      });
    }
  });

  // 创建练习会话 
  fastify.post('/practice', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const { fileUploadId, practiceType } = request.body as {
        fileUploadId: number;
        practiceType?: string;
      };

      if (!fileUploadId) {
        return reply.code(400).send({
          success: false,
          error: '缺少文件ID'
        });
      }

      // 验证文件是否属于当前用户
      const fileUpload = await prisma.fileUpload.findFirst({
        where: {
          id: fileUploadId,
          userId: userId
        }
      });

      if (!fileUpload) {
        return reply.code(404).send({
          success: false,
          error: '文件不存在或无权限'
        });
      }

      // 创建练习提交记录
      const practiceSubmission = await prisma.submission.create({
        data: {
          userId: userId,
          fileUploadId: fileUploadId,
          workMode: 'practice',
          status: 'UPLOADED'
        }
      });

      // 异步启动练习处理流程（OCR + AI批改）
      startPracticeProcessing(practiceSubmission.id, fastify)
        .then(() => {
          fastify.log.info(`练习处理完成: submissionId=${practiceSubmission.id}`);
        })
        .catch((error) => {
          fastify.log.error(`练习处理失败: submissionId=${practiceSubmission.id}`, error);
        });

      return {
        success: true,
        data: {
          sessionId: practiceSubmission.id,
          status: practiceSubmission.status,
          originalName: fileUpload.originalName,
          createdAt: practiceSubmission.submittedAt
        }
      };
    } catch (error) {
      fastify.log.error('创建练习会话失败:', error);
      return reply.code(500).send({
        success: false,
        error: '创建练习会话失败'
      });
    }
  });

  // 获取练习会话状态
  fastify.get('/practice/:sessionId/status', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const sessionId = parseInt((request.params as any).sessionId);

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: '无效的会话ID'
        });
      }

      // 获取练习会话详情
      const practiceSession = await prisma.submission.findFirst({
        where: {
          id: sessionId,
          userId: userId,
          workMode: 'practice'
        },
        include: {
          fileUpload: {
            select: {
              originalName: true,
              fileSize: true,
              mimeType: true
            }
          },
          mathpixResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          deepseekResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!practiceSession) {
        return reply.code(404).send({
          success: false,
          error: '练习会话不存在'
        });
      }

      // 计算处理进度
      let progress = 0;
      let stage = 'processing';
      let message = '正在处理...';

      const latestOCR = practiceSession.mathpixResults[0];
      const latestGrading = practiceSession.deepseekResults[0];

      if (latestOCR) {
        progress = 50;
        stage = 'ocr_completed';
        message = 'OCR识别完成，正在AI批改...';

        if (latestGrading) {
          progress = 100;
          stage = 'completed';
          message = '练习批改完成';
        }
      }

      return {
        success: true,
        data: {
          sessionId: practiceSession.id,
          status: practiceSession.status,
          progress: {
            percent: progress,
            stage: stage,
            message: message
          },
          fileInfo: practiceSession.fileUpload,
          ocrResult: latestOCR ? {
            recognizedText: latestOCR.recognizedText,
            confidence: latestOCR.confidence
          } : null,
          gradingResult: latestGrading ? {
            score: latestGrading.score,
            maxScore: latestGrading.maxScore,
            feedback: latestGrading.feedback,
            suggestions: latestGrading.suggestions,
            strengths: latestGrading.strengths,
            // 新增的结构化信息
            ...(((latestGrading.rawResult as any)?.enhancedData) && {
              questionCount: (latestGrading.rawResult as any).enhancedData.questionCount,
              incorrectCount: (latestGrading.rawResult as any).enhancedData.incorrectCount,
              correctCount: (latestGrading.rawResult as any).enhancedData.correctCount,
              knowledgePoints: (latestGrading.rawResult as any).enhancedData.knowledgePoints,
              detailedErrors: (latestGrading.rawResult as any).enhancedData.detailedErrors,
              improvementAreas: (latestGrading.rawResult as any).enhancedData.improvementAreas,
              nextStepRecommendations: (latestGrading.rawResult as any).enhancedData.nextStepRecommendations
            })
          } : null,
          submittedAt: practiceSession.submittedAt,
          completedAt: practiceSession.completedAt
        }
      };
    } catch (error) {
      fastify.log.error('获取练习状态失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取练习状态失败'
      });
    }
  });

  // 删除练习记录
  fastify.delete('/practice/:sessionId', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const sessionId = parseInt((request.params as any).sessionId);

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: '无效的会话ID'
        });
      }

      // 验证练习记录是否属于当前用户
      const practiceSession = await prisma.submission.findFirst({
        where: {
          id: sessionId,
          userId: userId,
          workMode: 'practice'
        },
        include: {
          fileUpload: true
        }
      });

      if (!practiceSession) {
        return reply.code(404).send({
          success: false,
          error: '练习记录不存在或无权限删除'
        });
      }

      // 删除关联的数据（级联删除应该自动处理 MathPixResult 和 DeepseekResult）
      await prisma.submission.delete({
        where: { id: sessionId }
      });

      // 如果需要，也可以删除文件上传记录（但要小心，因为可能被其他地方引用）
      // 这里我们暂时保留文件上传记录，只删除提交记录

      fastify.log.info(`练习记录已删除: sessionId=${sessionId}, userId=${userId}`);

      return {
        success: true,
        message: '练习记录已删除'
      };

    } catch (error) {
      fastify.log.error('删除练习记录失败:', error);
      return reply.code(500).send({
        success: false,
        error: '删除练习记录失败'
      });
    }
  });
};

// 练习处理流程（OCR + AI批改）
async function startPracticeProcessing(submissionId: number, fastify: any) {
  try {
    fastify.log.info(`🎯 开始练习处理流程 - submissionId: ${submissionId}`);

    // 1. OCR识别 - 使用内部调用header
    let ocrResult: any = null;
    try {
      const ocrResponse = await fetch(`http://localhost:3000/api/ocr/mathpix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-call': 'true' // 标识内部调用，跳过认证
        },
        body: JSON.stringify({
          submissionId: submissionId
        })
      });

      if (!ocrResponse.ok) {
        const errorText = await ocrResponse.text();
        fastify.log.error(`OCR API调用失败: ${ocrResponse.status} - ${errorText}`);
        ocrResult = { success: false, error: errorText };
      } else {
        ocrResult = await ocrResponse.json();
      }

      fastify.log.info(`✅ OCR识别完成:`, {
        submissionId,
        success: ocrResult?.success,
        hasText: !!ocrResult?.data?.recognizedText,
        confidence: ocrResult?.data?.confidence
      });
    } catch (error) {
      fastify.log.error(`OCR识别过程异常:`, error);
      ocrResult = { success: false, error: '网络连接失败' };
    }

    // 2. AI批改
    if (ocrResult?.success && ocrResult.data?.recognizedText) {
      try {
        const aiResponse = await fetch(`http://localhost:3000/api/ai/grade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-call': 'true' // 标识内部调用，跳过认证
          },
          body: JSON.stringify({
            submissionId: submissionId,
            recognizedText: ocrResult.data.recognizedText,
            subject: '微积分',
            exerciseType: '自主练习',
            context: {
              mode: 'practice',
              maxScore: 100,
              rubric: '根据解题步骤、方法正确性和计算准确性进行评分'
            }
          })
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          fastify.log.error(`AI批改失败: ${aiResponse.status} - ${errorText}`);
        } else {
          const aiResult = await aiResponse.json() as any;
          fastify.log.info(`✅ AI批改完成:`, {
            submissionId,
            score: aiResult.data?.score,
            maxScore: aiResult.data?.maxScore
          });
        }
      } catch (error) {
        fastify.log.error(`AI批改过程异常:`, error);
      }
    } else {
      fastify.log.warn(`跳过AI批改: OCR识别未成功或无文本内容`, {
        submissionId,
        ocrSuccess: ocrResult?.success,
        hasText: !!ocrResult?.data?.recognizedText
      });
    }

    // 3. 更新提交状态
    await prisma.submission.update({
      where: { id: submissionId },
      data: { 
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    fastify.log.info(`🎉 练习处理流程完成 - submissionId: ${submissionId}`);

  } catch (error) {
    fastify.log.error(`❌ 练习处理流程失败 - submissionId: ${submissionId}`, error);
    
    // 更新提交状态为失败
    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'FAILED' }
      });
    } catch (updateError) {
      fastify.log.error(`❌ 更新提交状态失败 - submissionId: ${submissionId}`, updateError);
    }
  }
}

export default practiceRoutes;