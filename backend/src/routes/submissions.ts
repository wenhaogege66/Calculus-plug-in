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
};

export default submissionRoutes; 