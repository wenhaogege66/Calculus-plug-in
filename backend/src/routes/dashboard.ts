// 简化的首页dashboard数据API

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const prisma = new PrismaClient();

export async function dashboardRoutes(fastify: FastifyInstance) {
  // 学生端首页统计数据
  fastify.get('/dashboard/student/stats', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      
      // 获取基础统计数据
      const [
        totalSubmissions,
        completedSubmissions,
        recentSubmissions
      ] = await Promise.all([
        // 总练习次数
        prisma.submission.count({
          where: { userId }
        }),
        
        // 已完成的提交
        prisma.submission.findMany({
          where: { 
            userId,
            status: 'COMPLETED',
            deepseekResults: {
              some: {}
            }
          },
          include: {
            deepseekResults: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          },
          orderBy: { completedAt: 'desc' },
          take: 20
        }),
        
        // 最近7天的提交
        prisma.submission.findMany({
          where: {
            userId,
            submittedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          },
          include: {
            deepseekResults: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        })
      ]);

      // 计算平均分
      const scores = completedSubmissions
        .map(s => s.deepseekResults[0]?.score)
        .filter((score): score is number => score !== null && score !== undefined);
      
      const averageScore = scores.length > 0 ? 
        Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;

      // 最高分
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
      
      // 最近7天练习次数
      const recentPracticeCount = recentSubmissions.length;

      // 进步趋势（简化计算）
      const improvementTrend = recentSubmissions.length > 1 ? 'improving' : 'stable';

      reply.send({
        success: true,
        data: {
          // 基础统计
          totalSubmissions,
          completedSubmissions: completedSubmissions.length,
          averageScore,
          highestScore,
          recentPracticeCount,
          improvementTrend,
          
          // 详细数据
          recentSubmissions: recentSubmissions.map(submission => {
            const latestGrading = submission.deepseekResults[0];
            return {
              id: submission.id,
              submittedAt: submission.submittedAt,
              score: latestGrading?.score || 0,
              feedback: latestGrading?.feedback?.substring(0, 100) + '...' || ''
            };
          }),
          
          errorAnalysis: [],
          learningRecommendations: []
        }
      });
    } catch (error) {
      fastify.log.error('获取学生统计数据失败:', error);
      reply.code(500).send({ success: false, error: '获取统计数据失败' });
    }
  });

  // 教师端首页统计数据
  fastify.get('/dashboard/teacher/stats', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const teacherId = request.currentUser!.id;

      // 简化的教师统计
      const [
        totalClassrooms,
        totalAssignments,
        totalStudents
      ] = await Promise.all([
        prisma.classroom.count({
          where: { teacherId, isActive: true }
        }),
        prisma.assignment.count({
          where: { teacherId, isActive: true }
        }),
        prisma.classroomMember.count({
          where: {
            classroom: { teacherId },
            isActive: true
          }
        })
      ]);

      reply.send({
        success: true,
        data: {
          totalClassrooms,
          totalAssignments,
          totalStudents,
          recentActivities: []
        }
      });
    } catch (error) {
      fastify.log.error('获取教师统计数据失败:', error);
      reply.code(500).send({ success: false, error: '获取统计数据失败' });
    }
  });

  // 教师端班级分析数据 - 匹配前端期望的API路径
  fastify.get('/dashboard/teacher/class-analytics', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const teacherId = request.currentUser!.id;

      // 获取教师的班级和相关数据
      const [classrooms, assignments, submissions] = await Promise.all([
        prisma.classroom.findMany({
          where: { teacherId, isActive: true },
          include: {
            members: {
              where: { isActive: true },
              include: { student: true }
            },
            _count: { select: { assignments: true, members: true } }
          }
        }),
        prisma.assignment.findMany({
          where: { teacherId, isActive: true }
        }),
        prisma.submission.findMany({
          where: {
            assignment: { teacherId },
            status: 'COMPLETED'
          },
          include: {
            user: true,
            assignment: true,
            deepseekResults: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        })
      ]);

      // 计算总提交数
      const totalSubmissions = submissions.length;

      // 分析需要关注的学生（分数低于60分的）
      const studentsNeedingAttention = submissions
        .filter(sub => {
          const score = sub.deepseekResults[0]?.score || 0;
          return score < 60;
        })
        .map(sub => ({
          id: sub.user.id,
          username: sub.user.username,
          assignmentTitle: sub.assignment?.title || '未知作业',
          score: sub.deepseekResults[0]?.score || 0,
          submittedAt: sub.submittedAt
        }))
        .reduce((acc, current) => {
          // 去重，每个学生只保留最低分的一次提交
          const existing = acc.find(s => s.id === current.id);
          if (!existing || current.score < existing.score) {
            return acc.filter(s => s.id !== current.id).concat(current);
          }
          return acc;
        }, [] as any[])
        .slice(0, 10); // 限制最多10个学生

      // 计算班级统计
      const classroomStats = classrooms.map(classroom => ({
        id: classroom.id,
        name: classroom.name,
        studentCount: classroom._count.members,
        assignmentCount: classroom._count.assignments,
        averageScore: 0 // 可以后续添加更详细的计算
      }));

      reply.send({
        success: true,
        data: {
          overview: {
            totalSubmissions,
            totalStudents: classrooms.reduce((sum, c) => sum + c._count.members, 0),
            totalAssignments: assignments.length,
            totalClassrooms: classrooms.length
          },
          studentsNeedingAttention,
          classroomStats,
          recentActivities: submissions
            .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
            .slice(0, 5)
            .map(sub => ({
              type: 'submission',
              studentName: sub.user.username,
              assignmentTitle: sub.assignment?.title || '未知作业',
              score: sub.deepseekResults[0]?.score || 0,
              submittedAt: sub.submittedAt
            }))
        }
      });
    } catch (error) {
      fastify.log.error('获取教师班级分析数据失败:', error);
      reply.code(500).send({ success: false, error: '获取班级分析数据失败' });
    }
  });
}