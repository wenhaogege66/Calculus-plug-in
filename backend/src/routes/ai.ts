// Deepseek AI批改服务

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/db';
import { handleRouteError } from '../utils/error-handler';
import { sendError, successResponse } from '../utils/response-helper';

// AI批改的核心逻辑 - 导出供其他模块使用
export async function processAIGrading(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance) {
  const { submissionId, recognizedText, subject = '微积分', exerciseType = '练习题' } = request.body as any;

  if (!submissionId || !recognizedText) {
    return sendError(reply, '缺少必要参数', 400);
  }

  try {
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
      return sendError(reply, '提交记录不存在', 404);
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

    const enhancedData = {
      questionCount: gradingResult.questionCount,
      incorrectCount: gradingResult.incorrectCount,
      correctCount: gradingResult.correctCount,
      knowledgePoints: gradingResult.knowledgePoints,
      detailedErrors: gradingResult.detailedErrors,
      improvementAreas: gradingResult.improvementAreas,
      nextStepRecommendations: gradingResult.nextStepRecommendations,
      suggestions: gradingResult.suggestions,
      strengths: gradingResult.strengths
    };

    // 保存批改结果
    const aiResult = await prisma.deepseekResult.create({
      data: {
        submissionId,
        score: gradingResult.score,
        maxScore: gradingResult.maxScore,
        feedback: gradingResult.feedback,
        errors: gradingResult.errors,
        processingTime,
        rawResult: {
          ...gradingResult.raw,
          enhancedData
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

    return successResponse({
      resultId: aiResult.id,
      score: aiResult.score,
      maxScore: aiResult.maxScore,
      feedback: aiResult.feedback,
      errors: aiResult.errors,
      processingTime: aiResult.processingTime,
      questionCount: enhancedData.questionCount || 0,
      incorrectCount: enhancedData.incorrectCount || 0,
      correctCount: enhancedData.correctCount || 0,
      knowledgePoints: enhancedData.knowledgePoints || [],
      detailedErrors: enhancedData.detailedErrors || [],
      improvementAreas: enhancedData.improvementAreas || [],
      nextStepRecommendations: enhancedData.nextStepRecommendations || [],
      suggestions: enhancedData.suggestions || [],
      strengths: enhancedData.strengths || []
    });
  } catch (error) {
    // 更新提交状态为失败（忽略内部错误）
    if (submissionId) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'FAILED' }
      }).catch(() => {});
    }

    return handleRouteError(fastify, reply, error, 'AI批改处理失败', {
      details: { submissionId }
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

  // 进一步提问功能 + 通用AI搜索
  fastify.post('/ai/follow-up', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { submissionId, question } = request.body as any;
      
      if (!question || question.trim().length === 0) {
        return sendError(reply, '缺少问题内容', 400);
      }

      // 支持通用AI搜索（submissionId为0或null）
      if (!submissionId || submissionId === 0) {
        // 通用AI搜索模式
        const generalPrompt = buildGeneralSearchPrompt(question.trim());
        const response = await callDeepseekFollowUpAPI(generalPrompt);

        return successResponse({
          question: question.trim(),
          answer: response.answer,
          timestamp: new Date(),
          mode: 'general_search'
        });
      }

      // 基于提交记录的进一步提问模式
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId: request.currentUser!.id
        },
        include: {
          mathpixResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          deepseekResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      // 如果有关联作业，获取作业信息
      let assignmentInfo = null;
      if (submission?.assignmentId) {
        assignmentInfo = await prisma.assignment.findUnique({
          where: { id: submission.assignmentId },
          select: {
            title: true,
            ocrText: true
          }
        });
      }

      if (!submission) {
        return sendError(reply, '提交记录不存在', 404);
      }

      const latestOCR = submission.mathpixResults[0];
      const latestGrading = submission.deepseekResults[0];

      if (!latestOCR || !latestGrading) {
        return sendError(reply, '缺少OCR识别或AI批改结果', 400);
      }

      const gradingEnhancedData = (latestGrading.rawResult as any)?.enhancedData || {};

      // 构建问答prompt
      const followUpPrompt = buildFollowUpPrompt(
        assignmentInfo?.ocrText || null,
        latestOCR.recognizedText || '',
        latestGrading.feedback || '',
        gradingEnhancedData.suggestions ? JSON.stringify(gradingEnhancedData.suggestions) : '',
        question.trim()
      );

      // 调用Deepseek API
      const response = await callDeepseekFollowUpAPI(followUpPrompt);

      return successResponse({
        question: question.trim(),
        answer: response.answer,
        timestamp: new Date(),
        mode: 'submission_based'
      });

    } catch (error) {
      return handleRouteError(fastify, reply, error, '处理提问请求失败');
    }
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
        return sendError(reply, '提交记录不存在', 404);
      }

      // 获取批改结果
      const aiResults = await prisma.deepseekResult.findMany({
        where: { submissionId: submissionId },
        orderBy: { createdAt: 'desc' }
      });

      const normalizedResults = aiResults.map(result => {
        const enhancedData = (result.rawResult as any)?.enhancedData || {};
        return {
          ...result,
          suggestions: enhancedData.suggestions || [],
          strengths: enhancedData.strengths || [],
          improvementAreas: enhancedData.improvementAreas || [],
          nextStepRecommendations: enhancedData.nextStepRecommendations || []
        };
      });

      return successResponse({ results: normalizedResults });

    } catch (error) {
      return handleRouteError(fastify, reply, error, '获取AI批改结果失败');
    }
  });
}

