"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { fileUploadId, metadata } = req.body;
    const userId = req.user?.userId;
    if (!fileUploadId) {
        return res.status(400).json({
            success: false,
            error: '文件上传ID是必填项'
        });
    }
    const submission = {
        id: (0, uuid_1.v4)(),
        userId,
        fileUploadId,
        status: 'uploaded',
        submittedAt: new Date().toISOString(),
        metadata: metadata || {}
    };
    res.json({
        success: true,
        data: submission
    });
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
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
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const { limit = 10, offset = 0, status } = req.query;
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
router.put('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user?.userId;
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
router.delete('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    res.json({
        success: true,
        message: '作业提交已删除'
    });
}));
exports.default = router;
//# sourceMappingURL=submissions.js.map