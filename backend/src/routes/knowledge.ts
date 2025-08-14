// 知识图谱API路由
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import axios from 'axios';

const prisma = new PrismaClient();

export async function knowledgeRoutes(fastify: FastifyInstance) {
  // 获取知识图谱数据 - 层次结构
  fastify.get('/knowledge/graph', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      
      // 获取完整的知识点层次结构
      const knowledgePoints = await prisma.knowledgePoint.findMany({
        include: {
          children: {
            include: {
              children: true // 支持三级层次
            }
          },
          parent: true,
          errorAnalysis: {
            where: {
              submission: {
                userId: userId
              }
            }
          }
        },
        orderBy: [
          { level: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      // 构建图形数据结构
      const nodes = knowledgePoints.map(kp => {
        // 计算用户在该知识点的错误次数
        const errorCount = kp.errorAnalysis.length;
        const masteryLevel = Math.max(0, 100 - errorCount * 15); // 简单的掌握度计算
        
        return {
          id: kp.id,
          name: kp.name,
          chapter: kp.chapter,
          level: kp.level,
          parentId: kp.parentId,
          keywords: kp.keywords,
          functionExamples: kp.functionExamples,
          difficultyLevel: kp.difficultyLevel,
          aiExplanation: kp.aiExplanation,
          // 用户相关数据
          errorCount: errorCount,
          masteryLevel: masteryLevel,
          status: masteryLevel > 80 ? 'mastered' : masteryLevel > 50 ? 'learning' : 'weak'
        };
      });

      // 构建连接关系
      const links = knowledgePoints
        .filter(kp => kp.parentId)
        .map(kp => ({
          source: kp.parentId,
          target: kp.id,
          type: 'hierarchy'
        }));

      // 添加同级关联关系（基于共同关键词）
      const sameChapterLinks = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i];
          const node2 = nodes[j];
          
          // 同章节且同级别的知识点建立关联
          if (node1.chapter === node2.chapter && 
              node1.level === node2.level && 
              node1.level > 1) {
            sameChapterLinks.push({
              source: node1.id,
              target: node2.id,
              type: 'related'
            });
          }
        }
      }

      // 合并所有连接
      const allLinks = [...links, ...sameChapterLinks];

      return {
        success: true,
        data: {
          nodes: nodes,
          links: allLinks,
          chapters: [...new Set(nodes.map(n => n.chapter).filter(Boolean))],
          stats: {
            totalKnowledgePoints: nodes.length,
            masteredPoints: nodes.filter(n => n.status === 'mastered').length,
            weakPoints: nodes.filter(n => n.status === 'weak').length,
            userProgress: nodes.length > 0 
              ? Math.round(nodes.filter(n => n.status === 'mastered').length / nodes.length * 100)
              : 0
          }
        }
      };
    } catch (error) {
      fastify.log.error('获取知识图谱失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取知识图谱失败'
      });
    }
  });

  // 获取知识点详细信息和AI解释
  fastify.get('/knowledge/:knowledgePointId/details', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const knowledgePointId = parseInt((request.params as any).knowledgePointId);
      const userId = request.currentUser!.id;

      if (!knowledgePointId) {
        return reply.code(400).send({
          success: false,
          error: '无效的知识点ID'
        });
      }

      // 获取知识点详细信息
      const knowledgePoint = await prisma.knowledgePoint.findUnique({
        where: { id: knowledgePointId },
        include: {
          parent: true,
          children: true,
          errorAnalysis: {
            where: {
              submission: {
                userId: userId
              }
            },
            include: {
              submission: {
                include: {
                  fileUpload: {
                    select: {
                      originalName: true
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          similarQuestionRelations: {
            include: {
              similarQuestion: {
                select: {
                  id: true,
                  generatedContent: true,
                  difficultyLevel: true,
                  isCompleted: true,
                  userRating: true
                }
              }
            },
            take: 3
          }
        }
      });

      if (!knowledgePoint) {
        return reply.code(404).send({
          success: false,
          error: '知识点不存在'
        });
      }

      // 如果没有AI解释，生成一个
      let aiExplanation = knowledgePoint.aiExplanation;
      if (!aiExplanation) {
        aiExplanation = await generateKnowledgePointExplanation(knowledgePoint);
        
        // 保存生成的解释
        await prisma.knowledgePoint.update({
          where: { id: knowledgePointId },
          data: { aiExplanation }
        });
      }

      // 计算相关统计
      const errorCount = knowledgePoint.errorAnalysis.length;
      const masteryLevel = Math.max(0, 100 - errorCount * 15);

      return {
        success: true,
        data: {
          id: knowledgePoint.id,
          name: knowledgePoint.name,
          chapter: knowledgePoint.chapter,
          level: knowledgePoint.level,
          description: knowledgePoint.description,
          keywords: knowledgePoint.keywords,
          functionExamples: knowledgePoint.functionExamples,
          difficultyLevel: knowledgePoint.difficultyLevel,
          aiExplanation: aiExplanation,
          // 层次关系
          parent: knowledgePoint.parent ? {
            id: knowledgePoint.parent.id,
            name: knowledgePoint.parent.name
          } : null,
          children: knowledgePoint.children.map(child => ({
            id: child.id,
            name: child.name,
            masteryLevel: Math.max(0, 100 - 15)
          })),
          // 用户学习数据
          userStats: {
            errorCount: errorCount,
            masteryLevel: masteryLevel,
            status: masteryLevel > 80 ? 'mastered' : masteryLevel > 50 ? 'learning' : 'weak',
            recentErrors: []
          },
          // 相关练习题
          relatedQuestions: knowledgePoint.similarQuestionRelations.map(rel => ({
            id: rel.similarQuestion.id,
            content: rel.similarQuestion.generatedContent.substring(0, 100) + '...',
            difficultyLevel: rel.similarQuestion.difficultyLevel,
            isCompleted: rel.similarQuestion.isCompleted,
            userRating: rel.similarQuestion.userRating
          }))
        }
      };
    } catch (error) {
      fastify.log.error('获取知识点详情失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取知识点详情失败'
      });
    }
  });

  // 初始化默认知识点结构
  fastify.post('/knowledge/initialize', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userRole = request.currentUser!.role;
      if (userRole?.toLowerCase() !== 'teacher') {
        return reply.code(403).send({
          success: false,
          error: '仅教师可初始化知识点结构'
        });
      }

      // 检查是否已有知识点
      const existingCount = await prisma.knowledgePoint.count();
      if (existingCount > 0) {
        return reply.code(400).send({
          success: false,
          error: '知识点结构已存在，无需重复初始化'
        });
      }

      // 创建微积分知识点层次结构
      const knowledgeStructure = await createCalculusKnowledgeStructure();

      return {
        success: true,
        data: {
          message: '知识点结构初始化成功',
          createdCount: knowledgeStructure.length
        }
      };
    } catch (error) {
      fastify.log.error('初始化知识点结构失败:', error);
      return reply.code(500).send({
        success: false,
        error: '初始化知识点结构失败'
      });
    }
  });

  // 搜索知识点
  fastify.get('/knowledge/search', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { q: query } = request.query as { q?: string };
      
      if (!query || query.trim().length < 2) {
        return reply.code(400).send({
          success: false,
          error: '搜索关键词至少需要2个字符'
        });
      }

      const searchTerm = query.trim();
      
      const results = await prisma.knowledgePoint.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { description: { contains: searchTerm } },
            { keywords: { has: searchTerm } },
            { chapter: { contains: searchTerm } }
          ]
        },
        include: {
          parent: {
            select: { id: true, name: true }
          },
          children: {
            select: { id: true, name: true }
          }
        },
        take: 20
      });

      return {
        success: true,
        data: results.map(kp => ({
          id: kp.id,
          name: kp.name,
          chapter: kp.chapter,
          level: kp.level,
          keywords: kp.keywords,
          description: kp.description,
          parent: kp.parent,
          childrenCount: kp.children.length
        }))
      };
    } catch (error) {
      fastify.log.error('搜索知识点失败:', error);
      return reply.code(500).send({
        success: false,
        error: '搜索知识点失败'
      });
    }
  });
}

