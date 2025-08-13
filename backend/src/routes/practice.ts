// 练习模式API路由
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import axios from 'axios';

const prisma = new PrismaClient();

const practiceRoutes: FastifyPluginAsync = async (fastify) => {
  // 获取练习历史记录
  fastify.get('/practice/history', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      
      // 获取用户的练习提交记录
      const practiceSubmissions = await prisma.submission.findMany({
        where: {
          userId: userId,
          workMode: 'practice'
        },
        include: {
          fileUpload: {
            select: {
              id: true,
              originalName: true,
              fileSize: true,
              mimeType: true
            }
          },
          mathpixResults: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              recognizedText: true,
              confidence: true,
              processingTime: true,
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
              suggestions: true,
              strengths: true,
              processingTime: true,
              createdAt: true,
              rawResult: true
            }
          }
        },
        orderBy: { submittedAt: 'desc' },
        take: 20 // 最近20次练习
      });

      // 转换为前端期望的格式
      const practiceHistory = practiceSubmissions.map(submission => {
        const latestOCR = submission.mathpixResults[0];
        const latestGrading = submission.deepseekResults[0];
        
        // 确定练习难度（基于AI评分结果）
        let difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM';
        if (latestGrading && latestGrading.score !== null && latestGrading.maxScore) {
          const percentage = (latestGrading.score / latestGrading.maxScore) * 100;
          if (percentage >= 85) {
            difficulty = 'EASY';
          } else if (percentage < 60) {
            difficulty = 'HARD';
          }
        }

        // 处理建议和优点数组转换为字符串
        const suggestions = latestGrading?.suggestions;
        const strengths = latestGrading?.strengths;
        
        const suggestionsText = suggestions ? (
          Array.isArray(suggestions) 
            ? suggestions.map((s: any) => 
                typeof s === 'string' ? s : `${s.aspect || '建议'}: ${s.recommendation || s.description || s}`
              ).join('; ')
            : suggestions.toString()
        ) : undefined;

        // 从rawResult中提取增强数据和基础统计数据
        const enhancedData = (latestGrading?.rawResult as any)?.enhancedData || {};
        const rawResult = latestGrading?.rawResult as any || {};
        
        // 智能提取统计数据 - 从多个可能的来源
        const questionCount = enhancedData.questionCount || 
                             rawResult.questionCount || 
                             (rawResult.analysis?.questionCount) || 
                             (latestGrading?.suggestions as any)?.length || 0;
        
        const correctCount = enhancedData.correctCount || 
                            rawResult.correctCount || 
                            (rawResult.analysis?.correctCount) || 0;
        
        const incorrectCount = enhancedData.incorrectCount || 
                              rawResult.incorrectCount || 
                              (rawResult.analysis?.incorrectCount) || 0;
        
        // 智能提取知识点
        const knowledgePoints = enhancedData.knowledgePoints || 
                               rawResult.knowledgePoints || 
                               (rawResult.analysis?.knowledgePoints) || 
                               [];
        
        // 截取OCR文本用于预览（前200字符）
        const ocrPreview = latestOCR?.recognizedText ? 
          (latestOCR.recognizedText.length > 200 ? 
            latestOCR.recognizedText.substring(0, 200) + '...' : 
            latestOCR.recognizedText) : undefined;
        
        return {
          id: submission.id.toString(),
          originalName: submission.fileUpload.originalName,
          uploadedAt: submission.submittedAt.toISOString(),
          status: submission.status,
          score: latestGrading?.score || undefined,
          feedback: latestGrading?.feedback || undefined,
          suggestions: suggestionsText,
          ocrText: ocrPreview, // 使用截取后的预览文本
          difficulty: difficulty,
          // 优化的结构化信息
          questionCount: questionCount,
          incorrectCount: incorrectCount,
          correctCount: correctCount,
          knowledgePoints: knowledgePoints,
          detailedErrors: enhancedData.detailedErrors || [],
          improvementAreas: enhancedData.improvementAreas || [],
          nextStepRecommendations: enhancedData.nextStepRecommendations || []
        };
      });

      return {
        success: true,
        data: practiceHistory
      };
    } catch (error) {
      fastify.log.error('获取练习历史失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取练习历史失败'
      });
    }
  });

  // 创建练习会话 
  fastify.post('/practice', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const { fileUploadId, practiceType } = request.body as {
        fileUploadId: number;
        practiceType?: string;
      };

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
          userId: userId
        }
      });

      if (!fileUpload) {
        return reply.code(404).send({
          success: false,
          error: '文件不存在或无权限'
        });
      }

      // 创建练习提交记录
      const practiceSubmission = await prisma.submission.create({
        data: {
          userId: userId,
          fileUploadId: fileUploadId,
          workMode: 'practice',
          status: 'UPLOADED'
        }
      });

      // 异步启动练习处理流程（OCR + AI批改）
      startPracticeProcessing(practiceSubmission.id, fastify)
        .then(() => {
          fastify.log.info(`练习处理完成: submissionId=${practiceSubmission.id}`);
        })
        .catch((error) => {
          fastify.log.error(`练习处理失败: submissionId=${practiceSubmission.id}`, error);
        });

      return {
        success: true,
        data: {
          sessionId: practiceSubmission.id,
          status: practiceSubmission.status,
          originalName: fileUpload.originalName,
          createdAt: practiceSubmission.submittedAt
        }
      };
    } catch (error) {
      fastify.log.error('创建练习会话失败:', error);
      return reply.code(500).send({
        success: false,
        error: '创建练习会话失败'
      });
    }
  });

  // 获取练习会话状态
  fastify.get('/practice/:sessionId/status', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const sessionId = parseInt((request.params as any).sessionId);

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: '无效的会话ID'
        });
      }

      // 获取练习会话详情
      const practiceSession = await prisma.submission.findFirst({
        where: {
          id: sessionId,
          userId: userId,
          workMode: 'practice'
        },
        include: {
          fileUpload: {
            select: {
              originalName: true,
              fileSize: true,
              mimeType: true
            }
          },
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

      if (!practiceSession) {
        return reply.code(404).send({
          success: false,
          error: '练习会话不存在'
        });
      }

      // 增强的进度计算
      let progress = 0;
      let stage = 'uploading';
      let message = '正在上传文件...';

      const latestOCR = practiceSession.mathpixResults[0];
      const latestGrading = practiceSession.deepseekResults[0];

      // 检查OCR进度
      if (practiceSession.status === 'PROCESSING') {
        if (!latestOCR) {
          progress = 25;
          stage = 'ocr_processing';
          message = '正在进行OCR识别...';
        } else {
          // OCR已完成，检查AI进度
          progress = 60;
          stage = 'ai_processing';
          message = '正在AI批改...';
          
          if (latestGrading) {
            progress = 100;
            stage = 'completed';
            message = '练习批改完成';
          }
        }
      } else if (practiceSession.status === 'COMPLETED') {
        progress = 100;
        stage = 'completed';
        message = '练习批改完成';
      } else if (practiceSession.status === 'FAILED') {
        progress = 0;
        stage = 'failed';
        message = '处理失败，请重试';
      } else {
        progress = 10;
        stage = 'uploading';
        message = '文件已上传，等待处理...';
      }

      return {
        success: true,
        data: {
          sessionId: practiceSession.id,
          status: practiceSession.status,
          progress: {
            percent: progress,
            stage: stage,
            message: message
          },
          fileInfo: practiceSession.fileUpload,
          ocrResult: latestOCR ? {
            recognizedText: latestOCR.recognizedText,
            confidence: latestOCR.confidence
          } : null,
          gradingResult: latestGrading ? {
            score: latestGrading.score,
            maxScore: latestGrading.maxScore,
            feedback: latestGrading.feedback,
            suggestions: latestGrading.suggestions,
            strengths: latestGrading.strengths,
            // 新增的结构化信息
            ...(((latestGrading.rawResult as any)?.enhancedData) && {
              questionCount: (latestGrading.rawResult as any).enhancedData.questionCount,
              incorrectCount: (latestGrading.rawResult as any).enhancedData.incorrectCount,
              correctCount: (latestGrading.rawResult as any).enhancedData.correctCount,
              knowledgePoints: (latestGrading.rawResult as any).enhancedData.knowledgePoints,
              detailedErrors: (latestGrading.rawResult as any).enhancedData.detailedErrors,
              improvementAreas: (latestGrading.rawResult as any).enhancedData.improvementAreas,
              nextStepRecommendations: (latestGrading.rawResult as any).enhancedData.nextStepRecommendations
            })
          } : null,
          submittedAt: practiceSession.submittedAt,
          completedAt: practiceSession.completedAt
        }
      };
    } catch (error) {
      fastify.log.error('获取练习状态失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取练习状态失败'
      });
    }
  });

  // AI生成类似题 - 基于练习错题
  fastify.post('/practice/:sessionId/generate-similar', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const sessionId = parseInt((request.params as any).sessionId);
      const { difficultyLevel, questionCount } = request.body as {
        difficultyLevel?: number; // 1-5，默认与原题相同
        questionCount?: number;   // 生成题目数量，默认3
      };

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: '无效的练习ID'
        });
      }

      // 获取原练习的详细信息
      const originalSubmission = await prisma.submission.findFirst({
        where: {
          id: sessionId,
          userId: userId,
          workMode: 'practice'
        },
        include: {
          mathpixResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
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
      });

      if (!originalSubmission) {
        return reply.code(404).send({
          success: false,
          error: '原练习记录不存在'
        });
      }

      const latestOCR = originalSubmission.mathpixResults[0];
      const latestGrading = originalSubmission.deepseekResults[0];

      if (!latestOCR?.recognizedText || !latestGrading) {
        return reply.code(400).send({
          success: false,
          error: '原练习缺少OCR识别结果或AI评分，无法生成类似题'
        });
      }

      // 分析错误知识点
      const errorKnowledgePoints = originalSubmission.errorAnalysis.map(error => ({
        name: error.knowledgePoint?.name || '未分类',
        errorType: error.errorType,
        description: error.errorDescription
      }));

      // 调用AI生成类似题
      const similarQuestions = await generateSimilarQuestions({
        originalText: latestOCR.recognizedText,
        score: latestGrading.score || 0,
        errorAnalysis: errorKnowledgePoints,
        difficultyLevel: difficultyLevel || 3,
        questionCount: questionCount || 3,
        subject: '微积分'
      });

      // 保存生成的类似题到数据库
      const savedQuestions = await Promise.all(
        similarQuestions.map(async (question: any) => {
          // 创建类似题记录
          const similarQuestion = await prisma.similarQuestion.create({
            data: {
              originalSubmissionId: sessionId,
              generatedContent: question.content,
              standardAnswer: question.standardAnswer,
              difficultyLevel: question.difficultyLevel,
              generationPrompt: question.prompt,
              isCompleted: false
            }
          });

          // 关联知识点
          if (question.knowledgePoints && question.knowledgePoints.length > 0) {
            // 查找或创建知识点
            for (const kpName of question.knowledgePoints) {
              let knowledgePoint = await prisma.knowledgePoint.findFirst({
                where: { name: kpName }
              });

              if (!knowledgePoint) {
                // 创建新知识点
                knowledgePoint = await prisma.knowledgePoint.create({
                  data: {
                    name: kpName,
                    chapter: '微积分基础', // 默认章节
                    level: 3, // 概念点级别
                    keywords: [kpName],
                    functionExamples: [],
                    difficultyLevel: question.difficultyLevel
                  }
                });
              }

              // 创建关联关系
              await prisma.similarQuestionKnowledgePoint.create({
                data: {
                  similarQuestionId: similarQuestion.id,
                  knowledgePointId: knowledgePoint.id
                }
              });
            }
          }

          return {
            id: similarQuestion.id,
            content: similarQuestion.generatedContent,
            standardAnswer: similarQuestion.standardAnswer,
            difficultyLevel: similarQuestion.difficultyLevel,
            knowledgePoints: question.knowledgePoints || []
          };
        })
      );

      return {
        success: true,
        data: {
          originalSubmissionId: sessionId,
          generatedQuestions: savedQuestions,
          generatedAt: new Date().toISOString(),
          analysisBase: {
            originalScore: latestGrading.score,
            errorKnowledgePoints: errorKnowledgePoints,
            targetDifficulty: difficultyLevel || 3
          }
        }
      };

    } catch (error) {
      fastify.log.error('生成类似题失败:', error);
      return reply.code(500).send({
        success: false,
        error: '生成类似题失败'
      });
    }
  });

  // 获取用户的类似题列表
  fastify.get('/practice/similar-questions', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      
      const similarQuestions = await prisma.similarQuestion.findMany({
        where: {
          originalSubmission: {
            userId: userId
          }
        },
        include: {
          originalSubmission: {
            select: {
              id: true,
              submittedAt: true,
              fileUpload: {
                select: {
                  originalName: true
                }
              }
            }
          },
          knowledgePointRelations: {
            include: {
              knowledgePoint: {
                select: {
                  id: true,
                  name: true,
                  chapter: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const formattedQuestions = similarQuestions.map(sq => ({
        id: sq.id,
        content: sq.generatedContent,
        standardAnswer: sq.standardAnswer,
        difficultyLevel: sq.difficultyLevel,
        isCompleted: sq.isCompleted,
        userAnswer: sq.userAnswer,
        userRating: sq.userRating,
        createdAt: sq.createdAt,
        knowledgePoints: sq.knowledgePointRelations.map(rel => ({
          id: rel.knowledgePoint.id,
          name: rel.knowledgePoint.name,
          chapter: rel.knowledgePoint.chapter
        })),
        originalPractice: {
          id: sq.originalSubmission.id,
          fileName: sq.originalSubmission.fileUpload.originalName,
          practiceDate: sq.originalSubmission.submittedAt
        },
        aiGradingResult: sq.aiGradingResult
      }));

      return {
        success: true,
        data: formattedQuestions
      };

    } catch (error) {
      fastify.log.error('获取类似题列表失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取类似题列表失败'
      });
    }
  });

  // 提交类似题答案并获得AI评分
  fastify.post('/practice/similar-questions/:questionId/submit', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const questionId = parseInt((request.params as any).questionId);
      const { userAnswer, requestFeedback } = request.body as {
        userAnswer: string;
        requestFeedback?: boolean;
      };

      if (!questionId || !userAnswer) {
        return reply.code(400).send({
          success: false,
          error: '缺少题目ID或用户答案'
        });
      }

      // 验证类似题是否属于当前用户
      const similarQuestion = await prisma.similarQuestion.findFirst({
        where: {
          id: questionId,
          originalSubmission: {
            userId: userId
          }
        },
        include: {
          knowledgePointRelations: {
            include: {
              knowledgePoint: true
            }
          }
        }
      });

      if (!similarQuestion) {
        return reply.code(404).send({
          success: false,
          error: '类似题不存在或无权限访问'
        });
      }

      // 如果请求AI反馈，调用AI评分
      let aiGradingResult = null;
      if (requestFeedback) {
        aiGradingResult = await gradeSimilarQuestion({
          questionContent: similarQuestion.generatedContent,
          standardAnswer: similarQuestion.standardAnswer || '',
          userAnswer: userAnswer,
          knowledgePoints: similarQuestion.knowledgePointRelations.map(rel => rel.knowledgePoint.name),
          difficultyLevel: similarQuestion.difficultyLevel
        });
      }

      // 更新类似题记录
      const updatedQuestion = await prisma.similarQuestion.update({
        where: { id: questionId },
        data: {
          userAnswer: userAnswer,
          isCompleted: true,
          aiGradingResult: aiGradingResult || undefined
        }
      });

      return {
        success: true,
        data: {
          questionId: updatedQuestion.id,
          submitted: true,
          userAnswer: updatedQuestion.userAnswer,
          aiGradingResult: updatedQuestion.aiGradingResult,
          completedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      fastify.log.error('提交类似题答案失败:', error);
      return reply.code(500).send({
        success: false,
        error: '提交答案失败'
      });
    }
  });

  // 用户评分类似题质量
  fastify.post('/practice/similar-questions/:questionId/rate', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const questionId = parseInt((request.params as any).questionId);
      const { rating, feedback } = request.body as {
        rating: number; // 1-5分
        feedback?: string;
      };

      if (!questionId || !rating || rating < 1 || rating > 5) {
        return reply.code(400).send({
          success: false,
          error: '缺少题目ID或评分无效（应为1-5分）'
        });
      }

      // 验证类似题是否属于当前用户
      const similarQuestion = await prisma.similarQuestion.findFirst({
        where: {
          id: questionId,
          originalSubmission: {
            userId: userId
          }
        }
      });

      if (!similarQuestion) {
        return reply.code(404).send({
          success: false,
          error: '类似题不存在或无权限访问'
        });
      }

      // 更新评分
      await prisma.similarQuestion.update({
        where: { id: questionId },
        data: {
          userRating: rating,
          // 可以将feedback存储在metadata中
          ...(feedback && {
            aiGradingResult: {
              ...(similarQuestion.aiGradingResult as any || {}),
              userFeedback: feedback
            }
          })
        }
      });

      return {
        success: true,
        data: {
          questionId: questionId,
          rating: rating,
          feedback: feedback || null,
          message: '评分已保存，感谢您的反馈！'
        }
      };

    } catch (error) {
      fastify.log.error('评分类似题失败:', error);
      return reply.code(500).send({
        success: false,
        error: '保存评分失败'
      });
    }
  });

  // 删除练习记录
  fastify.delete('/practice/:sessionId', { 
    preHandler: requireAuth 
  }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const sessionId = parseInt((request.params as any).sessionId);

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: '无效的会话ID'
        });
      }

      // 验证练习记录是否属于当前用户
      const practiceSession = await prisma.submission.findFirst({
        where: {
          id: sessionId,
          userId: userId,
          workMode: 'practice'
        },
        include: {
          fileUpload: true
        }
      });

      if (!practiceSession) {
        return reply.code(404).send({
          success: false,
          error: '练习记录不存在或无权限删除'
        });
      }

      // 删除关联的数据（级联删除应该自动处理 MathPixResult 和 DeepseekResult）
      await prisma.submission.delete({
        where: { id: sessionId }
      });

      // 如果需要，也可以删除文件上传记录（但要小心，因为可能被其他地方引用）
      // 这里我们暂时保留文件上传记录，只删除提交记录

      fastify.log.info(`练习记录已删除: sessionId=${sessionId}, userId=${userId}`);

      return {
        success: true,
        message: '练习记录已删除'
      };

    } catch (error) {
      fastify.log.error('删除练习记录失败:', error);
      return reply.code(500).send({
        success: false,
        error: '删除练习记录失败'
      });
    }
  });
};

