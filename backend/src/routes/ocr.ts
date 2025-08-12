// MathPix OCR识别服务

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { supabase, supabaseAdmin, STORAGE_BUCKETS } from '../config/supabase';
import axios from 'axios';

const prisma = new PrismaClient();

// OCR处理的核心逻辑 - 导出供其他模块使用
export async function processOCR(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance) {
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

          // 将文件转换为buffer进行预处理
          const fileBuffer = Buffer.from(await fileData.arrayBuffer());
          
          // 使用文件预处理功能
          imageToProcess = await preprocessFileForOCR(fileBuffer, fileUpload.mimeType);
          
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

      // 获取文件类型以优化MathPix识别
      const fileType = submission.fileUpload?.mimeType;

      // 调用MathPix API
      const mathpixResult = await callMathPixAPI(imageToProcess, fileType);
      
      const processingTime = Date.now() - startTime;

      // 保存识别结果 - 包括fallback结果
      const ocrResult = await prisma.mathPixResult.create({
        data: {
          submissionId: submissionId,
          recognizedText: mathpixResult.text,
          mathLatex: mathpixResult.latex,
          confidence: mathpixResult.confidence,
          processingTime: processingTime,
          rawResult: mathpixResult.raw
        }
      });

      fastify.log.info(`OCR结果已保存到数据库:`, {
        submissionId,
        resultId: ocrResult.id,
        textLength: mathpixResult.text?.length || 0,
        isFallback: mathpixResult.raw?.fallback || false
      });

      return {
        success: true,
        data: {
          resultId: ocrResult.id,
          recognizedText: ocrResult.recognizedText,
          mathLatex: ocrResult.mathLatex,
          confidence: ocrResult.confidence,
          processingTime: ocrResult.processingTime
        }
      };

    } catch (error) {
      fastify.log.error('MathPix OCR处理失败:', error);
      
      // 不返回fallback数据，直接抛出错误
      const submissionId = (request.body as any)?.submissionId;
      if (submissionId) {
        await prisma.submission.update({
          where: { id: submissionId },
          data: { status: 'FAILED' }
        }).catch(() => {});
      }

      return reply.code(500).send({
        success: false,
        error: `OCR识别失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }
}

export async function ocrRoutes(fastify: FastifyInstance) {
  // MathPix手写识别 - 统一端点（条件认证）
  fastify.post('/ocr/mathpix', { 
    preHandler: async (request, reply) => {
      // 对于内部调用，跳过认证检查
      if (request.headers['x-internal-call'] === 'true') {
        return;
      }
      // 对于外部调用，需要认证
      await requireAuth(request, reply);
    }
  }, async (request, reply) => {
    return await processOCR(request, reply, fastify);
  });

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
      const ocrResults = await prisma.mathPixResult.findMany({
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

// 检测文件格式并处理
async function preprocessFileForOCR(fileBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      console.log('📄 检测到PDF文件，需要转换为图像');
      // TODO: 实现PDF到图像的转换
      // 暂时直接转换为base64，但在实际生产环境中应该先转换为图像
      console.log('⚠️ PDF处理功能正在开发中，暂时使用fallback处理');
    }
    
    // 对于图像文件，直接转换为base64
    const base64Data = fileBuffer.toString('base64');
    
    // 验证base64数据
    if (!base64Data || base64Data.length < 100) {
      throw new Error('生成的base64数据无效或过小');
    }
    
    console.log(`✅ 文件预处理完成，base64大小: ${Math.round(base64Data.length / 1024)}KB`);
    return base64Data;
    
  } catch (error) {
    console.error('文件预处理失败:', error);
    throw new Error(`文件预处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 调用MathPix API的辅助函数
async function callMathPixAPI(imageData: string, fileType?: string): Promise<{
  text: string;
  latex?: string;
  confidence: number;
  raw: any;
}> {
  try {
    const appId = process.env.MATHPIX_APP_ID;
    const appKey = process.env.MATHPIX_APP_KEY;

    if (!appId || !appKey) {
      throw new Error('MathPix配置缺失: MATHPIX_APP_ID或MATHPIX_APP_KEY未设置');
    }

    // 根据文件类型确定正确的MIME类型
    let mimeType = 'image/png'; // 默认
    if (fileType) {
      if (fileType === 'application/pdf') {
        mimeType = 'application/pdf';
      } else if (fileType.includes('jpeg') || fileType.includes('jpg')) {
        mimeType = 'image/jpeg';
      } else if (fileType.includes('png')) {
        mimeType = 'image/png';
      } else if (fileType.includes('gif')) {
        mimeType = 'image/gif';
      } else if (fileType.includes('webp')) {
        mimeType = 'image/webp';
      }
    }

    // 构建MathPix API请求参数 - 根据官方文档优化
    // 基础配置，适用于数学内容识别
    const mathpixOptions: any = {
      src: `data:${mimeType};base64,${imageData}`,
      formats: ["text", "latex_normal"],
      data_options: {
        include_asciimath: true,
        include_latex: true,
        include_table_html: false, // 对于数学作业，通常不需要表格HTML
        include_tsv: false
      }
    };

    console.log('🔧 使用标准数学识别配置');

    // 调用MathPix OCR API
    console.log('🔍 调用MathPix OCR API进行识别');
    console.log('📋 请求参数:', {
      fileType,
      mimeType,
      formats: mathpixOptions.formats,
      imageSize: Math.round(imageData.length / 1024) + 'KB'
    });
    
    const response = await axios.post('https://api.mathpix.com/v3/text', mathpixOptions, {
      headers: {
        'app_id': appId,
        'app_key': appKey,
        'Content-Type': 'application/json'
      },
      timeout: 60000, // 增加超时时间到60秒
      validateStatus: function (status) {
        return status < 500; // 接受400-499的错误响应，以便更好地处理错误
      }
    });

    console.log('📡 MathPix API响应状态:', response.status);

    if (response.status !== 200) {
      console.error('❌ MathPix API返回错误:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      throw new Error(`MathPix API返回错误 ${response.status}: ${JSON.stringify(response.data)}`);
    }

    const result = response.data;
    console.log('📊 MathPix原始响应:', JSON.stringify(result, null, 2));

    // 提取识别结果 - 根据MathPix API v3响应格式
    const text = result.text || '';
    const latex = result.latex_normal || result.latex || '';
    const confidence = parseFloat(result.confidence) || 0.0;

    // 验证结果有效性
    if (!text || text.trim().length === 0) {
      console.warn('⚠️ MathPix返回空文本结果');
      throw new Error('MathPix OCR未能识别出任何文本内容');
    }

    console.log('✅ MathPix识别成功:', {
      textLength: text.length,
      latexLength: latex?.length || 0,
      confidence: confidence
    });

    return {
      text: text,
      latex: latex,
      confidence: confidence,
      raw: result
    };

  } catch (error) {
    console.error('❌ MathPix API调用失败:', error);
    
    // 输出详细的错误信息以便调试
    if (error instanceof Error) {
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    // 检查是否是axios错误
    if ((error as any).response) {
      console.error('HTTP错误响应:', {
        status: (error as any).response.status,
        statusText: (error as any).response.statusText,
        data: (error as any).response.data,
        headers: (error as any).response.headers
      });
    }
    
    // 检查是否是请求配置问题
    if ((error as any).request) {
      console.error('请求配置问题:', (error as any).request);
    }
    
    // 不要返回mock数据，直接抛出真实的错误
    throw new Error(`MathPix OCR识别失败: ${error instanceof Error ? error.message : '未知网络错误'}`);
  }
}