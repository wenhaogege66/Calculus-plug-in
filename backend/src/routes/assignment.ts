// 作业管理API路由
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const prisma = new PrismaClient();

const assignmentRoutes: FastifyPluginAsync = async (fastify) => {
  // 创建作业 - 仅教师
  fastify.post('/assignments', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser.role.toLowerCase() !== 'teacher') {
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
          teacherId: request.currentUser.id,
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
          teacherId: request.currentUser.id,
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
      if (request.currentUser.role.toLowerCase() !== 'teacher') {
        reply.code(403).send({ success: false, error: '只有教师可以查看作业列表' });
      }
    }
  }, async (request, reply) => {
    try {
      const assignments = await prisma.assignment.findMany({
        where: {
          teacherId: request.currentUser.id,
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
      if (request.currentUser.role.toLowerCase() !== 'student') {
        reply.code(403).send({ success: false, error: '只有学生可以查看作业列表' });
      }
    }
  }, async (request, reply) => {
    try {
      // 获取学生加入的所有班级
      const memberships = await prisma.classroomMember.findMany({
        where: {
          studentId: request.currentUser.id,
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

      // 检查学生是否已提交作业
      const submissionCounts = await prisma.submission.groupBy({
        by: ['assignmentId'],
        where: {
          userId: request.currentUser.id,
          assignmentId: { in: assignments.map(a => a.id) }
        },
        _count: { id: true }
      });

      const submissionMap = new Map(
        submissionCounts.map(s => [s.assignmentId, s._count.id > 0])
      );

      reply.send({
        success: true,
        data: assignments.map(assignment => ({
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          classroom: assignment.classroom,
          teacher: assignment.teacher,
          questionFile: assignment.questionFile,
          startDate: assignment.startDate,
          dueDate: assignment.dueDate,
          isSubmitted: submissionMap.get(assignment.id) || false,
          isOverdue: new Date() > assignment.dueDate
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
      if (request.currentUser.role.toLowerCase() === 'teacher') {
        const classroom = await prisma.classroom.findFirst({
          where: { id: classroomIdInt, teacherId: request.currentUser.id }
        });
        if (!classroom) {
          return reply.code(404).send({ success: false, error: '班级不存在或无权限' });
        }
      } else if (request.currentUser.role.toLowerCase() === 'student') {
        const membership = await prisma.classroomMember.findUnique({
          where: {
            classroomId_studentId: {
              classroomId: classroomIdInt,
              studentId: request.currentUser.id
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
};

export default assignmentRoutes;