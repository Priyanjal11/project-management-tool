import React, { useState } from 'react';
import {
  MessageSquare,
  Paperclip,
  ArrowLeft,
  ArrowRight,
  Edit3,
  Trash2,
  Calendar,
} from 'lucide-react';
import {
  Role,
  Task,
  TaskStatus,
  TaskPriority,
  TaskComment,
  TaskAttachment,
} from '../types';

interface KanbanBoardViewProps {
  tasks: Task[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  activeRole: Role;
  onMoveTaskStatus: (task: Task, newStatus: TaskStatus, newProgress: number) => void;
  onOpenCollaboration: (task: Task, initialTab: 'comments' | 'attachments') => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

const KANBAN_COLUMNS: {
  status: TaskStatus;
  title: string;
  subtitle: string;
  defaultProgress: number;
  headerAccent: string;
  barColor: string;
}[] = [
  {
    status: TaskStatus.TODO,
    title: '01. To Do',
    subtitle: 'Queued & Scoped',
    defaultProgress: 10,
    headerAccent: 'text-slate-700',
    barColor: 'bg-slate-600',
  },
  {
    status: TaskStatus.IN_PROGRESS,
    title: '02. In Progress',
    subtitle: 'Active Implementation',
    defaultProgress: 55,
    headerAccent: 'text-[#2563EB]',
    barColor: 'bg-[#2563EB]',
  },
  {
    status: TaskStatus.IN_REVIEW,
    title: '03. In Review',
    subtitle: 'Code & QA Verification',
    defaultProgress: 90,
    headerAccent: 'text-[#D97706]',
    barColor: 'bg-[#D97706]',
  },
  {
    status: TaskStatus.DONE,
    title: '04. Done',
    subtitle: 'Verified & Complete',
    defaultProgress: 100,
    headerAccent: 'text-[#16A34A]',
    barColor: 'bg-[#16A34A]',
  },
];

function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case TaskPriority.CRITICAL:
      return 'text-[#DC2626] font-semibold';
    case TaskPriority.HIGH:
      return 'text-[#D97706] font-semibold';
    case TaskPriority.MEDIUM:
      return 'text-slate-800 font-medium';
    default:
      return 'text-slate-500 font-normal';
  }
}

