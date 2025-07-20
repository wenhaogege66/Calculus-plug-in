// 作业提交路由

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 创建新的作业提交
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { fileUploadId, metadata } = req.body;
  const userId = req.user?.userId;

  if (!fileUploadId) {
    return res.status(400).json({
      success: false,
      error: '文件上传ID是必填项'
    });
  }

  // 创建提交记录
  const submission = {
    id: uuidv4(),
    userId,
    fileUploadId,
    status: 'uploaded',
    submittedAt: new Date().toISOString(),
    metadata: metadata || {}
  };

  // 这里应该保存到数据库
  // await saveSubmissionToDatabase(submission);

  res.json({
    success: true,
    data: submission
  });
}));

// 获取作业提交详情
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  // 临时返回模拟数据
  const submission = {
    id,
    userId,
    fileUpload: {
      id: 'file_123',
      filename: 'homework.pdf',
      originalName: '微积分作业.pdf',
      size: 1024000,
      type: 'application/pdf',
      url: '/api/files/user123/homework.pdf',
      uploadedAt: new Date().toISOString()
    },
    myScriptResult: {
      id: 'ocr_123',
      text: '∫x²dx = x³/3 + C',
      mathml: '<math><mi>x</mi><mo>²</mo></math>',
      latex: '\\int x^2 dx = \\frac{x^3}{3} + C',
      confidence: 0.95,
      expressions: [],
      processedAt: new Date().toISOString()
    },
    deepseekResult: {
      id: 'ai_123',
      score: 85,
      maxScore: 100,
      feedback: '解答基本正确，但缺少一些步骤说明。',
      errors: [
        {
          id: 'error_1',
          type: 'method',
          description: '缺少积分常数的说明',
          suggestion: '应该说明为什么要加积分常数C',
          severity: 'medium'
        }
      ],
      suggestions: ['建议加强对积分基本定理的理解'],
      strengths: ['积分计算正确', '符号使用规范'],
      gradedAt: new Date().toISOString()
    },
    status: 'completed',
    submittedAt: new Date().toISOString(),
    completedAt: new Date().toISOString()
  };

  res.json({
    success: true,
    data: submission
  });
}));

// 获取用户的作业提交列表
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { limit = 10, offset = 0, status } = req.query;

  // 临时返回模拟数据
  const submissions = [
    {
      id: 'sub_1',
      userId,
      fileUpload: {
        id: 'file_1',
        filename: 'homework1.pdf',
        originalName: '微积分作业1.pdf',
        uploadedAt: new Date().toISOString()
      },
      status: 'completed',
      submittedAt: new Date().toISOString(),
      deepseekResult: {
        score: 85
      }
    },
    {
      id: 'sub_2',
      userId,
      fileUpload: {
        id: 'file_2',
        filename: 'homework2.jpg',
        originalName: '手写作业.jpg',
        uploadedAt: new Date().toISOString()
      },
      status: 'processing',
      submittedAt: new Date().toISOString()
    }
  ];

  const filteredSubmissions = status 
    ? submissions.filter(sub => sub.status === status)
    : submissions;

  res.json({
    success: true,
    data: {
      submissions: filteredSubmissions.slice(Number(offset), Number(offset) + Number(limit)),
      total: filteredSubmissions.length,
      limit: Number(limit),
      offset: Number(offset)
    }
  });
}));

// 更新作业提交
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = req.user?.userId;

  // 这里应该验证用户权限和更新数据库
  // const submission = await updateSubmissionInDatabase(id, updates, userId);

  const updatedSubmission = {
    id,
    userId,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  res.json({
    success: true,
    data: updatedSubmission
  });
}));

// 删除作业提交
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  // 这里应该验证权限并删除数据库记录
  // await deleteSubmissionFromDatabase(id, userId);

  res.json({
    success: true,
    message: '作业提交已删除'
  });
}));

export default router; 