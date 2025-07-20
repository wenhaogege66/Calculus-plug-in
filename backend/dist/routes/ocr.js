"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const MYSCRIPT_CONFIG = {
    apiEndpoint: process.env.MYSCRIPT_API_ENDPOINT || 'https://cloud.myscript.com/api/v4.0/iink',
    wsEndpoint: process.env.MYSCRIPT_WEBSOCKET_ENDPOINT || 'wss://cloud.myscript.com/api/v4.0/iink/ws',
    applicationKey: process.env.MYSCRIPT_APPLICATION_KEY,
    hmacKey: process.env.MYSCRIPT_HMAC_KEY
};
router.post('/myscript', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { fileUploadId } = req.body;
    if (!fileUploadId) {
        return res.status(400).json({
            success: false,
            error: '文件上传ID是必填项'
        });
    }
    if (!MYSCRIPT_CONFIG.applicationKey || !MYSCRIPT_CONFIG.hmacKey) {
        return res.status(500).json({
            success: false,
            error: 'MyScript配置不完整'
        });
    }
    try {
        const mockResult = {
            id: `ocr_${Date.now()}`,
            text: '∫(2x + 3)dx = x² + 3x + C',
            mathml: '<math><mrow><mo>∫</mo><mo>(</mo><mn>2</mn><mi>x</mi><mo>+</mo><mn>3</mn><mo>)</mo><mi>dx</mi><mo>=</mo><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>3</mn><mi>x</mi><mo>+</mo><mi>C</mi></mrow></math>',
            latex: '\\int(2x + 3)dx = x^2 + 3x + C',
            confidence: 0.94,
            expressions: [
                {
                    id: 'expr_1',
                    content: '∫(2x + 3)dx',
                    type: 'math',
                    boundingBox: {
                        x: 15,
                        y: 25,
                        width: 120,
                        height: 35
                    }
                },
                {
                    id: 'expr_2',
                    content: 'x² + 3x + C',
                    type: 'math',
                    boundingBox: {
                        x: 145,
                        y: 25,
                        width: 100,
                        height: 30
                    }
                }
            ],
            processedAt: new Date().toISOString(),
            fileUploadId
        };
        res.json({
            success: true,
            data: mockResult
        });
    }
    catch (error) {
        console.error('MyScript识别失败:', error);
        res.status(500).json({
            success: false,
            error: 'OCR识别失败',
            details: error instanceof Error ? error.message : '未知错误'
        });
    }
}));
router.post('/myscript/batch', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { fileUploadIds } = req.body;
    if (!fileUploadIds || !Array.isArray(fileUploadIds) || fileUploadIds.length === 0) {
        return res.status(400).json({
            success: false,
            error: '文件上传ID列表是必填项'
        });
    }
    if (fileUploadIds.length > 10) {
        return res.status(400).json({
            success: false,
            error: '批量处理最多支持10个文件'
        });
    }
    try {
        const results = [];
        for (const fileUploadId of fileUploadIds) {
            const result = {
                id: `ocr_${Date.now()}_${Math.random()}`,
                text: `数学表达式识别结果 - ${fileUploadId}`,
                mathml: '<math><mi>x</mi><mo>+</mo><mn>1</mn></math>',
                latex: 'x + 1',
                confidence: 0.85 + Math.random() * 0.15,
                expressions: [],
                processedAt: new Date().toISOString(),
                fileUploadId
            };
            results.push(result);
        }
        res.json({
            success: true,
            data: {
                results,
                processed: results.length,
                failed: 0
            }
        });
    }
    catch (error) {
        console.error('批量OCR识别失败:', error);
        res.status(500).json({
            success: false,
            error: '批量OCR识别失败',
            details: error instanceof Error ? error.message : '未知错误'
        });
    }
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const result = {
        id,
        text: '示例识别结果：f(x) = x² + 2x + 1',
        mathml: '<math><mrow><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>2</mn><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math>',
        latex: 'f(x) = x^2 + 2x + 1',
        confidence: 0.96,
        expressions: [
            {
                id: 'expr_1',
                content: 'f(x) = x² + 2x + 1',
                type: 'math',
                boundingBox: { x: 10, y: 20, width: 150, height: 40 }
            }
        ],
        processedAt: new Date().toISOString(),
        fileUploadId: 'file_123'
    };
    res.json({
        success: true,
        data: result
    });
}));
router.get('/config/check', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const config = {
        endpoint: MYSCRIPT_CONFIG.apiEndpoint,
        wsEndpoint: MYSCRIPT_CONFIG.wsEndpoint,
        hasApplicationKey: !!MYSCRIPT_CONFIG.applicationKey,
        hasHmacKey: !!MYSCRIPT_CONFIG.hmacKey,
        configured: !!(MYSCRIPT_CONFIG.applicationKey && MYSCRIPT_CONFIG.hmacKey)
    };
    res.json({
        success: true,
        data: config
    });
}));
exports.default = router;
//# sourceMappingURL=ocr.js.map