// AI生成知识点解释
async function generateKnowledgePointExplanation(knowledgePoint: any): Promise<string> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return `${knowledgePoint.name}是微积分中的重要概念，需要深入理解其定义和应用。`;
    }

    const prompt = `
你是一位资深的微积分教师，请为以下知识点提供清晰易懂的解释：

知识点名称：${knowledgePoint.name}
所属章节：${knowledgePoint.chapter || '微积分基础'}
难度等级：${knowledgePoint.difficultyLevel}/5
关键词：${knowledgePoint.keywords?.join(', ') || '无'}
函数示例：${knowledgePoint.functionExamples?.join(', ') || '无'}

请提供：
1. 概念定义（用通俗易懂的语言）
2. 核心要点（3-4个关键点）
3. 常见应用场景
4. 学习建议和注意事项

要求：
- 语言简洁明了，适合学生理解
- 结合具体例子说明
- 重点突出，层次清晰
- 200-300字左右`;

    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    return response.data.choices[0].message.content || `${knowledgePoint.name}是微积分中的重要概念，需要深入理解其定义和应用。`;
  } catch (error) {
    console.error('生成知识点解释失败:', error);
    return `${knowledgePoint.name}是微积分中的重要概念，需要深入理解其定义和应用。建议查阅相关教材或咨询教师获得更详细的解释。`;
  }
}

