// 提交管理API路由
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { successResponse, sendError } from '../utils/response-helper';
import { handleRouteError } from '../utils/error-handler';

const submissionRoutes: FastifyPluginAsync = async (fastify) => {
  // 获取提交记录 (需要认证)
  fastify.get('/submissions', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { assignmentId } = request.query as any;
      
      const whereCondition: any = { userId: request.currentUser!.id };
      
      // 如果指定了作业ID，则筛选该作业的提交记录
      if (assignmentId) {
        whereCondition.assignmentId = parseInt(assignmentId);
      }

      const submissions = await prisma.submission.findMany({
        where: whereCondition,
        include: {
          fileUpload: true,
          mathpixResults: true,
          deepseekResults: true,
        },
        orderBy: { submittedAt: 'desc' },
        take: assignmentId ? 50 : 10 // 如果查询特定作业，返回更多记录
      });

      return successResponse({ submissions });
    } catch (error) {
      return handleRouteError(fastify, reply, error, '获取提交记录失败');
    }
  });
  
  // 创建提交 (需要认证)
  fastify.post('/submissions', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { fileUploadId, fileUploadIds, assignmentId, workMode, note, metadata: clientMetadata } = request.body as any;
      
      // 支持单个文件ID或多个文件ID数组
      const fileIds = fileUploadIds || (fileUploadId ? [fileUploadId] : []);
      
      if (!fileIds || fileIds.length === 0) {
        return sendError(reply, '缺少文件ID', 400);
      }

      // 验证所有文件是否属于当前用户
      const fileUploads = await prisma.fileUpload.findMany({
        where: {
          id: { in: fileIds },
          userId: request.currentUser!.id
        }
      });

      if (fileUploads.length !== fileIds.length) {
        return sendError(reply, '部分文件不存在或无权限', 404);
      }

      // 获取文件元数据中的workMode和assignmentId（使用第一个文件的元数据）
      const metadata = fileUploads[0].metadata as any;
      const finalWorkMode = workMode || metadata?.workMode || 'homework';
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
          return sendError(reply, '作业不存在或你没有权限提交', 400);
        }
      }

      // 为每个文件创建提交记录
      const submissions = [];
      for (const fileId of fileIds) {
        const submission = await prisma.submission.create({
          data: {
            userId: request.currentUser!.id,
            fileUploadId: fileId,
            assignmentId: finalAssignmentId,
            workMode: finalWorkMode,
            status: 'UPLOADED',
            metadata: {
              note: note || null,
              batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 为批次添加标识
              fileIndex: fileIds.indexOf(fileId) + 1,
              totalFiles: fileIds.length,
              ...(clientMetadata || {}) // 合并前端传递的metadata（包括版本信息）
            }
          }
        });
        submissions.push(submission);
      }

      // 根据用户角色和工作模式决定处理流程
      const userRole = request.currentUser!.role?.toLowerCase();
      
      for (const submission of submissions) {
        if (userRole === 'teacher') {
          // 教师上传：只进行OCR识别，存储到题库
          startQuestionProcessing(submission.id, fastify).catch(error => {
            fastify.log.error(`题目处理流程启动失败 - 提交ID: ${submission.id}`, error);
            // 更新提交状态为失败
            prisma.submission.update({
              where: { id: submission.id },
              data: { status: 'FAILED' }
            }).catch(updateError => {
              fastify.log.error(`更新失败状态失败 - 提交ID: ${submission.id}`, updateError);
            });
          });
        } else {
          // 学生提交：完整的批改流程
          startGradingProcess(submission.id, fastify).catch(error => {
            fastify.log.error(`自动批改流程启动失败 - 提交ID: ${submission.id}`, error);
            fastify.log.error(`错误详情:`, {
              message: error.message,
              stack: error.stack,
              submissionId: submission.id
            });
            // 更新提交状态为失败
            prisma.submission.update({
              where: { id: submission.id },
              data: { status: 'FAILED' }
            }).catch(updateError => {
              fastify.log.error(`更新失败状态失败 - 提交ID: ${submission.id}`, updateError);
            });
          });
        }
      }

      return successResponse({ 
        submissionIds: submissions.map(s => s.id),
        submissions: submissions.map(s => ({
          id: s.id,
          fileUploadId: s.fileUploadId,
          status: s.status
        })),
        message: `成功提交${fileIds.length}个文件`
      });
    } catch (error) {
      return handleRouteError(fastify, reply, error, '创建提交失败');
    }
  });

  // 获取提交状态 (用于监控批改进度)
  fastify.get('/submissions/:submissionId/status', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const submissionId = parseInt((request.params as any).submissionId);
      
      if (!submissionId) {
        return sendError(reply, '无效的提交ID', 400);
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
          mathpixResults: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              recognizedText: true,
              confidence: true,
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
          },
          assignment: {
            select: {
              id: true,
              title: true,
              ocrText: true,
              ocrLatex: true,
              ocrStatus: true
            }
          }
        }
      });

      if (!submission) {
        return sendError(reply, '提交记录不存在', 404);
      }

      // 计算批改进度 - 根据实际结果数据判断状态
      let progress = 0;
      let stage = '';
      let message = '';

      if (submission.mathpixResults && submission.mathpixResults.length > 0) {
        const mathpixResult = submission.mathpixResults[0];
        
        // 如果有文字识别结果且有文本内容，说明OCR完成
        if (mathpixResult.recognizedText && mathpixResult.recognizedText.trim().length > 0) {
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
          // 有MathPix记录但没有识别文本，可能还在处理中
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

      return successResponse({
        id: submission.id,
        status: submission.status,
        workMode: submission.workMode,
        submittedAt: submission.submittedAt,
        fileUpload: submission.fileUpload,
        mathpixResults: submission.mathpixResults,
        deepseekResults: submission.deepseekResults,
        assignment: submission.assignment, // 添加 assignment 数据
        progress: {
          percent: progress,
          stage: stage,
          message: message
        }
      });

    } catch (error) {
      const submissionIdParam = (request.params as any).submissionId;
      return handleRouteError(fastify, reply, error, '获取提交状态失败', {
        details: {
          submissionId: submissionIdParam,
          userId: request.currentUser?.id
        }
      });
    }
  });

  // 重新提交作业 (需要认证) - 学生专用
  fastify.post('/submissions/:submissionId/resubmit', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const submissionId = parseInt((request.params as any).submissionId);
      const { fileUploadId, note } = request.body as any;
      
      if (!submissionId || !fileUploadId) {
        return sendError(reply, '缺少提交ID或文件ID', 400);
      }

      // 获取原始提交记录，确保用户有权限
      const originalSubmission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId: request.currentUser!.id
        }
      });

      if (!originalSubmission) {
        return sendError(reply, '原始提交记录不存在或无权限', 404);
      }

      // 如果是作业模式，验证作业是否仍然可以提交（未过期）
      if (originalSubmission.workMode === 'homework' && originalSubmission.assignmentId) {
        const assignment = await prisma.assignment.findFirst({
          where: {
            id: originalSubmission.assignmentId,
            isActive: true,
            dueDate: { gte: new Date() } // 检查是否还在截止日期前
          }
        });
        
        if (!assignment) {
          return sendError(reply, '作业已过期或不存在，无法重新提交', 400);
        }
      }

      // 验证新文件是否属于当前用户
      const fileUpload = await prisma.fileUpload.findFirst({
        where: {
          id: fileUploadId,
          userId: request.currentUser!.id
        }
      });

      if (!fileUpload) {
        return sendError(reply, '文件不存在或无权限', 404);
      }

      // 获取当前最高版本号
      const existingSubmissions = await prisma.submission.findMany({
        where: {
          userId: request.currentUser!.id,
          assignmentId: originalSubmission.assignmentId,
          workMode: originalSubmission.workMode
        },
        select: { metadata: true }
      });

      let maxVersion = 1;
      for (const sub of existingSubmissions) {
        const metadata = sub.metadata as any;
        const version = metadata?.version || 1;
        if (version > maxVersion) {
          maxVersion = version;
        }
      }
      const newVersion = maxVersion + 1;

      // 创建新的提交记录（重新提交）
      const newSubmission = await prisma.submission.create({
        data: {
          userId: request.currentUser!.id,
          fileUploadId: fileUploadId,
          assignmentId: originalSubmission.assignmentId,
          workMode: originalSubmission.workMode,
          status: 'UPLOADED',
          metadata: {
            note: note || null,
            version: newVersion,
            isResubmission: true,
            originalSubmissionId: submissionId,
            resubmittedAt: new Date().toISOString()
          }
        }
      });

      // 启动批改流程
      const userRole = request.currentUser!.role?.toLowerCase();
      if (userRole === 'student') {
        startGradingProcess(newSubmission.id, fastify).catch(error => {
          fastify.log.error(`重新提交的自动批改流程启动失败 - 提交ID: ${newSubmission.id}`, error);
        });
      }

      return successResponse({
        submissionId: newSubmission.id,
        version: newVersion,
        message: `成功重新提交，这是第${newVersion}版`
      });
    } catch (error) {
      return handleRouteError(fastify, reply, error, '重新提交失败');
    }
  });
};

