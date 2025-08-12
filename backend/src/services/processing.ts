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