import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { KnowledgePointDetail } from './KnowledgePointDetail';
import './KnowledgeGraph.css';

interface KnowledgeNode {
  id: number;
  name: string;
  chapter: string;
  level: number;
  parentId?: number;
  keywords: string[];
  functionExamples: string[];
  difficultyLevel: number;
  aiExplanation?: string;
  errorCount: number;
  masteryLevel: number;
  status: 'mastered' | 'learning' | 'weak';
  // D3相关属性
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface KnowledgeLink {
  source: number | KnowledgeNode;
  target: number | KnowledgeNode;
  type: 'hierarchy' | 'related';
}

interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
  chapters: string[];
  stats: {
    totalKnowledgePoints: number;
    masteredPoints: number;
    weakPoints: number;
    userProgress: number;
  };
}

interface KnowledgeGraphProps {
  authState: AuthState;
  isDarkMode?: boolean;
  onNodeSelect?: (node: KnowledgeNode) => void;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ 
  authState, 
  isDarkMode = false,
  onNodeSelect 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChapter, setFilterChapter] = useState<string>('all');
  const [showLegend, setShowLegend] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailNodeId, setDetailNodeId] = useState<number | null>(null);
  
  // D3相关状态
  const simulationRef = useRef<d3.Simulation<KnowledgeNode, KnowledgeLink> | null>(null);

  useEffect(() => {
    loadKnowledgeGraph();
  }, [authState.token]);

  useEffect(() => {
    if (graphData && svgRef.current) {
      renderGraph();
    }
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [graphData, filterChapter, searchTerm]);

  const loadKnowledgeGraph = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/knowledge/graph`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 验证数据格式
          if (result.data && result.data.nodes && Array.isArray(result.data.nodes)) {
            setGraphData(result.data);
          } else {
            setGraphData({ nodes: [], links: [], chapters: [], stats: { 
              totalKnowledgePoints: 0, masteredPoints: 0, weakPoints: 0, userProgress: 0 
            }});
          }
        } else {
          setError(result.error || '获取知识图谱失败');
        }
      } else if (response.status === 404) {
        // 如果是404，说明没有初始化，显示空状态
        setGraphData({ nodes: [], links: [], chapters: [], stats: { 
          totalKnowledgePoints: 0, masteredPoints: 0, weakPoints: 0, userProgress: 0 
        }});
      } else {
        setError('获取知识图谱失败');
      }
    } catch (err) {
      setError('加载知识图谱失败');
    } finally {
      setLoading(false);
    }
  };

  const renderGraph = () => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    try {
      // 安全检查：确保有节点数据
      if (!graphData.nodes || graphData.nodes.length === 0) {
        
        // 显示需要初始化的提示
        const svg = d3.select(svgRef.current);
        const container = containerRef.current;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;
        
        svg.selectAll("*").remove();
        svg.attr("width", width).attr("height", height);
        
        const g = svg.append("g");
        g.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "#6b7280")
          .text("暂无知识图谱数据，请初始化知识点结构");
        
        return;
      }

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 清除之前的内容
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);


    // 过滤数据
    const filteredNodes = graphData.nodes.filter(node => {
      const matchesSearch = !searchTerm || 
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesChapter = filterChapter === 'all' || node.chapter === filterChapter;
      
      return matchesSearch && matchesChapter;
    });

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    
    // 安全处理链接数据 - 确保source和target是字符串ID格式，以匹配D3的.id()函数
    const rawLinks = graphData.links || [];
    const filteredLinks = rawLinks.filter(link => {
      if (!link || typeof link.source === 'undefined' || typeof link.target === 'undefined') {
        return false;
      }
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    }).map(link => ({
      ...link,
      // 转换为字符串以匹配.id()函数的返回值
      source: String(typeof link.source === 'object' ? link.source.id : link.source),
      target: String(typeof link.target === 'object' ? link.target.id : link.target)
    }));


    // 创建力导向图仿真
    const simulation = d3.forceSimulation<KnowledgeNode, KnowledgeLink>(filteredNodes)
      .force("link", filteredLinks.length > 0 ? 
        d3.forceLink<KnowledgeNode, KnowledgeLink>(filteredLinks)
          .id(d => d.id.toString())
          .distance(d => d.type === 'hierarchy' ? 100 : 80)
          .strength(d => d.type === 'hierarchy' ? 0.8 : 0.3)
        : null)
      .force("charge", d3.forceManyBody()
        .strength(d => {
          // 根据节点级别和状态调整排斥力
          const baseStrength = -300;
          const levelMultiplier = d.level === 1 ? 1.5 : d.level === 2 ? 1.2 : 1;
          return baseStrength * levelMultiplier;
        }))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => getNodeRadius(d) + 5));

    simulationRef.current = simulation;

    // 创建图形组
    const g = svg.append("g");

    // 添加缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // 绘制连接线（仅当有链接数据时）
    const link = g.append("g")
      .selectAll("line")
      .data(filteredLinks)
      .join("line")
      .attr("class", d => `link link-${d.type}`)
      .attr("stroke-width", d => d.type === 'hierarchy' ? 2 : 1)
      .attr("stroke", d => d.type === 'hierarchy' ? "#666" : "#ccc")
      .attr("stroke-dasharray", d => d.type === 'related' ? "5,5" : "none");

    // 绘制节点
    const node = g.append("g")
      .selectAll("circle")
      .data(filteredNodes)
      .join("circle")
      .attr("r", d => getNodeRadius(d))
      .attr("fill", d => getNodeColor(d))
      .attr("stroke", d => selectedNode?.id === d.id ? "#333" : "#fff")
      .attr("stroke-width", d => selectedNode?.id === d.id ? 3 : 2)
      .attr("class", d => `node node-level-${d.level} node-status-${d.status}`)
      .style("cursor", "pointer")
      .call(drag(simulation))
      .on("click", (event, d) => {
        handleNodeClick(event, d);
      })
      .on("dblclick", (event, d) => {
        handleNodeDoubleClick(event, d);
      })
      .on("mouseover", (event, d) => {
        showTooltip(event, d);
      })
      .on("mouseout", hideTooltip);

    // 添加节点标签
    const label = g.append("g")
      .selectAll("text")
      .data(filteredNodes)
      .join("text")
      .text(d => d.name)
      .attr("class", "node-label")
      .attr("dx", d => getNodeRadius(d) + 5)
      .attr("dy", "0.35em")
      .style("font-size", d => d.level === 1 ? "14px" : d.level === 2 ? "12px" : "10px")
      .style("font-weight", d => d.level === 1 ? "bold" : "normal")
      .style("fill", "#333")
      .style("pointer-events", "none");

    // 更新位置的函数
    const updatePositions = () => {
      // 只有在有链接数据时才更新链接位置
      if (filteredLinks.length > 0) {
        link
          .attr("x1", d => (d.source as KnowledgeNode).x!)
          .attr("y1", d => (d.source as KnowledgeNode).y!)
          .attr("x2", d => (d.target as KnowledgeNode).x!)
          .attr("y2", d => (d.target as KnowledgeNode).y!);
      }

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      label
        .attr("x", d => d.x!)
        .attr("y", d => d.y!);
    };

      // 启动仿真
      simulation.on("tick", updatePositions);
    } catch (error) {
      
      // 显示错误信息
      const svg = d3.select(svgRef.current);
      const container = containerRef.current;
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;
      
      svg.selectAll("*").remove();
      svg.attr("width", width).attr("height", height);
      
      const g = svg.append("g");
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#ef4444")
        .text("知识图谱渲染失败，请稍后重试");
        
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2 + 30)
        .attr("text-anchor", "middle")
        .attr("fill", "#6b7280")
        .attr("font-size", "12px")
        .text("可能需要先初始化知识点结构");
    }
  };

  // 节点拖拽行为
  const drag = (simulation: d3.Simulation<KnowledgeNode, KnowledgeLink>) => {
    return d3.drag<SVGCircleElement, KnowledgeNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  };

  // 计算节点半径
  const getNodeRadius = (node: KnowledgeNode): number => {
    const baseRadius = node.level === 1 ? 20 : node.level === 2 ? 15 : 12;
    const masteryMultiplier = 1 + (node.masteryLevel / 100) * 0.5; // 掌握度影响大小
    return baseRadius * masteryMultiplier;
  };

  // 获取节点颜色
  const getNodeColor = (node: KnowledgeNode): string => {
    if (node.status === 'mastered') return '#10b981'; // 绿色
    if (node.status === 'learning') return '#f59e0b'; // 橙色
    if (node.status === 'weak') return '#ef4444'; // 红色
    return '#6b7280'; // 灰色
  };

  // 节点点击处理
  const handleNodeClick = (event: MouseEvent, node: KnowledgeNode) => {
    event.stopPropagation();
    setSelectedNode(node);
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  // 节点双击处理 - 打开详情模态框
  const handleNodeDoubleClick = (event: MouseEvent, node: KnowledgeNode) => {
    event.stopPropagation();
    setDetailNodeId(node.id);
    setShowDetailModal(true);
  };

  // 导航到子知识点
  const handleNavigateToChild = (childId: number) => {
    setDetailNodeId(childId);
    // 刷新图谱数据以确保新节点可见
    loadKnowledgeGraph();
  };

  // 处理练习题点击
  const handlePracticeQuestion = (questionId: number) => {
    // 导航到练习模式
    window.location.hash = '#/practice';
  };

  // 显示工具提示
  const showTooltip = (event: MouseEvent, node: KnowledgeNode) => {
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "knowledge-tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("font-size", "12px")
      .style("max-width", "200px")
      .style("z-index", "1000");

    tooltip.html(`
      <div><strong>${node.name}</strong></div>
      <div>章节: ${node.chapter}</div>
      <div>掌握度: ${node.masteryLevel}%</div>
      <div>错误次数: ${node.errorCount}</div>
      <div>难度: ${"★".repeat(node.difficultyLevel)}</div>
    `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 10) + "px")
      .transition()
      .duration(200)
      .style("opacity", 1);
  };

  // 隐藏工具提示
  const hideTooltip = () => {
    d3.selectAll(".knowledge-tooltip").remove();
  };

  // 初始化知识点结构
  const initializeKnowledge = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/knowledge/initialize`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 重新加载图谱数据
          await loadKnowledgeGraph();
        } else {
          setError(result.error || '初始化失败');
        }
      } else {
        setError('初始化失败');
      }
    } catch (err) {
      setError('初始化知识点失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`knowledge-graph-container ${isDarkMode ? 'dark' : ''}`}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载知识图谱中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`knowledge-graph-container ${isDarkMode ? 'dark' : ''}`}>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>加载失败</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button className="retry-btn" onClick={loadKnowledgeGraph}>
              重试
            </button>
            {authState.user?.role?.toLowerCase() === 'teacher' && (
              <button className="initialize-btn" onClick={initializeKnowledge}>
                初始化知识点结构
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className={`knowledge-graph-container ${isDarkMode ? 'dark' : ''}`}>
        <div className="empty-container">
          <div className="empty-icon">🌐</div>
          <h3>暂无知识图谱数据</h3>
          <p>还没有构建知识点结构</p>
          <div className="empty-actions">
{authState.user?.role?.toLowerCase() === 'teacher' ? (
              <button className="initialize-btn" onClick={initializeKnowledge}>
                初始化微积分知识点结构
              </button>
            ) : (
              <p>请联系老师初始化知识图谱结构</p>
            )}
            <button className="retry-btn" onClick={loadKnowledgeGraph}>
              重新加载
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`knowledge-graph-container ${isDarkMode ? 'dark' : ''}`}>
      {/* 控制面板 */}
      <div className="knowledge-controls">
        <div className="controls-left">
          <div className="search-box">
            <input
              type="text"
              placeholder="搜索知识点..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
          <select
            value={filterChapter}
            onChange={(e) => setFilterChapter(e.target.value)}
            className="chapter-filter"
          >
            <option value="all">所有章节</option>
            {graphData.chapters.map(chapter => (
              <option key={chapter} value={chapter}>{chapter}</option>
            ))}
          </select>
        </div>
        <div className="controls-right">
          <button
            className="legend-toggle"
            onClick={() => setShowLegend(!showLegend)}
          >
            {showLegend ? '隐藏' : '显示'}图例
          </button>
          <button className="reset-view" onClick={loadKnowledgeGraph}>
            重置视图
          </button>
        </div>
      </div>

      {/* 统计面板 */}
      <div className="knowledge-stats">
        <div className="stat-item">
          <span className="stat-value">{graphData.stats.totalKnowledgePoints}</span>
          <span className="stat-label">总知识点</span>
        </div>
        <div className="stat-item mastered">
          <span className="stat-value">{graphData.stats.masteredPoints}</span>
          <span className="stat-label">已掌握</span>
        </div>
        <div className="stat-item weak">
          <span className="stat-value">{graphData.stats.weakPoints}</span>
          <span className="stat-label">需加强</span>
        </div>
        <div className="stat-item progress">
          <span className="stat-value">{graphData.stats.userProgress}%</span>
          <span className="stat-label">总进度</span>
        </div>
      </div>

      {/* 图例 */}
      {showLegend && (
        <div className="knowledge-legend">
          <h4>图例</h4>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-node mastered"></div>
              <span>已掌握 (≥80%)</span>
            </div>
            <div className="legend-item">
              <div className="legend-node learning"></div>
              <span>学习中 (50-80%)</span>
            </div>
            <div className="legend-item">
              <div className="legend-node weak"></div>
              <span>需加强 (&lt;50%)</span>
            </div>
            <div className="legend-item">
              <div className="legend-line hierarchy"></div>
              <span>层级关系</span>
            </div>
            <div className="legend-item">
              <div className="legend-line related"></div>
              <span>关联关系</span>
            </div>
          </div>
        </div>
      )}

      {/* SVG图谱 */}
      <div ref={containerRef} className="graph-viewport">
        <svg ref={svgRef} className="knowledge-svg"></svg>
      </div>

      {/* 选中节点详情 */}
      {selectedNode && (
        <div className="selected-node-info">
          <div className="node-info-header">
            <h3>{selectedNode.name}</h3>
            <div className="node-info-actions">
              <button 
                className="detail-btn"
                onClick={() => {
                  setDetailNodeId(selectedNode.id);
                  setShowDetailModal(true);
                }}
                title="查看详细信息"
              >
                📖
              </button>
              <button 
                className="close-btn"
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="node-info-content">
            <div className="info-item">
              <span className="info-label">章节:</span>
              <span className="info-value">{selectedNode.chapter}</span>
            </div>
            <div className="info-item">
              <span className="info-label">掌握度:</span>
              <span className={`info-value mastery-${selectedNode.status}`}>
                {selectedNode.masteryLevel}%
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">错误次数:</span>
              <span className="info-value">{selectedNode.errorCount}</span>
            </div>
            <div className="info-item">
              <span className="info-label">难度等级:</span>
              <span className="info-value">
                {"★".repeat(selectedNode.difficultyLevel)}
                {"☆".repeat(5 - selectedNode.difficultyLevel)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">关键词:</span>
              <div className="keywords">
                {selectedNode.keywords.map((keyword, idx) => (
                  <span key={idx} className="keyword-tag">{keyword}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="node-info-footer">
            <small>双击节点查看详细信息</small>
          </div>
        </div>
      )}

      {/* 知识点详情模态框 */}
      {showDetailModal && detailNodeId && (
        <KnowledgePointDetail
          knowledgePointId={detailNodeId}
          authState={authState}
          onClose={() => {
            setShowDetailModal(false);
            setDetailNodeId(null);
          }}
          onNavigateToChild={handleNavigateToChild}
          onPracticeQuestion={handlePracticeQuestion}
        />
      )}
    </div>
  );
};