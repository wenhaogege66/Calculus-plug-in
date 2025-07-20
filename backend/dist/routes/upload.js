"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const SUPPORTED_TYPES = [
    'application/pdf',
    'text/plain',
    'image/jpeg',
    'image/png'
];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760');
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.user?.userId || 'anonymous';
        const userDir = path_1.default.join(uploadsDir, userId);
        if (!fs_1.default.existsSync(userDir)) {
            fs_1.default.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const fileExtension = path_1.default.extname(file.originalname);
        const uniqueFileName = `${(0, uuid_1.v4)()}${fileExtension}`;
        cb(null, uniqueFileName);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 5
    },
    fileFilter: (req, file, cb) => {
        if (SUPPORTED_TYPES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`不支持的文件类型: ${file.mimetype}`));
        }
    }
});
router.post('/', upload.single('file'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: '没有上传文件'
        });
    }
    const fileInfo = {
        id: (0, uuid_1.v4)(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        url: `/api/files/${req.user?.userId || 'anonymous'}/${req.file.filename}`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.userId || null
    };
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
router.post('/multiple', upload.array('files', 5), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const files = req.files;
    if (!files || files.length === 0) {
        return res.status(400).json({
            success: false,
            error: '没有上传文件'
        });
    }
    const fileInfos = files.map(file => {
        const fileInfo = {
            id: (0, uuid_1.v4)(),
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
    res.json({
        success: true,
        data: fileInfos
    });
}));
router.get('/:userId/:filename', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId, filename } = req.params;
    if (req.user?.userId !== userId && req.user?.role !== 'teacher') {
        return res.status(403).json({
            success: false,
            error: '没有权限访问此文件'
        });
    }
    const filePath = path_1.default.join(uploadsDir, userId, filename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            error: '文件不存在'
        });
    }
    const stats = fs_1.default.statSync(filePath);
    const fileExtension = path_1.default.extname(filename).toLowerCase();
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
    res.sendFile(filePath);
}));
router.delete('/:userId/:filename', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { userId, filename } = req.params;
    if (req.user?.userId !== userId && req.user?.role !== 'teacher') {
        return res.status(403).json({
            success: false,
            error: '没有权限删除此文件'
        });
    }
    const filePath = path_1.default.join(uploadsDir, userId, filename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            error: '文件不存在'
        });
    }
    try {
        fs_1.default.unlinkSync(filePath);
        res.json({
            success: true,
            message: '文件删除成功'
        });
    }
    catch (error) {
        console.error('删除文件失败:', error);
        res.status(500).json({
            success: false,
            error: '删除文件失败'
        });
    }
}));
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: '需要登录'
        });
    }
    const userDir = path_1.default.join(uploadsDir, userId);
    if (!fs_1.default.existsSync(userDir)) {
        return res.json({
            success: true,
            data: []
        });
    }
    try {
        const files = fs_1.default.readdirSync(userDir);
        const fileInfos = files.map(filename => {
            const filePath = path_1.default.join(userDir, filename);
            const stats = fs_1.default.statSync(filePath);
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
    }
    catch (error) {
        console.error('获取文件列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取文件列表失败'
        });
    }
}));
router.use((error, req, res, next) => {
    if (error instanceof multer_1.default.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: `文件大小超过限制 (${MAX_FILE_SIZE / 1024 / 1024}MB)`
            });
        }
        else if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: '文件数量超过限制'
            });
        }
    }
    next(error);
});
exports.default = router;
//# sourceMappingURL=upload.js.map