// 练习处理流程（OCR + AI批改）
async function startPracticeProcessing(submissionId: number, fastify: any) {
  try {
    fastify.log.info(`🎯 开始练习处理流程 - submissionId: ${submissionId}`);

    // 1. OCR识别 - 使用内部调用header
    let ocrResult: any = null;
    try {
      const ocrResponse = await fetch(`http://localhost:3000/api/ocr/mathpix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-call': 'true' // 标识内部调用，跳过认证
        },
        body: JSON.stringify({
          submissionId: submissionId
        })
      });

      if (!ocrResponse.ok) {
        const errorText = await ocrResponse.text();
        fastify.log.error(`OCR API调用失败: ${ocrResponse.status} - ${errorText}`);
        ocrResult = { success: false, error: errorText };
      } else {
        ocrResult = await ocrResponse.json();
      }

      fastify.log.info(`✅ OCR识别完成:`, {
        submissionId,
        success: ocrResult?.success,
        hasText: !!ocrResult?.data?.recognizedText,
        confidence: ocrResult?.data?.confidence
      });
    } catch (error) {
      fastify.log.error(`OCR识别过程异常:`, error);
      ocrResult = { success: false, error: '网络连接失败' };
    }

    // 2. AI批改
    if (ocrResult?.success && ocrResult.data?.recognizedText) {
      try {
        const aiResponse = await fetch(`http://localhost:3000/api/ai/grade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-call': 'true' // 标识内部调用，跳过认证
          },
          body: JSON.stringify({
            submissionId: submissionId,
            recognizedText: ocrResult.data.recognizedText,
            subject: '微积分',
            exerciseType: '自主练习',
            context: {
              mode: 'practice',
              maxScore: 100,
              rubric: '根据解题步骤、方法正确性和计算准确性进行评分'
            }
          })
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          fastify.log.error(`AI批改失败: ${aiResponse.status} - ${errorText}`);
        } else {
          const aiResult = await aiResponse.json() as any;
          fastify.log.info(`✅ AI批改完成:`, {
            submissionId,
            score: aiResult.data?.score,
            maxScore: aiResult.data?.maxScore
          });

          // 3. 如果批改完成且分数较低，自动进行错题分析
          if (aiResult.data?.score !== null && aiResult.data.score < 80) {
            try {
              await performErrorAnalysis(submissionId, {
                recognizedText: ocrResult.data.recognizedText,
                gradingResult: aiResult.data,
                fastify: fastify
              });
              fastify.log.info(`✅ 错题分析完成: submissionId=${submissionId}`);
            } catch (errorAnalysisError) {
              fastify.log.error(`⚠️ 错题分析失败 (不影响主流程): submissionId=${submissionId}`, errorAnalysisError);
            }
          }
        }
      } catch (error) {
        fastify.log.error(`AI批改过程异常:`, error);
      }
    } else {
      fastify.log.warn(`跳过AI批改: OCR识别未成功或无文本内容`, {
        submissionId,
        ocrSuccess: ocrResult?.success,
        hasText: !!ocrResult?.data?.recognizedText
      });
    }

    // 3. 更新提交状态
    await prisma.submission.update({
      where: { id: submissionId },
      data: { 
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    fastify.log.info(`🎉 练习处理流程完成 - submissionId: ${submissionId}`);

  } catch (error) {
    fastify.log.error(`❌ 练习处理流程失败 - submissionId: ${submissionId}`, error);
    
    // 更新提交状态为失败
    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'FAILED' }
      });
    } catch (updateError) {
      fastify.log.error(`❌ 更新提交状态失败 - submissionId: ${submissionId}`, updateError);
    }
  }
}

