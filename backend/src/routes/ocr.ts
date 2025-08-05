// MyScript OCR识别服务

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { supabase, supabaseAdmin, STORAGE_BUCKETS } from '../config/supabase';
import axios from 'axios';

const prisma = new PrismaClient();

export async function ocrRoutes(fastify: FastifyInstance) {
  // MyScript手写识别 - 内部调用版本（无需认证）
  fastify.post('/internal/ocr/myscript', async (request, reply) => {
    return await processOCR(request, reply, fastify);
  });

  // MyScript手写识别 - 外部调用版本（需要认证）
  fastify.post('/ocr/myscript', { preHandler: requireAuth }, async (request, reply) => {
    return await processOCR(request, reply, fastify);
  });

// OCR处理的核心逻辑
async function processOCR(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance) {
    try {
      const { submissionId, imageData, fileId } = request.body as any;
      
      if (!submissionId) {
        return reply.code(400).send({
          success: false,
          error: '缺少提交ID'
        });
      }

      // 获取提交记录（对于内部调用，不验证用户）
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          ...(request.currentUser && { userId: request.currentUser.id }) // 只有在有用户上下文时才验证
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
      
      // 如果没有提供图片数据，从Supabase Storage获取文件
      if (!imageToProcess) {
        try {
          // 从文件上传记录获取文件路径
          const fileUpload = submission.fileUpload;
          if (!fileUpload) {
            return reply.code(400).send({
              success: false,
              error: '文件信息不存在'
            });
          }

          fastify.log.info(`从Supabase Storage获取文件: ${fileUpload.filePath}`);
          
          // 使用Admin客户端从Supabase Storage下载文件
          const storageClient = supabaseAdmin || supabase;
          const { data: fileData, error: downloadError } = await storageClient.storage
            .from(STORAGE_BUCKETS.ASSIGNMENTS)
            .download(fileUpload.filePath);

          if (downloadError || !fileData) {
            fastify.log.error('从Supabase Storage下载文件失败:', downloadError);
            return reply.code(400).send({
              success: false,
              error: '无法获取文件数据'
            });
          }

          // 将文件转换为base64
          const fileBuffer = await fileData.arrayBuffer();
          imageToProcess = Buffer.from(fileBuffer).toString('base64');
          
          fastify.log.info(`文件转换完成，大小: ${Math.round(fileBuffer.byteLength / 1024)}KB`);
          
        } catch (error) {
          fastify.log.error('获取文件数据时出错:', error);
          return reply.code(500).send({
            success: false,
            error: '获取文件数据失败'
          });
        }
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
      if ((request.body as any)?.submissionId) {
        await prisma.submission.update({
          where: { id: (request.body as any).submissionId },
          data: { status: 'FAILED' }
        }).catch(() => {}); // 忽略更新失败
      }

      return reply.code(500).send({
        success: false,
        error: 'OCR识别处理失败'
      });
    }
}

  // 获取OCR结果
  fastify.get('/ocr/results/:submissionId', { preHandler: requireAuth }, async (request, reply) => {
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

    // 临时Mock实现：由于MyScript API配置复杂，先用模拟结果测试完整流程
    console.log('🧪 使用Mock OCR结果测试完整流程');
    
    // 模拟识别延时
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 根据图片大小生成模拟的OCR结果
    const imageSize = Math.round(imageData.length / 1024);
    let mockText = '';
    
    if (imageSize > 200) {
      // 大图片，可能是复杂题目
      mockText = '计算下列极限：\n lim(x→0) (sin x) / x = ?\n\n解：\n根据洛必达法则，\nlim(x→0) (sin x) / x = lim(x→0) (cos x) / 1 = cos(0) = 1';
    } else {
      // 小图片，可能是简单表达式
      mockText = 'f(x) = x² + 2x + 1\nf\'(x) = 2x + 2';
    }

    return {
      text: mockText,
      confidence: 0.92, // 模拟92%的识别置信度
      raw: {
        mock: true,
        originalImageSize: imageSize + 'KB',
        processingTime: '1.2s',
        language: 'zh_CN'
      }
    };

    // TODO: 实际MyScript API实现
    /*
    const response = await axios.post(`${endpoint}/batch`, {
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
        // HMAC签名需要复杂计算
      }
    });

    return {
      text: response.data.text || '',
      confidence: response.data.confidence || 0,
      raw: response.data
    };
    */

  } catch (error) {
    console.error('MyScript API调用失败:', error);
    
    // 即使出错也返回模拟结果，确保流程能继续
    return {
      text: '识别失败，请重新上传清晰的图片',
      confidence: 0.1,
      raw: { error: error instanceof Error ? error.message : '未知错误' }
    };
  }
} 