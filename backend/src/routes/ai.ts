// Deepseek AI批改服务

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import axios from 'axios';

const prisma = new PrismaClient();

// AI批改的核心逻辑 - 导出供其他模块使用
export async function processAIGrading(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance) {
    try {
      const { submissionId, recognizedText, subject = '微积分', exerciseType = '练习题' } = request.body as any;
      
      if (!submissionId || !recognizedText) {
        return reply.code(400).send({
          success: false,
          error: '缺少必要参数'
        });
      }

      // 获取提交记录（对于内部调用，不验证用户）
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          ...(request.currentUser && { userId: request.currentUser.id }) // 只有在有用户上下文时才验证
        },
        include: {
          fileUpload: true,
          mathpixResults: true
        }
      });

      if (!submission) {
        return reply.code(404).send({
          success: false,
          error: '提交记录不存在'
        });
      }

      // 获取教师题目信息（如果是作业模式）
      let teacherQuestionText = null;
      let teacherQuestionLatex = null;
      
      if (submission.assignmentId) {
        fastify.log.info(`获取作业题目信息: assignmentId=${submission.assignmentId}`);
        
        const assignment = await prisma.assignment.findUnique({
          where: { id: submission.assignmentId },
          select: {
            id: true,
            title: true,
            ocrText: true,
            ocrLatex: true,
            ocrStatus: true
          }
        });

        if (assignment) {
          teacherQuestionText = assignment.ocrText;
          teacherQuestionLatex = assignment.ocrLatex;
          
          fastify.log.info(`作业题目OCR状态: ${assignment.ocrStatus}`);
          if (assignment.ocrText) {
            fastify.log.info(`题目文本长度: ${assignment.ocrText.length}字符`);
          }
        }
      }

      const startTime = Date.now();

      // 调用Deepseek AI进行批改，传入教师题目信息
      const gradingResult = await callDeepseekAPI(
        recognizedText, 
        subject, 
        exerciseType,
        teacherQuestionText,
        teacherQuestionLatex
      );
      
      const processingTime = Date.now() - startTime;

      // 保存批改结果
      const aiResult = await prisma.deepseekResult.create({
        data: {
          submissionId: submissionId,
          score: gradingResult.score,
          maxScore: gradingResult.maxScore,
          feedback: gradingResult.feedback,
          errors: gradingResult.errors,
          suggestions: gradingResult.suggestions,
          strengths: gradingResult.strengths,
          processingTime: processingTime,
          rawResult: {
            ...gradingResult.raw,
            enhancedData: {
              questionCount: gradingResult.questionCount,
              incorrectCount: gradingResult.incorrectCount,
              correctCount: gradingResult.correctCount,
              knowledgePoints: gradingResult.knowledgePoints,
              detailedErrors: gradingResult.detailedErrors,
              improvementAreas: gradingResult.improvementAreas,
              nextStepRecommendations: gradingResult.nextStepRecommendations
            }
          }
        }
      });

      // 更新提交状态为完成
      await prisma.submission.update({
        where: { id: submissionId },
        data: { 
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      // 从rawResult中提取增强数据
      const enhancedData = (aiResult.rawResult as any)?.enhancedData || {};
      
      return {
        success: true,
        data: {
          resultId: aiResult.id,
          score: aiResult.score,
          maxScore: aiResult.maxScore,
          feedback: aiResult.feedback,
          errors: aiResult.errors,
          suggestions: aiResult.suggestions,
          strengths: aiResult.strengths,
          processingTime: aiResult.processingTime,
          // 新增的结构化信息
          questionCount: enhancedData.questionCount || 0,
          incorrectCount: enhancedData.incorrectCount || 0,
          correctCount: enhancedData.correctCount || 0,
          knowledgePoints: enhancedData.knowledgePoints || [],
          detailedErrors: enhancedData.detailedErrors || [],
          improvementAreas: enhancedData.improvementAreas || [],
          nextStepRecommendations: enhancedData.nextStepRecommendations || []
        }
      };

    } catch (error) {
      fastify.log.error('Deepseek AI批改失败:', error);
      
      // 更新提交状态为失败
      if ((request.body as any)?.submissionId) {
        await prisma.submission.update({
          where: { id: (request.body as any).submissionId },
          data: { status: 'FAILED' }
        }).catch(() => {}); // 忽略更新失败
      }

      return reply.code(500).send({
        success: false,
        error: 'AI批改处理失败'
      });
    }
}

export async function aiRoutes(fastify: FastifyInstance) {
  // Deepseek AI批改作业 - 统一端点（条件认证）
  fastify.post('/ai/grade', { 
    preHandler: async (request, reply) => {
      // 对于内部调用，跳过认证检查
      if (request.headers['x-internal-call'] === 'true') {
        return;
      }
      // 对于外部调用，需要认证
      await requireAuth(request, reply);
    }
  }, async (request, reply) => {
    return await processAIGrading(request, reply, fastify);
  });

  // 获取批改结果
  fastify.get('/ai/results/:submissionId', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const submissionId = parseInt((request.params as any).submissionId);
      
      // 验证提交记录是否属于当前用户
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId: request.currentUser!.id
        }
      });

      if (!submission) {
        return reply.code(404).send({
          success: false,
          error: '提交记录不存在'
        });
      }

      // 获取批改结果
      const aiResults = await prisma.deepseekResult.findMany({
        where: { submissionId: submissionId },
        orderBy: { createdAt: 'desc' }
      });

      return {
        success: true,
        data: { results: aiResults }
      };

    } catch (error) {
      fastify.log.error('获取AI批改结果失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取AI批改结果失败'
      });
    }
  });
}

