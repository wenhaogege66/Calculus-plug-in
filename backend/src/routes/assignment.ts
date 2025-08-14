// 作业管理API路由
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import axios from 'axios';

const prisma = new PrismaClient();

const assignmentRoutes: FastifyPluginAsync = async (fastify) => {
  // 创建作业 - 仅教师
  fastify.post('/assignments', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (!request.currentUser || request.currentUser!.role.toLowerCase() !== 'teacher') {
        reply.code(403).send({ success: false, error: '只有教师可以创建作业' });
      }
    }
  }, async (request, reply) => {
    try {
      const { 
        title, 
        description, 
        classroomId, 
        fileUploadId, 
        startDate, 
        dueDate 
      } = request.body as {
        title: string;
        description?: string;
        classroomId: number;
        fileUploadId?: number;
        startDate: string;
        dueDate: string;
      };
      
      if (!title || title.trim().length === 0) {
        return reply.code(400).send({ success: false, error: '作业标题不能为空' });
      }

      if (!classroomId || !startDate || !dueDate) {
        return reply.code(400).send({ success: false, error: '班级、开始时间和截止时间不能为空' });
      }

      // 验证教师是否拥有该班级
      const classroom = await prisma.classroom.findFirst({
        where: {
          id: classroomId,
          teacherId: request.currentUser!.id,
          isActive: true
        }
      });

      if (!classroom) {
        return reply.code(404).send({ success: false, error: '班级不存在或无权限' });
      }

      // 验证时间
      const start = new Date(startDate);
      const due = new Date(dueDate);
      
      if (start >= due) {
        return reply.code(400).send({ success: false, error: '开始时间必须早于截止时间' });
      }

      const assignment = await prisma.assignment.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          classroomId,
          teacherId: request.currentUser!.id,
          fileUploadId: fileUploadId || null,
          startDate: start,
          dueDate: due
        },
        include: {
          classroom: { select: { name: true } },
          questionFile: {
            select: {
              id: true,
              filename: true,
              originalName: true
            }
          }
        }
      });

      // 如果有题目文件，异步触发OCR识别
      if (fileUploadId) {
        fastify.log.info(`作业创建成功，开始OCR识别任务: assignmentId=${assignment.id}`);
        
        // 异步调用OCR识别，不阻塞响应
        triggerAssignmentOCR(assignment.id, fastify)
          .then(() => {
            fastify.log.info(`作业OCR识别完成: assignmentId=${assignment.id}`);
          })
          .catch((error) => {
            fastify.log.error(`作业OCR识别失败: assignmentId=${assignment.id}`, error);
          });
      }

      reply.send({
        success: true,
        data: {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          classroom: assignment.classroom,
          questionFile: assignment.questionFile,
          startDate: assignment.startDate,
          dueDate: assignment.dueDate,
          ocrStatus: assignment.ocrStatus,
          createdAt: assignment.createdAt
        }
      });
    } catch (error) {
      console.error('创建作业失败:', error);
      reply.code(500).send({ success: false, error: '创建作业失败' });
    }
  });

  // 获取教师的作业列表
  fastify.get('/assignments/teacher', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser!.role.toLowerCase() !== 'teacher') {
        reply.code(403).send({ success: false, error: '只有教师可以查看作业列表' });
      }
    }
  }, async (request, reply) => {
    try {
      const assignments = await prisma.assignment.findMany({
        where: {
          teacherId: request.currentUser!.id,
          isActive: true
        },
        include: {
          classroom: { select: { id: true, name: true } },
          questionFile: {
            select: {
              id: true,
              filename: true,
              originalName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      reply.send({
        success: true,
        data: assignments.map(assignment => ({
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          classroom: assignment.classroom,
          questionFile: assignment.questionFile,
          startDate: assignment.startDate,
          dueDate: assignment.dueDate,
          isActive: assignment.isActive,
          createdAt: assignment.createdAt
        }))
      });
    } catch (error) {
      console.error('获取作业列表失败:', error);
      reply.code(500).send({ success: false, error: '获取作业列表失败' });
    }
  });

  // 获取学生的作业列表
  fastify.get('/assignments/student', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser!.role.toLowerCase() !== 'student') {
        reply.code(403).send({ success: false, error: '只有学生可以查看作业列表' });
      }
    }
  }, async (request, reply) => {
    try {
      // 获取学生加入的所有班级
      const memberships = await prisma.classroomMember.findMany({
        where: {
          studentId: request.currentUser!.id,
          isActive: true
        },
        select: { classroomId: true }
      });

      const classroomIds = memberships.map(m => m.classroomId);

      if (classroomIds.length === 0) {
        return reply.send({ success: true, data: [] });
      }

      // 获取这些班级的所有作业
      const assignments = await prisma.assignment.findMany({
        where: {
          classroomId: { in: classroomIds },
          isActive: true,
          startDate: { lte: new Date() } // 只显示已开始的作业
        },
        include: {
          classroom: { select: { id: true, name: true } },
          teacher: { select: { id: true, username: true } },
          questionFile: {
            select: {
              id: true,
              filename: true,
              originalName: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      });

      // 获取学生的详细提交统计信息
      const submissionCounts = await prisma.submission.groupBy({
        by: ['assignmentId'],
        where: {
          userId: request.currentUser!.id,
          assignmentId: { in: assignments.map(a => a.id) }
        },
        _count: { id: true }
      });

      // 获取最新提交版本信息
      const latestSubmissions = await prisma.submission.findMany({
        where: {
          userId: request.currentUser!.id,
          assignmentId: { in: assignments.map(a => a.id) }
        },
        select: {
          assignmentId: true,
          metadata: true,
          submittedAt: true
        },
        orderBy: { submittedAt: 'desc' }
      });

      const submissionMap = new Map(
        submissionCounts.map(s => [s.assignmentId, s._count.id])
      );

      const versionMap = new Map();
      for (const submission of latestSubmissions) {
        if (!versionMap.has(submission.assignmentId)) {
          const metadata = submission.metadata as any;
          versionMap.set(submission.assignmentId, metadata?.version || 1);
        }
      }

      reply.send({
        success: true,
        data: assignments.map(assignment => ({
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          classroomId: assignment.classroomId, // 添加缺失的classroomId字段
          classroom: assignment.classroom,
          teacher: assignment.teacher,
          questionFile: assignment.questionFile,
          startDate: assignment.startDate,
          dueDate: assignment.dueDate,
          isSubmitted: (submissionMap.get(assignment.id) || 0) > 0,
          isOverdue: new Date() > assignment.dueDate,
          submissionCount: submissionMap.get(assignment.id) || 0,
          latestSubmissionVersion: versionMap.get(assignment.id) || 1
        }))
      });
    } catch (error) {
      console.error('获取学生作业列表失败:', error);
      reply.code(500).send({ success: false, error: '获取作业列表失败' });
    }
  });

  // 获取特定班级的作业列表
  fastify.get('/classrooms/:classroomId/assignments', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
    }
  }, async (request, reply) => {
    try {
      const { classroomId } = request.params as { classroomId: string };
      const classroomIdInt = parseInt(classroomId);

      // 验证用户是否有权限访问该班级
      if (request.currentUser!.role.toLowerCase() === 'teacher') {
        const classroom = await prisma.classroom.findFirst({
          where: { id: classroomIdInt, teacherId: request.currentUser!.id }
        });
        if (!classroom) {
          return reply.code(404).send({ success: false, error: '班级不存在或无权限' });
        }
      } else if (request.currentUser!.role.toLowerCase() === 'student') {
        const membership = await prisma.classroomMember.findUnique({
          where: {
            classroomId_studentId: {
              classroomId: classroomIdInt,
              studentId: request.currentUser!.id
            }
          }
        });
        if (!membership || !membership.isActive) {
          return reply.code(404).send({ success: false, error: '未加入该班级' });
        }
      }

      const assignments = await prisma.assignment.findMany({
        where: {
          classroomId: classroomIdInt,
          isActive: true
        },
        include: {
          questionFile: {
            select: {
              id: true,
              filename: true,
              originalName: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      });

      reply.send({
        success: true,
        data: assignments.map(assignment => ({
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          questionFile: assignment.questionFile,
          startDate: assignment.startDate,
          dueDate: assignment.dueDate,
          isOverdue: new Date() > assignment.dueDate
        }))
      });
    } catch (error) {
      console.error('获取班级作业列表失败:', error);
      reply.code(500).send({ success: false, error: '获取作业列表失败' });
    }
  });

  // 更新作业信息
  fastify.put('/assignments/:id', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser!.role.toLowerCase() !== 'teacher') {
        reply.code(403).send({ success: false, error: '只有教师可以更新作业' });
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const assignmentId = parseInt(id);
      
      const updateData = request.body as {
        title?: string;
        description?: string;
        classroomId?: number;
        fileUploadId?: number;
        startDate?: string;
        dueDate?: string;
        isActive?: boolean;
      };

      // 验证作业是否存在且属于当前教师
      const existingAssignment = await prisma.assignment.findFirst({
        where: {
          id: assignmentId,
          teacherId: request.currentUser!.id
        }
      });

      if (!existingAssignment) {
        return reply.code(404).send({ success: false, error: '作业不存在或无权限' });
      }

      // 构建更新数据
      const updatePayload: any = {};
      
      if (updateData.title !== undefined) {
        if (!updateData.title || updateData.title.trim().length === 0) {
          return reply.code(400).send({ success: false, error: '作业标题不能为空' });
        }
        updatePayload.title = updateData.title.trim();
      }
      
      if (updateData.description !== undefined) {
        updatePayload.description = updateData.description?.trim() || null;
      }
      
      if (updateData.classroomId !== undefined) {
        // 验证教师是否拥有该班级
        const classroom = await prisma.classroom.findFirst({
          where: {
            id: updateData.classroomId,
            teacherId: request.currentUser!.id,
            isActive: true
          }
        });
        
        if (!classroom) {
          return reply.code(404).send({ success: false, error: '班级不存在或无权限' });
        }
        
        updatePayload.classroomId = updateData.classroomId;
      }
      
      if (updateData.fileUploadId !== undefined) {
        updatePayload.fileUploadId = updateData.fileUploadId || null;
      }
      
      if (updateData.startDate !== undefined) {
        updatePayload.startDate = new Date(updateData.startDate);
      }
      
      if (updateData.dueDate !== undefined) {
        updatePayload.dueDate = new Date(updateData.dueDate);
        
        // 如果只更新了dueDate，验证时间关系
        const startDate = updatePayload.startDate || existingAssignment.startDate;
        if (startDate >= updatePayload.dueDate) {
          return reply.code(400).send({ success: false, error: '开始时间必须早于截止时间' });
        }
      }
      
      if (updateData.isActive !== undefined) {
        updatePayload.isActive = updateData.isActive;
      }

      // 更新作业
      const updatedAssignment = await prisma.assignment.update({
        where: { id: assignmentId },
        data: updatePayload,
        include: {
          classroom: { select: { id: true, name: true } },
          questionFile: {
            select: {
              id: true,
              filename: true,
              originalName: true
            }
          }
        }
      });

      reply.send({
        success: true,
        data: {
          id: updatedAssignment.id,
          title: updatedAssignment.title,
          description: updatedAssignment.description,
          classroom: updatedAssignment.classroom,
          questionFile: updatedAssignment.questionFile,
          startDate: updatedAssignment.startDate,
          dueDate: updatedAssignment.dueDate,
          isActive: updatedAssignment.isActive,
          updatedAt: updatedAssignment.updatedAt
        }
      });
      
    } catch (error) {
      console.error('更新作业失败:', error);
      reply.code(500).send({ success: false, error: '更新作业失败' });
    }
  });

  // 切换作业状态（开启/结束）
  fastify.patch('/assignments/:id/toggle', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser!.role.toLowerCase() !== 'teacher') {
        reply.code(403).send({ success: false, error: '只有教师可以切换作业状态' });
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const assignmentId = parseInt(id);
      const { isActive } = request.body as { isActive: boolean };

      // 验证作业是否存在且属于当前教师
      const existingAssignment = await prisma.assignment.findFirst({
        where: {
          id: assignmentId,
          teacherId: request.currentUser!.id
        }
      });

      if (!existingAssignment) {
        return reply.code(404).send({ success: false, error: '作业不存在或无权限' });
      }

      // 切换状态
      const updatedAssignment = await prisma.assignment.update({
        where: { id: assignmentId },
        data: { isActive: isActive },
        include: {
          classroom: { select: { id: true, name: true } },
          questionFile: {
            select: {
              id: true,
              filename: true,
              originalName: true
            }
          }
        }
      });

      reply.send({
        success: true,
        data: {
          id: updatedAssignment.id,
          title: updatedAssignment.title,
          isActive: updatedAssignment.isActive,
          message: `作业已${isActive ? '开启' : '结束'}`
        }
      });
      
    } catch (error) {
      console.error('切换作业状态失败:', error);
      reply.code(500).send({ success: false, error: '切换作业状态失败' });
    }
  });
};

// 异步触发作业OCR识别的辅助函数
async function triggerAssignmentOCR(assignmentId: number, fastify: any) {
  try {
    // 调用内部OCR接口
    const response = await axios.post(`http://localhost:3000/api/internal/ocr/assignment`, {
      assignmentId: assignmentId
    }, {
      headers: {
        'Content-Type': 'application/json',
        // 这里需要添加内部服务认证，暂时跳过认证
      },
      timeout: 60000 // 60秒超时
    });

    fastify.log.info(`作业OCR识别结果:`, response.data);
    return response.data;
    
  } catch (error) {
    fastify.log.error(`触发作业OCR识别失败:`, error);
    throw error;
  }
}

export default assignmentRoutes;