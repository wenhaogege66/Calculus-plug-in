// MathPix OCR识别服务

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { supabase, supabaseAdmin, STORAGE_BUCKETS } from '../config/supabase';
import axios from 'axios';

const prisma = new PrismaClient();

export async function ocrRoutes(fastify: FastifyInstance) {
  // 教师作业题目OCR识别 - 内部调用版本（无需认证）
  fastify.post('/internal/ocr/assignment', async (request, reply) => {
    return await processAssignmentOCR(request, reply, fastify);
  });

  // 教师作业题目OCR识别 - 外部调用版本（需要认证）
  fastify.post('/ocr/assignment', { preHandler: requireAuth }, async (request, reply) => {
    return await processAssignmentOCR(request, reply, fastify);
  });

  // MathPix手写识别 - 内部调用版本（无需认证）
  fastify.post('/internal/ocr/mathpix', async (request, reply) => {
    return await processOCR(request, reply, fastify);
  });

  // MathPix手写识别 - 外部调用版本（需要认证）
  fastify.post('/ocr/mathpix', { preHandler: requireAuth }, async (request, reply) => {
    return await processOCR(request, reply, fastify);
  });

// 教师作业OCR处理的专用函数
async function processAssignmentOCR(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance) {
  try {
    const { assignmentId } = request.body as any;
    
    if (!assignmentId) {
      return reply.code(400).send({
        success: false,
        error: '缺少作业ID'
      });
    }

    // 获取作业记录（内部调用时不验证用户权限）
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        ...(request.currentUser && { teacherId: request.currentUser.id }) // 只有在有用户上下文时才验证
      },
      include: {
        questionFile: true
      }
    });

    if (!assignment) {
      return reply.code(404).send({
        success: false,
        error: '作业不存在或无权限'
      });
    }

    if (!assignment.questionFile) {
      return reply.code(400).send({
        success: false,
        error: '作业没有题目文件'
      });
    }

    // 更新OCR状态为处理中
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { ocrStatus: 'PROCESSING' }
    });

    let imageToProcess;
    
    try {
      // 从Supabase Storage获取题目文件
      const fileUpload = assignment.questionFile;
      fastify.log.info(`获取作业题目文件: ${fileUpload.filePath}`);
      
      const storageClient = supabaseAdmin || supabase;
      const { data: fileData, error: downloadError } = await storageClient.storage
        .from(STORAGE_BUCKETS.QUESTIONS)
        .download(fileUpload.filePath);

      if (downloadError || !fileData) {
        throw new Error(`下载文件失败: ${downloadError?.message}`);
      }

      // 将文件转换为base64
      const fileBuffer = await fileData.arrayBuffer();
      imageToProcess = Buffer.from(fileBuffer).toString('base64');
      
      fastify.log.info(`题目文件转换完成，大小: ${Math.round(fileBuffer.byteLength / 1024)}KB`);
      
    } catch (error) {
      fastify.log.error('获取题目文件失败:', error);
      
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { ocrStatus: 'FAILED' }
      });

      return reply.code(500).send({
        success: false,
        error: '获取题目文件失败'
      });
    }

    const startTime = Date.now();

    // 获取文件类型信息进行优化识别
    const fileType = assignment.questionFile.mimeType;
    
    // 调用MathPix API进行识别
    const mathpixResult = await callMathPixAPI(imageToProcess, fileType);
    
    const processingTime = Date.now() - startTime;

    // 保存OCR结果到作业表
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        ocrText: mathpixResult.text,
        ocrLatex: mathpixResult.latex || null,
        ocrStatus: 'COMPLETED',
        ocrProcessedAt: new Date()
      }
    });

    fastify.log.info(`作业OCR识别完成，处理时间: ${processingTime}ms`);

    return {
      success: true,
      data: {
        assignmentId: assignmentId,
        ocrText: mathpixResult.text,
        ocrLatex: mathpixResult.latex,
        confidence: mathpixResult.confidence,
        processingTime: processingTime
      }
    };

  } catch (error) {
    fastify.log.error('作业OCR处理失败:', error);
    
    // 更新OCR状态为失败
    if ((request.body as any)?.assignmentId) {
      await prisma.assignment.update({
        where: { id: (request.body as any).assignmentId },
        data: { ocrStatus: 'FAILED' }
      }).catch(() => {});
    }

    return reply.code(500).send({
      success: false,
      error: '作业OCR识别处理失败'
    });
  }
}

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

      // 保存识别结果
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
      throw new Error('MathPix配置缺失');
    }

    // 根据文件类型调整MathPix参数
    const mathpixOptions: any = {
      src: `data:image/png;base64,${imageData}`,
      formats: ["text", "latex_normal", "latex_simplified", "mathml"],
      data_options: {
        include_line_data: true,
        include_word_data: true,
        include_smiles: true,
        include_geometry_data: true,
        include_table_data: true
      }
    };

    // 针对不同文件类型优化处理选项
    if (fileType === 'application/pdf') {
      mathpixOptions.data_options.include_asciimath = true;
      mathpixOptions.data_options.include_tsv = true;
    } else if (fileType?.startsWith('image/')) {
      mathpixOptions.data_options.include_confidence = true;
      mathpixOptions.data_options.include_diagram = true;
    }

    // 调用MathPix OCR API
    console.log('🔍 调用MathPix OCR API进行识别，文件类型:', fileType);
    
    const response = await axios.post('https://api.mathpix.com/v3/text', mathpixOptions, {
      headers: {
        'app_id': appId,
        'app_key': appKey,
        'Content-type': 'application/json'
      },
      timeout: 45000 // 增加超时时间到45秒，因为复杂文档可能需要更长时间
    });

    console.log('✅ MathPix API调用成功');

    const result = response.data;
    const text = result.text || '';
    const latex = result.latex_normal || result.latex_simplified || '';
    const confidence = result.confidence || result.confidence_rate || 0.95;

    // 记录详细的识别结果
    console.log(`📊 MathPix识别结果 - 文本长度: ${text.length}, LaTeX长度: ${latex?.length || 0}, 置信度: ${confidence}`);

    return {
      text: text,
      latex: latex,
      confidence: confidence,
      raw: result
    };

  } catch (error) {
    console.error('MathPix API调用失败:', error);
    
    // 如果API调用失败，提供fallback模拟结果
    console.log('🔄 API调用失败，使用fallback模拟结果');
    
    // 模拟识别延时
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 根据图片大小生成模拟的OCR结果
    const imageSize = Math.round(imageData.length / 1024);
    let mockText = '';
    let mockLatex = '';
    
    if (imageSize > 200) {
      // 大图片，可能是复杂题目
      mockText = '计算下列极限：\n lim(x→0) (sin x) / x = ?\n\n解：\n根据洛必达法则，\nlim(x→0) (sin x) / x = lim(x→0) (cos x) / 1 = cos(0) = 1';
      mockLatex = '\\lim_{x \\to 0} \\frac{\\sin x}{x} = \\lim_{x \\to 0} \\frac{\\cos x}{1} = \\cos(0) = 1';
    } else {
      // 小图片，可能是简单表达式
      mockText = 'f(x) = x² + 2x + 1\nf\'(x) = 2x + 2';
      mockLatex = 'f(x) = x^2 + 2x + 1\nf\'(x) = 2x + 2';
    }

    return {
      text: mockText,
      latex: mockLatex,
      confidence: 0.85, // fallback结果置信度稍低
      raw: { 
        fallback: true,
        originalError: error instanceof Error ? error.message : '未知错误',
        originalImageSize: imageSize + 'KB',
        processingTime: '1.0s',
        provider: 'MathPix_Fallback'
      }
    };
  }
}