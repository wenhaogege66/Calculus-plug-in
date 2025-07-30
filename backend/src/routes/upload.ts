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
            assignmentId: assignmentId,
            userRole: userRole
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
} 