export const KanbanBoardView: React.FC<KanbanBoardViewProps> = ({
  tasks,
  comments,
  attachments,
  activeRole,
  onMoveTaskStatus,
  onOpenCollaboration,
  onEditTask,
  onDeleteTask,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colStatus: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colStatus) {
      setDragOverColumn(colStatus);
    }
  };

  const handleDrop = (e: React.DragEvent, targetCol: (typeof KANBAN_COLUMNS)[number]) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    setDragOverColumn(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetCol.status) return;

    const nextProgress =
      targetCol.status === TaskStatus.DONE
        ? 100
        : targetCol.status === TaskStatus.TODO
        ? Math.min(task.progress, 15)
        : Math.max(task.progress, targetCol.defaultProgress);

    onMoveTaskStatus(task, targetCol.status, nextProgress);
  };

  const stepColumn = (task: Task, direction: -1 | 1) => {
    const currentIndex = KANBAN_COLUMNS.findIndex((c) => c.status === task.status);
    if (currentIndex === -1) return;
    const targetCol = KANBAN_COLUMNS[currentIndex + direction];
    if (!targetCol) return;

    const nextProgress =
      targetCol.status === TaskStatus.DONE
        ? 100
        : targetCol.status === TaskStatus.TODO
        ? 10
        : targetCol.defaultProgress;

    onMoveTaskStatus(task, targetCol.status, nextProgress);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Interactive Kanban Execution Board
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag and drop cards across columns or use stage steppers to sync task status, progress, and live notifications.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-600 flex items-center gap-2">
          <span>{tasks.length} Tasks</span>
          <span aria-hidden="true">·</span>
          <span>{comments.length} Comments</span>
          <span aria-hidden="true">·</span>
          <span>{attachments.length} Files</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {KANBAN_COLUMNS.map((col, colIndex) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          const isDropTarget = dragOverColumn === col.status;
          const colSharePct =
            tasks.length > 0 ? Math.round((colTasks.length / tasks.length) * 100) : 0;

          return (
            <div
              key={col.status}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, col)}
              className={`bg-white/95 border rounded-xl p-4 transition-colors min-h-[460px] flex flex-col justify-between ${
                isDropTarget
                  ? 'border-[#2563EB] bg-blue-50/30'
                  : 'border-slate-200/90'
              }`}
            >
              <div className="space-y-3.5">
                {/* Column Header with Stage Progress Strip */}
                <div className="pb-3 border-b border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`text-xs font-bold ${col.headerAccent}`}>{col.title}</h3>
                      <p className="text-[11px] text-slate-500">{col.subtitle}</p>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-bold text-slate-800">
                      {colTasks.length}{' '}
                      <span className="text-slate-400 font-normal">({colSharePct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-xs overflow-hidden">
                    <div
                      className={`h-full ${col.barColor} transition-transform duration-150 origin-left`}
                      style={{
                        transform: `scaleX(${Math.max(0.04, colSharePct / 100)})`,
                      }}
                    />
                  </div>
                </div>

                {colTasks.length === 0 ? (
                  <div className="py-14 px-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                    <p className="text-xs font-medium text-slate-500">
                      No tasks in {col.title.slice(4)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Drag any card into this column to transition stage.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {colTasks.map((task) => {
                      const taskCommentCount = comments.filter(
                        (c) => c.taskId === task.id
                      ).length;
                      const taskAttachmentCount = attachments.filter(
                        (a) => a.taskId === task.id
                      ).length;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverColumn(null);
                          }}
                          className="p-4 bg-[#F8FAFC] hover:bg-white border border-slate-200/90 hover:border-slate-300 rounded-lg transition-colors cursor-grab active:cursor-grabbing space-y-3 group"
                        >
                          {/* Project Kicker & Edit/Delete Actions */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-slate-500 truncate">
                              {task.projectTitle}
                            </span>
                            {activeRole !== Role.TEAM_MEMBER && (
                              <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => onEditTask(task)}
                                  className="p-1 text-slate-400 hover:text-slate-900 rounded"
                                  title="Edit Task"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteTask(task)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                                  title="Delete Task"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Task Title & Description */}
                          <div>
                            <button
                              type="button"
                              onClick={() => onOpenCollaboration(task, 'comments')}
                              className="text-xs font-bold text-slate-900 hover:text-[#2563EB] text-left leading-snug transition-colors"
                            >
                              {task.title}
                            </button>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                              {task.description}
                            </p>
                          </div>

                          {/* Assignee Name + Priority & Due Date Metadata */}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-slate-900 truncate">
                                Assignee: {task.assigneeName}
                              </p>
                              <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <span className={getPriorityColor(task.priority)}>
                                  {task.priority}
                                </span>
                                <span aria-hidden="true">·</span>
                                <Calendar className="w-2.5 h-2.5 inline shrink-0" />
                                <span className="font-mono tabular-nums">{task.dueDate}</span>
                              </p>
                            </div>
                          </div>

                          {/* Completion Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                              <span>Progress</span>
                              <span className="font-semibold text-slate-900">
                                {task.progress}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-xs overflow-hidden">
                              <div
                                className={`h-full ${col.barColor} transition-transform duration-150 origin-left`}
                                style={{
                                  transform: `scaleX(${Math.max(0.03, task.progress / 100)})`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Collaboration & Column Step Controls */}
                          <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenCollaboration(task, 'comments')}
                                className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                title="Task Comments"
                              >
                                <MessageSquare className="w-3 h-3 text-slate-500" />
                                <span className="font-mono tabular-nums">{taskCommentCount}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenCollaboration(task, 'attachments')}
                                className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                title="Task File Attachments"
                              >
                                <Paperclip className="w-3 h-3 text-slate-500" />
                                <span className="font-mono tabular-nums">
                                  {taskAttachmentCount}
                                </span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={colIndex === 0}
                                onClick={() => stepColumn(task, -1)}
                                className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 bg-white border border-slate-200 rounded transition-colors cursor-pointer"
                                title="Move to previous stage"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={colIndex === KANBAN_COLUMNS.length - 1}
                                onClick={() => stepColumn(task, 1)}
                                className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 bg-white border border-slate-200 rounded transition-colors cursor-pointer"
                                title="Advance to next stage"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