// 调用Deepseek API的辅助函数
async function callDeepseekAPI(
  text: string, 
  subject: string, 
  exerciseType: string,
  teacherQuestionText?: string | null,
  teacherQuestionLatex?: string | null
): Promise<{
  score: number;
  maxScore: number;
  feedback: string;
  errors: any[];
  suggestions: any[];
  strengths: any[];
  questionCount?: number;
  incorrectCount?: number;
  correctCount?: number;
  knowledgePoints?: string[];
  detailedErrors?: any[];
  improvementAreas?: string[];
  nextStepRecommendations?: string[];
  raw: any;
}> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      throw new Error('Deepseek API密钥未配置');
    }

    // 构建包含题目信息的prompt
    let questionSection = '';
    if (teacherQuestionText) {
      questionSection = `
题目内容：
${teacherQuestionText}
${teacherQuestionLatex ? `
LaTeX格式：
${teacherQuestionLatex}
` : ''}`;
    }

    const prompt = `
你是一位资深的${subject}教师，请对以下学生作业进行全面、详细的智能批改分析。
${questionSection}

学生提交的解答内容：
${text}

批改要求：
${teacherQuestionText ? 
  '1. 根据题目要求进行精准评分，检查解题过程的完整性和正确性\n2. 分析学生对题目要求的理解程度\n3. 评估解题步骤的逻辑性和数学严谨性\n4. 验证计算结果的准确性' : 
  '1. 基于微积分知识体系进行评分\n2. 分析解题思路和方法选择的合理性\n3. 检查数学概念理解的准确程度\n4. 评估计算过程的规范性'
}

知识点选择范围（请仅从以下列表中选择相关知识点）：
【上册】
函数与极限: 集合与映射, 数列极限, 函数极限, 极限的性质, 无穷小与无穷大, 极限运算, 极限存在准则, 无穷小比阶与等价无穷小, 函数的连续性与间断点
一元函数微分学: 导数与微分, 导数的几何意义, 高阶导数, 隐函数与参数方程的求导, 复合函数求导, 对数与指数函数求导, 三角与反三角函数求导, 微分中值定理, 洛必达法则, 泰勒公式, 函数的单调性与极值, 函数的凹凸性与拐点, 渐近线与作图, 极值与最值的实际应用
不定积分: 原函数与不定积分, 不定积分的基本公式, 换元积分法, 分部积分法, 有理函数积分, 三角函数积分, 指数与对数函数积分, 反三角函数积分
定积分: 定积分的概念, 定积分的性质, 牛顿–莱布尼茨公式, 定积分的换元与分部积分法, 定积分的几何与物理应用, 反常积分
微分方程: 一阶微分方程（可分离变量型、齐次方程、线性方程）, 高阶线性微分方程, 常系数齐次线性方程, 常系数非齐次线性方程, 微分方程的应用

【下册】
矢量代数与空间解析几何: 二阶、三阶行列式及线性方程组, 矢量概念与运算, 空间直角坐标系与矢量的坐标表示, 两矢量的数量积与矢量积, 矢量的混合积与二重矢积, 平面与直线方程, 曲面与空间曲线方程, 二次曲面
多元函数微分学: 多元函数的极限与连续性, 偏导数与全微分, 复合函数微分法, 隐函数与反函数偏导数, 场的方向导数与梯度, 多元函数的极值与应用, 偏导数的几何应用
多元函数积分学: 二重积分, 三重积分, 第一类曲线积分与第一类曲面积分, 点函数积分及应用, 第二类曲线积分与第二类曲面积分, 第二类曲线积分与格林公式, 平面曲线积分与路径无关性, 第二类曲面积分与高斯公式, 斯托克斯公式与旋度、势量场
级数: 数项级数及收敛判别, 函数项级数与一致收敛, 幂级数及泰勒展开, 傅里叶级数
含参量积分: 含参量的常义积分与反常积分, Γ函数与B函数

请严格参考以下JSON格式返回批改结果：
{
  "score": 85,
  "maxScore": 100,
  "questionCount": 3,
  "incorrectCount": 1,
  "correctCount": 2,
  "knowledgePoints": [
    "导数与微分",
    "复合函数求导",
    "洛必达法则"
  ],
  "feedback": "整体解答思路正确，显示出对微积分基本概念的良好理解。主要问题出现在计算环节，需要加强计算准确性的训练。",
  "detailedErrors": [
    {
      "questionNumber": 1,
      "line": 3,
      "content": "d/dx(x²+1) = 2x+1",
      "errorType": "计算错误",
      "correction": "d/dx(x²+1) = 2x",
      "explanation": "常数的导数为0，所以常数项1求导后应该消除",
      "severity": "major",
      "knowledgePoint": "基本导数公式"
    }
  ],
  "suggestions": [
    {
      "aspect": "计算准确性",
      "recommendation": "建议多练习基本导数公式，特别注意常数项的处理",
      "priority": "high"
    },
    {
      "aspect": "解题步骤",
      "recommendation": "可以在每一步计算后进行自检，确保每步都正确",
      "priority": "medium"
    }
  ],
  "strengths": [
    {
      "aspect": "解题思路",
      "description": "正确识别了需要使用链式法则的复合函数",
      "importance": "high"
    },
    {
      "aspect": "公式应用",
      "description": "熟练掌握了基本的求导公式",
      "importance": "medium"
    }
  ],
  "improvementAreas": [
    "计算准确性需要提升",
    "细节检查能力有待加强"
  ],
  "nextStepRecommendations": [
    "加强基础计算练习",
    "学习使用验算方法检查结果",
    "练习更复杂的复合函数求导"
  ]
}

关键要求：
1. 准确统计题目数量和错题数量
2. 精确识别涉及的微积分知识点
3. 详细分析每个错误的类型、位置和改正方法
4. 提供具体可操作的改进建议
5. 客观评价学生的优点和不足
6. 评分范围0-100，要基于答题的完整性和准确性
7. 返回格式必须是有效的JSON，不包含任何其他文字
`;

    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const result = JSON.parse(response.data.choices[0].message.content);

    return {
      score: result.score || 0,
      maxScore: result.maxScore || 100,
      feedback: result.feedback || '批改完成',
      errors: result.errors || result.detailedErrors || [],
      suggestions: result.suggestions || [],
      strengths: result.strengths || [],
      questionCount: result.questionCount || 0,
      incorrectCount: result.incorrectCount || 0,
      correctCount: result.correctCount || 0,
      knowledgePoints: result.knowledgePoints || [],
      detailedErrors: result.detailedErrors || [],
      improvementAreas: result.improvementAreas || [],
      nextStepRecommendations: result.nextStepRecommendations || [],
      raw: response.data
    };

  } catch (error) {
    console.error('Deepseek API调用失败:', error);
    
    // 返回默认批改结果
    return {
      score: 75,
      maxScore: 100,
      feedback: 'AI批改服务暂时不可用，请稍后重试。',
      errors: [],
      suggestions: ['请稍后重试AI批改功能'],
      strengths: ['成功提交了作业'],
      questionCount: 1,
      incorrectCount: 0,
      correctCount: 1,
      knowledgePoints: ['待分析'],
      detailedErrors: [],
      improvementAreas: ['暂无分析'],
      nextStepRecommendations: ['请稍后重试'],
      raw: { error: error instanceof Error ? error.message : '未知错误' }
    };
  }
}