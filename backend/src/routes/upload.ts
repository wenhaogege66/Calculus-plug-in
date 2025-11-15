// 文件上传路由 - Supabase Storage

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase, supabaseAdmin, STORAGE_BUCKETS } from '../config/supabase';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/db';
import { successResponse, sendError } from '../utils/response-helper';
import { handleRouteError } from '../utils/error-handler';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import os from 'os';



export async function uploadRoutes(fastify: FastifyInstance) {
  // 文件上传端点
  fastify.post('/files', { preHandler: requireAuth }, async (request, reply) => {
    const startTime = Date.now();

    try {
      // 获取文件和其他参数
      const parts = request.parts();
      let fileData: any = null;
      let workMode = 'practice';
      let assignmentId: number | null = null;
      let tempFilePath: string | null = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          // 立即处理文件流，写入临时文件
          const tempDir = os.tmpdir();
          const tempFileName = `upload-${uuidv4()}.tmp`;
          tempFilePath = path.join(tempDir, tempFileName);

          const writeStream = fs.createWriteStream(tempFilePath);

          // 将文件流写入临时文件
          await new Promise<void>((resolve, reject) => {
            part.file.pipe(writeStream);

            writeStream.on('finish', () => {
              resolve();
            });

            part.file.on('error', (error) => {
              fastify.log.error('❌ 文件流读取错误:', error);
              reject(error);
            });

            writeStream.on('error', (error) => {
              fastify.log.error('❌ 临时文件写入错误:', error);
              reject(error);
            });
          });

          // 保存文件信息供后续使用
          fileData = {
            filename: part.filename,
            mimetype: part.mimetype,
            tempPath: tempFilePath
          };

        } else if (part.fieldname === 'workMode') {
          workMode = (part as any).value;
        } else if (part.fieldname === 'assignmentId') {
          assignmentId = parseInt((part as any).value) || null;
        }
      }

      const data = fileData;
      if (!data) {
        fastify.log.warn('❌ 没有收到文件数据');
        return sendError(reply, '没有收到文件', 400);
      }

      const { filename, mimetype, tempPath } = data;

      // 获取文件大小
      const fileStats = fs.statSync(tempPath);
      const fileSize = fileStats.size;

      const maxSize = Number(process.env.MAX_FILE_SIZE) || 104857600; // 100MB
      
      // fastify.log.info(`📊 文件大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      
      // if (fileSize > maxSize) {
      //   fastify.log.warn(`❌ 文件过大: ${fileSize} > ${maxSize}`);
      //   return reply.code(400).send({
      //     success: false,
      //     error: `文件大小超过限制 (${Math.round(maxSize / 1024 / 1024)}MB)`
      //   });
      // }

      // 检查文件类型 - 扩展支持更多数学相关格式
      const allowedTypes = [
        // PDF文件
        'application/pdf',
        // 标准图像格式
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        // 额外支持的图像格式
        'image/bmp',
        'image/tiff',
        'image/tif',
        'image/svg+xml',
        // Microsoft Office格式（包含数学公式）
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        // 支持常见的扫描仪输出格式
        'image/x-portable-bitmap', // .pbm
        'image/x-portable-graymap', // .pgm
        'image/x-portable-pixmap' // .ppm
      ];

      if (!allowedTypes.includes(mimetype)) {
        return sendError(reply, '不支持的文件类型，请上传PDF或图片文件', 400);
      }

      // 改进文件路径生成逻辑
      const fileExt = path.extname(filename);
      const uniqueFilename = `${uuidv4()}${fileExt}`;
      
      // 根据文件类型和用户角色生成更有意义的路径
      let filePath: string;
      const userRole = request.currentUser!.role?.toLowerCase() || 'student';
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (workMode === 'homework' && assignmentId) {
        // 作业提交文件：homework-submissions/assignment-{id}/student-{userId}/filename
        filePath = `homework-submissions/assignment-${assignmentId}/student-${request.currentUser!.id}/${uniqueFilename}`;
      } else if (userRole === 'teacher') {
        // 教师上传的文件（如题目）：teacher-files/user-{userId}/date/filename
        filePath = `teacher-files/user-${request.currentUser!.id}/${timestamp}/${uniqueFilename}`;
      } else {
        // 学生练习文件：student-practice/user-{userId}/date/filename
        filePath = `student-practice/user-${request.currentUser!.id}/${timestamp}/${uniqueFilename}`;
      }

      // 使用admin客户端上传到Supabase Storage
      const storageClient = supabaseAdmin || supabase;

      // 先检查bucket是否存在
      try {
        // 增加超时控制的bucket检查
        const bucketCheckPromise = storageClient.storage.listBuckets();
        const bucketCheckTimeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Bucket检查超时')), 10000); // 10秒超时
        });

        const { data: buckets, error: listError } = await Promise.race([bucketCheckPromise, bucketCheckTimeout]);

        if (listError) {
          fastify.log.error('❌ 获取bucket列表失败:', {
            message: listError.message,
            details: listError
          });
        }
      } catch (bucketCheckError) {
        fastify.log.error('❌ 检查bucket时发生异常:', {
          message: bucketCheckError instanceof Error ? bucketCheckError.message : 'Unknown error',
          code: (bucketCheckError as any)?.code,
          cause: (bucketCheckError as any)?.cause?.message,
          type: bucketCheckError instanceof Error ? bucketCheckError.constructor.name : typeof bucketCheckError
        });

        // 如果是网络连接问题，提供友好的错误信息
        if (bucketCheckError instanceof Error) {
          if (bucketCheckError.message.includes('timeout') || bucketCheckError.message.includes('TIMEOUT')) {
            fastify.log.warn('⚠️ 网络连接超时，可能是网络环境问题或需要代理');
          } else if (bucketCheckError.message.includes('fetch failed') || bucketCheckError.message.includes('ECONNRESET')) {
            fastify.log.warn('⚠️ 网络连接失败，请检查网络环境或防火墙设置');
          }
        }
      }

      // 创建超时Promise来防止无限等待
      const uploadTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Supabase Storage upload timeout after 30 seconds')), 30000);
      });

      let uploadData: any, uploadError: any;
      try {
        // 读取临时文件内容
        const fileBuffer = fs.readFileSync(tempPath);

        const uploadPromise = storageClient.storage
          .from(STORAGE_BUCKETS.ASSIGNMENTS)
          .upload(filePath, fileBuffer, {
            contentType: mimetype,
            upsert: false
          });

        const result = await Promise.race([uploadPromise, uploadTimeout]);
        uploadData = result.data;
        uploadError = result.error;
      } catch (timeoutError) {
        fastify.log.error('⏰ Supabase Storage上传超时:', timeoutError);
        // 清理临时文件
        try {
          fs.unlinkSync(tempPath);
        } catch (cleanupError) {
          fastify.log.warn('⚠️ 临时文件清理失败:', cleanupError);
        }
        return sendError(reply, '文件上传超时，可能是网络问题或Supabase服务响应慢', 500);
      }

      if (uploadError) {
        fastify.log.error('❌ Supabase Storage上传失败:', {
          message: uploadError.message,
          status: uploadError.status,
          statusCode: uploadError.statusCode,
          details: uploadError
        });
        
        // 检查是否是网络连接问题
        if (uploadError.message?.includes('timeout') || uploadError.message?.includes('fetch failed')) {
          // 清理临时文件
          try {
            fs.unlinkSync(tempPath);
          } catch (cleanupError) {
            fastify.log.warn('⚠️ 临时文件清理失败:', cleanupError);
          }
          return sendError(
            reply,
            '网络连接超时，请检查网络环境或稍后重试。如果问题持续，可能需要配置代理或联系管理员。',
            503
          );
        }
        
        // 如果bucket不存在，尝试创建
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          const { error: bucketError } = await storageClient.storage.createBucket(STORAGE_BUCKETS.ASSIGNMENTS, {
            public: false,
            allowedMimeTypes: allowedTypes,
            fileSizeLimit: maxSize
          });

          if (bucketError) {
            fastify.log.error('❌ 创建bucket失败:', bucketError);
            return sendError(reply, `无法创建存储bucket: ${bucketError.message}`, 500);
          } else {
            // 重试上传，同样使用超时机制
            try {
              const fileBuffer = fs.readFileSync(tempPath);
              const retryUploadPromise = storageClient.storage
                .from(STORAGE_BUCKETS.ASSIGNMENTS)
                .upload(filePath, fileBuffer, {
                  contentType: mimetype,
                  upsert: false
                });

              const retryUploadTimeout = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Retry upload timeout after 30 seconds')), 30000);
              });

              const retryResult = await Promise.race([retryUploadPromise, retryUploadTimeout]);

              if (retryResult.error) {
                fastify.log.error('❌ 重试上传失败:', retryResult.error);
                // 清理临时文件
                try {
                  fs.unlinkSync(tempPath);
                } catch (cleanupError) {
                  fastify.log.warn('⚠️ 临时文件清理失败:', cleanupError);
                }
                return sendError(reply, `文件上传失败: ${retryResult.error.message}`, 500);
              }
              uploadData = retryResult.data;
            } catch (retryTimeoutError) {
              fastify.log.error('⏰ 重试上传超时:', retryTimeoutError);
              // 清理临时文件
              try {
                fs.unlinkSync(tempPath);
              } catch (cleanupError) {
                fastify.log.warn('⚠️ 临时文件清理失败:', cleanupError);
              }
              return sendError(reply, '重试上传超时，请检查网络连接和Supabase服务状态', 500);
            }
          }
        } else {
          // 清理临时文件
          try {
            fs.unlinkSync(tempPath);
          } catch (cleanupError) {
            fastify.log.warn('⚠️ 临时文件清理失败:', cleanupError);
          }
          return sendError(reply, `文件上传失败: ${uploadError.message}`, 500);
        }
      }

      // 清理临时文件
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        fastify.log.warn('⚠️ 临时文件清理失败:', cleanupError);
      }

      // 获取文件的公共URL (使用supabase客户端，因为admin不能生成公共URL)
      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_BUCKETS.ASSIGNMENTS)
        .getPublicUrl(filePath);


      // 保存文件记录到数据库
      const fileUpload = await prisma.fileUpload.create({
        data: {
          userId: request.currentUser!.id,
          filename: uniqueFilename,
          originalName: filename,
          filePath: filePath,
          mimeType: mimetype,
          fileSize: fileSize,
          uploadType: workMode === 'homework' ? 'homework' : 'practice',
          metadata: {
            supabaseKey: uploadData?.path || filePath,
            publicUrl: publicUrlData.publicUrl,
            workMode: workMode,
            assignmentId: assignmentId,
            userRole: userRole
          }
        }
      });

      const processingTime = Date.now() - startTime;

      return successResponse({
        fileId: fileUpload.id,
        filename: fileUpload.filename,
        originalName: fileUpload.originalName,
        fileSize: fileUpload.fileSize,
        mimeType: fileUpload.mimeType,
        uploadedAt: fileUpload.createdAt,
        downloadUrl: publicUrlData.publicUrl
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      fastify.log.error(`❌ 文件上传处理失败 (${processingTime}ms):`, error);

      // 清理可能存在的临时文件
      const tempDir = os.tmpdir();
      const tempFiles = fs.readdirSync(tempDir).filter(file => file.startsWith('upload-') && file.endsWith('.tmp'));
      tempFiles.forEach(file => {
        try {
          fs.unlinkSync(path.join(tempDir, file));
        } catch (cleanupError) {
          // Silently fail temp file cleanup in catch block
        }
      });
      
      // 确保总是返回适当的错误响应
      if (!reply.sent) {
        return handleRouteError(fastify, reply, error, '文件上传处理失败');
      }
    }
  });

  // 获取用户文件列表
  fastify.get('/files', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const files = await prisma.fileUpload.findMany({
        where: { userId: request.currentUser!.id },
        orderBy: { createdAt: 'desc' },
        include: {
          submissions: {
            include: {
              mathpixResults: true,
              deepseekResults: true
            }
          }
        }
      });

      return successResponse({ files });
    } catch (error) {
      return handleRouteError(fastify, reply, error, '获取文件列表失败');
    }
  });

  // 优化的文件下载接口 - 允许学生下载作业题目文件
  fastify.get('/files/:fileId/download', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const fileId = parseInt((request.params as any).fileId);
      
      // 首先尝试找到文件
      const file = await prisma.fileUpload.findUnique({
        where: { id: fileId },
        include: {
          user: {
            select: { id: true, role: true, username: true }
          }
        }
      });

      if (!file) {
        return sendError(reply, '文件不存在', 404);
      }

      // 权限检查逻辑
      const currentUser = request.currentUser!;
      const isOwner = file.userId === currentUser.id;

      // 如果是文件所有者，直接允许下载
      if (isOwner) {
        // 继续下载流程
      }
      // 如果不是所有者，检查是否有权限访问
      else {
        // 检查该文件是否是作业题目文件
        const assignment = await prisma.assignment.findFirst({
          where: {
            fileUploadId: fileId,
            isActive: true
          },
          include: {
            classroom: {
              include: {
                members: {
                  where: {
                    studentId: currentUser.id,
                    isActive: true
                  }
                }
              }
            }
          }
        });

        // 如果是作业题目文件且用户是该班级成员，允许下载
        if (assignment && assignment.classroom.members.length > 0) {
          // 有权限，继续下载
        } else {
          return sendError(reply, '无权限下载此文件', 403);
        }
      }

      // 从Supabase Storage获取文件 - 使用admin客户端访问私有bucket
      const storageClient = supabaseAdmin || supabase;
      const { data, error } = await storageClient.storage
        .from(STORAGE_BUCKETS.ASSIGNMENTS)
        .download(file.filePath);

      if (error) {
        fastify.log.error('从Supabase Storage下载文件失败:', error);
        return sendError(reply, '文件下载失败：文件可能已被删除或移动', 404);
      }

      // 设置响应头并返回文件
      reply.header('Content-Type', file.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      
      return reply.send(Buffer.from(await data.arrayBuffer()));

    } catch (error) {
      return handleRouteError(fastify, reply, error, '文件下载处理失败');
    }
  });

  // 获取文件信息接口（不下载文件内容）
  fastify.get('/files/:fileId/info', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const fileId = parseInt((request.params as any).fileId);
      
      const file = await prisma.fileUpload.findFirst({
        where: {
          id: fileId,
          userId: request.currentUser!.id
        },
        select: {
          id: true,
          filename: true,
          originalName: true,
          fileSize: true,
          mimeType: true,
          createdAt: true,
          uploadType: true,
          metadata: true
        }
      });

      if (!file) {
        return sendError(reply, '文件不存在', 404);
      }

      return successResponse(file);

    } catch (error) {
      return handleRouteError(fastify, reply, error, '获取文件信息失败');
    }
  });

  // Debug endpoint - 测试Supabase连接
  fastify.get('/debug/supabase', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const results: any = {
        timestamp: new Date().toISOString(),
        user: request.currentUser?.id
      };

      // 测试admin客户端
      if (supabaseAdmin) {
        try {
          const { data: adminBuckets, error: adminError } = await supabaseAdmin.storage.listBuckets();
          results.adminClient = {
            available: true,
            buckets: adminBuckets?.map(b => b.name) || [],
            error: adminError ? adminError.message : null
          };
        } catch (adminErr) {
          results.adminClient = {
            available: false,
            error: adminErr instanceof Error ? adminErr.message : 'Unknown error'
          };
        }
      } else {
        results.adminClient = { available: false, error: 'Service role key not configured' };
      }

      // 测试普通客户端
      try {
        const { data: anonBuckets, error: anonError } = await supabase.storage.listBuckets();
        results.anonClient = {
          available: true,
          buckets: anonBuckets?.map(b => b.name) || [],
          error: anonError ? anonError.message : null
        };
      } catch (anonErr) {
        results.anonClient = {
          available: false,
          error: anonErr instanceof Error ? anonErr.message : 'Unknown error'
        };
      }

      // 检查目标bucket
      const targetBucket = STORAGE_BUCKETS.ASSIGNMENTS;
      results.targetBucket = {
        name: targetBucket,
        existsInAdmin: results.adminClient.buckets?.includes(targetBucket) || false,
        existsInAnon: results.anonClient.buckets?.includes(targetBucket) || false
      };

      return successResponse(results);

    } catch (error) {
      return handleRouteError(fastify, reply, error, 'Debug endpoint错误');
    }
  });
} 
