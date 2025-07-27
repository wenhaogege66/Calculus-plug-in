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
    try {
      // 获取文件和其他参数
      const parts = request.parts();
      let fileData: any = null;
      let workMode = 'practice';
      let assignmentId: number | null = null;
      
      for await (const part of parts) {
        if (part.type === 'file') {
          fileData = part;
        } else if (part.fieldname === 'workMode') {
          workMode = (part as any).value;
        } else if (part.fieldname === 'assignmentId') {
          assignmentId = parseInt((part as any).value) || null;
        }
      }
      
      const data = fileData;
      
      if (!data) {
        return reply.code(400).send({
          success: false,
          error: '没有收到文件'
        });
      }

      const { filename, mimetype } = data;
      
      // 检查文件大小
      const buffer = await data.toBuffer();
      const fileSize = buffer.length;
      const maxSize = Number(process.env.MAX_FILE_SIZE) || 104857600; // 100MB
      
      if (fileSize > maxSize) {
        return reply.code(400).send({
          success: false,
          error: `文件大小超过限制 (${Math.round(maxSize / 1024 / 1024)}MB)`
        });
      }

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

      // 生成唯一文件名
      const fileExt = path.extname(filename);
      const uniqueFilename = `${uuidv4()}${fileExt}`;
      const filePath = `assignments/${request.currentUser!.id}/${uniqueFilename}`;

      // 使用admin客户端上传到Supabase Storage
      const storageClient = supabaseAdmin || supabase;
      let { data: uploadData, error: uploadError } = await storageClient.storage
        .from(STORAGE_BUCKETS.ASSIGNMENTS)
        .upload(filePath, buffer, {
          contentType: mimetype,
          upsert: false
        });

      if (uploadError) {
        fastify.log.error('Supabase Storage上传失败:', uploadError);
        
        // 如果bucket不存在，尝试创建
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          fastify.log.info('尝试创建Storage bucket...');
          const { error: bucketError } = await storageClient.storage.createBucket(STORAGE_BUCKETS.ASSIGNMENTS, {
            public: false,
            allowedMimeTypes: allowedTypes,
            fileSizeLimit: maxSize
          });
          
          if (bucketError) {
            fastify.log.error('创建bucket失败:', bucketError);
          } else {
            // 重试上传
            const { data: retryUploadData, error: retryUploadError } = await storageClient.storage
              .from(STORAGE_BUCKETS.ASSIGNMENTS)
              .upload(filePath, buffer, {
                contentType: mimetype,
                upsert: false
              });
            
            if (retryUploadError) {
              fastify.log.error('重试上传失败:', retryUploadError);
              return reply.code(500).send({
                success: false,
                error: `文件上传失败: ${retryUploadError.message}`
              });
            }
            uploadData = retryUploadData;
          }
        } else {
          return reply.code(500).send({
            success: false,
            error: `文件上传失败: ${uploadError.message}`
          });
        }
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
            assignmentId: assignmentId
          }
        }
      });

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
      fastify.log.error('文件上传处理失败:', error);
      return reply.code(500).send({
        success: false,
        error: `文件上传处理失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
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

  // 下载文件
  fastify.get('/files/:fileId/download', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const fileId = parseInt((request.params as any).fileId);
      
      const file = await prisma.fileUpload.findFirst({
        where: {
          id: fileId,
          userId: request.currentUser!.id // 确保用户只能下载自己的文件
        }
      });

      if (!file) {
        return reply.code(404).send({
          success: false,
          error: '文件不存在'
        });
      }

      // 从Supabase Storage获取文件
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.ASSIGNMENTS)
        .download(file.filePath);

      if (error) {
        fastify.log.error('从Supabase Storage下载文件失败:', error);
        return reply.code(404).send({
          success: false,
          error: '文件下载失败'
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

  // 删除文件
  fastify.delete('/files/:fileId', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const fileId = parseInt((request.params as any).fileId);
      
      const file = await prisma.fileUpload.findFirst({
        where: {
          id: fileId,
          userId: request.currentUser!.id
        }
      });

      if (!file) {
        return reply.code(404).send({
          success: false,
          error: '文件不存在'
        });
      }

      // 从Supabase Storage删除文件
      const { error: deleteError } = await supabase.storage
        .from(STORAGE_BUCKETS.ASSIGNMENTS)
        .remove([file.filePath]);

      if (deleteError) {
        fastify.log.error('从Supabase Storage删除文件失败:', deleteError);
      }

      // 从数据库删除记录 (级联删除相关提交)
      await prisma.fileUpload.delete({
        where: { id: fileId }
      });

      return {
        success: true,
        message: '文件删除成功'
      };

    } catch (error) {
      fastify.log.error('文件删除处理失败:', error);
      return reply.code(500).send({
        success: false,
        error: '文件删除处理失败'
      });
    }
  });
} 