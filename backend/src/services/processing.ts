// 统一的批改处理服务
import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { processOCR } from '../routes/ocr';
import { processAIGrading } from '../routes/ai';

const prisma = new PrismaClient();

export interface ProcessingResult {
  success: boolean;
  error?: string;
  ocrResult?: any;
  aiResult?: any;
}

// 统一的OCR和AI批改处理流程
export async function processSubmission(
  submissionId: number, 
  fastify: FastifyInstance,
  options: {
    mode: 'practice' | 'homework';
    skipAI?: boolean;
  } = { mode: 'practice' }
): Promise<ProcessingResult> {
  try {
    fastify.log.info(`🚀 开始处理流程 - submissionId: ${submissionId}, mode: ${options.mode}`);

    // 1. OCR识别
    let ocrResult: any = null;
    try {
      // 直接调用OCR处理函数，而不是HTTP请求
      ocrResult = await processOCRInternal(submissionId, fastify);
      
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

    // 2. AI批改（如果不跳过且OCR成功）
    let aiResult: any = null;
    if (!options.skipAI && ocrResult?.success && ocrResult.data?.recognizedText) {
      try {
        // 直接调用AI处理函数，而不是HTTP请求
        const subject = '微积分';
        const exerciseType = options.mode === 'practice' ? '自主练习' : '作业提交';
        
        aiResult = await processAIGradingInternal(
          submissionId, 
          ocrResult.data.recognizedText, 
          subject, 
          exerciseType,
          fastify
        );
        
        fastify.log.info(`✅ AI批改完成:`, {
          submissionId,
          score: aiResult?.data?.score,
          maxScore: aiResult?.data?.maxScore
        });
        
        // 4. 自动添加错题（如果分数<75且模式是practice）
        if (options.mode === 'practice' && aiResult?.success && aiResult.data?.score && aiResult.data.score < 75) {
          try {
            await autoAddToMistakeBook(submissionId, fastify);
            fastify.log.info(`✅ 自动添加到错题本 - submissionId: ${submissionId}, score: ${aiResult.data.score}`);
          } catch (error) {
            fastify.log.error(`自动添加错题失败:`, error);
            // 不影响主流程，只记录错误
          }
        }
      } catch (error) {
        fastify.log.error(`AI批改过程异常:`, error);
        aiResult = { success: false, error: 'AI批改失败' };
      }
    } else {
      fastify.log.warn(`跳过AI批改:`, {
        submissionId,
        skipAI: options.skipAI,
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

    fastify.log.info(`🎉 处理流程完成 - submissionId: ${submissionId}`);

    return {
      success: true,
      ocrResult,
      aiResult
    };

  } catch (error) {
    fastify.log.error(`❌ 处理流程失败 - submissionId: ${submissionId}`, error);
    
    // 更新提交状态为失败
    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'FAILED' }
      });
    } catch (updateError) {
      fastify.log.error(`❌ 更新提交状态失败 - submissionId: ${submissionId}`, updateError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

// 内部OCR处理函数
async function processOCRInternal(submissionId: number, fastify: FastifyInstance) {
  try {
    const mockRequest: any = {
      body: { submissionId },
      currentUser: null, // 内部调用无需用户验证
      headers: { 'x-internal-call': 'true' }
    };
    
    const mockReply: any = {
      code: (statusCode: number) => mockReply,
      send: (data: any) => data
    };

    // 直接调用OCR处理函数
    const result = await processOCR(mockRequest, mockReply, fastify);
    return result;
    
  } catch (error) {
    fastify.log.error('内部OCR调用失败:', error);
    throw new Error(`OCR识别失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 内部AI处理函数
async function processAIGradingInternal(
  submissionId: number, 
  recognizedText: string, 
  subject: string, 
  exerciseType: string,
  fastify: FastifyInstance
) {
  try {
    const mockRequest: any = {
      body: { 
        submissionId, 
        recognizedText, 
        subject, 
        exerciseType 
      },
      currentUser: null, // 内部调用无需用户验证
      headers: { 'x-internal-call': 'true' }
    };
    
    const mockReply: any = {
      code: (statusCode: number) => mockReply,
      send: (data: any) => data
    };

    // 直接调用AI处理函数
    const result = await processAIGrading(mockRequest, mockReply, fastify);
    return result;
    
  } catch (error) {
    fastify.log.error('内部AI调用失败:', error);
    throw new Error(`AI批改失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 自动添加到错题本
async function autoAddToMistakeBook(submissionId: number, fastify: FastifyInstance) {
  try {
    // 验证提交记录和分数
    const submission = await prisma.submission.findFirst({
      where: { id: submissionId },
      include: {
        user: { select: { id: true } },
        fileUpload: { select: { originalName: true } },
        deepseekResults: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { score: true }
        }
      }
    });
    
    if (!submission) {
      throw new Error('提交记录不存在');
    }
    
    const latestResult = submission.deepseekResults[0];
    if (!latestResult || !latestResult.score || latestResult.score >= 75) {
      fastify.log.info(`跳过自动添加错题 - 分数不满足条件: ${latestResult?.score}`);
      return;
    }
    
    // 检查是否已存在
    const existingItem = await prisma.mistakeItem.findUnique({
      where: {
        userId_submissionId: {
          userId: submission.userId,
          submissionId
        }
      }
    });
    
    if (existingItem) {
      fastify.log.info('错题已存在，跳过添加');
      return existingItem;
    }
    
    // 获取或创建默认分类"需要加强"
    let defaultCategory = await prisma.mistakeCategory.findFirst({
      where: {
        userId: submission.userId,
        name: '需要加强',
        parentId: null,
        isActive: true
      }
    });
    
    if (!defaultCategory) {
      defaultCategory = await prisma.mistakeCategory.create({
        data: {
          userId: submission.userId,
          name: '需要加强',
          description: '系统自动创建的分类，用于存放需要重点练习的题目',
          level: 1,
          color: '#ef4444',
          icon: '🔴'
        }
      });
    }
    
    // 创建错题记录
    const mistakeItem = await prisma.mistakeItem.create({
      data: {
        userId: submission.userId,
        submissionId,
        categoryId: defaultCategory.id,
        title: submission.fileUpload?.originalName || '系统自动添加',
        notes: `系统检测到得分较低（${latestResult.score}分），自动添加到错题本`,
        tags: ['自动添加', '低分题目'],
        priority: latestResult.score < 50 ? 'high' : 'medium',
        addedBy: 'auto'
      }
    });
    
    fastify.log.info(`✅ 自动添加错题成功 - 分数: ${latestResult.score}分`);
    return mistakeItem;
  } catch (error) {
    fastify.log.error('自动添加错题异常:', error);
    throw error;
  }
}