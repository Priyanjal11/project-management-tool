import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  Paperclip,
  Send,
  Upload,
  Download,
  Trash2,
  FileText,
} from 'lucide-react';
import {
  Role,
  Task,
  TaskComment,
  TaskAttachment,
} from '../types';

interface TaskCollaborationModalProps {
  task: Task;
  initialTab: 'comments' | 'attachments';
  comments: TaskComment[];
  attachments: TaskAttachment[];
  actorName: string;
  actorRole: Role;
  onClose: () => void;
  onAddComment: (task: Task, content: string) => Promise<void>;
  onDeleteComment: (comment: TaskComment) => Promise<void>;
  onAddAttachment: (
    task: Task,
    fileInput: {
      fileName: string;
      fileType: string;
      fileSizeBytes: number;
      contentPreview: string;
    }
  ) => Promise<void>;
  onDeleteAttachment: (attachment: TaskAttachment) => Promise<void>;
}

const QUICK_SPEC_TEMPLATES = [
  {
    fileName: 'jdbc-transaction-audit.sql',
    fileType: 'application/sql',
    content: `-- PreparedStatement & Transaction Isolation Verification
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
UPDATE tasks SET status = 'IN_REVIEW', progress = 90 WHERE id = ?;
INSERT INTO activity_logs (id, user_id, reference_type, reference_id, message) VALUES (?, ?, 'TASK', ?, ?);
COMMIT;`,
  },
  {
    fileName: 'servlet-rbac-checklist.md',
    fileType: 'text/markdown',
    content: `# Servlet RBAC & Input Validation Sign-off
- [x] Verify HttpSession userId and Role enum before servicing POST/PUT
- [x] Validate string bounds and regex ID format on server
- [x] Return HTTP 403 on unauthorized role mutation attempts`,
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export const TaskCollaborationModal: React.FC<TaskCollaborationModalProps> = ({
  task,
  initialTab,
  comments,
  attachments,
  actorName,
  actorRole,
  onClose,
  onAddComment,
  onDeleteComment,
  onAddAttachment,
  onDeleteAttachment,
}) => {
  const [activeTab, setActiveTab] = useState<'comments' | 'attachments'>(initialTab);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(null);

  const taskComments = comments.filter((c) => c.taskId === task.id);
  const taskAttachments = attachments.filter((a) => a.taskId === task.id);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onAddComment(task, commentText.trim());
      setCommentText('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      let previewText = `Binary/Document Attachment: ${file.name} (${formatBytes(file.size)})`;
      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.sql') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.xml') ||
        file.name.endsWith('.java') ||
        file.name.endsWith('.ts')
      ) {
        const rawText = await file.text();
        previewText = rawText.slice(0, 4500) || `Empty text file: ${file.name}`;
      }

      await onAddAttachment(task, {
        fileName: file.name.slice(0, 120),
        fileType: (file.type || 'application/octet-stream').slice(0, 80),
        fileSizeBytes: file.size,
        contentPreview: previewText,
      });
      e.target.value = '';
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to attach file.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickTemplateAttach = async (tpl: (typeof QUICK_SPEC_TEMPLATES)[number]) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onAddAttachment(task, {
        fileName: tpl.fileName,
        fileType: tpl.fileType,
        fileSizeBytes: tpl.content.length,
        contentPreview: tpl.content,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to attach template.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadAttachment = (att: TaskAttachment) => {
    const blob = new Blob([att.contentPreview], { type: att.fileType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = att.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              {task.projectTitle} · Assignee: {task.assigneeName} ·{' '}
              <span className="font-mono tabular-nums">Due {task.dueDate} ({task.progress}%)</span>
            </p>
            <h3 className="text-base font-bold text-slate-900 mt-0.5 truncate">
              {task.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Tab Controls */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'comments'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Task Comments ({taskComments.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attachments')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'attachments'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>File Attachments ({taskAttachments.length})</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 hidden sm:inline">
            Posting as <strong className="text-slate-800">{actorName}</strong> ({actorRole.replace(/_/g, ' ')})
          </span>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'comments' ? (
            <>
              {/* Comment List */}
              {taskComments.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-md space-y-1">
                  <p className="text-xs font-semibold text-slate-700">
                    No comments on this task yet
                  </p>
                  <p className="text-xs text-slate-500">
                    Start the technical discussion or post an implementation update below.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {taskComments.map((cmt) => (
                    <div key={cmt.id} className="p-4 space-y-1.5 bg-white">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-semibold text-slate-900">{cmt.authorName}</span>
                          <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
                          <span className="text-slate-500">
                            {cmt.authorRole.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteComment(cmt)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Delete Comment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {cmt.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment Form */}
              <form onSubmit={handleCommentSubmit} className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Add Task Comment
                </label>
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share progress notes, review feedback, or blocker details..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                  maxLength={1000}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Posting...' : 'Post Comment'}</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              {/* Upload & Quick Attach Controls */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-900">
                    Attach Specification, Log, or Document
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Upload any file from your device or attach a technical template below.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <label className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Uploading...' : 'Upload File'}</span>
                    <input
                      type="file"
                      onChange={handleFileInputChange}
                      disabled={submitting}
                      className="hidden"
                    />
                  </label>

                  {QUICK_SPEC_TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleQuickTemplateAttach(tpl)}
                      className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      + {tpl.fileName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attachments List */}
              {taskAttachments.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-md space-y-1">
                  <p className="text-xs font-semibold text-slate-700">
                    No files attached to this task
                  </p>
                  <p className="text-xs text-slate-500">
                    Click "Upload File" or select a quick specification template above.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {taskAttachments.map((att) => {
                    const isPreviewOpen = previewAttachmentId === att.id;
                    return (
                      <div key={att.id} className="p-4 bg-white space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {att.fileName}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                <span>Uploaded by {att.uploadedBy}</span>
                                <span className="mx-1.5" aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {formatBytes(att.fileSizeBytes)}
                                </span>
                                <span className="mx-1.5" aria-hidden="true">·</span>
                                <span className="font-mono">{att.fileType}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewAttachmentId(isPreviewOpen ? null : att.id)
                              }
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            >
                              {isPreviewOpen ? 'Hide Preview' : 'Preview'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(att)}
                              className="p-1.5 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteAttachment(att)}
                              className="p-1.5 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded transition-colors"
                              title="Remove Attachment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isPreviewOpen && (
                          <pre className="p-3 bg-slate-900 text-slate-100 rounded text-[11px] font-mono overflow-x-auto max-h-48">
                            <code>{att.contentPreview}</code>
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