// 自动化批改流程 - 使用统一的处理服务
async function startGradingProcess(submissionId: number, fastifyInstance: FastifyInstance) {
  const { processSubmission } = await import('../services/processing');

  // 使用统一的处理服务，而不是重复的代码
  const result = await processSubmission(submissionId, fastifyInstance, {
    mode: 'homework'
  });
  
  if (!result.success) {
    fastifyInstance.log.error(`❌ 自动批改流程失败 - 提交ID: ${submissionId}`, result.error);
  } else {
    fastifyInstance.log.info(`🎉 自动批改流程完成 - 提交ID: ${submissionId}`);
  }
}

// 教师端题目处理流程（仅OCR识别，存储到题库）
async function startQuestionProcessing(submissionId: number, fastifyInstance: FastifyInstance) {
  const { processSubmission } = await import('../services/processing');

  // 使用统一的处理服务，教师上传只需要OCR，不需要AI批改
  const result = await processSubmission(submissionId, fastifyInstance, {
    mode: 'homework',
    skipAI: true // 教师端跳过AI批改
  });
  
  if (!result.success) {
    fastifyInstance.log.error(`❌ 题目处理流程失败 - 提交ID: ${submissionId}`, result.error);
  } else {
    fastifyInstance.log.info(`🎉 题目处理流程完成 - 提交ID: ${submissionId}`);
    // TODO: 将OCR结果存储到题库
  }
}

export default submissionRoutes; 
