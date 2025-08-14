import React, { useState, useEffect } from 'react';
import { API_BASE_URL, type AuthState } from '../common/config/supabase';
import { useNotificationContext } from '../contexts/NotificationContext';

interface Assignment {
  id: number;
  title: string;
  description?: string;
  classroomId?: number;
  classroom?: {
    id: number;
    name: string;
  };
  teacher?: {
    id: number;
    username: string;
  };
  questionFile?: {
    id: number;
    filename: string;
    originalName: string;
  };
  startDate: string;
  dueDate: string;
  isSubmitted?: boolean;
  isOverdue?: boolean;
  isActive: boolean;
  createdAt: string;
  submissionCount?: number; // 提交次数
  latestSubmissionVersion?: number; // 最新提交版本
}

interface Classroom {
  id: number;
  name: string;
  description?: string;
  inviteCode?: string;
  memberCount?: number;
  assignmentCount?: number;
}

interface AssignmentsPageProps {
  authState: AuthState;
  onPageChange?: (page: string) => void;
  params?: {
    classroomId?: number;
    classroomName?: string;
  };
}

export const AssignmentsPage: React.FC<AssignmentsPageProps> = ({ authState, onPageChange, params }) => {
  const { showSuccess, showError, showWarning, showInfo } = useNotificationContext();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    classroomId: '',
    startDate: '',
    dueDate: '',
    fileUpload: null as File | null
  });
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailAssignment, setDetailAssignment] = useState<Assignment | null>(null);
  const [showGradingResultModal, setShowGradingResultModal] = useState(false);
  const [gradingResultAssignment, setGradingResultAssignment] = useState<Assignment | null>(null);
  const [gradingResults, setGradingResults] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    classroomId: '',
    startDate: '',
    dueDate: '',
    fileUpload: null as File | null,
    isActive: true
  });
  const [teacherFilters, setTeacherFilters] = useState({
    classroom: 'all',
    status: 'all', // all, active, inactive
    dateRange: 'all', // all, upcoming, overdue
    sortBy: 'createdAt' // createdAt, dueDate, classroom, title
  });
  const [submitForm, setSubmitForm] = useState({
    files: [] as File[],
    note: ''
  });
  const [filters, setFilters] = useState({
    status: 'all', // all, pending, submitted, overdue
    classroom: 'all',
    sortBy: 'dueDate' // dueDate, title, status
  });
  const [submitting, setSubmitting] = useState(false);
  const [isResubmission, setIsResubmission] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState<any[]>([]);

  const isTeacher = authState.user?.role === 'TEACHER';

  useEffect(() => {
    loadData();
  }, [authState.token]);

  // 根据页面参数设置初始筛选条件
  useEffect(() => {
    if (params?.classroomId) {
      setFilters(prev => ({
        ...prev,
        classroom: params.classroomId.toString()
      }));
    }
  }, [params]);

  // 应用过滤和排序
  useEffect(() => {
    let filtered = [...assignments];

    // 状态过滤
    if (filters.status !== 'all') {
      filtered = filtered.filter(assignment => {
        switch (filters.status) {
          case 'pending':
            return !assignment.isSubmitted && !assignment.isOverdue;
          case 'submitted':
            return assignment.isSubmitted;
          case 'overdue':
            return assignment.isOverdue;
          default:
            return true;
        }
      });
    }

    // 班级过滤
    if (filters.classroom !== 'all') {
      filtered = filtered.filter(assignment => 
        assignment.classroom?.id === parseInt(filters.classroom)
      );
    }

    // 排序
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'dueDate':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'status':
          // 优先级: pending > overdue > submitted
          const getStatusPriority = (assignment: Assignment) => {
            if (!assignment.isSubmitted && !assignment.isOverdue) return 0; // pending
            if (assignment.isOverdue) return 1; // overdue
            return 2; // submitted
          };
          return getStatusPriority(a) - getStatusPriority(b);
        default:
          return 0;
      }
    });

    setFilteredAssignments(filtered);
  }, [assignments, filters]);

  // 教师端过滤逻辑
  useEffect(() => {
    if (!isTeacher) return;

    let filtered = [...assignments];

    // 班级过滤
    if (teacherFilters.classroom !== 'all') {
      filtered = filtered.filter(assignment => 
        assignment.classroom?.id === parseInt(teacherFilters.classroom)
      );
    }

    // 状态过滤
    if (teacherFilters.status !== 'all') {
      filtered = filtered.filter(assignment => {
        return teacherFilters.status === 'active' ? assignment.isActive : !assignment.isActive;
      });
    }

    // 日期范围过滤
    if (teacherFilters.dateRange !== 'all') {
      const now = new Date();
      filtered = filtered.filter(assignment => {
        const dueDate = new Date(assignment.dueDate);
        switch (teacherFilters.dateRange) {
          case 'upcoming':
            return dueDate > now;
          case 'overdue':
            return dueDate < now;
          default:
            return true;
        }
      });
    }

    // 排序
    filtered.sort((a, b) => {
      switch (teacherFilters.sortBy) {
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'dueDate':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'classroom':
          return (a.classroom?.name || '').localeCompare(b.classroom?.name || '');
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    setFilteredAssignments(filtered);
  }, [assignments, teacherFilters, isTeacher]);

  const loadData = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      setError('');

      if (isTeacher) {
        // 教师：加载作业列表和班级列表
        const [assignmentsRes, classroomsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/assignments/teacher`, {
            headers: { 'Authorization': `Bearer ${authState.token}` }
          }),
          fetch(`${API_BASE_URL}/classrooms/teacher`, {
            headers: { 'Authorization': `Bearer ${authState.token}` }
          })
        ]);

        if (assignmentsRes.ok) {
          const assignmentsData = await assignmentsRes.json();
          if (assignmentsData.success) {
            setAssignments(assignmentsData.data);
          }
        }

        if (classroomsRes.ok) {
          const classroomsData = await classroomsRes.json();
          if (classroomsData.success) {
            setClassrooms(classroomsData.data);
          }
        }
      } else {
        // 学生：加载作业列表
        const assignmentsRes = await fetch(`${API_BASE_URL}/assignments/student`, {
          headers: { 'Authorization': `Bearer ${authState.token}` }
        });

        if (assignmentsRes.ok) {
          const assignmentsData = await assignmentsRes.json();
          if (assignmentsData.success) {
            setAssignments(assignmentsData.data);
          }
        }
      }
    } catch (err) {
      console.error('加载数据失败:', err);
      setError('加载数据失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const createAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.token || !isTeacher) return;

    try {
      setSubmitting(true);
      setError('');

      // 首先上传文件（如果有）
      let fileUploadId = null;
      if (createForm.fileUpload) {
        const formData = new FormData();
        formData.append('file', createForm.fileUpload);
        formData.append('purpose', 'assignment_question');

        const uploadResponse = await fetch(`${API_BASE_URL}/files`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authState.token}` },
          body: formData
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          if (uploadData.success) {
            fileUploadId = uploadData.data.fileId;
          }
        }
      }

      // 创建作业
      const assignmentData = {
        title: createForm.title,
        description: createForm.description,
        classroomId: parseInt(createForm.classroomId),
        fileUploadId,
        startDate: createForm.startDate,
        dueDate: createForm.dueDate
      };

      const response = await fetch(`${API_BASE_URL}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(assignmentData)
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setCreateForm({
          title: '',
          description: '',
          classroomId: '',
          startDate: '',
          dueDate: '',
          fileUpload: null
        });
        await loadData(); // 重新加载数据
      } else {
        setError(data.error || '创建作业失败');
      }
    } catch (err) {
      console.error('创建作业失败:', err);
      setError('创建作业失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAssignment = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowSubmitModal(true);
  };

  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      setSubmitForm(prev => ({
        ...prev,
        files: Array.from(files)
      }));
    }
  };

  const submitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !authState.token) return;

    try {
      setSubmitting(true);
      setError('');

      // 上传文件
      const uploadPromises = submitForm.files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workMode', 'homework');
        formData.append('assignmentId', selectedAssignment.id.toString());

        const uploadResponse = await fetch(`${API_BASE_URL}/files`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authState.token}` },
          body: formData
        });

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          throw new Error(`文件 ${file.name} 上传失败: ${uploadData.error}`);
        }
        return uploadData.data.fileId;
      });

      const fileIds = await Promise.all(uploadPromises);

      // 计算版本号（基于历史提交记录）
      const currentVersion = isResubmission 
        ? Math.max(...submissionHistory.map(s => s.metadata?.version || 1), 0) + 1
        : 1;

      // 创建提交记录
      const submissionData = {
        assignmentId: selectedAssignment.id,
        fileUploadIds: fileIds,
        note: submitForm.note,
        metadata: {
          version: currentVersion,
          isResubmission: isResubmission,
          resubmissionNote: isResubmission ? `第${currentVersion}次提交` : undefined
        }
      };

      const response = await fetch(`${API_BASE_URL}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(submissionData)
      });

      const data = await response.json();
      if (data.success) {
        const actionText = isResubmission ? '重新提交' : '提交';
        showSuccess(`${actionText}成功！${isResubmission ? `（版本 ${currentVersion}）` : ''}`);
        
        setShowSubmitModal(false);
        setSelectedAssignment(null);
        setSubmitForm({ files: [], note: '' });
        setIsResubmission(false);
        setSubmissionHistory([]);
        await loadData(); // 重新加载数据
      } else {
        setError(data.error || '提交作业失败');
      }
    } catch (err) {
      console.error('提交作业失败:', err);
      setError(err instanceof Error ? err.message : '提交作业失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 获取作业的提交历史
  const loadSubmissionHistory = async (assignmentId: number) => {
    if (!authState.token) return [];

    try {
      const response = await fetch(`${API_BASE_URL}/submissions?assignmentId=${assignmentId}`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      const data = await response.json();
      if (data.success) {
        return data.data.submissions || [];
      }
      return [];
    } catch (error) {
      console.error('获取提交历史失败:', error);
      return [];
    }
  };

  // 处理重新提交
  const handleResubmitAssignment = async (assignment: Assignment) => {
    const history = await loadSubmissionHistory(assignment.id);
    setSubmissionHistory(history);
    setIsResubmission(true);
    setSelectedAssignment(assignment);
    setSubmitForm({ files: [], note: '' });
    setShowSubmitModal(true);
  };

  const getStatusBadge = (assignment: Assignment) => {
    if (isTeacher) {
      return <span className="status-badge active">已发布</span>;
    }

    if (assignment.isSubmitted) {
      return <span className="status-badge submitted">已提交</span>;
    }

    if (assignment.isOverdue) {
      return <span className="status-badge overdue">已过期</span>;
    }

    return <span className="status-badge pending">待提交</span>;
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setEditForm({
      title: assignment.title,
      description: assignment.description || '',
      classroomId: assignment.classroom?.id?.toString() || '',
      startDate: assignment.startDate.slice(0, 16), // 格式化为datetime-local
      dueDate: assignment.dueDate.slice(0, 16),
      fileUpload: null,
      isActive: assignment.isActive
    });
    setShowEditModal(true);
  };

  const handleShowAssignmentDetail = (assignment: Assignment) => {
    setDetailAssignment(assignment);
    setShowDetailModal(true);
  };

  const handleShowGradingResult = async (assignment: Assignment) => {
    if (!authState.token) return;

    try {
      setLoading(true);
      setGradingResultAssignment(assignment);

      // 获取该作业的提交记录和批改结果
      const response = await fetch(`${API_BASE_URL}/submissions?assignmentId=${assignment.id}`, {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      });

      const data = await response.json();
      if (data.success && data.data.submissions && data.data.submissions.length > 0) {
        // 获取最新的提交记录的详细批改结果
        const latestSubmission = data.data.submissions[0];
        const statusResponse = await fetch(`${API_BASE_URL}/submissions/${latestSubmission.id}/status`, {
          headers: { 'Authorization': `Bearer ${authState.token}` }
        });

        const statusData = await statusResponse.json();
        if (statusData.success) {
          setGradingResults(statusData.data);
          setShowGradingResultModal(true);
        } else {
          showError('获取批改结果失败');
        }
      } else {
        showError('未找到提交记录');
      }
    } catch (error) {
      console.error('获取批改结果失败:', error);
      showError('获取批改结果失败');
    } finally {
      setLoading(false);
    }
  };

  const updateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.token || !isTeacher || !editingAssignment) return;

    try {
      setSubmitting(true);
      setError('');

      // 首先上传文件（如果有新文件）
      let fileUploadId = editingAssignment.questionFile?.id || null;
      if (editForm.fileUpload) {
        const formData = new FormData();
        formData.append('file', editForm.fileUpload);
        formData.append('purpose', 'assignment_question');

        const uploadResponse = await fetch(`${API_BASE_URL}/files`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authState.token}` },
          body: formData
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          if (uploadData.success) {
            fileUploadId = uploadData.data.fileId;
          }
        }
      }

      // 更新作业
      const assignmentData = {
        title: editForm.title,
        description: editForm.description,
        classroomId: parseInt(editForm.classroomId),
        fileUploadId,
        startDate: editForm.startDate,
        dueDate: editForm.dueDate,
        isActive: editForm.isActive
      };

      const response = await fetch(`${API_BASE_URL}/assignments/${editingAssignment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify(assignmentData)
      });

      const data = await response.json();
      if (data.success) {
        setShowEditModal(false);
        setEditingAssignment(null);
        setEditForm({
          title: '',
          description: '',
          classroomId: '',
          startDate: '',
          dueDate: '',
          fileUpload: null,
          isActive: true
        });
        await loadData(); // 重新加载数据
      } else {
        setError(data.error || '更新作业失败');
      }
    } catch (err) {
      console.error('更新作业失败:', err);
      setError('更新作业失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAssignmentStatus = async (assignment: Assignment) => {
    if (!authState.token || !isTeacher) return;

    try {
      const response = await fetch(`${API_BASE_URL}/assignments/${assignment.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({ isActive: !assignment.isActive })
      });

      const data = await response.json();
      if (data.success) {
        await loadData(); // 重新加载数据
        showSuccess(`作业状态已更新为${!assignment.isActive ? '开启' : '结束'}`);
      } else {
        showError(data.error || '更新作业状态失败');
      }
    } catch (err) {
      console.error('更新作业状态失败:', err);
      showError('更新作业状态失败');
    }
  };

  const extendAssignmentDeadline = async (assignment: Assignment, days: number) => {
    if (!authState.token || !isTeacher) return;

    try {
      const newDueDate = new Date(assignment.dueDate);
      newDueDate.setDate(newDueDate.getDate() + days);

      const response = await fetch(`${API_BASE_URL}/assignments/${assignment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({ dueDate: newDueDate.toISOString() })
      });

      const data = await response.json();
      if (data.success) {
        await loadData(); // 重新加载数据
        showSuccess(`作业截止时间已延长${days}天`);
      } else {
        showError(data.error || '延期失败');
      }
    } catch (err) {
      console.error('延期失败:', err);
      showError('延期失败');
    }
  };

  const handleDownloadFile = async (fileId: number, fileName: string) => {
    if (!authState.token) {
      showError('请先登录');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/files/${fileId}/download`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showSuccess(`文件 ${fileName} 下载成功`);
      } else {
        const errorData = await response.json();
        showError(errorData.error || '文件下载失败');
      }
    } catch (err) {
      console.error('下载失败:', err);
      showError('文件下载失败，请稍后重试');
    }
  };

  const getUniqueClassrooms = () => {
    const uniqueClassrooms = assignments.reduce((acc, assignment) => {
      if (assignment.classroom && !acc.find(c => c.id === assignment.classroom!.id)) {
        acc.push(assignment.classroom);
      }
      return acc;
    }, [] as { id: number; name: string; }[]);
    return uniqueClassrooms;
  };

  if (loading) {
    return (
      <div className="assignments-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assignments-page">
      <div className="page-header">
        <div className="header-content">
          <h1>{isTeacher ? '📝 作业管理' : '📝 我的作业'}</h1>
          <p className="page-description">
            {isTeacher ? '管理和发布作业任务' : '查看和完成老师布置的作业'}
          </p>
        </div>
        
        {isTeacher && (
          <div className="header-actions">
            <button
              className="btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={classrooms.length === 0}
            >
              <span className="btn-icon">➕</span>
              <span>布置作业</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* 教师端过滤控件 */}
      {isTeacher && assignments.length > 0 && (
        <div className="filters-section teacher-filters">
          <div className="filters-row">
            <div className="filter-group">
              <label htmlFor="teacherClassroomFilter">班级筛选：</label>
              <select
                id="teacherClassroomFilter"
                value={teacherFilters.classroom}
                onChange={(e) => setTeacherFilters(prev => ({ ...prev, classroom: e.target.value }))}
              >
                <option value="all">全部班级</option>
                {classrooms.map(classroom => (
                  <option key={classroom.id} value={classroom.id.toString()}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="teacherStatusFilter">状态筛选：</label>
              <select
                id="teacherStatusFilter"
                value={teacherFilters.status}
                onChange={(e) => setTeacherFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="all">全部状态</option>
                <option value="active">激活中</option>
                <option value="inactive">已禁用</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="teacherDateRangeFilter">时间筛选：</label>
              <select
                id="teacherDateRangeFilter"
                value={teacherFilters.dateRange}
                onChange={(e) => setTeacherFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              >
                <option value="all">全部时间</option>
                <option value="upcoming">即将到期</option>
                <option value="overdue">已过期</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="teacherSortFilter">排序方式：</label>
              <select
                id="teacherSortFilter"
                value={teacherFilters.sortBy}
                onChange={(e) => setTeacherFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              >
                <option value="createdAt">创建时间</option>
                <option value="dueDate">截止时间</option>
                <option value="classroom">班级名称</option>
                <option value="title">作业标题</option>
              </select>
            </div>
          </div>

          <div className="filter-summary">
            <span className="filter-count">
              显示 {filteredAssignments.length} / {assignments.length} 个作业
            </span>
          </div>
        </div>
      )}

      {/* 学生端过滤控件 */}
      {!isTeacher && assignments.length > 0 && (
        <div className="filters-section">
          <div className="filters-row">
            <div className="filter-group">
              <label htmlFor="statusFilter">状态筛选：</label>
              <select
                id="statusFilter"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="all">全部</option>
                <option value="pending">待提交</option>
                <option value="submitted">已提交</option>
                <option value="overdue">已过期</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="classroomFilter">班级筛选：</label>
              <select
                id="classroomFilter"
                value={filters.classroom}
                onChange={(e) => setFilters(prev => ({ ...prev, classroom: e.target.value }))}
              >
                <option value="all">全部班级</option>
                {getUniqueClassrooms().map(classroom => (
                  <option key={classroom.id} value={classroom.id.toString()}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="sortFilter">排序方式：</label>
              <select
                id="sortFilter"
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              >
                <option value="dueDate">截止时间</option>
                <option value="title">作业标题</option>
                <option value="status">完成状态</option>
              </select>
            </div>
          </div>

          <div className="filter-summary">
            <span className="filter-count">
              显示 {filteredAssignments.length} / {assignments.length} 个作业
            </span>
          </div>
        </div>
      )}

      {isTeacher && classrooms.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🏫</div>
          <h3>还没有创建班级</h3>
          <p>请先创建班级才能布置作业</p>
          <button className="btn-secondary" onClick={() => onPageChange?.('classrooms')}>
            <span>创建班级</span>
          </button>
        </div>
      )}

      {(assignments.length === 0 || filteredAssignments.length === 0) && !loading && classrooms.length > 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          {filteredAssignments.length === 0 && assignments.length > 0 ? (
            // 有作业但筛选后没有结果
            <>
              <h3>当前筛选条件下没有作业</h3>
              <p>
                {params?.classroomName ? 
                  `当前班级"${params.classroomName}"尚未布置作业` : 
                  '尝试调整筛选条件查看其他作业'
                }
              </p>
            </>
          ) : (
            // 完全没有作业
            <>
              <h3>{isTeacher ? '还没有布置任何作业' : '暂无作业'}</h3>
              <p>{isTeacher ? '点击"布置作业"按钮开始创建第一个作业' : '老师还没有布置作业，请耐心等待'}</p>
            </>
          )}
        </div>
      ) : (
        <div className="assignments-grid">
          {filteredAssignments.map(assignment => (
            <div key={assignment.id} className="assignment-card">
              <div className="card-header">
                <div className="assignment-title">
                  <h3>{assignment.title}</h3>
                  {getStatusBadge(assignment)}
                </div>
                
                {assignment.classroom && (
                  <div className="classroom-info">
                    <span className="classroom-icon">🏫</span>
                    <span className="classroom-name">{assignment.classroom.name}</span>
                  </div>
                )}
                
                {assignment.teacher && !isTeacher && (
                  <div className="teacher-info">
                    <span className="teacher-icon">👨‍🏫</span>
                    <span className="teacher-name">{assignment.teacher.username}</span>
                  </div>
                )}
              </div>

              {assignment.description && (
                <div className="assignment-description">
                  <p>{assignment.description}</p>
                </div>
              )}

              <div className="assignment-meta">
                <div className="meta-item">
                  <span className="meta-label">开始时间:</span>
                  <span className="meta-value">{formatDate(assignment.startDate)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">截止时间:</span>
                  <span className={`meta-value ${assignment.isOverdue ? 'overdue' : ''}`}>
                    {formatDate(assignment.dueDate)}
                  </span>
                </div>
              </div>

              {assignment.questionFile && (
                <div className="question-file">
                  <button 
                    className="file-download-link"
                    onClick={(e) => {
                      e.stopPropagation(); // 防止触发卡片点击
                      handleDownloadFile(assignment.questionFile!.id, assignment.questionFile!.originalName);
                    }}
                  >
                    <span className="file-icon">📎</span>
                    <span className="file-name">{assignment.questionFile.originalName}</span>
                    <span className="download-hint">点击下载</span>
                  </button>
                </div>
              )}

              <div className="card-actions">
                {isTeacher ? (
                  <>
                    <button className="btn-secondary small">
                      <span className="btn-icon">👥</span>
                      <span>查看提交</span>
                    </button>
                    <button 
                      className="btn-secondary small"
                      onClick={() => handleEditAssignment(assignment)}
                    >
                      <span className="btn-icon">✏️</span>
                      <span>编辑</span>
                    </button>
                    <button 
                      className={`btn-secondary small ${assignment.isActive ? 'status-active' : 'status-inactive'}`}
                      onClick={() => toggleAssignmentStatus(assignment)}
                      title={assignment.isActive ? '点击结束' : '点击开启'}
                    >
                      <span className="btn-icon">{assignment.isActive ? '🔴' : '🟢'}</span>
                      <span>{assignment.isActive ? '结束' : '开启'}</span>
                    </button>
                    <div className="time-management-actions">
                      <button 
                        className="btn-icon-only small"
                        onClick={() => extendAssignmentDeadline(assignment, 3)}
                        title="延期3天"
                      >
                        📅 +3天
                      </button>
                      <button 
                        className="btn-icon-only small"
                        onClick={() => extendAssignmentDeadline(assignment, 7)}
                        title="延期7天"
                      >
                        📅 +7天
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {!assignment.isSubmitted && !assignment.isOverdue && (
                      <button 
                        className="btn-primary small"
                        onClick={() => handleSubmitAssignment(assignment)}
                      >
                        <span className="btn-icon">📝</span>
                        <span>提交作业</span>
                      </button>
                    )}
                    {assignment.isSubmitted && (
                      <button 
                        className="btn-secondary small"
                        onClick={() => handleShowGradingResult(assignment)}
                      >
                        <span className="btn-icon">👀</span>
                        <span>查看结果</span>
                      </button>
                    )}
                    <button 
                      className="btn-secondary small"
                      onClick={() => handleShowAssignmentDetail(assignment)}
                    >
                      <span className="btn-icon">📋</span>
                      <span>详情</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建作业模态框 */}
      {showCreateModal && isTeacher && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>布置新作业</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            
            <form onSubmit={createAssignment} className="modal-form">
              <div className="form-group">
                <label htmlFor="assignmentTitle">作业标题 *</label>
                <input
                  id="assignmentTitle"
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                  placeholder="如：第三章积分计算练习"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="assignmentClassroom">选择班级 *</label>
                <select
                  id="assignmentClassroom"
                  value={createForm.classroomId}
                  onChange={(e) => setCreateForm({...createForm, classroomId: e.target.value})}
                  required
                >
                  <option value="">请选择班级</option>
                  {classrooms.map(classroom => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="assignmentStartDate">开始时间 *</label>
                  <input
                    id="assignmentStartDate"
                    type="datetime-local"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({...createForm, startDate: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="assignmentDueDate">截止时间 *</label>
                  <input
                    id="assignmentDueDate"
                    type="datetime-local"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm({...createForm, dueDate: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="assignmentDescription">作业描述</label>
                <textarea
                  id="assignmentDescription"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  placeholder="详细描述作业要求..."
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="assignmentFile">题目文件（可选）</label>
                <input
                  id="assignmentFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setCreateForm({...createForm, fileUpload: e.target.files?.[0] || null})}
                />
                <small className="form-help">支持PDF、JPG、PNG格式，将自动进行OCR识别</small>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting || !createForm.title.trim() || !createForm.classroomId}
                >
                  {submitting ? '创建中...' : '发布作业'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 学生提交作业模态框 */}
      {showSubmitModal && selectedAssignment && !isTeacher && (
        <div className="modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isResubmission ? '重新提交作业' : '提交作业'}：{selectedAssignment.title}</h2>
              <button className="close-btn" onClick={() => {
                setShowSubmitModal(false);
                setIsResubmission(false);
                setSubmissionHistory([]);
              }}>✕</button>
            </div>
            
            <div className="assignment-info">
              <div className="info-item">
                <span className="info-label">班级：</span>
                <span className="info-value">{selectedAssignment.classroom?.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">截止时间：</span>
                <span className={`info-value ${selectedAssignment.isOverdue ? 'overdue' : ''}`}>
                  {formatDate(selectedAssignment.dueDate)}
                </span>
              </div>
              {selectedAssignment.description && (
                <div className="info-item full-width">
                  <span className="info-label">作业要求：</span>
                  <p className="info-description">{selectedAssignment.description}</p>
                </div>
              )}
              {selectedAssignment.questionFile && (
                <div className="info-item">
                  <span className="info-label">题目文件：</span>
                  <button 
                    className="file-download-link"
                    onClick={() => handleDownloadFile(selectedAssignment.questionFile!.id, selectedAssignment.questionFile!.originalName)}
                  >
                    <span className="file-icon">📎</span>
                    {selectedAssignment.questionFile.originalName}
                  </button>
                </div>
              )}
            </div>
            
            {/* 提交历史 */}
            {isResubmission && submissionHistory.length > 0 && (
              <div className="submission-history">
                <h3 className="history-title">📋 提交历史</h3>
                <div className="history-list">
                  {submissionHistory.map((submission, index) => (
                    <div key={submission.id} className="history-item">
                      <div className="history-info">
                        <span className="version-badge">v{submission.metadata?.version || index + 1}</span>
                        <span className="submission-date">
                          {new Date(submission.submittedAt).toLocaleString('zh-CN')}
                        </span>
                        <span className={`status-badge ${submission.status.toLowerCase()}`}>
                          {submission.status === 'COMPLETED' ? '已批改' : 
                           submission.status === 'PROCESSING' ? '批改中' : '已上传'}
                        </span>
                      </div>
                      {submission.metadata?.note && (
                        <div className="submission-note">备注：{submission.metadata.note}</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="next-version-info">
                  <span className="next-version">即将提交：v{Math.max(...submissionHistory.map(s => s.metadata?.version || 1), 0) + 1}</span>
                </div>
              </div>
            )}
            
            <form onSubmit={submitAssignment} className="modal-form">
              <div className="form-group">
                <label htmlFor="submissionFiles">上传作业文件 *</label>
                <input
                  id="submissionFiles"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  required
                />
                <small className="form-help">支持PDF、图片文件、Word文档，可选择多个文件</small>
                {submitForm.files.length > 0 && (
                  <div className="selected-files">
                    <p className="files-label">已选择的文件：</p>
                    <ul className="files-list">
                      {submitForm.files.map((file, index) => (
                        <li key={index} className="file-item">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="submissionNote">备注说明（可选）</label>
                <textarea
                  id="submissionNote"
                  value={submitForm.note}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="请说明您的解题思路或需要特别关注的地方..."
                  rows={3}
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowSubmitModal(false)}
                  disabled={submitting}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting || submitForm.files.length === 0}
                >
                  {submitting ? 
                    (isResubmission ? '重新提交中...' : '提交中...') : 
                    (isResubmission ? '重新提交作业' : '提交作业')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑作业模态框 */}
      {showEditModal && editingAssignment && isTeacher && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>编辑作业</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            
            <form onSubmit={updateAssignment} className="modal-form">
              <div className="form-group">
                <label htmlFor="editAssignmentTitle">作业标题 *</label>
                <input
                  id="editAssignmentTitle"
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({...prev, title: e.target.value}))}
                  placeholder="如：第三章积分计算练习"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="editAssignmentClassroom">选择班级 *</label>
                <select
                  id="editAssignmentClassroom"
                  value={editForm.classroomId}
                  onChange={(e) => setEditForm(prev => ({...prev, classroomId: e.target.value}))}
                  required
                >
                  <option value="">请选择班级</option>
                  {classrooms.map(classroom => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="editAssignmentStartDate">开始时间 *</label>
                  <input
                    id="editAssignmentStartDate"
                    type="datetime-local"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm(prev => ({...prev, startDate: e.target.value}))}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="editAssignmentDueDate">截止时间 *</label>
                  <input
                    id="editAssignmentDueDate"
                    type="datetime-local"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm(prev => ({...prev, dueDate: e.target.value}))}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="editAssignmentDescription">作业描述</label>
                <textarea
                  id="editAssignmentDescription"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({...prev, description: e.target.value}))}
                  placeholder="详细描述作业要求..."
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="editAssignmentFile">更换题目文件（可选）</label>
                <input
                  id="editAssignmentFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setEditForm(prev => ({
                      ...prev,
                      fileUpload: file
                    }));
                  }}
                />
                <small className="form-help">
                  {editingAssignment.questionFile 
                    ? `当前文件：${editingAssignment.questionFile.originalName}` 
                    : '无题目文件'
                  }
                </small>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm(prev => ({...prev, isActive: e.target.checked}))}
                  />
                  <span className="checkbox-text">启用该作业（学生可见）</span>
                </label>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={submitting}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting || !editForm.title?.trim() || !editForm.classroomId}
                >
                  {submitting ? '更新中...' : '保存更改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 作业详情模态框 */}
      {showDetailModal && detailAssignment && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>作业详情：{detailAssignment.title}</h2>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            
            <div className="assignment-detail">
              {/* 基本信息 */}
              <div className="detail-section">
                <h3 className="section-title">📋 基本信息</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">作业标题：</span>
                    <span className="detail-value">{detailAssignment.title}</span>
                  </div>
                  {detailAssignment.classroom && (
                    <div className="detail-item">
                      <span className="detail-label">所属班级：</span>
                      <span className="detail-value">{detailAssignment.classroom.name}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">开始时间：</span>
                    <span className="detail-value">{formatDate(detailAssignment.startDate)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">截止时间：</span>
                    <span className={`detail-value ${detailAssignment.isOverdue ? 'overdue' : ''}`}>
                      {formatDate(detailAssignment.dueDate)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">作业状态：</span>
                    <span className="detail-value">
                      {detailAssignment.isSubmitted ? (
                        <span className="status-tag submitted">✅ 已提交</span>
                      ) : detailAssignment.isOverdue ? (
                        <span className="status-tag overdue">⏰ 已过期</span>
                      ) : (
                        <span className="status-tag pending">⏳ 待提交</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* 作业描述 */}
              {detailAssignment.description && (
                <div className="detail-section">
                  <h3 className="section-title">📝 作业要求</h3>
                  <div className="detail-description">
                    <p>{detailAssignment.description}</p>
                  </div>
                </div>
              )}

              {/* 题目文件 */}
              {detailAssignment.questionFile && (
                <div className="detail-section">
                  <h3 className="section-title">📎 题目文件</h3>
                  <div className="file-display">
                    <button
                      className="file-download-btn"
                      onClick={() => {
                        handleDownloadFile(detailAssignment.questionFile!.id, detailAssignment.questionFile!.originalName);
                      }}
                    >
                      <span className="file-icon">📄</span>
                      <span className="file-name">{detailAssignment.questionFile.originalName}</span>
                      <span className="download-text">点击下载</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 提交状态 */}
              {!isTeacher && (
                <div className="detail-section">
                  <h3 className="section-title">📤 提交状态</h3>
                  <div className="submission-status">
                    {detailAssignment.isSubmitted ? (
                      <div className="status-card submitted">
                        <div className="status-icon">✅</div>
                        <div className="status-content">
                          <p className="status-title">作业已提交</p>
                          <p className="status-desc">
                            您的作业已成功提交，等待批改结果
                            {detailAssignment.submissionCount && detailAssignment.submissionCount > 1 && (
                              <span className="version-info">（已提交 {detailAssignment.submissionCount} 次）</span>
                            )}
                          </p>
                          <div className="status-actions">
                            {!detailAssignment.isOverdue && (
                              <button 
                                className="btn-secondary small"
                                onClick={() => {
                                  setShowDetailModal(false);
                                  handleResubmitAssignment(detailAssignment);
                                }}
                              >
                                <span className="btn-icon">🔄</span>
                                <span>重新提交</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : detailAssignment.isOverdue ? (
                      <div className="status-card overdue">
                        <div className="status-icon">⏰</div>
                        <div className="status-content">
                          <p className="status-title">作业已过期</p>
                          <p className="status-desc">作业已超过截止时间，无法再提交</p>
                        </div>
                      </div>
                    ) : (
                      <div className="status-card pending">
                        <div className="status-icon">⏳</div>
                        <div className="status-content">
                          <p className="status-title">待提交作业</p>
                          <p className="status-desc">请在截止时间前完成并提交作业</p>
                          <button 
                            className="btn-primary small"
                            onClick={() => {
                              setShowDetailModal(false);
                              handleSubmitAssignment(detailAssignment);
                            }}
                          >
                            <span className="btn-icon">📝</span>
                            <span>立即提交</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowDetailModal(false)}
              >
                关闭
              </button>
              {!isTeacher && !detailAssignment.isSubmitted && !detailAssignment.isOverdue && (
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setShowDetailModal(false);
                    handleSubmitAssignment(detailAssignment);
                  }}
                >
                  <span className="btn-icon">📝</span>
                  <span>提交作业</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI批改结果模态框 */}
      {showGradingResultModal && gradingResultAssignment && gradingResults && (
        <div className="modal-overlay" onClick={() => setShowGradingResultModal(false)}>
          <div className="modal-content grading-results-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>AI批改结果：{gradingResultAssignment.title}</h2>
              <button className="close-btn" onClick={() => setShowGradingResultModal(false)}>✕</button>
            </div>
            
            {/* 作业批改三部分展示 */}
            <div className="assignment-grading-layout">
              {/* 左侧：题目识别 */}
              <div className="question-recognition-panel">
                <div className="panel-header">
                  <h3>📝 题目识别</h3>
                  <div className="progress-indicator">
                    {gradingResultAssignment.ocrStatus === 'PROCESSING' ? (
                      <span className="status-badge processing">识别中...</span>
                    ) : gradingResultAssignment.ocrStatus === 'COMPLETED' ? (
                      <span className="status-badge completed">已完成</span>
                    ) : gradingResultAssignment.ocrStatus === 'FAILED' ? (
                      <span className="status-badge failed">识别失败</span>
                    ) : (
                      <span className="status-badge pending">等待中...</span>
                    )}
                  </div>
                </div>
                <div className="recognition-content">
                  {gradingResultAssignment.ocrStatus === 'PROCESSING' && (
                    <div className="processing-indicator">
                      <div className="loading-spinner"></div>
                      <p>正在识别教师题目...</p>
                    </div>
                  )}
                  
                  {gradingResultAssignment.ocrText ? (
                    <div className="question-content">
                      <div className="content-header">
                        <span className="content-type">识别的题目内容：</span>
                      </div>
                      <div className="recognized-text">
                        {gradingResultAssignment.ocrText}
                      </div>
                      {gradingResultAssignment.ocrLatex && (
                        <div className="latex-content">
                          <div className="content-header">
                            <span className="content-type">LaTeX格式：</span>
                          </div>
                          <div className="latex-text">
                            {gradingResultAssignment.ocrLatex}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : gradingResultAssignment.ocrStatus === 'COMPLETED' || gradingResultAssignment.ocrStatus === 'FAILED' ? (
                    <div className="error-content">
                      <div className="error-icon">⚠️</div>
                      <h4>题目识别失败</h4>
                      <p>教师上传的题目文件识别过程中出现问题。</p>
                    </div>
                  ) : (
                    <div className="empty-content">
                      <p>📄 题目识别结果将在此显示</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 中间：学生作业识别 */}
              <div className="answer-recognition-panel">
                <div className="panel-header">
                  <h3>🔍 作业识别</h3>
                  <div className="progress-indicator">
                    {gradingResults.progress?.stage === 'ocr' ? (
                      <span className="status-badge processing">识别中...</span>
                    ) : gradingResults.mathpixResults && gradingResults.mathpixResults.length > 0 ? (
                      <span className="status-badge completed">已完成</span>
                    ) : gradingResults.progress?.stage === 'completed' ? (
                      <span className="status-badge failed">识别失败</span>
                    ) : (
                      <span className="status-badge pending">等待中...</span>
                    )}
                  </div>
                </div>
                <div className="recognition-content">
                  {gradingResults.progress?.stage === 'ocr' && (
                    <div className="processing-indicator">
                      <div className="loading-spinner"></div>
                      <p>正在识别学生作业...</p>
                    </div>
                  )}
                  
                  {gradingResults.mathpixResults && gradingResults.mathpixResults.length > 0 ? (
                    <div className="answer-content">
                      <div className="confidence-info">
                        <span>识别置信度: {(gradingResults.mathpixResults[0].confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="recognized-text">
                        {gradingResults.mathpixResults[0].recognizedText || '暂无识别内容'}
                      </div>
                      {gradingResults.mathpixResults[0].mathLatex && (
                        <div className="latex-content">
                          <div className="content-header">
                            <span className="content-type">LaTeX公式：</span>
                          </div>
                          <div className="latex-text">
                            {gradingResults.mathpixResults[0].mathLatex}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : gradingResults.status === 'COMPLETED' || gradingResults.status === 'FAILED' ? (
                    <div className="error-content">
                      <div className="error-icon">⚠️</div>
                      <h4>作业识别失败</h4>
                      <p>学生作业识别过程中出现问题，可能是文件格式不支持。</p>
                    </div>
                  ) : (
                    <div className="empty-content">
                      <p>📄 学生作业识别结果将在此显示</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：AI批改解答 */}
              <div className="ai-grading-panel">
                <div className="panel-header">
                  <h3>🤖 AI批改解答</h3>
                  <div className="progress-indicator">
                    {gradingResults.progress?.stage === 'grading' ? (
                      <span className="status-badge processing">批改中...</span>
                    ) : gradingResults.deepseekResults && gradingResults.deepseekResults.length > 0 ? (
                      <span className="status-badge completed">已完成</span>
                    ) : gradingResults.progress?.stage === 'completed' ? (
                      <span className="status-badge failed">批改失败</span>
                    ) : (
                      <span className="status-badge pending">等待中...</span>
                    )}
                  </div>
                </div>
                <div className="grading-content">
                  {gradingResults.progress?.stage === 'grading' && (
                    <div className="processing-indicator">
                      <div className="loading-spinner"></div>
                      <p>AI正在智能批改...</p>
                    </div>
                  )}
                  
                  {gradingResults.deepseekResults && gradingResults.deepseekResults.length > 0 ? (
                    <div className="grading-result">
                      {/* 评分结果 */}
                      <div className="score-display">
                        <div className="score-circle">
                          <div className="score-number">
                            {gradingResults.deepseekResults[0].score || 0}
                          </div>
                          <div className="score-total">/ {gradingResults.deepseekResults[0].maxScore || 100}</div>
                        </div>
                        <div className="score-level">
                          <span className="level-value">
                            {(() => {
                              const score = gradingResults.deepseekResults[0].score || 0;
                              return score >= 90 ? '优秀' : 
                                     score >= 80 ? '良好' : 
                                     score >= 70 ? '中等' : 
                                     score >= 60 ? '及格' : '需要改进';
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* AI反馈 */}
                      {gradingResults.deepseekResults[0].feedback && (
                        <div className="feedback-section">
                          <h4>💬 AI反馈</h4>
                          <p>{gradingResults.deepseekResults[0].feedback}</p>
                        </div>
                      )}

                      {/* 错误分析 */}
                      {gradingResults.deepseekResults[0].errors && 
                       Array.isArray(gradingResults.deepseekResults[0].errors) && 
                       gradingResults.deepseekResults[0].errors.length > 0 && (
                        <div className="errors-section">
                          <h4>❌ 问题分析</h4>
                          <div className="errors-list">
                            {gradingResults.deepseekResults[0].errors.map((error: string, index: number) => (
                              <div key={index} className="error-item">
                                <span className="error-icon">⚠️</span>
                                <span className="error-text">{error}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 改进建议 */}
                      {gradingResults.deepseekResults[0].suggestions && 
                       Array.isArray(gradingResults.deepseekResults[0].suggestions) && 
                       gradingResults.deepseekResults[0].suggestions.length > 0 && (
                        <div className="suggestions-section">
                          <h4>💡 改进建议</h4>
                          <div className="suggestions-list">
                            {gradingResults.deepseekResults[0].suggestions.map((suggestion: string, index: number) => (
                              <div key={index} className="suggestion-item">
                                <span className="suggestion-icon">💡</span>
                                <span className="suggestion-text">{suggestion}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : gradingResults.status === 'COMPLETED' || gradingResults.status === 'FAILED' ? (
                    <div className="error-content">
                      <div className="error-icon">⚠️</div>
                      <h4>AI批改失败</h4>
                      <p>由于作业识别失败，无法进行AI批改。</p>
                    </div>
                  ) : (
                    <div className="empty-content">
                      <p>🤖 AI批改结果将在此显示</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 全页面底部进度指示器 - 只在处理中显示 */}
            {gradingResults.progress && gradingResults.progress.percent < 100 && (
              <div className="bottom-progress-bar">
                <div className="progress-info">
                  <span className="progress-text">{gradingResults.progress.message}</span>
                  <span className="progress-percentage">{gradingResults.progress.percent}%</span>
                </div>
                <div className="progress-bar-full">
                  <div 
                    className="progress-fill-animated"
                    style={{ width: `${gradingResults.progress.percent}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowGradingResultModal(false)}
              >
                关闭
              </button>
              <button 
                className="btn-primary"
                onClick={() => {
                  setShowGradingResultModal(false);
                  // 可以添加导出或分享功能
                }}
              >
                <span className="btn-icon">📄</span>
                <span>导出结果</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};