// AI生成类似题的辅助函数
async function generateSimilarQuestions(params: {
  originalText: string;
  score: number;
  errorAnalysis: Array<{ name: string; errorType: string; description: string }>;
  difficultyLevel: number;
  questionCount: number;
  subject: string;
}) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('Deepseek API密钥未配置');
    }

    const { originalText, score, errorAnalysis, difficultyLevel, questionCount, subject } = params;

    const prompt = `
你是一位资深的微积分教师，需要基于学生的练习情况生成针对性的类似题目。

原题内容：
${originalText}

学生表现分析：
- 原题得分：${score}分
- 错误分析：${JSON.stringify(errorAnalysis, null, 2)}

生成要求：
- 学科：${subject}
- 题目数量：${questionCount}道
- 难度等级：${difficultyLevel}/5 (1=最简单，5=最困难)
- 重点加强学生的薄弱环节

请为每道题生成：
1. content: 题目内容（包含完整的数学表达式，使用LaTeX格式）
2. standardAnswer: 标准答案和解题步骤
3. difficultyLevel: 实际难度等级
4. knowledgePoints: 涉及的知识点数组
5. prompt: 生成时使用的思路说明

返回JSON格式：
{
  "questions": [
    {
      "content": "求函数 $f(x) = x^2 + 2x + 1$ 在区间 $[0, 2]$ 上的最大值。",
      "standardAnswer": "解：首先求导数 $f'(x) = 2x + 2$，令其为0得到驻点...",
      "difficultyLevel": 3,
      "knowledgePoints": ["导数", "函数极值", "最值问题"],
      "prompt": "基于学生在导数应用方面的错误，生成一道关于求最值的题目"
    }
  ]
}

注意：
- 题目要与原题知识点相关但不完全相同
- 根据错误分析调整题目难度和考查重点
- 答案要详细包含解题步骤
- 使用标准的数学LaTeX符号`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.8 // 稍高的温度以增加创造性
      })
    });

    if (!response.ok) {
      throw new Error(`AI API调用失败: ${response.status}`);
    }

    const result = await response.json();
    const parsed = JSON.parse(result.choices[0].message.content);

    // 为每个题目添加生成提示信息
    const questions = (parsed.questions || []).map((q: any) => ({
      ...q,
      prompt: q.prompt || `基于原题(得分${score})的错误分析生成，难度${difficultyLevel}/5`
    }));

    return questions;
  } catch (error) {
    console.error('AI生成类似题失败:', error);
    // 返回备用题目
    return [{
      content: '求函数 $f(x) = x^3 - 3x + 1$ 的导数，并求其极值点。',
      standardAnswer: '解：$f\'(x) = 3x^2 - 3 = 3(x^2 - 1) = 3(x-1)(x+1)$\n令$f\'(x) = 0$，得$x = ±1$\n当$x < -1$时，$f\'(x) > 0$；当$-1 < x < 1$时，$f\'(x) < 0$；当$x > 1$时，$f\'(x) > 0$\n所以$x = -1$是极大值点，$x = 1$是极小值点',
      difficultyLevel: params.difficultyLevel,
      knowledgePoints: ['导数', '极值'],
      prompt: '基于原练习错误生成的备用题目'
    }];
  }
}

