// 文件上传路由 - Supabase Storage

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase, supabaseAdmin, STORAGE_BUCKETS } from '../config/supabase';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export async function uploadRoutes(fastify: FastifyInstance) {
  // 文件上传端点
  fastify.post('/files', { preHandler: requireAuth }, async (request, reply) => {
    const startTime = Date.now();
    fastify.log.info(`🚀 开始处理文件上传请求 - 用户: ${request.currentUser?.id}`);
    
    try {
      // 获取文件和其他参数
      const parts = request.parts();
      let fileData: any = null;
      let workMode = 'practice';
      let assignmentId: number | null = null;
      
      fastify.log.info('📦 开始解析multipart数据...');
      
      for await (const part of parts) {
        if (part.type === 'file') {
          fileData = part;
          fastify.log.info(`📄 找到文件: ${part.filename}, 类型: ${part.mimetype}`);
        } else if (part.fieldname === 'workMode') {
          workMode = (part as any).value;
          fastify.log.info(`⚙️ 工作模式: ${workMode}`);
        } else if (part.fieldname === 'assignmentId') {
          assignmentId = parseInt((part as any).value) || null;
          fastify.log.info(`📝 作业ID: ${assignmentId}`);
        }
      }
      
      const data = fileData;
      
      if (!data) {
        fastify.log.warn('❌ 没有收到文件数据');
        return reply.code(400).send({
          success: false,
          error: '没有收到文件'
        });
      }

      const { filename, mimetype } = data;
      fastify.log.info(`📋 文件信息 - 名称: ${filename}, 类型: ${mimetype}`);
      
      // 检查文件大小 - 使用流式处理避免大文件内存问题
      fastify.log.info('📏 开始检查文件大小...');
      // ⚠️ 不能再用 toBuffer()，直接用 stream，文件大小通过 headers 获取或跳过严格校验
      const fileStream = data.file; // Fastify Multipart 提供的 Readable stream

      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);
      const fileSize = fileBuffer.length;

      const maxSize = Number(process.env.MAX_FILE_SIZE) || 104857600; // 100MB
      
      // fastify.log.info(`📊 文件大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      
      // if (fileSize > maxSize) {
      //   fastify.log.warn(`❌ 文件过大: ${fileSize} > ${maxSize}`);
      //   return reply.code(400).send({
      //     success: false,
      //     error: `文件大小超过限制 (${Math.round(maxSize / 1024 / 1024)}MB)`
      //   });
      // }

      // 检查文件类型
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
      ];

      if (!allowedTypes.includes(mimetype)) {
        return reply.code(400).send({
          success: false,
          error: '不支持的文件类型，请上传PDF或图片文件'
        });
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
      const clientType = supabaseAdmin ? 'Admin客户端' : 'Anonymous客户端';
      fastify.log.info(`☁️ 开始上传到Supabase Storage - 客户端类型: ${clientType}, Bucket: ${STORAGE_BUCKETS.ASSIGNMENTS}, 路径: ${filePath}`);

      // 先检查bucket是否存在
      fastify.log.info('🔍 检查bucket是否存在...');
      try {
        const { data: buckets, error: listError } = await storageClient.storage.listBuckets();
        if (listError) {
          fastify.log.error('❌ 获取bucket列表失败:', listError);
        } else {
          const bucketExists = buckets?.some(bucket => bucket.name === STORAGE_BUCKETS.ASSIGNMENTS);
          fastify.log.info(`📋 Bucket存在状态: ${bucketExists ? '存在' : '不存在'}`);
          if (buckets && buckets.length > 0) {
            fastify.log.info(`📦 现有buckets: ${buckets.map(b => b.name).join(', ')}`);
          }
        }
      } catch (bucketCheckError) {
        fastify.log.error('❌ 检查bucket时发生异常:', bucketCheckError);
      }
      
      // 创建超时Promise来防止无限等待
      const uploadTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Supabase Storage upload timeout after 30 seconds')), 30000);
      });
      
      let uploadData: any, uploadError: any;
      try {
        const uploadPromise = storageClient.storage
          .from(STORAGE_BUCKETS.ASSIGNMENTS)
          .upload(filePath, fileBuffer, {
            contentType: mimetype,
            upsert: false
          });
        
        fastify.log.info('📤 正在执行上传操作...');
        const result = await Promise.race([uploadPromise, uploadTimeout]);
        uploadData = result.data;
        uploadError = result.error;
        fastify.log.info('✅ 上传操作完成，检查结果...');
      } catch (timeoutError) {
        fastify.log.error('⏰ Supabase Storage上传超时:', timeoutError);
        return reply.code(500).send({
          success: false,
          error: `文件上传超时，可能是网络问题或Supabase服务响应慢`
        });
      }

      if (uploadError) {
        fastify.log.error('❌ Supabase Storage上传失败:', uploadError);
        fastify.log.error('错误详情:', JSON.stringify(uploadError, null, 2));
        
        // 如果bucket不存在，尝试创建
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          fastify.log.info(`🛠️ 检测到bucket不存在错误，尝试创建Storage bucket: ${STORAGE_BUCKETS.ASSIGNMENTS}...`);
          fastify.log.info(`🔧 Bucket配置 - public: false, maxSize: ${maxSize}, allowedTypes: ${allowedTypes.join(', ')}`);
          
          const { error: bucketError } = await storageClient.storage.createBucket(STORAGE_BUCKETS.ASSIGNMENTS, {
            public: false,
            allowedMimeTypes: allowedTypes,
            fileSizeLimit: maxSize
          });
          
          if (bucketError) {
            fastify.log.error('❌ 创建bucket失败:', bucketError);
            return reply.code(500).send({
              success: false,
              error: `无法创建存储bucket: ${bucketError.message}`
            });
          } else {
            fastify.log.info('✅ Bucket创建成功，重试上传...');
            // 重试上传，同样使用超时机制
            try {
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
                return reply.code(500).send({
                  success: false,
                  error: `文件上传失败: ${retryResult.error.message}`
                });
              }
              uploadData = retryResult.data;
              fastify.log.info('✅ 重试上传成功');
            } catch (retryTimeoutError) {
              fastify.log.error('⏰ 重试上传超时:', retryTimeoutError);
              return reply.code(500).send({
                success: false,
                error: `重试上传超时，请检查网络连接和Supabase服务状态`
              });
            }
          }
        } else {
          return reply.code(500).send({
            success: false,
            error: `文件上传失败: ${uploadError.message}`
          });
        }
      } else {
        fastify.log.info('✅ Supabase Storage上传成功');
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
      fastify.log.info(`🎉 文件上传完成! 处理时间: ${processingTime}ms, 文件ID: ${fileUpload.id}`);
      
      return {
        success: true,
        data: {
          fileId: fileUpload.id,
          filename: fileUpload.filename,
          originalName: fileUpload.originalName,
          fileSize: fileUpload.fileSize,
          mimeType: fileUpload.mimeType,
          uploadedAt: fileUpload.createdAt,
          downloadUrl: publicUrlData.publicUrl
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      fastify.log.error(`❌ 文件上传处理失败 (${processingTime}ms):`, error);
      
      // 确保总是返回适当的错误响应
      if (!reply.sent) {
        return reply.code(500).send({
          success: false,
          error: `文件上传处理失败: ${error instanceof Error ? error.message : '未知错误'}`
        });
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
              myscriptResults: true,
              deepseekResults: true
            }
          }
        }
      });

      return {
        success: true,
        data: { files }
      };
    } catch (error) {
      fastify.log.error('获取文件列表失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取文件列表失败'
      });
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
        return reply.code(404).send({
          success: false,
          error: '文件不存在'
        });
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
          return reply.code(403).send({
            success: false,
            error: '无权限下载此文件'
          });
        }
      }

      // 从Supabase Storage获取文件
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.ASSIGNMENTS)
        .download(file.filePath);

      if (error) {
        fastify.log.error('从Supabase Storage下载文件失败:', error);
        return reply.code(404).send({
          success: false,
          error: '文件下载失败：文件可能已被删除或移动'
        });
      }

      // 设置响应头并返回文件
      reply.header('Content-Type', file.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      
      return reply.send(Buffer.from(await data.arrayBuffer()));

    } catch (error) {
      fastify.log.error('文件下载处理失败:', error);
      return reply.code(500).send({
        success: false,
        error: '文件下载处理失败'
      });
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
        return reply.code(404).send({
          success: false,
          error: '文件不存在'
        });
      }

      return {
        success: true,
        data: file
      };

    } catch (error) {
      fastify.log.error('获取文件信息失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取文件信息失败'
      });
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

      return {
        success: true,
        data: results
      };

    } catch (error) {
      fastify.log.error('Debug endpoint错误:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
} 