// Deepseek API重试辅助函数
async function callDeepseekAPIWithRetry(
  payload: any,
  apiKey: string,
  maxRetries: number = 2
): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();

      const response = await axios.post('https://api.deepseek.com/chat/completions', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 180000 // 3分钟超时
      });

      const duration = Date.now() - startTime;

      return response;
    } catch (error: any) {
      const isTimeout =
        error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED';
      const isNetworkError = error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED';

      if (attempt < maxRetries && (isTimeout || isNetworkError)) {
        const waitTime = Math.pow(2, attempt + 1) * 1000; // 指数退避: 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      throw error;
    }
  }

  throw new Error('重试次数已用尽');
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
  const apiKey = process.env.DEEPSEEK_API_KEY;

  try {
    if (!apiKey) {
      throw new Error('Deepseek API密钥未配置');
    }

    // 根据模式构建不同的prompt
    const isAssignmentMode = teacherQuestionText !== null;
    const prompt = isAssignmentMode ?
      buildAssignmentModePrompt(subject, teacherQuestionText || null, teacherQuestionLatex || null, text) :
      buildPracticeModePrompt(subject, text);


    const payload = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    };

    // 使用重试机制调用API
    const response = await callDeepseekAPIWithRetry(payload, apiKey, 2);

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
    console.error('[Deepseek] 调用失败', {
      message: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any)?.code,
      apiKey: apiKey ? '已配置' : '未配置'
    });

    // 直接抛出错误，不返回默认分数，避免误导用户
    throw new Error(
      `AI批改服务暂时不可用: ${error instanceof Error ? error.message : '未知错误'}。请稍后重试或联系管理员: 3220104512@zju.edu.cn`
    );
  }
}