// 创建微积分知识点层次结构
async function createCalculusKnowledgeStructure() {
  const knowledgePoints = [
    // 第一章：极限与连续
    {
      name: '极限与连续',
      chapter: '极限与连续',
      level: 1,
      keywords: ['极限', '连续', '函数'],
      difficultyLevel: 3,
      children: [
        {
          name: '数列极限',
          level: 2,
          keywords: ['数列', '极限', '收敛'],
          difficultyLevel: 3,
          children: [
            { name: '极限存在准则', level: 3, keywords: ['夹逼定理', '单调有界'], difficultyLevel: 4 },
            { name: '极限运算法则', level: 3, keywords: ['四则运算', '复合函数'], difficultyLevel: 3 }
          ]
        },
        {
          name: '函数极限',
          level: 2,
          keywords: ['函数极限', '左极限', '右极限'],
          difficultyLevel: 3,
          children: [
            { name: '重要极限', level: 3, keywords: ['sinx/x', 'e的极限'], difficultyLevel: 4 },
            { name: '无穷小量', level: 3, keywords: ['无穷小', '等价无穷小'], difficultyLevel: 4 }
          ]
        },
        {
          name: '连续性',
          level: 2,
          keywords: ['连续', '间断点', '一致连续'],
          difficultyLevel: 3,
          children: [
            { name: '连续函数性质', level: 3, keywords: ['介值定理', '最值定理'], difficultyLevel: 3 },
            { name: '间断点分类', level: 3, keywords: ['可去间断', '跳跃间断'], difficultyLevel: 3 }
          ]
        }
      ]
    },
    // 第二章：导数与微分
    {
      name: '导数与微分',
      chapter: '导数与微分',
      level: 1,
      keywords: ['导数', '微分', '求导'],
      difficultyLevel: 3,
      children: [
        {
          name: '导数概念',
          level: 2,
          keywords: ['导数定义', '几何意义', '物理意义'],
          difficultyLevel: 3,
          children: [
            { name: '导数的几何意义', level: 3, keywords: ['切线斜率', '几何'], difficultyLevel: 2 },
            { name: '导数的物理意义', level: 3, keywords: ['变化率', '速度', '加速度'], difficultyLevel: 2 }
          ]
        },
        {
          name: '求导法则',
          level: 2,
          keywords: ['求导法则', '链式法则', '乘积法则'],
          difficultyLevel: 3,
          children: [
            { name: '基本求导公式', level: 3, keywords: ['幂函数', '指数函数', '对数函数'], difficultyLevel: 2 },
            { name: '复合函数求导', level: 3, keywords: ['链式法则', '复合函数'], difficultyLevel: 4 },
            { name: '隐函数求导', level: 3, keywords: ['隐函数', '参数方程'], difficultyLevel: 4 }
          ]
        },
        {
          name: '导数应用',
          level: 2,
          keywords: ['导数应用', '极值', '单调性'],
          difficultyLevel: 4,
          children: [
            { name: '函数单调性', level: 3, keywords: ['单调性', '导数符号'], difficultyLevel: 3 },
            { name: '函数极值', level: 3, keywords: ['极大值', '极小值', '驻点'], difficultyLevel: 4 },
            { name: '最值问题', level: 3, keywords: ['最大值', '最小值', '应用题'], difficultyLevel: 4 },
            { name: '曲线凹凸性', level: 3, keywords: ['二阶导数', '拐点', '凹凸'], difficultyLevel: 4 }
          ]
        }
      ]
    },
    // 第三章：积分学
    {
      name: '积分学',
      chapter: '积分学',
      level: 1,
      keywords: ['积分', '不定积分', '定积分'],
      difficultyLevel: 4,
      children: [
        {
          name: '不定积分',
          level: 2,
          keywords: ['不定积分', '原函数', '积分法'],
          difficultyLevel: 3,
          children: [
            { name: '基本积分公式', level: 3, keywords: ['基本积分', '原函数'], difficultyLevel: 3 },
            { name: '换元积分法', level: 3, keywords: ['第一类换元', '第二类换元'], difficultyLevel: 4 },
            { name: '分部积分法', level: 3, keywords: ['分部积分', 'udv公式'], difficultyLevel: 4 }
          ]
        },
        {
          name: '定积分',
          level: 2,
          keywords: ['定积分', '几何意义', '物理意义'],
          difficultyLevel: 4,
          children: [
            { name: '定积分概念', level: 3, keywords: ['黎曼积分', '几何意义'], difficultyLevel: 3 },
            { name: '牛顿-莱布尼兹公式', level: 3, keywords: ['基本定理', '计算定积分'], difficultyLevel: 3 },
            { name: '定积分应用', level: 3, keywords: ['面积', '体积', '弧长'], difficultyLevel: 4 }
          ]
        }
      ]
    }
  ];

  // 递归创建知识点
  const createKnowledgePoints = async (points: any[], parentId: number | null = null): Promise<any[]> => {
    const results: any[] = [];
    for (const point of points) {
      const { children, ...pointData } = point;
      
      const createdPoint = await prisma.knowledgePoint.create({
        data: {
          ...pointData,
          parentId,
          functionExamples: [],
          description: `${pointData.name}相关的微积分知识点`,
        }
      });
      
      results.push(createdPoint);
      
      if (children && children.length > 0) {
        const childResults: any[] = await createKnowledgePoints(children, createdPoint.id);
        results.push(...childResults);
      }
    }
    return results;
  };

  return await createKnowledgePoints(knowledgePoints);
}

export default knowledgeRoutes;