// 提交管理API路由
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const prisma = new PrismaClient();

const submissionRoutes: FastifyPluginAsync = async (fastify) => {
  // 获取提交记录 (需要认证)
  fastify.get('/submissions', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const submissions = await prisma.submission.findMany({
        where: { userId: request.currentUser!.id },
        include: {
          fileUpload: true,
          myscriptResults: true,
          deepseekResults: true,
        },
        orderBy: { submittedAt: 'desc' },
        take: 10 // 限制返回最近10条
      });

      return { 
        success: true, 
        data: { submissions }
      };
    } catch (error) {
      fastify.log.error('获取提交记录失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取提交记录失败'
      });
    }
  });
  
  // 创建提交 (需要认证)
  fastify.post('/submissions', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { fileUploadId, assignmentId, workMode } = request.body as any;
      
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
          userId: request.currentUser!.id
        }
      });

      if (!fileUpload) {
        return reply.code(404).send({
          success: false,
          error: '文件不存在'
        });
      }

      // 获取文件元数据中的workMode和assignmentId
      const metadata = fileUpload.metadata as any;
      const finalWorkMode = workMode || metadata?.workMode || 'practice';
      const finalAssignmentId = assignmentId || metadata?.assignmentId || null;
      
      // 如果是作业模式，验证作业是否存在且用户可以提交
      if (finalWorkMode === 'homework' && finalAssignmentId) {
        const assignment = await prisma.assignment.findFirst({
          where: {
            id: finalAssignmentId,
            isActive: true,
            startDate: { lte: new Date() },
            dueDate: { gte: new Date() }
          },
          include: {
            classroom: {
              include: {
                members: {
                  where: { studentId: request.currentUser!.id, isActive: true }
                }
              }
            }
          }
        });
        
        if (!assignment || assignment.classroom.members.length === 0) {
          return reply.code(400).send({
            success: false,
            error: '作业不存在或你没有权限提交'
          });
        }
      }

      // 创建提交记录
      const submission = await prisma.submission.create({
        data: {
          userId: request.currentUser!.id,
          fileUploadId: fileUploadId,
          assignmentId: finalAssignmentId,
          workMode: finalWorkMode,
          status: 'UPLOADED'
        }
      });

      // 根据用户角色和工作模式决定处理流程
      const userRole = request.currentUser!.role?.toLowerCase();
      
      if (userRole === 'teacher') {
        // 教师上传：只进行OCR识别，存储到题库
        startQuestionProcessing(submission.id).catch(error => {
          fastify.log.error(`题目处理流程启动失败 - 提交ID: ${submission.id}`, error);
        });
      } else {
        // 学生提交：完整的批改流程
        startGradingProcess(submission.id).catch(error => {
          fastify.log.error(`自动批改流程启动失败 - 提交ID: ${submission.id}`, error);
        });
      }

      return {
        success: true,
        data: { 
          submissionId: submission.id,
          status: submission.status 
        }
      };
    } catch (error) {
      fastify.log.error('创建提交失败:', error);
      return reply.code(500).send({
        success: false,
        error: '创建提交失败'
      });
    }
  });

  // 获取提交状态 (用于监控批改进度)
  fastify.get('/submissions/:submissionId/status', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const submissionId = parseInt((request.params as any).submissionId);
      
      if (!submissionId) {
        return reply.code(400).send({
          success: false,
          error: '无效的提交ID'
        });
      }

      // 获取提交记录及相关的批改结果
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId: request.currentUser!.id // 确保用户只能查看自己的提交
        },
        include: {
          fileUpload: {
            select: { originalName: true, fileSize: true, mimeType: true }
          },
          myscriptResults: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              recognizedText: true,
              confidenceScore: true,
              processingTime: true,
              rawResult: true,
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
              errors: true,
              suggestions: true,
              strengths: true,
              processingTime: true,
              rawResult: true,
              createdAt: true
            }
          }
        }
      });

      if (!submission) {
        return reply.code(404).send({
          success: false,
          error: '提交记录不存在'
        });
      }

      // 计算批改进度 - 根据实际结果数据判断状态
      let progress = 0;
      let stage = '';
      let message = '';

      if (submission.myscriptResults && submission.myscriptResults.length > 0) {
        const myscriptResult = submission.myscriptResults[0];
        
        // 如果有文字识别结果且有文本内容，说明OCR完成
        if (myscriptResult.recognizedText && myscriptResult.recognizedText.trim().length > 0) {
          progress = 60;
          stage = 'grading';
          message = 'AI智能批改中...';
          
          // 检查Deepseek结果
          if (submission.deepseekResults && submission.deepseekResults.length > 0) {
            const deepseekResult = submission.deepseekResults[0];
            
            // 如果有评分或反馈，说明批改完成
            if (deepseekResult.score !== null || (deepseekResult.feedback && deepseekResult.feedback.trim().length > 0)) {
              progress = 100;
              stage = 'completed';
              message = '批改完成';
            } else {
              // 有Deepseek记录但没有结果，可能还在处理中
              progress = 80;
              stage = 'grading';
              message = 'AI智能批改处理中...';
            }
          }
        } else {
          // 有MyScript记录但没有识别文本，可能还在处理中
          progress = 30;
          stage = 'ocr';
          message = '文字识别处理中...';
        }
      } else {
        // 没有任何处理记录
        progress = 10;
        stage = 'ocr';
        message = '等待文字识别...';
      }

      return {
        success: true,
        data: {
          id: submission.id,
          status: submission.status,
          workMode: submission.workMode,
          submittedAt: submission.submittedAt,
          fileUpload: submission.fileUpload,
          myscriptResults: submission.myscriptResults,
          deepseekResults: submission.deepseekResults,
          progress: {
            percent: progress,
            stage: stage,
            message: message
          }
        }
      };

    } catch (error) {
      fastify.log.error('获取提交状态失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取提交状态失败'
      });
    }
  });
};

