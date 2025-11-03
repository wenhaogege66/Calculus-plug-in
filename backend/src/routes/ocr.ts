// MathPix OCR识别服务

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { supabase, supabaseAdmin, STORAGE_BUCKETS } from '../config/supabase';
import axios from 'axios';
import FormData from 'form-data';

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

      let imageToProcess: Buffer | undefined = undefined;
      
      // 从Supabase Storage获取文件
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

        // 将文件转换为buffer
        const fileBuffer = Buffer.from(await fileData.arrayBuffer());
        
        // 直接使用buffer，不需要base64转换
        imageToProcess = fileBuffer;
        
      } catch (error) {
        fastify.log.error('获取文件数据时出错:', error);
        return reply.code(500).send({
          success: false,
          error: '获取文件数据失败'
        });
      }

      if (!imageToProcess) {
        return reply.code(400).send({
          success: false,
          error: '缺少文件数据'
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

      // 调用MathPix API - 现在使用Buffer而不是base64字符串
      const mathpixResult = await callMathPixAPI(imageToProcess as Buffer, fileType);
      
      const processingTime = Date.now() - startTime;

      // 保存识别结果 - 包括fallback结果
      let ocrResult;
      try {
        ocrResult = await prisma.mathPixResult.create({
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
      } catch (dbError) {
        fastify.log.error('数据库保存失败:', dbError);
        
        // 检查是否是字符编码问题
        if (dbError instanceof Error && dbError.message.includes('invalid byte sequence')) {
          throw new Error('OCR识别结果包含特殊字符，无法保存。请联系管理员：3220104512@zju.edu.cn');
        }
        
        throw new Error(`数据库保存失败，请联系管理员：3220104512@zju.edu.cn。错误详情：${dbError instanceof Error ? dbError.message : '未知错误'}`);
      }

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

  // 下载DOCX文件 - 用户请求的功能
  fastify.get('/ocr/download/docx/:submissionId', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const submissionId = parseInt((request.params as any).submissionId);
      
      // 验证提交记录是否属于当前用户
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId: request.currentUser!.id
        },
        include: {
          mathpixResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!submission || submission.mathpixResults.length === 0) {
        return reply.code(404).send({
          success: false,
          error: '未找到OCR结果'
        });
      }

      const ocrResult = submission.mathpixResults[0];
      const docxData = (ocrResult.rawResult as any)?.docxData;

      if (!docxData) {
        return reply.code(404).send({
          success: false,
          error: 'DOCX文件不可用'
        });
      }

      // 转换base64回到buffer
      const docxBuffer = Buffer.from(docxData, 'base64');
      
      // 设置适当的headers
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      reply.header('Content-Disposition', `attachment; filename="ocr-result-${submissionId}.docx"`);
      reply.header('Content-Length', docxBuffer.length);
      
      return reply.send(docxBuffer);

    } catch (error) {
      fastify.log.error('下载DOCX文件失败:', error);
      return reply.code(500).send({
        success: false,
        error: '下载文件失败'
      });
    }
  });
}

// 预处理函数已删除 - 直接使用Buffer处理文件

// 调用MathPix API的辅助函数 - 支持PDF和图片文件
async function callMathPixAPI(fileBuffer: Buffer, fileType?: string): Promise<{
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

    console.log('🔑 使用MathPix配置:', { 
      app_id: appId.slice(0, 4) + '***' + appId.slice(-4),
      file_size: Math.round(fileBuffer.length / 1024) + 'KB',
      file_type: fileType 
    });

    const BASE = 'https://api.mathpix.com/v3';
    const AXIOS_DEFAULTS = {
      maxContentLength: Infinity as any,
      maxBodyLength: Infinity as any,
      timeout: 60000,
      headers: {
        app_id: appId,
        app_key: appKey,
      },
    };

    // 判断文件类型，选择合适的处理方式
    const isImageFile = fileType && (
      fileType.startsWith('image/') ||
      ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'].includes(fileType)
    );

    if (isImageFile) {
      // 图片文件：使用v3/text端点直接处理
      console.log('📷 处理图片文件...');
      return await processImageFile(fileBuffer, fileType, BASE, AXIOS_DEFAULTS);
    } else {
      // PDF文件：使用v3/pdf端点
      console.log('📄 处理PDF文件...');
      return await processPdfFile(fileBuffer, fileType, BASE, AXIOS_DEFAULTS);
    }

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
        data: (error as any).response.data
      });
    }
    
    // 直接抛出真实的错误
    throw new Error(`MathPix OCR识别失败: ${error instanceof Error ? error.message : '未知网络错误'}`);
  }
}

// 处理图片文件
async function processImageFile(fileBuffer: Buffer, fileType: string, BASE: string, AXIOS_DEFAULTS: any) {
  const form = new FormData();
  
  // 为图片文件配置选项
  form.append('options_json', JSON.stringify({
    formats: ["text", "latex_simplified"],
    math_inline_delimiters: ['$', '$'],
    rm_spaces: true,
    numbers_default_to_math: true
  }));
  
  // 生成合适的文件名
  const fileExtension = getFileExtension(fileType);
  form.append('file', fileBuffer, {
    filename: `upload.${fileExtension}`,
    contentType: fileType
  });

  console.log('📤 正在上传图片到MathPix...');
  const response = await axios.post(`${BASE}/text`, form, {
    ...AXIOS_DEFAULTS,
    headers: { ...AXIOS_DEFAULTS.headers, ...form.getHeaders() },
  });

  if (response.data.error) {
    throw new Error(`MathPix图片处理失败: ${response.data.error}`);
  }

  const text = response.data.text || '';
  const latex = response.data.latex_simplified || '';
  
  console.log('✅ 图片识别成功:', {
    textLength: text.length,
    latexLength: latex.length,
    confidence: response.data.confidence || 0.95
  });

  return {
    text: text,
    latex: latex,
    confidence: response.data.confidence || 0.95,
    raw: {
      ...response.data,
      provider: 'MathPix_v3_Text',
      fileType: 'image'
    }
  };
}