// 作业模式prompt - 简化版，专注错误定位
function buildAssignmentModePrompt(
  subject: string,
  teacherQuestionText: string | null,
  teacherQuestionLatex: string | null,
  studentAnswerText: string
): string {
  const questionSection = teacherQuestionText ? `
题目内容：
${teacherQuestionText}
${teacherQuestionLatex ? `
LaTeX格式：
${teacherQuestionLatex}
` : ''}` : '';

  return `
你是一位资深的${subject}教师，请精准批改学生作业，重点标注错误位置。

【作业模式 - 题目与解答分离】
${questionSection}

学生提交的解答内容：
${studentAnswerText}

批改要求：
1. 精准评分（0-100分），基于解答的完整性和正确性
2. 准确统计题目数量、答对数量、答错数量
3. 识别涉及的微积分知识点（从下方列表中选择）
4. **核心任务**：精确标注每个错误的位置（行号、起始字符、结束字符）
5. 对每个错误给出：错误类型、正确答案、简短解释
6. feedback简洁明了，指出主要问题即可

${getKnowledgePointsSection()}

${getJsonFormatSection()}

关键要求：
1. 必须返回有效的JSON格式，不包含其他文字
2. detailedErrors是核心，必须精确标注line、startChar、endChar
3. feedback要简洁，不要冗长的说教
4. 不要返回suggestions、strengths、improvementAreas、nextStepRecommendations等冗余字段
`;
}

// 练习模式prompt - 简化版，专注错误定位
function buildPracticeModePrompt(subject: string, contentText: string): string {
  return `
你是一位资深的${subject}教师，请精准批改学生练习，重点标注错误位置。

【练习模式 - 题目与解答一体】
以下内容包含题目和学生解答，请识别并批改：

练习内容：
${contentText}

批改要求：
1. 识别题目和解答内容
2. 精准评分（0-100分），基于解答的完整性和正确性
3. 准确统计题目数量、答对数量、答错数量
4. 识别涉及的微积分知识点（从下方列表中选择）
5. **核心任务**：精确标注每个错误的位置（行号、起始字符、结束字符）
6. 对每个错误给出：错误类型、正确答案、简短解释
7. feedback简洁明了，指出主要问题即可

${getKnowledgePointsSection()}

${getJsonFormatSection()}

关键要求：
1. 必须返回有效的JSON格式，不包含其他文字
2. detailedErrors是核心，必须精确标注line、startChar、endChar
3. feedback要一语见地
`;
}

// 知识点选择范围 - 公共部分
function getKnowledgePointsSection(): string {
  return `
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
`;
}

// JSON格式示例 - 公共部分（简化版，专注错误定位）
function getJsonFormatSection(): string {
  return `
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
  "feedback": "整体解答思路正确，主要问题出现在第1题第3行的导数计算中。",
  "detailedErrors": [
    {
      "questionNumber": 1,
      "line": 3,
      "startChar": 0,
      "endChar": 20,
      "content": "d/dx(x²+1) = 2x+1",
      "errorType": "计算错误",
      "correction": "d/dx(x²+1) = 2x",
      "explanation": "常数的导数为0，常数项1求导后应该消除",
      "severity": "major",
      "knowledgePoint": "基本导数公式"
    }
  ]
}

重要说明：
1. detailedErrors是核心，必须精确标注每个错误的位置
2. line: 错误所在行号（从1开始）
3. startChar: 错误内容在该行的起始字符位置（从0开始）
4. endChar: 错误内容在该行的结束字符位置（不含）
5. feedback要简洁明了，指出主要问题即可
`;
}