// 自动化批改流程
async function startGradingProcess(submissionId: number) {
  try {
    console.log(`🚀 开始自动批改流程 - 提交ID: ${submissionId}`);
    
    // 1. 首先进行OCR识别
    console.log(`📝 步骤1: 启动OCR识别`);
    const ocrResponse = await fetch(`http://localhost:3000/api/internal/ocr/myscript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 注意：这里需要系统级认证，暂时跳过auth
      },
      body: JSON.stringify({
        submissionId: submissionId
      })
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      throw new Error(`OCR识别失败: ${ocrResponse.status} - ${errorText}`);
    }

    const ocrResult = await ocrResponse.json() as any;
    console.log(`✅ OCR识别完成:`, {
      submissionId,
      hasText: !!ocrResult.data?.recognizedText,
      textLength: ocrResult.data?.recognizedText?.length || 0,
      confidence: ocrResult.data?.confidence
    });

    // 2. 如果OCR识别成功，进行AI批改
    if (ocrResult.success && ocrResult.data?.recognizedText) {
      console.log(`🤖 步骤2: 启动AI批改`);
      
      const aiResponse = await fetch(`http://localhost:3000/api/internal/ai/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 注意：这里需要系统级认证，暂时跳过auth
        },
        body: JSON.stringify({
          submissionId: submissionId,
          recognizedText: ocrResult.data.recognizedText,
          subject: '微积分',
          exerciseType: '练习题'
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI批改失败: ${aiResponse.status} - ${errorText}`);
      }

      const aiResult = await aiResponse.json() as any;
      console.log(`✅ AI批改完成:`, {
        submissionId,
        score: aiResult.data?.score,
        maxScore: aiResult.data?.maxScore,
        hasFeedback: !!aiResult.data?.feedback
      });

    } else {
      console.warn(`⚠️ OCR识别未获得文本，跳过AI批改`, {
        submissionId,
        ocrSuccess: ocrResult.success,
        hasText: !!ocrResult.data?.recognizedText
      });
    }

    console.log(`🎉 自动批改流程完成 - 提交ID: ${submissionId}`);

  } catch (error) {
    console.error(`❌ 自动批改流程失败 - 提交ID: ${submissionId}`, error);
    
    // 更新提交状态为失败
    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'FAILED' }
      });
    } catch (updateError) {
      console.error(`❌ 更新提交状态失败 - 提交ID: ${submissionId}`, updateError);
    }
  }
}

// 教师端题目处理流程（仅OCR识别，存储到题库）
async function startQuestionProcessing(submissionId: number) {
  try {
    console.log(`📚 开始题目处理流程 - 提交ID: ${submissionId}`);
    
    // 进行OCR识别
    console.log(`📝 步骤1: 启动题目OCR识别`);
    const ocrResponse = await fetch(`http://localhost:3000/api/internal/ocr/myscript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submissionId: submissionId
      })
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      throw new Error(`题目OCR识别失败: ${ocrResponse.status} - ${errorText}`);
    }

    const ocrResult = await ocrResponse.json() as any;
    console.log(`✅ 题目OCR识别完成:`, {
      submissionId,
      hasText: !!ocrResult.data?.recognizedText,
      textLength: ocrResult.data?.recognizedText?.length || 0,
      confidence: ocrResult.data?.confidence
    });

    // TODO: 如果识别成功，将题目存储到题库
    if (ocrResult.success && ocrResult.data?.recognizedText) {
      console.log(`📝 题目识别成功，可以存储到题库`);
      
      // 更新提交状态为已完成（教师端不需要AI批改）
      await prisma.submission.update({
        where: { id: submissionId },
        data: { 
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
    } else {
      console.warn(`⚠️ 题目OCR识别未获得文本`, {
        submissionId,
        ocrSuccess: ocrResult.success,
        hasText: !!ocrResult.data?.recognizedText
      });
    }

    console.log(`🎉 题目处理流程完成 - 提交ID: ${submissionId}`);

  } catch (error) {
    console.error(`❌ 题目处理流程失败 - 提交ID: ${submissionId}`, error);
    
    // 更新提交状态为失败
    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'FAILED' }
      });
    } catch (updateError) {
      console.error(`❌ 更新提交状态失败 - 提交ID: ${submissionId}`, updateError);
    }
  }
}

export default submissionRoutes; 