// AI评分类似题的辅助函数
async function gradeSimilarQuestion(params: {
  questionContent: string;
  standardAnswer: string;
  userAnswer: string;
  knowledgePoints: string[];
  difficultyLevel: number;
}) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('Deepseek API密钥未配置');
    }

    const { questionContent, standardAnswer, userAnswer, knowledgePoints, difficultyLevel } = params;

    const prompt = `
你是一位微积分教师，需要评分学生对类似题的回答。

题目：${questionContent}

标准答案：${standardAnswer}

学生答案：${userAnswer}

涉及知识点：${knowledgePoints.join(', ')}
题目难度：${difficultyLevel}/5

请按以下标准评分：
1. 解题思路正确性 (40%)
2. 计算过程准确性 (30%)  
3. 答案正确性 (20%)
4. 步骤完整性 (10%)

返回JSON格式评分结果：
{
  "score": 85,
  "maxScore": 100,
  "feedback": "解题思路正确，但在第二步计算中有小错误...",
  "strengths": ["思路清晰", "步骤完整"],
  "improvements": ["计算准确性需提高", "注意符号处理"],
  "detailedAnalysis": {
    "methodScore": 35,
    "calculationScore": 22,
    "answerScore": 18,
    "completenessScore": 10
  },
  "nextRecommendations": ["多练习类似的计算题", "注意验证答案的合理性"]
}`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3 // 较低温度保证评分一致性
      })
    });

    if (!response.ok) {
      throw new Error(`AI评分API调用失败: ${response.status}`);
    }

    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
  } catch (error) {
    console.error('AI评分失败:', error);
    // 返回默认评分
    return {
      score: 70,
      maxScore: 100,
      feedback: '系统暂时无法提供详细评分，建议检查解题步骤的完整性和计算准确性。',
      strengths: ['已提交答案'],
      improvements: ['可以进一步检查解题过程'],
      detailedAnalysis: {
        methodScore: 28,
        calculationScore: 21,
        answerScore: 14,
        completenessScore: 7
      },
      nextRecommendations: ['继续练习相关题目']
    };
  }
}

