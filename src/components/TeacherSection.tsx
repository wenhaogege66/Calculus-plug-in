import React from 'react';

interface TeacherSectionProps {
  classrooms: any[];
  selectedClassroom: string;
  showCreateClass: boolean;
  showAssignWork: boolean;
  showStudents: boolean;
  showInviteCode: boolean;
  students: any[];
  currentInviteCode: string;
  className: string;
  classDescription: string;
  assignmentTitle: string;
  assignmentDescription: string;
  startDate: string;
  dueDate: string;
  assignmentFile: File | null;
  uploadStatus: {
    uploading: boolean;
    progress: number;
    message: string;
  };
  onClassroomChange: (value: string) => void;
  onShowCreateClass: () => void;
  onShowAssignWork: () => void;
  onViewStudents: () => void;
  onViewInviteCode: () => void;
  onCreateClass: () => void;
  onAssignWork: () => void;
  onCloseCreateClass: () => void;
  onCloseAssignWork: () => void;
  onCloseStudents: () => void;
  onCloseInviteCode: () => void;
  onClassNameChange: (value: string) => void;
  onClassDescriptionChange: (value: string) => void;
  onAssignmentTitleChange: (value: string) => void;
  onAssignmentDescriptionChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onAssignmentFileChange: (file: File | null) => void;
  onCopyInviteCode: () => void;
}

export const TeacherSection: React.FC<TeacherSectionProps> = ({
  classrooms,
  selectedClassroom,
  showCreateClass,
  showAssignWork,
  showStudents,
  showInviteCode,
  students,
  currentInviteCode,
  className,
  classDescription,
  assignmentTitle,
  assignmentDescription,
  startDate,
  dueDate,
  assignmentFile,
  uploadStatus,
  onClassroomChange,
  onShowCreateClass,
  onShowAssignWork,
  onViewStudents,
  onViewInviteCode,
  onCreateClass,
  onAssignWork,
  onCloseCreateClass,
  onCloseAssignWork,
  onCloseStudents,
  onCloseInviteCode,
  onClassNameChange,
  onClassDescriptionChange,
  onAssignmentTitleChange,
  onAssignmentDescriptionChange,
  onStartDateChange,
  onDueDateChange,
  onAssignmentFileChange,
  onCopyInviteCode
}) => {
  return (
    <div className="teacher-section">
      <h3>👨‍🏫 教师功能</h3>
      
      {!showCreateClass && !showAssignWork && (
        <>
          <div className="classroom-selector">
            <label>选择班级：</label>
            <select 
              value={selectedClassroom} 
              onChange={(e) => onClassroomChange(e.target.value)}
            >
              <option value="">请选择班级</option>
              {classrooms.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          
          <div className="teacher-actions">
            <button 
              className="teacher-btn"
              onClick={onShowCreateClass}
            >
              📋 创建班级
            </button>
            <button 
              className="teacher-btn"
              onClick={onShowAssignWork}
              disabled={!selectedClassroom}
            >
              📤 布置作业
            </button>
            <button 
              className="teacher-btn"
              onClick={onViewStudents}
              disabled={!selectedClassroom || uploadStatus.uploading}
            >
              📊 查看学生
            </button>
            <button 
              className="teacher-btn"
              onClick={onViewInviteCode}
              disabled={!selectedClassroom}
            >
              🔗 邀请码
            </button>
          </div>
        </>
      )}
      
      {showCreateClass && (
        <div className="create-class-form">
          <h4>创建新班级</h4>
          <input 
            type="text" 
            placeholder="班级名称" 
            value={className}
            onChange={(e) => onClassNameChange(e.target.value)}
          />
          <textarea 
            placeholder="班级描述（可选）"
            value={classDescription}
            onChange={(e) => onClassDescriptionChange(e.target.value)}
          ></textarea>
          <div className="form-buttons">
            <button 
              className="btn-primary"
              onClick={onCreateClass}
              disabled={uploadStatus.uploading}
            >
              {uploadStatus.uploading ? '创建中...' : '创建'}
            </button>
            <button 
              className="btn-secondary"
              onClick={onCloseCreateClass}
            >
              取消
            </button>
          </div>
        </div>
      )}
      
      {showAssignWork && (
        <div className="assign-work-form">
          <h4>布置作业</h4>
          <input 
            type="text" 
            placeholder="作业标题" 
            value={assignmentTitle}
            onChange={(e) => onAssignmentTitleChange(e.target.value)}
          />
          <textarea 
            placeholder="作业描述（可选）"
            value={assignmentDescription}
            onChange={(e) => onAssignmentDescriptionChange(e.target.value)}
          ></textarea>
          <div className="date-inputs">
            <label>
              开始时间：
              <input 
                type="datetime-local" 
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
              />
            </label>
            <label>
              截止时间：
              <input 
                type="datetime-local" 
                value={dueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
              />
            </label>
          </div>
          <div className="upload-area">
            <input 
              type="file" 
              accept=".pdf,.jpg,.jpeg,.png" 
              onChange={(e) => onAssignmentFileChange(e.target.files?.[0] || null)}
            />
            <p>上传题目文件 (PDF/图片, 可选)</p>
          </div>
          <div className="form-buttons">
            <button 
              className="btn-primary"
              onClick={onAssignWork}
              disabled={uploadStatus.uploading}
            >
              {uploadStatus.uploading ? '布置中...' : '布置作业'}
            </button>
            <button 
              className="btn-secondary"
              onClick={onCloseAssignWork}
            >
              取消
            </button>
          </div>
        </div>
      )}
      
      {showStudents && (
        <div className="students-list">
          <h4>班级学生列表</h4>
          <div className="students-container">
            {students.length > 0 ? (
              students.map(member => (
                <div key={member.id} className="student-item">
                  <div className="student-avatar">
                    {member.student.avatarUrl ? (
                      <img src={member.student.avatarUrl} alt="头像" />
                    ) : (
                      <div className="avatar-placeholder">
                        {member.student.username?.charAt(0).toUpperCase() || 'S'}
                      </div>
                    )}
                  </div>
                  <div className="student-info">
                    <p><strong>{member.student.username}</strong></p>
                    <p>{member.student.email}</p>
                    <p>加入时间: {new Date(member.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <p>该班级暂无学生</p>
            )}
          </div>
          <button 
            className="btn-secondary"
            onClick={onCloseStudents}
          >
            关闭
          </button>
        </div>
      )}
      
      {showInviteCode && (
        <div className="invite-code-display">
          <h4>班级邀请码</h4>
          <div className="invite-code-container">
            <div className="invite-code">{currentInviteCode}</div>
            <button 
              className="btn-small"
              onClick={onCopyInviteCode}
            >
              复制
            </button>
          </div>
          <p>学生可使用此邀请码加入班级</p>
          <button 
            className="btn-secondary"
            onClick={onCloseInviteCode}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}; 