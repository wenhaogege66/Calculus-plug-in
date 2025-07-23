// MyScript OCR识别服务

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import axios from 'axios';

const prisma = new PrismaClient();

export async function ocrRoutes(fastify: FastifyInstance) {
  // MyScript手写识别
  fastify.post('/ocr/myscript', { preHandler: requireAuth }, async (request: FastifyRequest<{
    Body: {
      submissionId: number;
      imageData?: string; // base64编码的图片数据
      fileId?: number;    // 或者文件ID
    }
  }>, reply: FastifyReply) => {
    try {
      const { submissionId, imageData, fileId } = request.body;
      
      if (!submissionId) {
        return reply.code(400).send({
          success: false,
          error: '缺少提交ID'
        });
      }

      // 验证提交记录是否属于当前用户
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId: request.currentUser!.id
        },
        include: {
          fileUpload: true
        }
      });

      if (!submission) {
        return reply.code(404).send({
          success: false,
          error: '提交记录不存在'
        });
      }

      let imageToProcess = imageData;
      
      // 如果没有提供图片数据，尝试从文件获取
      if (!imageToProcess && fileId) {
        // 这里应该从Supabase Storage获取文件并转换为base64
        // 暂时返回错误，需要实现文件处理逻辑
        return reply.code(400).send({
          success: false,
          error: '文件处理功能待实现'
        });
      }

      if (!imageToProcess) {
        return reply.code(400).send({
          success: false,
          error: '缺少图片数据'
        });
      }

      // 更新提交状态为处理中
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'PROCESSING' }
      });

      const startTime = Date.now();

      // 调用MyScript API
      const myscriptResult = await callMyScriptAPI(imageToProcess);
      
      const processingTime = Date.now() - startTime;

      // 保存识别结果
      const ocrResult = await prisma.myScriptResult.create({
        data: {
          submissionId: submissionId,
          recognizedText: myscriptResult.text,
          confidenceScore: myscriptResult.confidence,
          processingTime: processingTime,
          rawResult: myscriptResult.raw
        }
      });

      return {
        success: true,
        data: {
          resultId: ocrResult.id,
          recognizedText: ocrResult.recognizedText,
          confidence: ocrResult.confidenceScore,
          processingTime: ocrResult.processingTime
        }
      };

    } catch (error) {
      fastify.log.error('MyScript OCR处理失败:', error);
      
      // 更新提交状态为失败
      if (request.body?.submissionId) {
        await prisma.submission.update({
          where: { id: request.body.submissionId },
          data: { status: 'FAILED' }
        }).catch(() => {}); // 忽略更新失败
      }

      return reply.code(500).send({
        success: false,
        error: 'OCR识别处理失败'
      });
    }
  });

  // 获取OCR结果
  fastify.get('/ocr/results/:submissionId', { preHandler: requireAuth }, async (request: FastifyRequest<{
    Params: { submissionId: string }
  }>, reply: FastifyReply) => {
    try {
      const submissionId = parseInt(request.params.submissionId);
      
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

      // 获取OCR结果
      const ocrResults = await prisma.myScriptResult.findMany({
        where: { submissionId: submissionId },
        orderBy: { createdAt: 'desc' }
      });

      return {
        success: true,
        data: { results: ocrResults }
      };

    } catch (error) {
      fastify.log.error('获取OCR结果失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取OCR结果失败'
      });
    }
  });
}

// 调用MyScript API的辅助函数
async function callMyScriptAPI(imageData: string): Promise<{
  text: string;
  confidence: number;
  raw: any;
}> {
  try {
    const endpoint = process.env.MYSCRIPT_API_ENDPOINT;
    const appKey = process.env.MYSCRIPT_APPLICATION_KEY;
    const hmacKey = process.env.MYSCRIPT_HMAC_KEY;

    if (!endpoint || !appKey || !hmacKey) {
      throw new Error('MyScript配置缺失');
    }

    // 这里是MyScript API调用的简化版本
    // 实际实现需要根据MyScript的具体API文档
    const response = await axios.post(`${endpoint}/text`, {
      inputType: 'image',
      data: imageData,
      configuration: {
        lang: 'zh_CN',
        export: {
          'text/plain': {
            smartFormat: true
          }
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'applicationKey': appKey,
        // 这里应该包含HMAC签名，暂时简化
      }
    });

    return {
      text: response.data.text || '',
      confidence: response.data.confidence || 0,
      raw: response.data
    };

  } catch (error) {
    console.error('MyScript API调用失败:', error);
    throw new Error('手写识别服务暂时不可用');
  }
} 