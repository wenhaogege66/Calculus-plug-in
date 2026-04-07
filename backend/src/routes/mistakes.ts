// 错题本管理API路由
import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/db';



const mistakeRoutes: FastifyPluginAsync = async (fastify) => {
  // 获取用户的所有分类（树形结构）
  fastify.get('/mistakes/categories', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      
      // 获取所有分类，按层级和排序顺序排序
      const categories = await prisma.mistakeCategory.findMany({
        where: {
          userId,
          isActive: true
        },
        orderBy: [
          { level: 'asc' },
          { sortOrder: 'asc' },
          { createdAt: 'asc' }
        ],
        include: {
          children: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
          },
          mistakes: {
            where: { isResolved: false },
            select: { id: true }
          }
        }
      });
      
      // 构建树形结构
      const rootCategories = categories.filter(cat => cat.parentId === null);
      const buildTree = (parentId: number | null): any[] => {
        return categories
          .filter(cat => cat.parentId === parentId)
          .map(cat => ({
            ...cat,
            mistakeCount: cat.mistakes.length,
            children: buildTree(cat.id)
          }));
      };
      
      const tree = buildTree(null);
      
      return {
        success: true,
        data: {
          categories: tree,
          totalCategories: categories.length,
          rootCategories: rootCategories.length
        }
      };
    } catch (error) {
      fastify.log.error('获取错题分类失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取错题分类失败'
      });
    }
  });

  // 创建分类
  fastify.post('/mistakes/categories', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const { 
        name, 
        description, 
        parentId, 
        color, 
        icon 
      } = request.body as {
        name: string;
        description?: string;
        parentId?: number;
        color?: string;
        icon?: string;
      };
      
      if (!name || name.trim().length === 0) {
        return reply.code(400).send({
          success: false,
          error: '分类名称不能为空'
        });
      }
      
      // 检查父分类是否存在且属于当前用户
      let level = 1;
      if (parentId) {
        const parentCategory = await prisma.mistakeCategory.findFirst({
          where: {
            id: parentId,
            userId,
            isActive: true
          }
        });
        
        if (!parentCategory) {
          return reply.code(404).send({
            success: false,
            error: '父分类不存在'
          });
        }
        
        level = parentCategory.level + 1;
        
        // 限制最大层级为5层
        if (level > 5) {
          return reply.code(400).send({
            success: false,
            error: '分类层级不能超过5层'
          });
        }
      }
      
      // 检查同级分类名称是否重复
      const existingCategory = await prisma.mistakeCategory.findFirst({
        where: {
          userId,
          name: name.trim(),
          parentId: parentId || null,
          isActive: true
        }
      });
      
      if (existingCategory) {
        return reply.code(409).send({
          success: false,
          error: '同级分类中已存在相同名称的分类'
        });
      }
      
      // 获取当前层级的最大排序顺序
      const maxSortOrder = await prisma.mistakeCategory.findFirst({
        where: {
          userId,
          parentId: parentId || null,
          isActive: true
        },
        orderBy: { sortOrder: 'desc' }
      });
      
      const sortOrder = (maxSortOrder?.sortOrder || 0) + 1;
      
      const category = await prisma.mistakeCategory.create({
        data: {
          userId,
          name: name.trim(),
          description: description?.trim() || null,
          parentId: parentId || null,
          level,
          sortOrder,
          color: color || null,
          icon: icon || null
        }
      });
      
      return {
        success: true,
        data: { category }
      };
    } catch (error) {
      fastify.log.error('创建分类失败:', error);
      return reply.code(500).send({
        success: false,
        error: '创建分类失败'
      });
    }
  });

  // 更新分类
  fastify.put('/mistakes/categories/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const categoryId = parseInt((request.params as any).id);
      const { 
        name, 
        description, 
        color, 
        icon 
      } = request.body as {
        name: string;
        description?: string;
        color?: string;
        icon?: string;
      };
      
      if (!name || name.trim().length === 0) {
        return reply.code(400).send({
          success: false,
          error: '分类名称不能为空'
        });
      }
      
      // 验证分类存在且属于当前用户
      const existingCategory = await prisma.mistakeCategory.findFirst({
        where: {
          id: categoryId,
          userId,
          isActive: true
        }
      });
      
      if (!existingCategory) {
        return reply.code(404).send({
          success: false,
          error: '分类不存在或无权限'
        });
      }
      
      // 检查同级分类名称是否重复（排除自己）
      const duplicateCategory = await prisma.mistakeCategory.findFirst({
        where: {
          userId,
          name: name.trim(),
          parentId: existingCategory.parentId,
          isActive: true,
          id: { not: categoryId }
        }
      });
      
      if (duplicateCategory) {
        return reply.code(409).send({
          success: false,
          error: '同级分类中已存在相同名称的分类'
        });
      }
      
      const updatedCategory = await prisma.mistakeCategory.update({
        where: { id: categoryId },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          color: color || null,
          icon: icon || null
        }
      });
      
      return {
        success: true,
        data: { category: updatedCategory }
      };
    } catch (error) {
      fastify.log.error('更新分类失败:', error);
      return reply.code(500).send({
        success: false,
        error: '更新分类失败'
      });
    }
  });

  // 删除分类
  fastify.delete('/mistakes/categories/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const categoryId = parseInt((request.params as any).id);
      
      // 验证分类存在且属于当前用户
      const category = await prisma.mistakeCategory.findFirst({
        where: {
          id: categoryId,
          userId,
          isActive: true
        },
        include: {
          children: { where: { isActive: true } },
          mistakes: true
        }
      });
      
      if (!category) {
        return reply.code(404).send({
          success: false,
          error: '分类不存在或无权限'
        });
      }
      
      // 检查是否有子分类
      if (category.children.length > 0) {
        return reply.code(409).send({
          success: false,
          error: '该分类包含子分类，无法删除。请先删除或移动所有子分类。'
        });
      }
      
      // 软删除分类（设置isActive为false）
      await prisma.mistakeCategory.update({
        where: { id: categoryId },
        data: { 
          isActive: false,
          updatedAt: new Date()
        }
      });
      
      // 将该分类下的错题移到未分类
      if (category.mistakes.length > 0) {
        await prisma.mistakeItem.updateMany({
          where: {
            categoryId: categoryId,
            userId
          },
          data: {
            categoryId: null,
            updatedAt: new Date()
          }
        });
      }
      
      return {
        success: true,
        data: {
          message: `分类"${category.name}"已删除`,
          affectedMistakes: category.mistakes.length
        }
      };
    } catch (error) {
      fastify.log.error('删除分类失败:', error);
      return reply.code(500).send({
        success: false,
        error: '删除分类失败'
      });
    }
  });

  // 移动分类
  fastify.patch('/mistakes/categories/:id/move', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const categoryId = parseInt((request.params as any).id);
      const { 
        newParentId, 
        newSortOrder 
      } = request.body as {
        newParentId?: number | null;
        newSortOrder?: number;
      };
      
      // 验证分类存在且属于当前用户
      const category = await prisma.mistakeCategory.findFirst({
        where: {
          id: categoryId,
          userId,
          isActive: true
        }
      });
      
      if (!category) {
        return reply.code(404).send({
          success: false,
          error: '分类不存在或无权限'
        });
      }
      
      // 验证新父分类（如果指定了的话）
      let newLevel = 1;
      if (newParentId) {
        const newParent = await prisma.mistakeCategory.findFirst({
          where: {
            id: newParentId,
            userId,
            isActive: true
          }
        });
        
        if (!newParent) {
          return reply.code(404).send({
            success: false,
            error: '目标父分类不存在'
          });
        }
        
        // 防止循环引用（不能移动到自己的子分类下）
        const isDescendant = async (ancestorId: number, descendantId: number): Promise<boolean> => {
          const descendants = await prisma.mistakeCategory.findMany({
            where: {
              parentId: ancestorId,
              isActive: true
            }
          });
          
          for (const desc of descendants) {
            if (desc.id === descendantId) return true;
            if (await isDescendant(desc.id, descendantId)) return true;
          }
          return false;
        };
        
        if (await isDescendant(categoryId, newParentId)) {
          return reply.code(400).send({
            success: false,
            error: '不能将分类移动到其子分类下'
          });
        }
        
        newLevel = newParent.level + 1;
        if (newLevel > 5) {
          return reply.code(400).send({
            success: false,
            error: '移动后的层级不能超过5层'
          });
        }
      }
      
      // 执行移动
      await prisma.mistakeCategory.update({
        where: { id: categoryId },
        data: {
          parentId: newParentId || null,
          level: newLevel,
          sortOrder: newSortOrder || category.sortOrder,
          updatedAt: new Date()
        }
      });
      
      // 递归更新所有子分类的层级
      const updateChildrenLevel = async (parentId: number, parentLevel: number) => {
        const children = await prisma.mistakeCategory.findMany({
          where: {
            parentId,
            isActive: true
          }
        });
        
        for (const child of children) {
          const childLevel = parentLevel + 1;
          await prisma.mistakeCategory.update({
            where: { id: child.id },
            data: { 
              level: childLevel,
              updatedAt: new Date()
            }
          });
          await updateChildrenLevel(child.id, childLevel);
        }
      };
      
      await updateChildrenLevel(categoryId, newLevel);
      
      return {
        success: true,
        data: { message: '分类移动成功' }
      };
    } catch (error) {
      fastify.log.error('移动分类失败:', error);
      return reply.code(500).send({
        success: false,
        error: '移动分类失败'
      });
    }
  });

  // 获取错题列表（分页）
  fastify.get('/mistakes/items', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const { 
        page = 1, 
        limit = 20, 
        categoryId, 
        search, 
        priority,
        isResolved,
        tags,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = request.query as {
        page?: number;
        limit?: number;
        categoryId?: number;
        search?: string;
        priority?: string;
        isResolved?: boolean;
        tags?: string[];
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      };
      
      const skip = (page - 1) * limit;
      
      // 构建查询条件
      const where: any = { userId };
      
      if (categoryId !== undefined) {
        where.categoryId = categoryId;
      }
      
      if (priority) {
        where.priority = priority;
      }
      
      if (isResolved !== undefined) {
        where.isResolved = isResolved;
      }
      
      if (tags && tags.length > 0) {
        where.tags = { hasSome: tags };
      }
      
      // 搜索条件（标题或笔记）
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } }
        ];
      }
      
      // 构建排序条件
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;
      
      // 查询错题
      const [items, totalCount] = await Promise.all([
        prisma.mistakeItem.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                color: true,
                icon: true
              }
            },
                submission: {
                include: {
                  fileUpload: {
                    select: {
                      id: true,
                      originalName: true,
                      createdAt: true
                    }
                  },
                  deepseekResults: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: {
                      score: true,
                      maxScore: true,
                      feedback: true,
                      errors: true
                    }
                  },
                  mathpixResults: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: {
                      recognizedText: true,
                      mathLatex: true,
                      confidence: true
                    }
                  }
                }
              }
          }
        }),
        prisma.mistakeItem.count({ where })
      ]);
      
      const totalPages = Math.ceil(totalCount / limit);
      
      return {
        success: true,
        data: {
          items,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        }
      };
    } catch (error) {
      fastify.log.error('获取错题列表失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取错题列表失败'
      });
    }
  });

  // 添加错题到错题本
  fastify.post('/mistakes/items', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const {
        submissionId,
        categoryId,
        title,
        notes,
        tags = [],
        priority = 'medium'
      } = request.body as {
        submissionId: number;
        categoryId?: number;
        title?: string;
        notes?: string;
        tags?: string[];
        priority?: string;
      };
      
      // 验证提交记录存在且属于当前用户
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId
        },
        include: {
          fileUpload: { select: { originalName: true } },
          deepseekResults: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { score: true }
          }
        }
      });
      
      if (!submission) {
        return reply.code(404).send({
          success: false,
          error: '提交记录不存在或无权限'
        });
      }
      
      // 验证分类（如果指定了）
      if (categoryId) {
        const category = await prisma.mistakeCategory.findFirst({
          where: {
            id: categoryId,
            userId,
            isActive: true
          }
        });
        
        if (!category) {
          return reply.code(404).send({
            success: false,
            error: '分类不存在'
          });
        }
      }
      
      // 检查是否已存在
      const existingItem = await prisma.mistakeItem.findUnique({
        where: {
          userId_submissionId: {
            userId,
            submissionId
          }
        }
      });
      
      if (existingItem) {
        return reply.code(409).send({
          success: false,
          error: '该题目已存在于错题本中'
        });
      }
      
      // 创建错题记录
      const mistakeItem = await prisma.mistakeItem.create({
        data: {
          userId,
          submissionId,
          categoryId: categoryId || null,
          title: title || submission.fileUpload?.originalName || '未命名练习',
          notes: notes || null,
          tags,
          priority,
          addedBy: 'manual'
        }
      });
      
      return {
        success: true,
        data: { 
          mistake: mistakeItem,
          message: '已添加到错题本'
        }
      };
    } catch (error) {
      fastify.log.error('添加错题失败:', error);
      return reply.code(500).send({
        success: false,
        error: '添加错题失败'
      });
    }
  });

  // 自动添加错题（AI批改分数<75分时调用）
  fastify.post('/mistakes/items/auto-add', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const { submissionId } = request.body as { submissionId: number };
      
      // 验证提交记录和分数
      const submission = await prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId
        },
        include: {
          fileUpload: { select: { originalName: true } },
          deepseekResults: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { score: true }
          }
        }
      });
      
      if (!submission) {
        return reply.code(404).send({
          success: false,
          error: '提交记录不存在或无权限'
        });
      }
      
      const latestResult = submission.deepseekResults[0];
      if (!latestResult || !latestResult.score || latestResult.score >= 75) {
        return reply.code(400).send({
          success: false,
          error: '分数不满足自动添加条件（需要<75分）'
        });
      }
      
      // 检查是否已存在
      const existingItem = await prisma.mistakeItem.findUnique({
        where: {
          userId_submissionId: {
            userId,
            submissionId
          }
        }
      });
      
      if (existingItem) {
        return {
          success: true,
          data: { 
            mistake: existingItem,
            message: '题目已在错题本中'
          }
        };
      }
      
      // 获取或创建默认分类"需要加强"
      let defaultCategory = await prisma.mistakeCategory.findFirst({
        where: {
          userId,
          name: '需要加强',
          parentId: null,
          isActive: true
        }
      });
      
      if (!defaultCategory) {
        defaultCategory = await prisma.mistakeCategory.create({
          data: {
            userId,
            name: '需要加强',
            description: '系统自动创建的分类，用于存放需要重点练习的题目',
            level: 1,
            color: '#ef4444',
            icon: '🔴'
          }
        });
      }
      
      // 创建错题记录
      const mistakeItem = await prisma.mistakeItem.create({
        data: {
          userId,
          submissionId,
          categoryId: defaultCategory.id,
          title: submission.fileUpload?.originalName || '系统自动添加',
          notes: `系统检测到得分较低（${latestResult.score}分），自动添加到错题本`,
          tags: ['自动添加', '低分题目'],
          priority: latestResult.score < 50 ? 'high' : 'medium',
          addedBy: 'auto'
        }
      });
      
      return {
        success: true,
        data: { 
          mistake: mistakeItem,
          message: `已自动添加到错题本（分数：${latestResult.score}分）`
        }
      };
    } catch (error) {
      fastify.log.error('自动添加错题失败:', error);
      return reply.code(500).send({
        success: false,
        error: '自动添加错题失败'
      });
    }
  });

  // 更新错题
  fastify.put('/mistakes/items/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const mistakeId = parseInt((request.params as any).id);
      const {
        categoryId,
        title,
        notes,
        tags,
        priority,
        masteryLevel,
        isResolved
      } = request.body as {
        categoryId?: number | null;
        title?: string;
        notes?: string;
        tags?: string[];
        priority?: string;
        masteryLevel?: number;
        isResolved?: boolean;
      };
      
      // 验证错题存在且属于当前用户
      const existingMistake = await prisma.mistakeItem.findFirst({
        where: {
          id: mistakeId,
          userId
        }
      });
      
      if (!existingMistake) {
        return reply.code(404).send({
          success: false,
          error: '错题不存在或无权限'
        });
      }
      
      // 验证分类（如果指定了）
      if (categoryId !== undefined && categoryId !== null) {
        const category = await prisma.mistakeCategory.findFirst({
          where: {
            id: categoryId,
            userId,
            isActive: true
          }
        });
        
        if (!category) {
          return reply.code(404).send({
            success: false,
            error: '分类不存在'
          });
        }
      }
      
      // 构建更新数据
      const updateData: any = {};
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (title !== undefined) updateData.title = title;
      if (notes !== undefined) updateData.notes = notes;
      if (tags !== undefined) updateData.tags = tags;
      if (priority !== undefined) updateData.priority = priority;
      if (masteryLevel !== undefined) updateData.masteryLevel = masteryLevel;
      if (isResolved !== undefined) updateData.isResolved = isResolved;
      
      const updatedMistake = await prisma.mistakeItem.update({
        where: { id: mistakeId },
        data: updateData
      });
      
      return {
        success: true,
        data: { mistake: updatedMistake }
      };
    } catch (error) {
      fastify.log.error('更新错题失败:', error);
      return reply.code(500).send({
        success: false,
        error: '更新错题失败'
      });
    }
  });

  // 删除错题
  fastify.delete('/mistakes/items/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const mistakeId = parseInt((request.params as any).id);
      
      // 验证错题存在且属于当前用户
      const mistake = await prisma.mistakeItem.findFirst({
        where: {
          id: mistakeId,
          userId
        }
      });
      
      if (!mistake) {
        return reply.code(404).send({
          success: false,
          error: '错题不存在或无权限'
        });
      }
      
      // 删除错题
      await prisma.mistakeItem.delete({
        where: { id: mistakeId }
      });
      
      return {
        success: true,
        data: { message: '错题已删除' }
      };
    } catch (error) {
      fastify.log.error('删除错题失败:', error);
      return reply.code(500).send({
        success: false,
        error: '删除错题失败'
      });
    }
  });

  // 记录复习
  fastify.post('/mistakes/items/:id/review', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      const mistakeId = parseInt((request.params as any).id);
      const { masteryLevel } = request.body as { masteryLevel: number };
      
      // 验证错题存在且属于当前用户
      const mistake = await prisma.mistakeItem.findFirst({
        where: {
          id: mistakeId,
          userId
        }
      });
      
      if (!mistake) {
        return reply.code(404).send({
          success: false,
          error: '错题不存在或无权限'
        });
      }
      
      // 计算下次复习时间（间隔复习算法）
      const intervals = [1, 3, 7, 14, 30, 60]; // 天数
      const nextInterval = intervals[Math.min(mistake.reviewCount, intervals.length - 1)];
      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);
      
      // 更新复习记录
      const updatedMistake = await prisma.mistakeItem.update({
        where: { id: mistakeId },
        data: {
          reviewCount: mistake.reviewCount + 1,
          masteryLevel: Math.max(masteryLevel, mistake.masteryLevel),
          lastReviewedAt: new Date(),
          nextReviewAt,
          isResolved: masteryLevel >= 4 // 掌握程度≥4认为已解决
        }
      });
      
      return {
        success: true,
        data: { 
          mistake: updatedMistake,
          nextReviewIn: nextInterval,
          message: `复习记录已更新，建议${nextInterval}天后再次复习`
        }
      };
    } catch (error) {
      fastify.log.error('记录复习失败:', error);
      return reply.code(500).send({
        success: false,
        error: '记录复习失败'
      });
    }
  });

  // 获取需要复习的错题
  fastify.get('/mistakes/items/review-due', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      
      const dueItems = await prisma.mistakeItem.findMany({
        where: {
          userId,
          isResolved: false,
          OR: [
            { nextReviewAt: { lte: new Date() } },
            { nextReviewAt: null }
          ]
        },
        orderBy: { priority: 'desc' },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true
            }
          },
          submission: {
            include: {
              fileUpload: {
                select: {
                  id: true,
                  originalName: true
                }
              }
            }
          }
        }
      });
      
      return {
        success: true,
        data: {
          items: dueItems,
          count: dueItems.length
        }
      };
    } catch (error) {
      fastify.log.error('获取待复习错题失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取待复习错题失败'
      });
    }
  });

  // 获取错题统计信息
  fastify.get('/mistakes/stats', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.currentUser!.id;
      
      const [
        totalMistakes,
        resolvedMistakes,
        categoryStats,
        priorityStats,
        recentAdded
      ] = await Promise.all([
        prisma.mistakeItem.count({ where: { userId } }),
        prisma.mistakeItem.count({ where: { userId, isResolved: true } }),
        prisma.mistakeItem.groupBy({
          by: ['categoryId'],
          where: { userId },
          _count: true
        }),
        prisma.mistakeItem.groupBy({
          by: ['priority'],
          where: { userId, isResolved: false },
          _count: true
        }),
        prisma.mistakeItem.count({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天内
            }
          }
        })
      ]);
      
      const needsReview = await prisma.mistakeItem.count({
        where: {
          userId,
          isResolved: false,
          OR: [
            { nextReviewAt: { lte: new Date() } },
            { nextReviewAt: null }
          ]
        }
      });
      
      return {
        success: true,
        data: {
          total: totalMistakes,
          resolved: resolvedMistakes,
          unresolved: totalMistakes - resolvedMistakes,
          needsReview,
          recentAdded,
          categoryDistribution: categoryStats,
          priorityDistribution: priorityStats.reduce((acc, item) => {
            acc[item.priority] = item._count;
            return acc;
          }, {} as Record<string, number>),
          resolutionRate: totalMistakes > 0 ? (resolvedMistakes / totalMistakes * 100).toFixed(1) : '0'
        }
      };
    } catch (error) {
      fastify.log.error('获取错题统计失败:', error);
      return reply.code(500).send({
        success: false,
        error: '获取错题统计失败'
      });
    }
  });
};

export default mistakeRoutes;
