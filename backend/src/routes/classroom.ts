// 班级管理API路由
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const prisma = new PrismaClient();

const classroomRoutes: FastifyPluginAsync = async (fastify) => {
  // 生成邀请码
  const generateInviteCode = (): string => {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  };

  // 创建班级 - 仅教师
  fastify.post('/classrooms', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser!.role.toLowerCase() !== 'teacher') {
        reply.code(403).send({ success: false, error: '只有教师可以创建班级' });
      }
    }
  }, async (request, reply) => {
    try {
      const { name, description } = request.body as { name: string; description?: string };
      
      if (!name || name.trim().length === 0) {
        return reply.code(400).send({ success: false, error: '班级名称不能为空' });
      }

      const inviteCode = generateInviteCode();
      
      const classroom = await prisma.classroom.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          inviteCode,
          teacherId: request.currentUser!.id
        }
      });

      reply.send({
        success: true,
        data: {
          id: classroom.id,
          name: classroom.name,
          description: classroom.description,
          inviteCode: classroom.inviteCode,
          createdAt: classroom.createdAt
        }
      });
    } catch (error) {
      console.error('创建班级失败:', error);
      reply.code(500).send({ success: false, error: '创建班级失败' });
    }
  });

  // 获取教师的班级列表
  fastify.get('/classrooms/teacher', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser!.role.toLowerCase() !== 'teacher') {
        reply.code(403).send({ success: false, error: '只有教师可以查看班级列表' });
      }
    }
  }, async (request, reply) => {
    try {
      const classrooms = await prisma.classroom.findMany({
        where: {
          teacherId: request.currentUser!.id,
          isActive: true
        },
        include: {
          _count: {
            select: {
              members: true,
              assignments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      reply.send({
        success: true,
        data: classrooms.map(classroom => ({
          id: classroom.id,
          name: classroom.name,
          description: classroom.description,
          inviteCode: classroom.inviteCode,
          memberCount: classroom._count.members,
          assignmentCount: classroom._count.assignments,
          createdAt: classroom.createdAt
        }))
      });
    } catch (error) {
      console.error('获取班级列表失败:', error);
      reply.code(500).send({ success: false, error: '获取班级列表失败' });
    }
  });

  // 获取学生的班级列表
  fastify.get('/classrooms/student', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser!.role.toLowerCase() !== 'student') {
        reply.code(403).send({ success: false, error: '只有学生可以查看加入的班级' });
      }
    }
  }, async (request, reply) => {
    try {
      const memberships = await prisma.classroomMember.findMany({
        where: {
          studentId: request.currentUser!.id,
          isActive: true
        },
        include: {
          classroom: {
            include: {
              teacher: {
                select: { id: true, username: true }
              },
              _count: {
                select: { assignments: true }
              }
            }
          }
        },
        orderBy: { joinedAt: 'desc' }
      });

      reply.send({
        success: true,
        data: memberships.map(membership => ({
          id: membership.classroom.id,
          name: membership.classroom.name,
          description: membership.classroom.description,
          teacher: membership.classroom.teacher,
          assignmentCount: membership.classroom._count.assignments,
          joinedAt: membership.joinedAt
        }))
      });
    } catch (error) {
      console.error('获取学生班级列表失败:', error);
      reply.code(500).send({ success: false, error: '获取班级列表失败' });
    }
  });

  // 通过邀请码加入班级 - 仅学生
  fastify.post('/classrooms/join', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser!.role.toLowerCase() !== 'student') {
        reply.code(403).send({ success: false, error: '只有学生可以加入班级' });
      }
    }
  }, async (request, reply) => {
    try {
      const { inviteCode } = request.body as { inviteCode: string };
      
      if (!inviteCode || inviteCode.trim().length === 0) {
        return reply.code(400).send({ success: false, error: '邀请码不能为空' });
      }

      // 查找班级
      const classroom = await prisma.classroom.findUnique({
        where: { inviteCode: inviteCode.trim().toUpperCase() },
        include: {
          teacher: { select: { id: true, username: true } }
        }
      });

      if (!classroom || !classroom.isActive) {
        return reply.code(404).send({ success: false, error: '无效的邀请码' });
      }

      // 检查是否已加入
      const existingMembership = await prisma.classroomMember.findUnique({
        where: {
          classroomId_studentId: {
            classroomId: classroom.id,
            studentId: request.currentUser!.id
          }
        }
      });

      if (existingMembership) {
        if (existingMembership.isActive) {
          return reply.code(400).send({ success: false, error: '你已经加入了这个班级' });
        } else {
          // 重新激活成员资格
          await prisma.classroomMember.update({
            where: { id: existingMembership.id },
            data: { isActive: true }
          });
        }
      } else {
        // 创建新的成员资格
        await prisma.classroomMember.create({
          data: {
            classroomId: classroom.id,
            studentId: request.currentUser!.id
          }
        });
      }

      reply.send({
        success: true,
        data: {
          id: classroom.id,
          name: classroom.name,
          description: classroom.description,
          teacher: classroom.teacher
        }
      });
    } catch (error) {
      console.error('加入班级失败:', error);
      reply.code(500).send({ success: false, error: '加入班级失败' });
    }
  });

  // 获取班级成员列表 - 仅教师
  fastify.get('/classrooms/:classroomId/members', {
    preHandler: async (request, reply) => {
      await requireAuth(request, reply);
      if (request.currentUser!.role.toLowerCase() !== 'teacher') {
        reply.code(403).send({ success: false, error: '只有教师可以查看班级成员' });
      }
    }
  }, async (request, reply) => {
    try {
      const { classroomId } = request.params as { classroomId: string };
      
      // 验证教师是否拥有该班级
      const classroom = await prisma.classroom.findFirst({
        where: {
          id: parseInt(classroomId),
          teacherId: request.currentUser!.id
        }
      });

      if (!classroom) {
        return reply.code(404).send({ success: false, error: '班级不存在或无权限' });
      }

      const members = await prisma.classroomMember.findMany({
        where: {
          classroomId: parseInt(classroomId),
          isActive: true
        },
        include: {
          student: {
            select: {
              id: true,
              username: true,
              email: true,
              avatarUrl: true
            }
          }
        },
        orderBy: { joinedAt: 'asc' }
      });

      reply.send({
        success: true,
        data: members.map(member => ({
          id: member.id,
          student: member.student,
          joinedAt: member.joinedAt
        }))
      });
    } catch (error) {
      console.error('获取班级成员失败:', error);
      reply.code(500).send({ success: false, error: '获取班级成员失败' });
    }
  });
};

export default classroomRoutes;