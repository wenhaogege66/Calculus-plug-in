// 文件上传路由

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 支持的文件类型
const SUPPORTED_TYPES = [
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png'
];

// 文件大小限制 (10MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760');

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 根据用户ID创建子目录
    const userId = req.user?.userId || 'anonymous';
    const userDir = path.join(uploadsDir, userId);
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const fileExtension = path.extname(file.originalname);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    cb(null, uniqueFileName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5 // 最多5个文件
  },
  fileFilter: (req, file, cb) => {
    // 检查文件类型
    if (SUPPORTED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
  }
});

// 单文件上传
router.post('/', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: '没有上传文件'
    });
  }

  const fileInfo = {
    id: uuidv4(),
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
    url: `/api/files/${req.user?.userId || 'anonymous'}/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.user?.userId || null
  };

  // 这里应该将文件信息保存到数据库
  // await saveFileToDatabase(fileInfo);

  res.json({
    success: true,
    data: {
      id: fileInfo.id,
      filename: fileInfo.filename,
      originalName: fileInfo.originalName,
      size: fileInfo.size,
      type: fileInfo.mimetype,
      url: fileInfo.url,
      uploadedAt: fileInfo.uploadedAt
    }
  });
}));

// 多文件上传
router.post('/multiple', upload.array('files', 5), asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: '没有上传文件'
    });
  }

  const fileInfos = files.map(file => {
    const fileInfo = {
      id: uuidv4(),
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      url: `/api/files/${req.user?.userId || 'anonymous'}/${file.filename}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user?.userId || null
    };

    return {
      id: fileInfo.id,
      filename: fileInfo.filename,
      originalName: fileInfo.originalName,
      size: fileInfo.size,
      type: fileInfo.mimetype,
      url: fileInfo.url,
      uploadedAt: fileInfo.uploadedAt
    };
  });

  // 这里应该将文件信息保存到数据库
  // await Promise.all(fileInfos.map(info => saveFileToDatabase(info)));

  res.json({
    success: true,
    data: fileInfos
  });
}));

// 获取文件
router.get('/:userId/:filename', asyncHandler(async (req: Request, res: Response) => {
  const { userId, filename } = req.params;
  
  // 检查权限：用户只能访问自己的文件，或者管理员可以访问所有文件
  if (req.user?.userId !== userId && req.user?.role !== 'teacher') {
    return res.status(403).json({
      success: false,
      error: '没有权限访问此文件'
    });
  }

  const filePath = path.join(uploadsDir, userId, filename);
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: '文件不存在'
    });
  }

  // 获取文件信息
  const stats = fs.statSync(filePath);
  const fileExtension = path.extname(filename).toLowerCase();
  
  // 设置适当的Content-Type
  let contentType = 'application/octet-stream';
  switch (fileExtension) {
    case '.pdf':
      contentType = 'application/pdf';
      break;
    case '.txt':
      contentType = 'text/plain';
      break;
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
    case '.png':
      contentType = 'image/png';
      break;
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  
  // 发送文件
  res.sendFile(filePath);
}));

// 删除文件
router.delete('/:userId/:filename', asyncHandler(async (req: Request, res: Response) => {
  const { userId, filename } = req.params;
  
  // 检查权限：用户只能删除自己的文件
  if (req.user?.userId !== userId && req.user?.role !== 'teacher') {
    return res.status(403).json({
      success: false,
      error: '没有权限删除此文件'
    });
  }

  const filePath = path.join(uploadsDir, userId, filename);
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: '文件不存在'
    });
  }

  try {
    // 删除文件
    fs.unlinkSync(filePath);
    
    // 这里应该从数据库中删除文件记录
    // await deleteFileFromDatabase(filename);
    
    res.json({
      success: true,
      message: '文件删除成功'
    });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({
      success: false,
      error: '删除文件失败'
    });
  }
}));

// 获取用户的文件列表
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: '需要登录'
    });
  }

  const userDir = path.join(uploadsDir, userId);
  
  if (!fs.existsSync(userDir)) {
    return res.json({
      success: true,
      data: []
    });
  }

  try {
    const files = fs.readdirSync(userDir);
    const fileInfos = files.map(filename => {
      const filePath = path.join(userDir, filename);
      const stats = fs.statSync(filePath);
      
      return {
        filename,
        size: stats.size,
        url: `/api/files/${userId}/${filename}`,
        uploadedAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString()
      };
    });

    res.json({
      success: true,
      data: fileInfos
    });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文件列表失败'
    });
  }
}));

// 错误处理中间件
router.use((error: any, req: Request, res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `文件大小超过限制 (${MAX_FILE_SIZE / 1024 / 1024}MB)`
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: '文件数量超过限制'
      });
    }
  }
  
  next(error);
});

export default router; 