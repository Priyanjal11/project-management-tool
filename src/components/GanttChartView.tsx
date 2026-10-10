import React, { useMemo, useState } from 'react';
import { Calendar, MessageSquare, Paperclip, Eye } from 'lucide-react';
import {
  Project,
  Task,
  TaskComment,
  TaskAttachment,
  TaskStatus,
} from '../types';
import kanbanGanttBlueprint from '../assets/images/kanban_gantt_blueprint_1791618638744.jpg';

interface GanttChartViewProps {
  projects: Project[];
  tasks: Task[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  onShiftTaskDueDate: (task: Task, deltaDays: number) => void;
  onOpenCollaboration: (task: Task, initialTab: 'comments' | 'attachments') => void;
}

function parseDateMs(dateStr: string, fallbackStr: string): number {
  const d = Date.parse(dateStr);
  return Number.isNaN(d) ? Date.parse(fallbackStr) : d;
}

function shiftIsoDate(dateStr: string, deltaDays: number): string {
  const ms = parseDateMs(dateStr, '2026-10-15');
  const next = new Date(ms + deltaDays * 86400000);
  return next.toISOString().slice(0, 10);
}

export const GanttChartView: React.FC<GanttChartViewProps> = ({
  projects,
  tasks,
  comments,
  attachments,
  onShiftTaskDueDate,
  onOpenCollaboration,
}) => {
  const [showSchematicBanner, setShowSchematicBanner] = useState(false);
  const [schematicImgError, setSchematicImgError] = useState(false);

  // Compute timeline window across all projects and tasks
  const timelineBounds = useMemo(() => {
    const defaultStart = Date.parse('2026-09-20');
    const defaultEnd = Date.parse('2026-12-10');

    if (projects.length === 0 && tasks.length === 0) {
      return { minMs: defaultStart, maxMs: defaultEnd, spanMs: defaultEnd - defaultStart };
    }

    let minMs = Infinity;
    let maxMs = -Infinity;

    for (const p of projects) {
      const s = parseDateMs(p.startDate, '2026-09-25');
      const e = parseDateMs(p.endDate, '2026-11-30');
      if (s < minMs) minMs = s;
      if (e > maxMs) maxMs = e;
    }

    for (const t of tasks) {
      const due = parseDateMs(t.dueDate, '2026-10-25');
      const estStart = due - 12 * 86400000;
      if (estStart < minMs) minMs = estStart;
      if (due > maxMs) maxMs = due;
    }

    const paddedMin = minMs - 5 * 86400000;
    const paddedMax = maxMs + 7 * 86400000;
    const spanMs = Math.max(14 * 86400000, paddedMax - paddedMin);

    return { minMs: paddedMin, maxMs: paddedMax, spanMs };
  }, [projects, tasks]);

  // Generate 6 evenly spaced date tick labels for the header axis
  const axisTicks = useMemo(() => {
    const ticks: { label: string; pct: number }[] = [];
    const count = 6;
    for (let i = 0; i <= count; i++) {
      const pct = (i / count) * 100;
      const ms = timelineBounds.minMs + (i / count) * timelineBounds.spanMs;
      const iso = new Date(ms).toISOString().slice(5, 10); // MM-DD
      ticks.push({ label: iso, pct });
    }
    return ticks;
  }, [timelineBounds]);

  const todayPct = useMemo(() => {
    const todayMs = Date.parse('2026-10-10');
    const raw = ((todayMs - timelineBounds.minMs) / timelineBounds.spanMs) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [timelineBounds]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Interactive Project & Task Gantt Chart
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Visual schedule of project windows and task milestone bars. Adjust task deadlines (-3d / +3d) or click any task to open comments & files.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="font-mono tabular-nums">
            Window: {new Date(timelineBounds.minMs).toISOString().slice(0, 10)} →{' '}
            {new Date(timelineBounds.maxMs).toISOString().slice(0, 10)}
          </span>
          <button
            type="button"
            onClick={() => setShowSchematicBanner((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showSchematicBanner ? 'Hide Blueprint' : 'View Timeline Schematic'}</span>
          </button>
        </div>
      </div>

      {showSchematicBanner && (
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 space-y-2">
              <p className="text-xs font-semibold text-[#2563EB]">
                Architectural Schedule Reference
              </p>
              <h3 className="text-base font-bold text-slate-900">
                Modular Critical-Path & Milestone Orchestration
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Each parent project bar spans its committed start-to-end delivery window, while child task bars plot 14-day sprint execution windows leading into their target due dates. Use the <span className="font-mono font-semibold">-3d</span> and <span className="font-mono font-semibold">+3d</span> controls on any row to shift deadlines in real time.
              </p>
            </div>
            <div className="lg:col-span-7">
              {!schematicImgError ? (
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-white h-48">
                  <img
                    src={kanbanGanttBlueprint}
                    alt="Project Orchestration and Timeline Schematic"
                    referrerPolicy="no-referrer"
                    onError={() => setSchematicImgError(true)}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-900 text-white p-6 h-48 flex flex-col justify-center">
                  <p className="text-sm font-bold">Critical-Path Timeline Architecture</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Synchronized with Cloud Firestore real-time task and project snapshots.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500">
          No projects available to display on the Gantt timeline. Click "Load Sample Data" or "New Project".
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[880px]">
            {/* Timeline Header Row */}
            <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <div className="col-span-4 py-3 px-4 border-r border-slate-200">
                Project / Task Hierarchy
              </div>
              <div className="col-span-2 py-3 px-3 border-r border-slate-200">
                Owner / Schedule
              </div>
              <div className="col-span-6 py-3 px-4 relative">
                <div className="flex items-center justify-between font-mono tabular-nums text-[11px] text-slate-500">
                  {axisTicks.map((tick, idx) => (
                    <span key={idx}>2026-{tick.label}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Project & Task Rows */}
            <div className="divide-y divide-slate-200 text-xs">
              {projects.map((project) => {
                const projTasks = tasks.filter((t) => t.projectId === project.id);
                const projStartMs = parseDateMs(project.startDate, '2026-09-25');
                const projEndMs = parseDateMs(project.endDate, '2026-11-25');
                const projLeftPct = Math.max(
                  0,
                  Math.min(
                    95,
                    ((projStartMs - timelineBounds.minMs) / timelineBounds.spanMs) * 100
                  )
                );
                const projWidthPct = Math.max(
                  5,
                  Math.min(
                    100 - projLeftPct,
                    ((projEndMs - projStartMs) / timelineBounds.spanMs) * 100
                  )
                );

                const projAvgProgress =
                  projTasks.length > 0
                    ? Math.round(
                        projTasks.reduce((a, b) => a + (Number(b.progress) || 0), 0) /
                          projTasks.length
                      )
                    : project.status === 'COMPLETED'
                    ? 100
                    : 0;

                return (
                  <React.Fragment key={project.id}>
                    {/* Parent Project Row */}
                    <div className="grid grid-cols-12 bg-slate-50/90 hover:bg-slate-100/70 transition-colors items-center">
                      <div className="col-span-4 py-3.5 px-4 border-r border-slate-200">
                        <p className="font-bold text-slate-900 truncate">{project.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Project · {project.status.replace(/_/g, ' ')} · {projTasks.length} Tasks ({projAvgProgress}%)
                        </p>
                      </div>
                      <div className="col-span-2 py-3.5 px-3 border-r border-slate-200 font-mono tabular-nums text-[11px] text-slate-600">
                        <p className="font-sans font-medium text-slate-800 truncate">
                          {project.managerName}
                        </p>
                        <p>
                          {project.startDate.slice(5)} → {project.endDate.slice(5)}
                        </p>
                      </div>
                      <div className="col-span-6 py-3.5 px-4 relative h-12 flex items-center">
                        {/* Reference Today Vertical Line */}
                        <div
                          className="absolute top-0 bottom-0 w-px bg-amber-500/70 pointer-events-none"
                          style={{ left: `${todayPct}%` }}
                        />
                        {/* Project Span Bar */}
                        <div
                          className="h-5 bg-slate-200 rounded-xs relative overflow-hidden border border-slate-300"
                          style={{
                            marginLeft: `${projLeftPct}%`,
                            width: `${projWidthPct}%`,
                          }}
                          title={`${project.title}: ${project.startDate} to ${project.endDate} (${projAvgProgress}%)`}
                        >
                          <div
                            className="h-full bg-slate-900 transition-transform duration-150 origin-left"
                            style={{
                              transform: `scaleX(${Math.max(0.02, projAvgProgress / 100)})`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Child Task Rows */}
                    {projTasks.map((task) => {
                      const dueMs = parseDateMs(task.dueDate, project.endDate);
                      const taskStartMs = Math.max(projStartMs, dueMs - 14 * 86400000);
                      const taskLeftPct = Math.max(
                        0,
                        Math.min(
                          94,
                          ((taskStartMs - timelineBounds.minMs) / timelineBounds.spanMs) * 100
                        )
                      );
                      const taskWidthPct = Math.max(
                        6,
                        Math.min(
                          100 - taskLeftPct,
                          ((dueMs - taskStartMs) / timelineBounds.spanMs) * 100
                        )
                      );

                      const commentCount = comments.filter((c) => c.taskId === task.id).length;
                      const attachCount = attachments.filter((a) => a.taskId === task.id).length;

                      return (
                        <div
                          key={task.id}
                          className="grid grid-cols-12 hover:bg-slate-50 transition-colors items-center"
                        >
                          <div className="col-span-4 py-2.5 pl-7 pr-4 border-r border-slate-200 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => onOpenCollaboration(task, 'comments')}
                                className="font-medium text-slate-800 hover:text-[#2563EB] hover:underline text-left truncate block max-w-full cursor-pointer"
                              >
                                {task.title}
                              </button>
                              <p className="text-[11px] text-slate-500">
                                {task.priority} · {task.status.replace(/_/g, ' ')} ·{' '}
                                <span className="font-mono tabular-nums font-semibold text-slate-700">
                                  {task.progress}%
                                </span>
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenCollaboration(task, 'comments')}
                                className="px-1.5 py-0.5 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 rounded flex items-center gap-1 font-mono tabular-nums cursor-pointer"
                                title="Open Task Comments"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>{commentCount}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenCollaboration(task, 'attachments')}
                                className="px-1.5 py-0.5 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 rounded flex items-center gap-1 font-mono tabular-nums cursor-pointer"
                                title="Open Task Attachments"
                              >
                                <Paperclip className="w-3 h-3" />
                                <span>{attachCount}</span>
                              </button>
                            </div>
                          </div>

                          <div className="col-span-2 py-2.5 px-3 border-r border-slate-200 flex items-center justify-between gap-1">
                            <div className="min-w-0">
                              <p className="text-slate-800 font-medium truncate">
                                {task.assigneeName}
                              </p>
                              <p className="font-mono tabular-nums text-[11px] text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3 shrink-0" />
                                <span>{task.dueDate}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onShiftTaskDueDate(task, -3)}
                                className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                                title="Shift due date -3 days"
                              >
                                -3d
                              </button>
                              <button
                                type="button"
                                onClick={() => onShiftTaskDueDate(task, 3)}
                                className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                                title="Shift due date +3 days"
                              >
                                +3d
                              </button>
                            </div>
                          </div>

                          <div className="col-span-6 py-2.5 px-4 relative h-10 flex items-center">
                            <div
                              className="absolute top-0 bottom-0 w-px bg-amber-500/70 pointer-events-none"
                              style={{ left: `${todayPct}%` }}
                            />
                            <div
                              onClick={() => onOpenCollaboration(task, 'comments')}
                              className={`h-4 rounded-xs relative overflow-hidden cursor-pointer border ${
                                task.status === TaskStatus.DONE
                                  ? 'bg-emerald-100 border-emerald-400'
                                  : 'bg-blue-100 border-blue-400'
                              }`}
                              style={{
                                marginLeft: `${taskLeftPct}%`,
                                width: `${taskWidthPct}%`,
                              }}
                              title={`${task.title} — Due ${task.dueDate} (${task.progress}%)`}
                            >
                              <div
                                className={`h-full transition-transform duration-150 origin-left ${
                                  task.status === TaskStatus.DONE
                                    ? 'bg-[#16A34A]'
                                    : 'bg-[#2563EB]'
                                }`}
                                style={{
                                  transform: `scaleX(${Math.max(0.04, task.progress / 100)})`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { shiftIsoDate };
