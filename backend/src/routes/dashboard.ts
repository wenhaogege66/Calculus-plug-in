// 首页dashboard数据API

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import axios from 'axios';

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
        recentSubmissions,
        errorAnalysis,
        learningRecommendations
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
          },
          orderBy: { submittedAt: 'desc' }
        }),
        
        // 错题分析
        prisma.errorAnalysis.findMany({
          where: {
            submission: {
              userId
            }
          },
          include: {
            knowledgePoint: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
        
        // AI学习建议
        prisma.learningRecommendation.findMany({
          where: { 
            userId,
            isRead: false
          },
          orderBy: { priority: 'desc' },
          take: 5
        })
      ]);

      // 计算统计指标
      const scores = completedSubmissions
        .map(s => s.deepseekResults[0]?.score)
        .filter(score => score !== null && score !== undefined);
      
      const averageScore = scores.length > 0 
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : 0;
      
      const recentScores = recentSubmissions
        .map(s => s.deepseekResults[0]?.score)
        .filter(score => score !== null && score !== undefined);
      
      const weeklyAverageScore = recentScores.length > 0 
        ? Math.round(recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length)
        : 0;

      // 分析知识点掌握情况
      const knowledgePointStats = analyzeKnowledgePoints(errorAnalysis);
      
      // 计算进步趋势
      const progressTrend = calculateProgressTrend(completedSubmissions);

      return {
        success: true,
        data: {
          overview: {
            totalPractices: totalSubmissions,
            completedPractices: completedSubmissions.length,
            averageScore,
            weeklyAverageScore,
            progressTrend
          },
          recentActivities: recentSubmissions.slice(0, 5).map(submission => ({
            id: submission.id,
            date: submission.submittedAt,
            score: submission.deepseekResults[0]?.score || null,
            status: submission.status,
            workMode: submission.workMode
          })),
          knowledgePointMastery: knowledgePointStats,
          learningRecommendations: learningRecommendations.map(rec => ({
            id: rec.id,
            type: rec.type,
            title: rec.title,
            content: rec.content,
            priority: rec.priority,
            createdAt: rec.createdAt
          })),
          weakAreas: errorAnalysis.slice(0, 3).map(error => ({
            knowledgePoint: error.knowledgePoint?.name || '未分类',
            errorType: error.errorType,
            description: error.errorDescription,
            suggestion: error.aiSuggestion
          }))
        }
      };
    } catch (error) {
      fastify.log.error('获取学生统计数据失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取统计数据失败'
      });
    }
  });

  // 学生端AI学习建议生成
  fastify.post('/dashboard/student/generate-recommendations', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;

      // 获取用户最近的错题数据
      const recentErrors = await prisma.errorAnalysis.findMany({
        where: {
          submission: {
            userId
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 最近30天
          }
        },
        include: {
          knowledgePoint: true,
          submission: {
            include: {
              deepseekResults: {
                orderBy: { createdAt: 'desc' },
                take: 1
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      // 调用AI生成学习建议
      const recommendations = await generateLearningRecommendations(userId, recentErrors);

      // 保存AI建议到数据库
      const savedRecommendations = await Promise.all(
        recommendations.map((rec: any) => 
          prisma.learningRecommendation.create({
            data: {
              userId,
              type: rec.type,
              title: rec.title,
              content: rec.content,
              priority: rec.priority,
              metadata: rec.metadata || {}
            }
          })
        )
      );

      return {
        success: true,
        data: {
          recommendations: savedRecommendations,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      fastify.log.error('生成学习建议失败:', error);
      return reply.code(500).send({
        success: false,
        error: '生成学习建议失败'
      });
    }
  });

  // 教师端班级分析统计数据
  fastify.get('/dashboard/teacher/class-analytics', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const teacherId = request.currentUser!.id;
      const userRole = request.currentUser!.role;
      
      if (userRole?.toLowerCase() !== 'teacher') {
        return reply.code(403).send({
          success: false,
          error: '仅教师可访问班级分析数据'
        });
      }

      // 获取教师的班级信息
      const classrooms = await prisma.classroom.findMany({
        where: { teacherId },
        include: {
          members: {
            where: { isActive: true },
            include: {
              student: {
                include: {
                  submissions: {
                    where: {
                      status: 'COMPLETED',
                      submittedAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 最近30天
                      }
                    },
                    include: {
                      deepseekResults: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                      },
                      errorAnalysis: {
                        include: {
                          knowledgePoint: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          assignments: {
            where: { isActive: true },
            include: {
              _count: {
                select: {
                  // 通过submission表计算提交情况（需要间接查询）
                }
              }
            }
          }
        }
      });

      // 统计所有学生数据
      let totalStudents = 0;
      let activeStudents = 0; // 最近7天有提交的学生
      let totalSubmissions = 0;
      let totalScores: number[] = [];
      let errorsByKnowledgePoint: { [key: string]: { count: number, students: Set<number> } } = {};
      let studentsNeedingAttention: Array<{
        id: number,
        username: string,
        issues: string[],
        lastSubmission: Date | null,
        averageScore: number
      }> = [];

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for (const classroom of classrooms) {
        for (const member of classroom.members) {
          totalStudents++;
          const student = member.student;
          const submissions = student.submissions;
          
          // 检查学生是否活跃
          const recentSubmissions = submissions.filter(s => s.submittedAt > sevenDaysAgo);
          if (recentSubmissions.length > 0) {
            activeStudents++;
          }

          totalSubmissions += submissions.length;

          // 收集分数
          const scores = submissions
            .map(s => s.deepseekResults[0]?.score)
            .filter(score => score !== null && score !== undefined);
          totalScores.push(...scores);

          // 分析错题知识点
          for (const submission of submissions) {
            for (const error of submission.errorAnalysis) {
              const knowledgePointName = error.knowledgePoint?.name || '未分类';
              if (!errorsByKnowledgePoint[knowledgePointName]) {
                errorsByKnowledgePoint[knowledgePointName] = { count: 0, students: new Set() };
              }
              errorsByKnowledgePoint[knowledgePointName].count++;
              errorsByKnowledgePoint[knowledgePointName].students.add(student.id);
            }
          }

          // 识别需要关注的学生
          const studentIssues: string[] = [];
          const lastSubmission = submissions.length > 0 
            ? new Date(Math.max(...submissions.map(s => s.submittedAt.getTime())))
            : null;

          // 检查是否长时间未提交
          if (!lastSubmission || lastSubmission < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)) {
            studentIssues.push('超过2周未提交作业');
          }

          // 检查成绩是否下降
          const recentScores = submissions
            .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
            .slice(0, 5)
            .map(s => s.deepseekResults[0]?.score)
            .filter(score => score !== null && score !== undefined);

          const averageScore = recentScores.length > 0 
            ? recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
            : 0;

          if (averageScore < 60) {
            studentIssues.push('最近成绩偏低');
          }

          // 检查错题数量
          const recentErrors = submissions
            .filter(s => s.submittedAt > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
            .reduce((total, s) => total + s.errorAnalysis.length, 0);

          if (recentErrors > 10) {
            studentIssues.push('错题数量较多');
          }

          if (studentIssues.length > 0) {
            studentsNeedingAttention.push({
              id: student.id,
              username: student.username,
              issues: studentIssues,
              lastSubmission,
              averageScore
            });
          }
        }
      }

      // 计算整体统计
      const classAverage = totalScores.length > 0 
        ? Math.round(totalScores.reduce((sum, score) => sum + score, 0) / totalScores.length)
        : 0;

      const submitRate = totalStudents > 0 
        ? Math.round((activeStudents / totalStudents) * 100)
        : 0;

      // 知识点难点分析（按错误率排序）
      const knowledgePointAnalysis = Object.entries(errorsByKnowledgePoint)
        .map(([point, data]) => ({
          knowledgePoint: point,
          errorCount: data.count,
          affectedStudents: data.students.size,
          errorRate: Math.round((data.students.size / Math.max(totalStudents, 1)) * 100)
        }))
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 10);

      // 调用AI生成教学建议
      const teachingRecommendations = await generateTeachingRecommendations(
        classAverage,
        knowledgePointAnalysis,
        studentsNeedingAttention.length
      );

      return {
        success: true,
        data: {
          overview: {
            totalStudents,
            activeStudents,
            totalSubmissions,
            classAverage,
            submitRate,
            totalClassrooms: classrooms.length
          },
          knowledgePointAnalysis,
          studentsNeedingAttention: studentsNeedingAttention
            .sort((a, b) => b.issues.length - a.issues.length)
            .slice(0, 10),
          teachingRecommendations,
          classroomStats: classrooms.map(classroom => ({
            id: classroom.id,
            name: classroom.name,
            memberCount: classroom.members.length,
            assignmentCount: classroom.assignments.length,
            avgScore: 0 // TODO: 计算每个班级的平均分
          }))
        }
      };
    } catch (error) {
      fastify.log.error('获取教师班级分析失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取班级分析数据失败'
      });
    }
  });

  // 获取学习进度详情
  fastify.get('/dashboard/student/progress-detail', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;

      // 获取最近30天的详细数据
      const submissions = await prisma.submission.findMany({
        where: {
          userId,
          submittedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          deepseekResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: { submittedAt: 'asc' }
      });

      // 按天分组统计
      const dailyStats = groupSubmissionsByDay(submissions);
      
      // 知识点掌握度变化
      const knowledgePointProgress = await getKnowledgePointProgress(userId);

      return {
        success: true,
        data: {
          dailyStats,
          knowledgePointProgress,
          totalDays: 30,
          activeDays: Object.keys(dailyStats).length
        }
      };
    } catch (error) {
      fastify.log.error('获取学习进度详情失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取学习进度详情失败'
      });
    }
  });
}

// 辅助函数：分析知识点掌握情况
function analyzeKnowledgePoints(errorAnalysis: any[]) {
  const knowledgePointMap = new Map();
  
  errorAnalysis.forEach(error => {
    const point = error.knowledgePoint?.name || '未分类';
    if (!knowledgePointMap.has(point)) {
      knowledgePointMap.set(point, { total: 0, errors: 0 });
    }
    knowledgePointMap.get(point).errors++;
  });

  return Array.from(knowledgePointMap.entries()).map(([point, stats]) => ({
    knowledgePoint: point,
    errorCount: stats.errors,
    masteryLevel: Math.max(0, 100 - stats.errors * 10) // 简单的掌握度计算
  }));
}

// 辅助函数：计算进步趋势
function calculateProgressTrend(submissions: any[]) {
  if (submissions.length < 2) return 0;
  
  const recent5 = submissions.slice(0, 5);
  const previous5 = submissions.slice(5, 10);
  
  const recentAvg = recent5.reduce((sum, s) => sum + (s.deepseekResults[0]?.score || 0), 0) / recent5.length;
  const previousAvg = previous5.length > 0 
    ? previous5.reduce((sum, s) => sum + (s.deepseekResults[0]?.score || 0), 0) / previous5.length
    : recentAvg;
  
  return recentAvg - previousAvg;
}

// 辅助函数：AI生成学习建议
async function generateLearningRecommendations(userId: number, errorAnalysis: any[]) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('Deepseek API密钥未配置');
    }

    // 构建错题分析摘要
    const errorSummary = errorAnalysis.map(error => ({
      knowledgePoint: error.knowledgePoint?.name || '未分类',
      errorType: error.errorType,
      description: error.errorDescription
    }));

    const prompt = `
你是一位资深的微积分教师，请基于以下学生错题分析，生成个性化的学习建议：

错题分析数据：
${JSON.stringify(errorSummary, null, 2)}

请生成3-5条学习建议，每条建议需包含：
1. type: 建议类型（'knowledge_point', 'study_method', 'practice_suggestion'）
2. title: 建议标题（15字以内）
3. content: 具体建议内容（50-100字）
4. priority: 优先级（'high', 'medium', 'low'）

返回JSON格式：
{
  "recommendations": [
    {
      "type": "knowledge_point",
      "title": "加强导数基础概念",
      "content": "建议重新学习导数的定义和几何意义，多做基础概念题...",
      "priority": "high"
    }
  ]
}
`;

    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const result = JSON.parse(response.data.choices[0].message.content);
    return result.recommendations || [];
  } catch (error) {
    console.error('AI生成学习建议失败:', error);
    return [];
  }
}

// 辅助函数：按天分组统计
function groupSubmissionsByDay(submissions: any[]) {
  const dailyStats: Record<string, any> = {};
  
  submissions.forEach(submission => {
    const date = submission.submittedAt.toISOString().split('T')[0];
    if (!dailyStats[date]) {
      dailyStats[date] = {
        date,
        practiceCount: 0,
        totalScore: 0,
        scores: []
      };
    }
    
    dailyStats[date].practiceCount++;
    const score = submission.deepseekResults[0]?.score || 0;
    dailyStats[date].totalScore += score;
    dailyStats[date].scores.push(score);
  });

  // 计算每天的平均分
  Object.values(dailyStats).forEach((day: any) => {
    day.averageScore = day.practiceCount > 0 ? Math.round(day.totalScore / day.practiceCount) : 0;
  });

  return dailyStats;
}

// 辅助函数：获取知识点进度
async function getKnowledgePointProgress(userId: number) {
  // 这里可以实现更复杂的知识点掌握度分析
  // 暂时返回模拟数据
  return [
    { knowledgePoint: '极限与连续', progress: 85, trend: 5 },
    { knowledgePoint: '导数与微分', progress: 72, trend: -2 },
    { knowledgePoint: '积分学', progress: 68, trend: 8 }
  ];
}

// 辅助函数：AI生成教学建议
async function generateTeachingRecommendations(
  classAverage: number, 
  knowledgePointAnalysis: any[], 
  studentsNeedingAttention: number
) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('Deepseek API密钥未配置');
    }

    const prompt = `
你是一位资深的微积分教师，请基于以下班级数据分析，生成针对教师的教学改进建议：

班级整体情况：
- 班级平均分：${classAverage}分
- 需要关注的学生数量：${studentsNeedingAttention}人

知识点错误分析：
${JSON.stringify(knowledgePointAnalysis.slice(0, 5), null, 2)}

请生成4-6条教学建议，每条建议需包含：
1. type: 建议类型（'curriculum_adjustment', 'teaching_method', 'student_care', 'assessment_strategy'）
2. title: 建议标题（20字以内）
3. content: 具体建议内容（80-120字）
4. priority: 优先级（'high', 'medium', 'low'）
5. actionItems: 具体行动步骤（数组，3-5个步骤）

返回JSON格式：
{
  "recommendations": [
    {
      "type": "curriculum_adjustment",
      "title": "重点加强极限概念讲解",
      "content": "基于错题分析，学生在极限概念理解上存在普遍困难...",
      "priority": "high",
      "actionItems": [
        "增加极限直观理解的图形演示",
        "设计更多渐进式练习题",
        "安排小组讨论解决概念困惑"
      ]
    }
  ]
}`;

    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const result = JSON.parse(response.data.choices[0].message.content);
    return result.recommendations || [];
  } catch (error) {
    console.error('AI生成教学建议失败:', error);
    return [];
  }
}