// 处理PDF文件（原有逻辑）
async function processPdfFile(fileBuffer: Buffer, fileType: string, BASE: string, AXIOS_DEFAULTS: any) {
  // Step 1: 上传PDF到MathPix
  const form = new FormData();
  
  // 配置选项 - 针对数学内容优化，确保公式不丢失
  form.append('options_json', JSON.stringify({
    formats: ["mmd", "docx"], // 请求mmd和docx格式，使用format=mmd保证公式完整性
    math_inline_delimiters: ['$', '$'],
    rm_spaces: true,
    numbers_default_to_math: true
  }));
  
  form.append('file', fileBuffer, {
    filename: 'upload.pdf',
    contentType: fileType || 'application/pdf'
  });

  console.log('📤 正在上传PDF到MathPix...');
  const uploadResponse = await axios.post(`${BASE}/pdf`, form, {
    ...AXIOS_DEFAULTS,
    headers: { ...AXIOS_DEFAULTS.headers, ...form.getHeaders() },
  });

  const pdf_id = uploadResponse.data?.pdf_id;
  if (!pdf_id) {
    console.error('⚠️ 上传响应:', uploadResponse.data);
    throw new Error('未返回 pdf_id');
  }
  console.log('✅ 上传成功，pdf_id =', pdf_id);

  // Step 2: 轮询等待OCR完成
  console.log('⏳ 等待OCR完成...');
  const POLL_INTERVAL_MS = 3000;
  const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10分钟超时
  const start = Date.now();
  
  let ocrCompleted = false;
  let progress = 0;
  
  while (!ocrCompleted) {
    const statusResponse = await axios.get(`${BASE}/pdf/${pdf_id}`, AXIOS_DEFAULTS);
    const status = statusResponse.data?.status;
    progress = statusResponse.data?.percent_done || 0;
    
    if (status === 'completed') {
      console.log(`🎉 OCR完成！进度=${progress}%`);
      ocrCompleted = true;
      break;
    }
    
    if (status === 'error') {
      throw new Error(`PDF 处理错误: ${JSON.stringify(statusResponse.data)}`);
    }
    
    if (Date.now() - start > POLL_TIMEOUT_MS) {
      throw new Error('等待超时：PDF 处理未完成');
    }
    
    console.log(`📊 OCR进度: ${progress}%`);
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Step 3: 获取识别结果 - 使用format=mmd确保数学公式完整性
  console.log('📥 下载识别结果...');
  const resultResponse = await axios.get(`${BASE}/pdf/${pdf_id}.mmd`, {
    ...AXIOS_DEFAULTS,
    responseType: 'text'
  });

  const text = resultResponse.data as string;
  console.log('📊 识别结果长度:', text.length);

  // 验证结果有效性
  if (!text || text.trim().length === 0) {
    throw new Error('MathPix OCR未能识别出任何文本内容');
  }

  // 改进的文本清洗逻辑 - 保留LaTeX格式字符，移除有害字符
  const cleanText = text
    .replace(/\x00/g, '') // 移除null字节
    .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // 移除控制字符，保留\n和\r
    .replace(/\uFFFD/g, ''); // 移除替换字符（�）

  if (cleanText.trim().length === 0) {
    throw new Error('OCR识别结果清洗后为空，可能包含过多特殊字符');
  }

  // 尝试获取LaTeX格式 (可选)
  let latex = '';
  try {
    const latexResponse = await axios.get(`${BASE}/pdf/${pdf_id}.tex`, {
      ...AXIOS_DEFAULTS,
      responseType: 'text'
    });
    const rawLatex = latexResponse.data as string;
    // 同样使用改进的清洗逻辑
    latex = rawLatex
      .replace(/\x00/g, '')
      .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\uFFFD/g, '');
  } catch (e) {
    console.log('📝 LaTeX格式不可用，使用Markdown格式');
  }

  // 尝试获取DOCX格式 (可选) - 用户请求的下载功能
  let docxBuffer: Buffer | null = null;
  try {
    const docxResponse = await axios.get(`${BASE}/pdf/${pdf_id}.docx`, {
      ...AXIOS_DEFAULTS,
      responseType: 'arraybuffer'
    });
    docxBuffer = Buffer.from(docxResponse.data);
    console.log('✅ DOCX格式获取成功，大小:', Math.round(docxBuffer.length / 1024) + 'KB');
  } catch (e) {
    console.log('📄 DOCX格式不可用');
  }

  console.log('✅ MathPix识别成功:', {
    originalLength: text.length,
    cleanedLength: cleanText.length,
    latexLength: latex.length,
    docxSize: docxBuffer ? Math.round(docxBuffer.length / 1024) + 'KB' : '不可用',
    confidence: 0.95 // v3/pdf API不返回置信度，使用默认值
  });

  return {
    text: cleanText,
    latex: latex,
    confidence: 0.95,
    raw: {
      pdf_id,
      status: 'completed',
      progress: 100,
      provider: 'MathPix_v3_PDF',
      fileType: 'pdf',
      // 保存docx数据用于下载（如果可用）
      docxData: docxBuffer ? docxBuffer.toString('base64') : null
    }
  };
}

// 根据MIME类型获取文件扩展名
function getFileExtension(mimeType: string): string {
  const mimeToExt: { [key: string]: string } = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/tif': 'tif',
    'application/pdf': 'pdf'
  };
  
  return mimeToExt[mimeType] || 'jpg'; // 默认使用jpg
}