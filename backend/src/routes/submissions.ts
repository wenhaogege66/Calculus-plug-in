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

export default submissionRoutes; 