// 构建通用AI搜索的prompt
function buildGeneralSearchPrompt(userQuestion: string): string {
  // 检测用户问题的类型
  const casualGreetings = ['你好', '您好', 'hello', 'hi', '嗨', '谢谢', '感谢', '再见', 'bye'];
  const isSimpleCasualMessage = casualGreetings.some(greeting => 
    userQuestion.toLowerCase().trim().includes(greeting.toLowerCase())
  ) && userQuestion.trim().length <= 10;

  // 检测是否包含数学相关词汇
  const mathKeywords = ['公式', '定理', '微积分', '极限', '导数', '积分', '函数', '求导', '计算', '解法', '方法', '为什么', '怎么', '如何'];
  const isMathRelated = mathKeywords.some(keyword => userQuestion.includes(keyword));

  // 如果是简单的问候或感谢，不需要大量上下文
  if (isSimpleCasualMessage && !isMathRelated) {
    return `
你是一位友善的微积分教师，学生向你说了："${userQuestion}"

请给出自然、友善的回应，保持简短和亲切。如果学生需要数学帮助，可以鼓励他们具体提问。

要求：
1. 回应要自然、亲切
2. 不要主动解释数学问题
3. 保持简短，1-2句话即可`;
  }

  // 对于数学相关问题，提供专业的微积分教学指导
  return `
你是一位资深的微积分教师和AI学习助手，学生向你提出了以下问题：

学生的问题：
${userQuestion}

请基于微积分教学知识为学生提供准确、详细、易懂的回答。要求：

1. 回答要准确、清晰、有针对性
2. 如果涉及数学概念，请结合具体的公式和例子进行解释
3. 如果是计算问题，请给出详细的解题步骤
4. 语言要通俗易懂，适合学生理解
5. 可以适当拓展相关知识点，但不要偏离主题
6. 如果问题不明确，可以要求学生提供更多信息

知识范围包括但不限于：
- 函数与极限：极限的概念、计算、连续性
- 导数：导数定义、求导法则、导数应用
- 积分：不定积分、定积分、积分应用
- 微分方程：一阶微分方程、高阶线性微分方程
- 多元函数：偏导数、多重积分、场论初步

请直接回答问题，不需要特殊格式。
`;
}

// 构建进一步提问的prompt
function buildFollowUpPrompt(
  originalQuestion: string | null,
  studentAnswer: string,
  previousFeedback: string,
  previousSuggestions: string,
  userQuestion: string
): string {
  // 检测用户问题的类型
  const casualGreetings = ['你好', '您好', 'hello', 'hi', '嗨', '谢谢', '感谢', '再见', 'bye'];
  const isSimpleCasualMessage = casualGreetings.some(greeting => 
    userQuestion.toLowerCase().trim().includes(greeting.toLowerCase())
  ) && userQuestion.trim().length <= 10;

  // 检测是否包含数学相关词汇
  const mathKeywords = ['公式', '定理', '微积分', '极限', '导数', '积分', '函数', '求导', '计算', '解法', '方法', '为什么', '怎么', '如何'];
  const isMathRelated = mathKeywords.some(keyword => userQuestion.includes(keyword));

  // 如果是简单的问候或感谢，不需要大量上下文
  if (isSimpleCasualMessage && !isMathRelated) {
    return `
你是一位友善的微积分教师，学生向你说了："${userQuestion}"

请给出自然、友善的回应，保持简短和亲切。如果学生需要数学帮助，可以鼓励他们具体提问。

要求：
1. 回应要自然、亲切
2. 保持简短，1-2句话即可`;
  }

  // 对于数学相关问题，提供完整上下文
  const questionSection = originalQuestion ? `
原题目内容：
${originalQuestion}
` : '';

  return `
你是一位资深的微积分教师，学生基于之前的批改结果向你提出了进一步的问题。请结合相关信息给出清晰、有帮助的回答。

${questionSection}
学生的解答：
${studentAnswer}

之前的批改反馈：
${previousFeedback}

之前的改进建议：
${previousSuggestions}

学生的问题：
${userQuestion}

请回答学生的问题，要求：
1. 回答要准确、清晰、有针对性
2. 如果问题与题目相关，结合具体的数学概念和公式进行解释
3. 如果问题比较一般化，可以适当简化回答
4. 如果涉及计算错误，请给出正确的步骤
5. 语言要通俗易懂，适合学生理解

请直接回答问题，不需要特殊格式。
`;
}

// 调用Deepseek API进行问答
async function callDeepseekFollowUpAPI(prompt: string): Promise<{ answer: string }> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      throw new Error('Deepseek API密钥未配置');
    }

    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const answer = response.data.choices[0].message.content;

    return {
      answer: answer || '抱歉，无法生成回答，请重试。'
    };

  } catch (error) {
    
    return {
      answer: '抱歉，AI助手暂时不可用，请稍后重试。如果问题持续存在，请联系老师获得帮助。'
    };
  }
}
