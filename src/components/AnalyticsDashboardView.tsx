import React, { useState } from 'react';
import { Download, Check } from 'lucide-react';
import {
  Project,
  Task,
  ManagedUser,
  TaskComment,
  TaskAttachment,
  TaskStatus,
  TaskPriority,
} from '../types';

interface AnalyticsDashboardViewProps {
  projects: Project[];
  tasks: Task[];
  managedUsers: ManagedUser[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const AnalyticsDashboardView: React.FC<AnalyticsDashboardViewProps> = ({
  projects,
  tasks,
  managedUsers,
  comments,
  attachments,
}) => {
  const [downloadedRecently, setDownloadedRecently] = useState(false);

  const totalTasks = tasks.length;
  const todoCount = tasks.filter((t) => t.status === TaskStatus.TODO).length;
  const inProgressCount = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
  const inReviewCount = tasks.filter((t) => t.status === TaskStatus.IN_REVIEW).length;
  const doneCount = tasks.filter((t) => t.status === TaskStatus.DONE).length;

  const criticalCount = tasks.filter((t) => t.priority === TaskPriority.CRITICAL).length;
  const highCount = tasks.filter((t) => t.priority === TaskPriority.HIGH).length;
  const mediumCount = tasks.filter((t) => t.priority === TaskPriority.MEDIUM).length;
  const lowCount = tasks.filter((t) => t.priority === TaskPriority.LOW).length;

  // SVG Donut math (r = 42, circumference = 2 * pi * 42 ≈ 263.89)
  const circumference = 263.89;
  const doneRatio = totalTasks > 0 ? doneCount / totalTasks : 0;
  const reviewRatio = totalTasks > 0 ? inReviewCount / totalTasks : 0;
  const progRatio = totalTasks > 0 ? inProgressCount / totalTasks : 0;

  const doneDash = doneRatio * circumference;
  const reviewDash = reviewRatio * circumference;
  const progDash = progRatio * circumference;

  const handleDownloadCsvReport = () => {
    const headers = [
      'Record Type',
      'Project ID',
      'Project Title',
      'Project Status',
      'Project Start Date',
      'Project End Date',
      'Project Manager',
      'Project Avg Progress (%)',
      'Task ID',
      'Task Title',
      'Task Status',
      'Task Priority',
      'Assignee Name',
      'Task Due Date',
      'Task Progress (%)',
      'Comments Count',
      'Attachments Count',
    ];

    const rows: (string | number)[][] = [];
    const projectMap = new Map<string, Project>();
    for (const p of projects) {
      projectMap.set(p.id, p);
    }

    // 1. Add project summary rows with aggregate task progress metrics
    for (const project of projects) {
      const projTasks = tasks.filter((t) => t.projectId === project.id);
      const projAvgProgress =
        projTasks.length > 0
          ? Math.round(
              projTasks.reduce((sum, t) => sum + (Number(t.progress) || 0), 0) / projTasks.length
            )
          : project.status === 'COMPLETED'
          ? 100
          : 0;
      const projCommentsCount = projTasks.reduce(
        (sum, t) => sum + comments.filter((c) => c.taskId === t.id).length,
        0
      );
      const projAttachmentsCount = projTasks.reduce(
        (sum, t) => sum + attachments.filter((a) => a.taskId === t.id).length,
        0
      );

      rows.push([
        'PROJECT_SUMMARY',
        project.id,
        project.title,
        project.status,
        project.startDate,
        project.endDate,
        project.managerName,
        projAvgProgress,
        'ALL_PROJECT_TASKS',
        `${projTasks.length} Assigned Tasks`,
        project.status,
        'N/A',
        project.managerName,
        project.endDate,
        projAvgProgress,
        projCommentsCount,
        projAttachmentsCount,
      ]);
    }

    // 2. Add individual project task status and progress metric rows
    for (const task of tasks) {
      const parentProject = projectMap.get(task.projectId);
      const projTasks = tasks.filter((t) => t.projectId === task.projectId);
      const projAvgProgress =
        projTasks.length > 0
          ? Math.round(
              projTasks.reduce((sum, t) => sum + (Number(t.progress) || 0), 0) / projTasks.length
            )
          : 0;
      const taskCommentCount = comments.filter((c) => c.taskId === task.id).length;
      const taskAttachmentCount = attachments.filter((a) => a.taskId === task.id).length;

      rows.push([
        'PROJECT_TASK',
        task.projectId,
        parentProject?.title || task.projectTitle,
        parentProject?.status || 'ACTIVE',
        parentProject?.startDate || '',
        parentProject?.endDate || '',
        parentProject?.managerName || '',
        projAvgProgress,
        task.id,
        task.title,
        task.status,
        task.priority,
        task.assigneeName,
        task.dueDate,
        task.progress,
        taskCommentCount,
        taskAttachmentCount,
      ]);
    }

    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ];
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `project-task-progress-report-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadedRecently(true);
    window.setTimeout(() => setDownloadedRecently(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Analytics Report Header & CSV Export Action */}
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Project & Task Analytics Report
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live metrics across {projects.length} projects and {tasks.length} tasks. Export full task statuses and progress metrics to CSV.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadCsvReport}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {downloadedRecently ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Report Downloaded</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Task Status Distribution Donut & Breakdown */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Task Lifecycle Distribution
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Proportional breakdown of tasks across execution stages.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6 pt-2">
            <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth="12"
                />
                {progDash > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    stroke="#2563EB"
                    strokeWidth="12"
                    strokeDasharray={`${progDash} ${circumference}`}
                    strokeDashoffset={-(doneDash + reviewDash)}
                  />
                )}
                {reviewDash > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    stroke="#D97706"
                    strokeWidth="12"
                    strokeDasharray={`${reviewDash} ${circumference}`}
                    strokeDashoffset={-doneDash}
                  />
                )}
                {doneDash > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    stroke="#16A34A"
                    strokeWidth="12"
                    strokeDasharray={`${doneDash} ${circumference}`}
                    strokeDashoffset={0}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                  {totalTasks}
                </span>
                <span className="text-[11px] text-slate-500">Tasks</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#16A34A]">Done (100%)</span>
                <span className="font-mono tabular-nums text-slate-800">
                  {doneCount} ({totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#D97706]">In Review</span>
                <span className="font-mono tabular-nums text-slate-800">
                  {inReviewCount} (
                  {totalTasks > 0 ? Math.round((inReviewCount / totalTasks) * 100) : 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#2563EB]">In Progress</span>
                <span className="font-mono tabular-nums text-slate-800">
                  {inProgressCount} (
                  {totalTasks > 0 ? Math.round((inProgressCount / totalTasks) * 100) : 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600">To Do (Queued)</span>
                <span className="font-mono tabular-nums text-slate-800">
                  {todoCount} ({totalTasks > 0 ? Math.round((todoCount / totalTasks) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Priority & Risk Breakdown */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Task Priority & Risk Allocation
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribution of work items by severity tier across active projects.
            </p>
          </div>

          <div className="space-y-3.5 pt-1">
            {(
              [
                { label: 'CRITICAL Priority', count: criticalCount, barClass: 'bg-[#DC2626]' },
                { label: 'HIGH Priority', count: highCount, barClass: 'bg-[#D97706]' },
                { label: 'MEDIUM Priority', count: mediumCount, barClass: 'bg-slate-800' },
                { label: 'LOW Priority', count: lowCount, barClass: 'bg-slate-400' },
              ] as const
            ).map((row) => {
              const pct = totalTasks > 0 ? Math.round((row.count / totalTasks) * 100) : 0;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{row.label}</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {row.count} tasks · {pct}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-xs overflow-hidden">
                    <div
                      className={`h-full ${row.barClass} transition-transform duration-150 origin-left`}
                      style={{ transform: `scaleX(${Math.max(0.02, pct / 100)})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Project Completion Velocity Comparison */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Project Completion Velocity
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregate task progress per project against target end date.
            </p>
          </div>

          {projects.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No active projects to compare.
            </p>
          ) : (
            <div className="space-y-3.5 pt-1">
              {projects.slice(0, 4).map((proj) => {
                const pTasks = tasks.filter((t) => t.projectId === proj.id);
                const avg =
                  pTasks.length > 0
                    ? Math.round(
                        pTasks.reduce((s, t) => s + (Number(t.progress) || 0), 0) / pTasks.length
                      )
                    : proj.status === 'COMPLETED'
                    ? 100
                    : 0;
                return (
                  <div key={proj.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-semibold text-slate-800 truncate">{proj.title}</span>
                      <span className="font-mono tabular-nums text-slate-700 shrink-0">
                        {avg}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#2563EB] transition-transform duration-150 origin-left"
                        style={{ transform: `scaleX(${Math.max(0.03, avg / 100)})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Team Member Collaboration & Velocity Report Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Team Delivery & Collaboration Analytics
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Quantitative summary of task assignments, completion rates, comments, and file attachments per user.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {projects.length} Active Projects
          </span>
        </div>

        {managedUsers.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No workspace user accounts available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Role · Department</th>
                  <th className="py-3 px-4 text-right">Assigned Tasks</th>
                  <th className="py-3 px-4 text-right">Completed</th>
                  <th className="py-3 px-4 text-right">Comments</th>
                  <th className="py-3 px-4 text-right">Files Attached</th>
                  <th className="py-3 px-4 text-right">Avg Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {managedUsers.map((member) => {
                  const mTasks = tasks.filter(
                    (t) => t.assigneeId === member.id || t.assigneeName === member.name
                  );
                  const mDone = mTasks.filter((t) => t.status === TaskStatus.DONE).length;
                  const mComments = comments.filter((c) => c.authorName === member.name).length;
                  const mFiles = attachments.filter((a) => a.uploadedBy === member.name).length;
                  const mAvg =
                    mTasks.length > 0
                      ? Math.round(
                          mTasks.reduce((a, b) => a + (Number(b.progress) || 0), 0) / mTasks.length
                        )
                      : 0;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-slate-900">{member.name}</p>
                          <p className="text-slate-500 font-mono">{member.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {member.role.replace(/_/g, ' ')} · {member.department}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-800">
                        {mTasks.length}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#16A34A] font-semibold">
                        {mDone}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {mComments}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {mFiles}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2 w-28">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-xs overflow-hidden">
                            <div
                              className="h-full bg-slate-900 origin-left"
                              style={{ transform: `scaleX(${Math.max(0.04, mAvg / 100)})` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums font-semibold text-slate-900 w-9 text-right">
                            {mAvg}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