// 错题分析辅助函数
async function performErrorAnalysis(submissionId: number, params: {
  recognizedText: string;
  gradingResult: any;
  fastify: any;
}) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('Deepseek API密钥未配置');
    }

    const { recognizedText, gradingResult } = params;

    const prompt = `
你是微积分教师，需要分析学生的错误并提供改进建议。

题目内容：
${recognizedText}

AI评分结果：
- 得分：${gradingResult.score}/${gradingResult.maxScore}
- 反馈：${gradingResult.feedback || '无'}
- 建议：${JSON.stringify(gradingResult.suggestions || [])}

请分析学生的主要错误类型和知识点缺陷，返回JSON格式：
{
  "errorAnalysis": [
    {
      "errorType": "calculation", // 'concept', 'calculation', 'formula', 'logic'
      "knowledgePointName": "导数计算",
      "errorDescription": "在求导过程中，忽略了复合函数的链式法则",
      "severity": "high", // 'low', 'medium', 'high'
      "aiSuggestion": "建议重新学习复合函数求导法则，多做相关练习题"
    }
  ],
  "overallAssessment": {
    "mainWeaknesses": ["复合函数求导", "符号处理"],
    "recommendedActions": ["复习导数基本公式", "练习链式法则应用"],
    "nextLearningGoals": ["掌握复杂函数求导", "提高计算准确性"]
  }
}

分析要求：
- 识别具体的错误类型和涉及知识点
- 评估错误严重程度
- 提供针对性的学习建议
- 基于微积分知识体系给出系统性指导`;

    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const result = JSON.parse(response.data.choices[0].message.content);
    const errorAnalysisData = result.errorAnalysis || [];

    // 保存错误分析到数据库
    for (const error of errorAnalysisData) {
      // 查找或创建知识点
      let knowledgePoint = await prisma.knowledgePoint.findFirst({
        where: { name: error.knowledgePointName }
      });

      if (!knowledgePoint) {
        // 推断章节信息
        const chapter = inferChapter(error.knowledgePointName);
        knowledgePoint = await prisma.knowledgePoint.create({
          data: {
            name: error.knowledgePointName,
            chapter: chapter,
            level: 3, // 概念点级别
            keywords: [error.knowledgePointName],
            functionExamples: [],
            difficultyLevel: error.severity === 'high' ? 4 : error.severity === 'medium' ? 3 : 2,
            aiExplanation: error.aiSuggestion
          }
        });
      }

      // 创建错误分析记录
      await prisma.errorAnalysis.create({
        data: {
          submissionId: submissionId,
          errorType: error.errorType,
          knowledgePointId: knowledgePoint.id,
          errorDescription: error.errorDescription,
          severity: error.severity,
          aiSuggestion: error.aiSuggestion,
          frequencyCount: 1
        }
      });
    }

    params.fastify.log.info(`✅ 错误分析已保存到数据库: ${errorAnalysisData.length}个错误点`);
    return result;

  } catch (error) {
    console.error('错题分析失败:', error);
    throw error;
  }
}

// 根据知识点名称推断章节
function inferChapter(knowledgePointName: string): string {
  const chapterMappings = [
    { keywords: ['极限', '连续', '趋于', 'lim'], chapter: '极限与连续' },
    { keywords: ['导数', '求导', '微分', 'derivative'], chapter: '导数与微分' },
    { keywords: ['积分', '原函数', '定积分', '不定积分'], chapter: '积分学' },
    { keywords: ['级数', '收敛', '发散', '幂级数'], chapter: '无穷级数' },
    { keywords: ['偏导', '梯度', '多元', '二重积分'], chapter: '多元函数' },
    { keywords: ['微分方程', '解微分', '常微分'], chapter: '微分方程' }
  ];

  for (const mapping of chapterMappings) {
    if (mapping.keywords.some(keyword => 
      knowledgePointName.toLowerCase().includes(keyword.toLowerCase())
    )) {
      return mapping.chapter;
    }
  }

  return '微积分基础'; // 默认章节
}

export default practiceRoutes;