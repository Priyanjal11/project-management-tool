import React, { Component, ErrorInfo, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Database,
  RefreshCw,
  X,
  MessageSquare,
  Paperclip,
  Bell,
} from 'lucide-react';
import { auth, db, googleProvider, handleFirestoreError } from './firebase';
import {
  Role,
  UserStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  SettingCategory,
  OperationType,
  UserProfile,
  ManagedUser,
  Project,
  Task,
  TaskComment,
  TaskAttachment,
  ActivityLog,
  SystemSetting,
} from './types';
import {
  ensureUserProfile,
  switchActiveUserRole,
  updateUserProfileDetails,
  saveManagedUser,
  removeManagedUser,
  saveProject,
  removeProject,
  saveTask,
  updateTaskProgressAndStatus,
  updateTaskScheduleAndProgress,
  removeTask,
  addTaskComment,
  removeTaskComment,
  addTaskAttachment,
  removeTaskAttachment,
  saveSystemSetting,
  markActivityRead,
  markAllActivitiesRead,
  seedSampleWorkspace,
  clearWorkspaceData,
} from './services/firestoreService';
import { SearchGroundingView } from './components/SearchGroundingView';
import { JavaArchitectureView } from './components/JavaArchitectureView';
import { KanbanBoardView } from './components/KanbanBoardView';
import { GanttChartView, shiftIsoDate } from './components/GanttChartView';
import { TaskCollaborationModal } from './components/TaskCollaborationModal';
import { AnalyticsDashboardView } from './components/AnalyticsDashboardView';
import kanbanGanttBlueprint from './assets/images/kanban_gantt_blueprint_1791618638744.jpg';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Application Runtime Exception</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              An unexpected permission or validation error occurred. Review the diagnostic details below:
            </p>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded text-xs font-mono overflow-x-auto">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type NavTab = 'dashboard' | 'tracking' | 'analytics' | 'grounding' | 'profile';
type TrackingSubView = 'kanban' | 'gantt' | 'table';

function formatStatusLabel(val: string): string {
  return val.replace(/_/g, ' ');
}

function getStatusTextClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
    case 'COMPLETED':
    case 'DONE':
      return 'text-[#16A34A] font-semibold';
    case 'IN_PROGRESS':
    case 'IN_REVIEW':
    case 'PLANNING':
    case 'ON_HOLD':
      return 'text-[#D97706] font-semibold';
    case 'SUSPENDED':
    case 'CRITICAL':
    case 'ARCHIVED':
      return 'text-[#DC2626] font-semibold';
    default:
      return 'text-slate-700 font-medium';
  }
}

function getPriorityTextClass(priority: TaskPriority): string {
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

export default function App() {
  return (
    <AppErrorBoundary>
      <ProjectManagementApp />
    </AppErrorBoundary>
  );
}

function ProjectManagementApp() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  // Smart Signup / Login Onboarding state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [signupPrefs, setSignupPrefs] = useState<{
    customName: string;
    role: Role;
    department: string;
  }>({
    customName: '',
    role: Role.ADMIN,
    department: 'Platform & Product Engineering',
  });
  const signupPrefsRef = useRef(signupPrefs);
  signupPrefsRef.current = signupPrefs;

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [activeNav, setActiveNav] = useState<NavTab>('dashboard');
  const [trackingSubView, setTrackingSubView] = useState<TrackingSubView>('kanban');
  const [showJavaSpecsDrawer, setShowJavaSpecsDrawer] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [activityFilterType, setActivityFilterType] = useState<string>('ALL');

  const [bannerFeedback, setBannerFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [seedingBusy, setSeedingBusy] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('ALL');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('ALL');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Collaboration Modal State (Comments & File Attachments)
  const [collabTaskId, setCollabTaskId] = useState<string | null>(null);
  const [collabInitialTab, setCollabInitialTab] = useState<'comments' | 'attachments'>('comments');

  // CRUD Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: Role.TEAM_MEMBER,
    department: 'Backend Engineering',
    status: UserStatus.ACTIVE,
    avatarKey: 'engineer',
  });

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    startDate: '2026-10-01',
    endDate: '2026-12-15',
    status: ProjectStatus.ACTIVE,
    managerId: '',
  });

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    projectId: '',
    title: '',
    description: '',
    assigneeId: '',
    priority: TaskPriority.HIGH,
    status: TaskStatus.TODO,
    dueDate: '2026-10-30',
    progress: 0,
  });

  const [settingModalOpen, setSettingModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null);
  const [settingForm, setSettingForm] = useState({
    settingKey: '',
    settingValue: '',
    category: SettingCategory.SECURITY,
    description: '',
  });

  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    department: '',
    role: Role.ADMIN,
    newPassword: '',
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setBannerFeedback({ type, message });
    setTimeout(() => {
      setBannerFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setUserProfile(null);
        setManagedUsers([]);
        setProjects([]);
        setTasks([]);
        setComments([]);
        setAttachments([]);
        setActivities([]);
        setSettings([]);
        setDataLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    setDataLoading(true);
    const uid = firebaseUser.uid;

    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setUserProfile(data);
          setProfileForm({
            name: data.name || firebaseUser.displayName || 'Workspace User',
            email: data.email || firebaseUser.email || '',
            department: data.department || 'Engineering',
            role: data.role || Role.ADMIN,
            newPassword: '',
          });
        } else {
          ensureUserProfile(
            uid,
            firebaseUser.displayName || 'Administrator',
            firebaseUser.email || 'user@enterprise-pmt.io',
            null,
            signupPrefsRef.current
          ).catch((err) => console.error(err));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    const unsubUsers = onSnapshot(
      query(collection(db, 'managedUsers'), where('ownerId', '==', uid)),
      (snap) => {
        setManagedUsers(snap.docs.map((d) => d.data() as ManagedUser));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'managedUsers')
    );

    const unsubProjects = onSnapshot(
      query(collection(db, 'projects'), where('ownerId', '==', uid)),
      (snap) => {
        setProjects(snap.docs.map((d) => d.data() as Project));
        setDataLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
    );

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('ownerId', '==', uid)),
      (snap) => {
        setTasks(snap.docs.map((d) => d.data() as Task));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tasks')
    );

    const unsubComments = onSnapshot(
      query(collection(db, 'taskComments'), where('ownerId', '==', uid)),
      (snap) => {
        setComments(snap.docs.map((d) => d.data() as TaskComment));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'taskComments')
    );

    const unsubAttachments = onSnapshot(
      query(collection(db, 'taskAttachments'), where('ownerId', '==', uid)),
      (snap) => {
        setAttachments(snap.docs.map((d) => d.data() as TaskAttachment));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'taskAttachments')
    );

    const unsubActivities = onSnapshot(
      query(collection(db, 'activities'), where('ownerId', '==', uid)),
      (snap) => {
        setActivities(snap.docs.map((d) => d.data() as ActivityLog));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'activities')
    );

    const unsubSettings = onSnapshot(
      query(collection(db, 'systemSettings'), where('ownerId', '==', uid)),
      (snap) => {
        setSettings(snap.docs.map((d) => d.data() as SystemSetting));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'systemSettings')
    );

    return () => {
      unsubProfile();
      unsubUsers();
      unsubProjects();
      unsubTasks();
      unsubComments();
      unsubAttachments();
      unsubActivities();
      unsubSettings();
    };
  }, [authReady, firebaseUser]);

  const activeRole: Role = userProfile?.role || Role.ADMIN;
  const actorName = userProfile?.name || firebaseUser?.displayName || 'Workspace User';

  const activeCollabTask = useMemo(
    () => tasks.find((t) => t.id === collabTaskId) || null,
    [tasks, collabTaskId]
  );

  const handleSmartAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (authMode === 'signup' && cred.user) {
        // Apply selected role and department if user chose Smart Role Signup
        await switchActiveUserRole(cred.user.uid, signupPrefs.role).catch(() => {
          // Profile will be created by onSnapshot listener with signupPrefsRef
        });
      }
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleRoleSwitch = async (newRole: Role) => {
    if (!firebaseUser) return;
    try {
      await switchActiveUserRole(firebaseUser.uid, newRole);
      showNotification(
        'success',
        `Switched active RBAC role to ${formatStatusLabel(newRole)}.`
      );
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Failed to switch role.');
    }
  };

  const handleSeedSample = async () => {
    if (!firebaseUser) return;
    setSeedingBusy(true);
    try {
      await seedSampleWorkspace(firebaseUser.uid);
      showNotification(
        'success',
        'Loaded sample users, projects, Kanban tasks, comments, file attachments, and settings.'
      );
    } catch (error) {
      showNotification(
        'error',
        error instanceof Error ? error.message : 'Failed to load sample data.'
      );
    } finally {
      setSeedingBusy(false);
    }
  };

  const handleClearSample = async () => {
    if (!firebaseUser) return;
    setSeedingBusy(true);
    try {
      await clearWorkspaceData(firebaseUser.uid);
      showNotification('success', 'Cleared workspace records for a clean production slate.');
    } catch (error) {
      showNotification(
        'error',
        error instanceof Error ? error.message : 'Failed to clear workspace.'
      );
    } finally {
      setSeedingBusy(false);
    }
  };

  const metrics = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === ProjectStatus.ACTIVE).length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const avgProgress =
      totalTasks > 0
        ? Math.round(tasks.reduce((acc, t) => acc + (Number(t.progress) || 0), 0) / totalTasks)
        : 0;
    const unreadNotifications = activities.filter((a) => !a.readState).length;

    return {
      totalProjects,
      activeProjects,
      totalTasks,
      completedTasks,
      avgProgress,
      unreadNotifications,
    };
  }, [projects, tasks, activities]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesStatus = projectStatusFilter === 'ALL' || p.status === projectStatusFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.managerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [projects, projectStatusFilter, searchQuery]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesStatus = taskStatusFilter === 'ALL' || t.status === taskStatusFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigneeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.projectTitle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [tasks, taskStatusFilter, searchQuery]);

  const filteredUsers = useMemo(() => {
    return managedUsers.filter((u) => {
      const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [managedUsers, userRoleFilter, searchQuery]);

  const filteredActivities = useMemo(() => {
    return activities.filter(
      (a) => activityFilterType === 'ALL' || a.referenceType === activityFilterType
    );
  }, [activities, activityFilterType]);

  // Modal Open Helpers
  const openCreateUserModal = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      role: Role.TEAM_MEMBER,
      department: 'Backend Engineering',
      status: UserStatus.ACTIVE,
      avatarKey: 'engineer',
    });
    setUserModalOpen(true);
  };

  const openEditUserModal = (u: ManagedUser) => {
    setEditingUser(u);
    setUserForm({
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      status: u.status,
      avatarKey: u.avatarKey || 'engineer',
    });
    setUserModalOpen(true);
  };

  const openCreateProjectModal = () => {
    setEditingProject(null);
    const defaultMgr =
      managedUsers.find((u) => u.role === Role.PROJECT_MANAGER) || managedUsers[0];
    setProjectForm({
      title: '',
      description: '',
      startDate: '2026-10-10',
      endDate: '2026-12-20',
      status: ProjectStatus.ACTIVE,
      managerId: defaultMgr?.id || firebaseUser?.uid || 'mgr_default',
    });
    setProjectModalOpen(true);
  };

  const openEditProjectModal = (p: Project) => {
    setEditingProject(p);
    setProjectForm({
      title: p.title,
      description: p.description,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      managerId: p.managerId,
    });
    setProjectModalOpen(true);
  };

  const openCreateTaskModal = (prefill?: {
    projectId?: string;
    title?: string;
    description?: string;
  }) => {
    setEditingTask(null);
    const defaultProj = projects[0];
    const defaultAssignee =
      managedUsers.find((u) => u.role === Role.TEAM_MEMBER) || managedUsers[0];
    setTaskForm({
      projectId: prefill?.projectId || defaultProj?.id || '',
      title: prefill?.title || '',
      description: prefill?.description || '',
      assigneeId: defaultAssignee?.id || firebaseUser?.uid || 'usr_default',
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      dueDate: '2026-10-30',
      progress: 0,
    });
    setTaskModalOpen(true);
  };

  const openEditTaskModal = (t: Task) => {
    setEditingTask(t);
    setTaskForm({
      projectId: t.projectId,
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      progress: t.progress,
    });
    setTaskModalOpen(true);
  };

  const openCreateSettingModal = () => {
    setEditingSetting(null);
    setSettingForm({
      settingKey: 'jdbc.pool.connectionTimeoutMs',
      settingValue: '5000',
      category: SettingCategory.JDBC_POOL,
      description: 'Maximum milliseconds to wait for a connection from the DataSource pool.',
    });
    setSettingModalOpen(true);
  };

  const openEditSettingModal = (s: SystemSetting) => {
    setEditingSetting(s);
    setSettingForm({
      settingKey: s.settingKey,
      settingValue: s.settingValue,
      category: s.category,
      description: s.description,
    });
    setSettingModalOpen(true);
  };

  const handleOpenCollaboration = (task: Task, tab: 'comments' | 'attachments') => {
    setCollabTaskId(task.id);
    setCollabInitialTab(tab);
  };

  // Form Submit Handlers
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      await saveManagedUser(
        firebaseUser.uid,
        actorName,
        activeRole,
        {
          id: editingUser?.id,
          ...userForm,
        },
        Boolean(editingUser)
      );
      setUserModalOpen(false);
      showNotification(
        'success',
        editingUser
          ? `User account "${userForm.name}" updated and persisted.`
          : `User account "${userForm.name}" created with role ${userForm.role}.`
      );
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Failed to save user.');
    }
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const managerObj = managedUsers.find((u) => u.id === projectForm.managerId);
    const managerName = managerObj ? managerObj.name : actorName;
    try {
      await saveProject(
        firebaseUser.uid,
        actorName,
        activeRole,
        {
          id: editingProject?.id,
          ...projectForm,
          managerId: projectForm.managerId || firebaseUser.uid,
          managerName,
        },
        Boolean(editingProject)
      );
      setProjectModalOpen(false);
      showNotification(
        'success',
        editingProject
          ? `Project "${projectForm.title}" updated.`
          : `Project "${projectForm.title}" created.`
      );
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Failed to save project.');
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const projObj = projects.find((p) => p.id === taskForm.projectId);
    if (!projObj) {
      showNotification('error', 'Please create or select a valid parent project first.');
      return;
    }
    const assigneeObj = managedUsers.find((u) => u.id === taskForm.assigneeId);
    const assigneeName = assigneeObj ? assigneeObj.name : actorName;

    try {
      await saveTask(
        firebaseUser.uid,
        actorName,
        activeRole,
        {
          id: editingTask?.id,
          projectId: projObj.id,
          projectTitle: projObj.title,
          title: taskForm.title,
          description: taskForm.description,
          assigneeId: taskForm.assigneeId || firebaseUser.uid,
          assigneeName,
          priority: taskForm.priority,
          status: taskForm.status,
          dueDate: taskForm.dueDate,
          progress: Number(taskForm.progress),
        },
        Boolean(editingTask)
      );
      setTaskModalOpen(false);
      showNotification(
        'success',
        editingTask
          ? `Task "${taskForm.title}" updated.`
          : `Task "${taskForm.title}" assigned to ${assigneeName}.`
      );
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Failed to save task.');
    }
  };

  const handleSettingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      await saveSystemSetting(
        firebaseUser.uid,
        actorName,
        activeRole,
        {
          id: editingSetting?.id,
          ...settingForm,
        },
        Boolean(editingSetting)
      );
      setSettingModalOpen(false);
      showNotification('success', `System setting "${settingForm.settingKey}" saved.`);
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Failed to save setting.');
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      await updateUserProfileDetails(firebaseUser.uid, activeRole, profileForm);
      setProfileForm((prev) => ({ ...prev, newPassword: '' }));
      showNotification('success', 'Personal profile, role, and credential settings updated.');
    } catch (error) {
      showNotification('error', error instanceof Error ? error.message : 'Profile update failed.');
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">
          Initializing Project Management Tool...
        </div>
      </div>
    );
  }

  // ===========================================================================
  // SMART SIGNUP / LOGIN PORTAL (UNAUTHENTICATED)
  // ===========================================================================
  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
        {/* Strict 3-Zone Top Bar Contract */}
        <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-30">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
          >
            Project Management Tool
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#smart-auth" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Smart Signup & Login
            </a>
            <a href="#roles" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              RBAC Roles
            </a>
            <a href="#capabilities" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Kanban & Gantt
            </a>
            <a href="#architecture" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Java & JDBC Specs
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSmartAuthSubmit}
              disabled={authBusy}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {authBusy ? 'Authenticating...' : 'Continue with Google'}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-12">
          <section id="smart-auth" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: Architectural Editorial Hero & Interactive RBAC Role Selector */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
              {/* Technical Schematic Banner (Zero People/Characters) */}
              <div className="relative h-60 sm:h-68 bg-slate-900 overflow-hidden">
                <img
                  src={kanbanGanttBlueprint}
                  alt="Project Orchestration and Timeline Schematic"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-35"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-900/40 p-6 sm:p-8 flex flex-col justify-end">
                  <p className="text-xs font-medium text-blue-300">
                    Enterprise Project Governance · Kanban & Gantt · Real-Time Collaboration
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight mt-1.5">
                    Precision Project Orchestration, Kanban Execution & Live Analytics
                  </h1>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6 flex-1 flex flex-col justify-between">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Select a workspace role below to pre-configure your Role-Based Access Control (RBAC) permissions, or sign in directly to access interactive Kanban boards, Gantt timelines, task comments, file attachments, real-time notifications, and Java Servlet + JDBC specifications.
                </p>

                {/* Interactive Role Selection Cards */}
                <div id="roles" className="space-y-2.5">
                  <p className="text-xs font-semibold text-slate-700">
                    Click a Role to Pre-Select for Smart Signup:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {(
                      [
                        {
                          role: Role.ADMIN,
                          num: '01. Administrator',
                          desc: 'User account CRUD, role assignments, projects, and JDBC system settings.',
                        },
                        {
                          role: Role.PROJECT_MANAGER,
                          num: '02. Project Manager',
                          desc: 'Project timelines, Gantt scheduling, task assignments, and analytics.',
                        },
                        {
                          role: Role.TEAM_MEMBER,
                          num: '03. Team Member',
                          desc: 'Kanban execution, progress updates, task comments, and file attachments.',
                        },
                      ] as const
                    ).map((item) => {
                      const isSelected = signupPrefs.role === item.role;
                      return (
                        <button
                          key={item.role}
                          type="button"
                          onClick={() => {
                            setAuthMode('signup');
                            setSignupPrefs((prev) => ({ ...prev, role: item.role }));
                          }}
                          className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-[#F8FAFC] hover:bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          <p className={`font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {item.num}
                          </p>
                          <p
                            className={`mt-1 leading-relaxed ${
                              isSelected ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {item.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Smart Signup / Login Portal */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Smart Workspace Access
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Zero-Trust Firebase Auth & RBAC Onboarding
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        authMode === 'signup'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Smart Signup
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        authMode === 'login'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sign In
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSmartAuthSubmit} className="space-y-4 text-xs">
                  {authMode === 'signup' ? (
                    <>
                      <p className="text-slate-600 leading-relaxed">
                        Configure your initial Role-Based Access Control (RBAC) profile and engineering unit before authenticating with Google.
                      </p>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Display Name (Optional override)
                        </label>
                        <input
                          type="text"
                          value={signupPrefs.customName}
                          onChange={(e) =>
                            setSignupPrefs({ ...signupPrefs, customName: e.target.value })
                          }
                          placeholder="Uses Google profile name if blank"
                          className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFC] focus:bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Selected Workspace Role
                        </label>
                        <select
                          value={signupPrefs.role}
                          onChange={(e) =>
                            setSignupPrefs({ ...signupPrefs, role: e.target.value as Role })
                          }
                          className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFC] focus:bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          <option value={Role.ADMIN}>ADMIN — Full System & User Governance</option>
                          <option value={Role.PROJECT_MANAGER}>
                            PROJECT_MANAGER — Projects, Gantt & Task Assignments
                          </option>
                          <option value={Role.TEAM_MEMBER}>
                            TEAM_MEMBER — Assigned Tasks, Kanban & Collaboration
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Department / Engineering Unit
                        </label>
                        <input
                          type="text"
                          value={signupPrefs.department}
                          onChange={(e) =>
                            setSignupPrefs({ ...signupPrefs, department: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFC] focus:bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div className="p-4 bg-[#F8FAFC] border border-slate-200 rounded-lg space-y-2.5">
                      <p className="font-semibold text-slate-900">
                        Returning Workspace Member
                      </p>
                      <p className="text-slate-600 leading-relaxed">
                        Sign in with your verified Google account to resume your existing workspace session, role permissions, projects, Kanban tasks, and real-time notifications.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authBusy}
                    className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-md transition-colors cursor-pointer"
                  >
                    {authBusy
                      ? 'Authenticating with Google...'
                      : authMode === 'signup'
                      ? `Complete Smart Signup as ${formatStatusLabel(signupPrefs.role)}`
                      : 'Sign In with Google'}
                  </button>
                </form>
              </div>

              {/* Blueprint Thumbnail Preview Card */}
              <div className="pt-4 border-t border-slate-200 flex items-center gap-3.5">
                <img
                  src={kanbanGanttBlueprint}
                  alt="Timeline orchestration blueprint"
                  referrerPolicy="no-referrer"
                  className="w-16 h-12 rounded object-cover border border-slate-200 shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Includes interactive Kanban boards, Gantt schedule charts, CSV report exports, and full Java Servlet + JDBC specifications.
                </p>
              </div>
            </div>
          </section>

          {/* Full-Width 4-Column Core Functional Modules Strip */}
          <section id="capabilities" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
              <p className="text-xs font-mono font-semibold text-[#2563EB]">MODULE 01</p>
              <h3 className="text-sm font-bold text-slate-900">Smart Auth & RBAC Control</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Role-aware onboarding, instant role switching (Admin, Project Manager, Team Member), and credential rotation.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
              <p className="text-xs font-mono font-semibold text-[#2563EB]">MODULE 02</p>
              <h3 className="text-sm font-bold text-slate-900">Kanban, Gantt & Attachments</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Drag-and-drop Kanban stage columns, interactive Gantt milestone bars, and in-app file attachment previews.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
              <p className="text-xs font-mono font-semibold text-[#2563EB]">MODULE 03</p>
              <h3 className="text-sm font-bold text-slate-900">Comments & Live Notifications</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Threaded task discussions, instant unread notification stream, and filterable workspace audit logs.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
              <p className="text-xs font-mono font-semibold text-[#2563EB]">MODULE 04</p>
              <h3 className="text-sm font-bold text-slate-900">Visual Analytics & CSV Reports</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Lifecycle donut charts, priority risk distribution, team velocity tables, and one-click CSV report export.
              </p>
            </div>
          </section>

          <section id="architecture">
            <JavaArchitectureView />
          </section>
        </main>
      </div>
    );
  }

  // ===========================================================================
  // AUTHENTICATED WORKSPACE SHELL
  // ===========================================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('dashboard');
          }}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
        >
          Project Management Tool
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveNav('dashboard')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNav === 'dashboard'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Role Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('tracking')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNav === 'tracking'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Kanban & Gantt
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('analytics')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNav === 'analytics'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Analytics & Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('grounding')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNav === 'grounding'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Search Grounding
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('profile')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeNav === 'profile'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Profile & Activity ({metrics.unreadNotifications})
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSignOut}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Workspace Context, RBAC Switcher, Notifications & Sample Data Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-bold text-slate-900">{actorName}</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>{userProfile?.department || 'Engineering'}</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="font-semibold text-slate-900">
              RBAC Role: {formatStatusLabel(activeRole)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Interactive Role Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => handleRoleSwitch(Role.ADMIN)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeRole === Role.ADMIN
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwitch(Role.PROJECT_MANAGER)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeRole === Role.PROJECT_MANAGER
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Project Manager
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwitch(Role.TEAM_MEMBER)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeRole === Role.TEAM_MEMBER
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Team Member
              </button>
            </div>

            {/* Real-Time Notifications Drawer Toggle */}
            <button
              type="button"
              onClick={() => setNotifDrawerOpen((prev) => !prev)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Bell className="w-3.5 h-3.5 text-slate-600" />
              <span className="font-mono tabular-nums">
                Notifications ({metrics.unreadNotifications})
              </span>
            </button>

            {/* Java & SQL Specs Toggle */}
            <button
              type="button"
              onClick={() => setShowJavaSpecsDrawer((prev) => !prev)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              {showJavaSpecsDrawer ? 'Hide Java/SQL Specs' : 'Java & JDBC Specs'}
            </button>

            {/* Sample Data Controls */}
            <button
              type="button"
              onClick={handleSeedSample}
              disabled={seedingBusy}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{seedingBusy ? 'Working...' : 'Load Sample Data'}</span>
            </button>

            {(projects.length > 0 || managedUsers.length > 0) && (
              <button
                type="button"
                onClick={handleClearSample}
                disabled={seedingBusy}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Clear Workspace
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Real-Time Notifications Panel */}
      {notifDrawerOpen && (
        <div className="bg-slate-900 text-slate-100 border-b border-slate-800 px-6 py-4">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Real-Time Notification Stream ({metrics.unreadNotifications} Unread)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {metrics.unreadNotifications > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      markAllActivitiesRead(activities).then(() =>
                        showNotification('success', 'Marked all notifications as read.')
                      )
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                  >
                    Mark All Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifDrawerOpen(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                No notifications yet. Move a task on the Kanban board, post a comment, or attach a file.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto">
                {activities.slice(0, 9).map((act) => (
                  <div
                    key={act.id}
                    className={`p-3 rounded border text-xs flex items-start justify-between gap-2 ${
                      act.readState
                        ? 'bg-slate-800/50 border-slate-800 text-slate-400'
                        : 'bg-slate-800 border-slate-700 text-white'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <p className={act.readState ? 'font-normal' : 'font-semibold'}>
                        {act.message}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {act.actorName} · {act.referenceType}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => markActivityRead(act.id, !act.readState)}
                      className="text-[11px] text-slate-300 hover:text-white underline shrink-0"
                    >
                      {act.readState ? 'Unread' : 'Read'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Java & SQL Specs Panel */}
      {showJavaSpecsDrawer && (
        <div className="bg-white border-b border-slate-200 px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <JavaArchitectureView />
          </div>
        </div>
      )}

      {/* Mobile Navigation Bar */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto px-6 py-2 bg-slate-100 border-b border-slate-200 text-xs">
        {(
          [
            ['dashboard', 'Role Dashboard'],
            ['tracking', 'Kanban & Gantt'],
            ['analytics', 'Analytics'],
            ['grounding', 'Search Grounding'],
            ['profile', 'Profile & Activity'],
          ] as [NavTab, string][]
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveNav(tabKey)}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap shrink-0 ${
              activeNav === tabKey ? 'bg-slate-900 text-white' : 'text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Server Confirmation & Validation Feedback Banner */}
      {bannerFeedback && (
        <div className="max-w-7xl w-full mx-auto px-6 pt-4">
          <div
            className={`px-4 py-3 rounded-md border flex items-center justify-between gap-3 text-xs ${
              bannerFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {bannerFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
              )}
              <span className="font-medium">{bannerFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerFeedback(null)}
              className="text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-10">
        {dataLoading ? (
          <div className="space-y-4">
            <div className="h-24 bg-white border border-slate-200 rounded-lg p-6 animate-pulse" />
            <div className="h-64 bg-white border border-slate-200 rounded-lg p-6 animate-pulse" />
          </div>
        ) : activeNav === 'grounding' ? (
          <SearchGroundingView
            projects={projects}
            onCreateTaskFromResearch={(projectId, suggestedTitle, suggestedDescription) => {
              if (activeRole === Role.TEAM_MEMBER) {
                showNotification(
                  'error',
                  'Switch to Project Manager or Admin role to assign new tasks from research.'
                );
                return;
              }
              openCreateTaskModal({
                projectId,
                title: suggestedTitle,
                description: suggestedDescription,
              });
            }}
          />
        ) : activeNav === 'analytics' ? (
          <div className="space-y-8">
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Executive Reporting · Real-Time Firestore Aggregation
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                  Visual Analytics & Delivery Performance Dashboard
                </h2>
              </div>
            </div>
            <AnalyticsDashboardView
              projects={projects}
              tasks={tasks}
              managedUsers={managedUsers}
              comments={comments}
              attachments={attachments}
            />
          </div>
        ) : activeNav === 'tracking' ? (
          /* Dedicated Kanban Board, Gantt Chart & Task Tracking View */
          <div className="space-y-8">
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Task & Project Tracking · Kanban Board · Gantt Schedule · File Attachments
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                  Interactive Execution Boards & Timeline Scheduler
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTrackingSubView('kanban')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      trackingSubView === 'kanban'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kanban Board
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackingSubView('gantt')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      trackingSubView === 'gantt'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Gantt Chart
                  </button>
                </div>

                {activeRole !== Role.TEAM_MEMBER && (
                  <button
                    type="button"
                    onClick={() => openCreateTaskModal()}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Task</span>
                  </button>
                )}
              </div>
            </div>

            {trackingSubView === 'kanban' ? (
              <KanbanBoardView
                tasks={filteredTasks}
                comments={comments}
                attachments={attachments}
                activeRole={activeRole}
                onMoveTaskStatus={(task, newStatus, newProgress) => {
                  updateTaskProgressAndStatus(
                    firebaseUser.uid,
                    actorName,
                    activeRole,
                    task,
                    newStatus,
                    newProgress
                  ).then(() =>
                    showNotification(
                      'success',
                      `Moved "${task.title}" to ${formatStatusLabel(newStatus)} (${newProgress}%).`
                    )
                  );
                }}
                onOpenCollaboration={handleOpenCollaboration}
                onEditTask={openEditTaskModal}
                onDeleteTask={(task) =>
                  removeTask(firebaseUser.uid, actorName, activeRole, task).then(() =>
                    showNotification('success', `Removed task "${task.title}".`)
                  )
                }
              />
            ) : (
              <GanttChartView
                projects={filteredProjects}
                tasks={filteredTasks}
                comments={comments}
                attachments={attachments}
                onShiftTaskDueDate={(task, deltaDays) => {
                  const nextDate = shiftIsoDate(task.dueDate, deltaDays);
                  updateTaskScheduleAndProgress(
                    firebaseUser.uid,
                    actorName,
                    activeRole,
                    task,
                    nextDate,
                    task.status,
                    task.progress
                  ).then(() =>
                    showNotification(
                      'success',
                      `Rescheduled "${task.title}" due date to ${nextDate}.`
                    )
                  );
                }}
                onOpenCollaboration={handleOpenCollaboration}
              />
            )}
          </div>
        ) : activeNav === 'profile' ? (
          /* Profile Management, Real-Time Notifications & Activity Audit Log */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Account Security · Role & Credential Management
                </p>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  Personal Profile & RBAC Settings
                </h2>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Active RBAC Role
                    </label>
                    <select
                      value={profileForm.role}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, role: e.target.value as Role })
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                    >
                      <option value={Role.ADMIN}>ADMIN</option>
                      <option value={Role.PROJECT_MANAGER}>PROJECT_MANAGER</option>
                      <option value={Role.TEAM_MEMBER}>TEAM_MEMBER</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={profileForm.department}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, department: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      required
                      minLength={2}
                      maxLength={60}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rotate Password (Optional, min 8 chars)
                  </label>
                  <input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, newPassword: e.target.value })
                    }
                    placeholder="Leave blank to keep existing hash"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    minLength={8}
                  />
                </div>
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 font-mono">
                  Active Credential Hash: {userProfile?.passwordHashPreview || 'pbkdf2_sha256$310000'}
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                >
                  Save Profile & Role Changes
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Real-Time Event Stream · Collaboration & Audit Log
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">
                    Activity Log & Notifications ({metrics.unreadNotifications} Unread)
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={activityFilterType}
                    onChange={(e) => setActivityFilterType(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    <option value="ALL">All Event Types</option>
                    <option value="TASK">Tasks</option>
                    <option value="COMMENT">Comments</option>
                    <option value="ATTACHMENT">File Attachments</option>
                    <option value="PROJECT">Projects</option>
                    <option value="USER">Users</option>
                    <option value="SETTING">Settings</option>
                  </select>

                  {metrics.unreadNotifications > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        markAllActivitiesRead(activities).then(() =>
                          showNotification('success', 'All notifications marked as read.')
                        )
                      }
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                    >
                      Mark All Read
                    </button>
                  )}
                </div>
              </div>

              {filteredActivities.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-md space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    No activity logs match the filter
                  </p>
                  <p className="text-xs text-slate-500">
                    Create or update a project, task, comment, or attachment to generate audit events.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 max-h-[520px] overflow-y-auto">
                  {filteredActivities.map((act) => (
                    <div
                      key={act.id}
                      className="py-3.5 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p
                          className={`text-xs ${
                            act.readState ? 'text-slate-600' : 'text-slate-900 font-semibold'
                          }`}
                        >
                          {act.message}
                        </p>
                        <p className="text-xs text-slate-500">
                          <span>{act.actorName}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{formatStatusLabel(act.actorRole)}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-mono">{act.referenceType}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => markActivityRead(act.id, !act.readState)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
                      >
                        {act.readState ? 'Mark Unread' : 'Mark Read'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ===================================================================
             MAIN ROLE DASHBOARD (ADMIN / PROJECT MANAGER / TEAM MEMBER)
             =================================================================== */
          <div className="space-y-8">
            {/* Executive Workspace Command Banner (Pure Typographic & Schematic, Zero Characters) */}
            <section className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <p className="text-xs font-medium text-blue-300">
                    {activeRole === Role.ADMIN
                      ? 'Administrator Command Center · User CRUD, Projects & System Settings'
                      : activeRole === Role.PROJECT_MANAGER
                      ? 'Project Manager Workspace · Timelines, Gantt Scheduling & Task Assignments'
                      : 'Team Member Execution Workspace · Assigned Kanban Tasks & Collaboration'}
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Welcome back, {actorName}
                  </h1>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {projects.length === 0 && managedUsers.length === 0
                      ? 'Your workspace is currently empty. Seed realistic sample data or create your first project to begin.'
                      : `Monitoring ${metrics.activeProjects} active projects and ${metrics.totalTasks} tasks (${metrics.avgProgress}% average completion).`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {projects.length === 0 && managedUsers.length === 0 ? (
                    <button
                      type="button"
                      onClick={handleSeedSample}
                      disabled={seedingBusy}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${seedingBusy ? 'animate-spin' : ''}`} />
                      <span>{seedingBusy ? 'Seeding Workspace...' : 'Seed Sample Workspace'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveNav('tracking')}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Open Kanban & Gantt
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNav('analytics')}
                        className="px-3.5 py-2 text-xs font-medium text-slate-100 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Analytics & CSV Report
                      </button>
                    </>
                  )}
                </div>
            </section>

            {/* Interactive Quantitative KPI Strip with Embedded Progress Bars */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setTrackingSubView('gantt')}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 space-y-3 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Active / Total Projects</span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {metrics.totalProjects > 0
                      ? Math.round((metrics.activeProjects / metrics.totalProjects) * 100)
                      : 0}
                    % Active
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {metrics.activeProjects} / {metrics.totalProjects}
                </p>
                <div className="w-full h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-slate-900 origin-left transition-transform duration-150"
                    style={{
                      transform: `scaleX(${
                        metrics.totalProjects > 0
                          ? Math.max(0.05, metrics.activeProjects / metrics.totalProjects)
                          : 0.05
                      })`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Managed across {managedUsers.length} workspace accounts
                </p>
              </div>

              <div
                onClick={() => setTrackingSubView('kanban')}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 space-y-3 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Task Completion Velocity</span>
                  <span className="font-mono tabular-nums text-[#16A34A] font-semibold">
                    {metrics.completedTasks} DONE
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {metrics.avgProgress}%
                </p>
                <div className="w-full h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-[#16A34A] origin-left transition-transform duration-150"
                    style={{
                      transform: `scaleX(${Math.max(0.04, metrics.avgProgress / 100)})`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {metrics.completedTasks} of {metrics.totalTasks} tasks completed
                </p>
              </div>

              <div
                onClick={() => {
                  if (tasks[0]) handleOpenCollaboration(tasks[0], 'comments');
                }}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 space-y-3 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Comments & Attachments</span>
                  <span className="font-mono tabular-nums text-[#2563EB] font-semibold">
                    Live Sync
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {comments.length} · {attachments.length}
                </p>
                <div className="w-full h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB] origin-left transition-transform duration-150"
                    style={{
                      transform: `scaleX(${Math.min(
                        1,
                        Math.max(0.08, (comments.length + attachments.length) / 10)
                      )})`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {comments.length} comments · {attachments.length} attached files
                </p>
              </div>

              <div
                onClick={() => setNotifDrawerOpen(true)}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 space-y-3 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Audit Log & Notifications</span>
                  <span className="font-mono tabular-nums text-[#D97706] font-semibold">
                    {metrics.unreadNotifications} Unread
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {activities.length}
                </p>
                <div className="w-full h-1.5 bg-slate-100 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-[#D97706] origin-left transition-transform duration-150"
                    style={{
                      transform: `scaleX(${
                        activities.length > 0
                          ? Math.max(0.08, metrics.unreadNotifications / activities.length)
                          : 0.08
                      })`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  Click to open real-time notification stream
                </p>
              </div>
            </section>

            {/* Shared Search, View Switcher & Quick Action Bar */}
            <section className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users, projects, tasks, or assignees..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Segmented Board/Gantt/Table View Switcher */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTrackingSubView('kanban')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      trackingSubView === 'kanban'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kanban Board
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackingSubView('gantt')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      trackingSubView === 'gantt'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Gantt Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackingSubView('table')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      trackingSubView === 'table'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Table View
                  </button>
                </div>

                {activeRole === Role.ADMIN && (
                  <button
                    type="button"
                    onClick={openCreateUserModal}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New User</span>
                  </button>
                )}

                {activeRole !== Role.TEAM_MEMBER && (
                  <>
                    <button
                      type="button"
                      onClick={openCreateProjectModal}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Project</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateTaskModal()}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Assign Task</span>
                    </button>
                  </>
                )}

                {activeRole === Role.ADMIN && (
                  <button
                    type="button"
                    onClick={openCreateSettingModal}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Setting</span>
                  </button>
                )}
              </div>
            </section>

            {/* =================================================================
                2. TASK & PROJECT TRACKING (KANBAN / GANTT / TABLE SWITCHABLE)
               ================================================================= */}
            {trackingSubView === 'kanban' ? (
              <KanbanBoardView
                tasks={filteredTasks}
                comments={comments}
                attachments={attachments}
                activeRole={activeRole}
                onMoveTaskStatus={(task, newStatus, newProgress) => {
                  updateTaskProgressAndStatus(
                    firebaseUser.uid,
                    actorName,
                    activeRole,
                    task,
                    newStatus,
                    newProgress
                  ).then(() =>
                    showNotification(
                      'success',
                      `Moved "${task.title}" to ${formatStatusLabel(newStatus)} (${newProgress}%).`
                    )
                  );
                }}
                onOpenCollaboration={handleOpenCollaboration}
                onEditTask={openEditTaskModal}
                onDeleteTask={(task) =>
                  removeTask(firebaseUser.uid, actorName, activeRole, task).then(() =>
                    showNotification('success', `Removed task "${task.title}".`)
                  )
                }
              />
            ) : trackingSubView === 'gantt' ? (
              <GanttChartView
                projects={filteredProjects}
                tasks={filteredTasks}
                comments={comments}
                attachments={attachments}
                onShiftTaskDueDate={(task, deltaDays) => {
                  const nextDate = shiftIsoDate(task.dueDate, deltaDays);
                  updateTaskScheduleAndProgress(
                    firebaseUser.uid,
                    actorName,
                    activeRole,
                    task,
                    nextDate,
                    task.status,
                    task.progress
                  ).then(() =>
                    showNotification(
                      'success',
                      `Rescheduled "${task.title}" due date to ${nextDate}.`
                    )
                  );
                }}
                onOpenCollaboration={handleOpenCollaboration}
              />
            ) : (
              /* Task Table View with Comments & File Attachment Buttons */
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Task Assignments, Comments & File Attachments
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Update task status, adjust completion sliders, or open task comments and file attachments.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                    {(
                      [
                        'ALL',
                        TaskStatus.TODO,
                        TaskStatus.IN_PROGRESS,
                        TaskStatus.IN_REVIEW,
                        TaskStatus.DONE,
                      ] as const
                    ).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setTaskStatusFilter(st)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          taskStatusFilter === st
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st === 'ALL' ? 'All' : formatStatusLabel(st)}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No tasks match the current filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Task & Parent Project</th>
                          <th className="py-3 px-4">Assignee</th>
                          <th className="py-3 px-4">Priority · Due</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Progress</th>
                          <th className="py-3 px-4">Collaboration</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {filteredTasks.map((t) => {
                          const cmtCount = comments.filter((c) => c.taskId === t.id).length;
                          const attCount = attachments.filter((a) => a.taskId === t.id).length;

                          return (
                            <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3.5 px-4 max-w-md">
                                <p className="font-semibold text-slate-900">{t.title}</p>
                                <p className="text-slate-500 mt-0.5">
                                  <span>{t.projectTitle}</span>
                                  <span className="mx-1.5" aria-hidden="true">·</span>
                                  <span>{t.description}</span>
                                </p>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-slate-800 font-medium">
                                {t.assigneeName}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={getPriorityTextClass(t.priority)}>
                                  {t.priority}
                                </span>
                                <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums text-slate-600">
                                  {t.dueDate}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <select
                                  aria-label={`Status for ${t.title}`}
                                  value={t.status}
                                  onChange={(e) => {
                                    const nextStatus = e.target.value as TaskStatus;
                                    const nextProg =
                                      nextStatus === TaskStatus.DONE ? 100 : t.progress;
                                    updateTaskProgressAndStatus(
                                      firebaseUser.uid,
                                      actorName,
                                      activeRole,
                                      t,
                                      nextStatus,
                                      nextProg
                                    ).then(() =>
                                      showNotification(
                                        'success',
                                        `Task "${t.title}" status updated to ${nextStatus}.`
                                      )
                                    );
                                  }}
                                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded font-medium text-slate-900"
                                >
                                  <option value={TaskStatus.TODO}>TODO</option>
                                  <option value={TaskStatus.IN_PROGRESS}>IN PROGRESS</option>
                                  <option value={TaskStatus.IN_REVIEW}>IN REVIEW</option>
                                  <option value={TaskStatus.DONE}>DONE</option>
                                </select>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    aria-label={`Progress for ${t.title}`}
                                    value={t.progress}
                                    onChange={(e) => {
                                      const nextProg = Number(e.target.value);
                                      const nextStatus =
                                        nextProg === 100
                                          ? TaskStatus.DONE
                                          : nextProg > 0 && t.status === TaskStatus.TODO
                                          ? TaskStatus.IN_PROGRESS
                                          : t.status;
                                      updateTaskProgressAndStatus(
                                        firebaseUser.uid,
                                        actorName,
                                        activeRole,
                                        t,
                                        nextStatus,
                                        nextProg
                                      );
                                    }}
                                    className="w-20 accent-slate-900 cursor-pointer"
                                  />
                                  <span className="font-mono tabular-nums font-semibold text-slate-800 w-9 text-right">
                                    {t.progress}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCollaboration(t, 'comments')}
                                    className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span className="font-mono tabular-nums">{cmtCount}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCollaboration(t, 'attachments')}
                                    className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    <span className="font-mono tabular-nums">{attCount}</span>
                                  </button>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                {activeRole !== Role.TEAM_MEMBER ? (
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openEditTaskModal(t)}
                                      className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                      title="Edit Task"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeTask(
                                          firebaseUser.uid,
                                          actorName,
                                          activeRole,
                                          t
                                        ).then(() =>
                                          showNotification(
                                            'success',
                                            `Removed task "${t.title}".`
                                          )
                                        )
                                      }
                                      className="p-1.5 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                      title="Delete Task"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateTaskProgressAndStatus(
                                        firebaseUser.uid,
                                        actorName,
                                        activeRole,
                                        t,
                                        TaskStatus.DONE,
                                        100
                                      ).then(() =>
                                        showNotification(
                                          'success',
                                          `Marked "${t.title}" as 100% DONE.`
                                        )
                                      )
                                    }
                                    className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                  >
                                    Complete
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* =================================================================
                4. VISUAL REPORTING & ANALYTICS DASHBOARD
               ================================================================= */}
            <AnalyticsDashboardView
              projects={projects}
              tasks={tasks}
              managedUsers={managedUsers}
              comments={comments}
              attachments={attachments}
            />

            {/* =================================================================
                PROJECTS OVERVIEW & TIMELINE TABLE
               ================================================================= */}
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Projects & Delivery Timelines
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeRole === Role.TEAM_MEMBER
                      ? 'View project scope, start/end timelines, and assigned project managers.'
                      : 'Create, edit, and monitor project schedules and lifecycle statuses.'}
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                  {(
                    [
                      'ALL',
                      ProjectStatus.PLANNING,
                      ProjectStatus.ACTIVE,
                      ProjectStatus.ON_HOLD,
                      ProjectStatus.COMPLETED,
                    ] as const
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setProjectStatusFilter(st)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                        projectStatusFilter === st
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st === 'ALL' ? 'All' : formatStatusLabel(st)}
                    </button>
                  ))}
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No projects match the current filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Project Title & Scope</th>
                        <th className="py-3 px-4">Project Manager</th>
                        <th className="py-3 px-4">Timeline</th>
                        <th className="py-3 px-4">Status</th>
                        {activeRole !== Role.TEAM_MEMBER && (
                          <th className="py-3 px-4 text-right">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredProjects.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4 max-w-md">
                            <p className="font-semibold text-slate-900">{p.title}</p>
                            <p className="text-slate-500 mt-0.5 line-clamp-2">{p.description}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                            {p.managerName}
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {p.startDate} → {p.endDate}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={getStatusTextClass(p.status)}>
                              {formatStatusLabel(p.status)}
                            </span>
                          </td>
                          {activeRole !== Role.TEAM_MEMBER && (
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditProjectModal(p)}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeProject(
                                      firebaseUser.uid,
                                      actorName,
                                      activeRole,
                                      p
                                    ).then(() =>
                                      showNotification('success', `Removed project "${p.title}".`)
                                    )
                                  }
                                  className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* =================================================================
                1. ADMIN USER ACCOUNTS & SYSTEM CONFIGURATION SECTIONS
               ================================================================= */}
            {activeRole === Role.ADMIN && (
              <div className="space-y-10">
                <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        User Accounts & Role Entitlements (RBAC)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Create, edit, assign roles (ADMIN · PROJECT_MANAGER · TEAM_MEMBER), and remove user accounts.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                      {(['ALL', Role.ADMIN, Role.PROJECT_MANAGER, Role.TEAM_MEMBER] as const).map(
                        (r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setUserRoleFilter(r)}
                            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                              userRoleFilter === r
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {r === 'ALL' ? 'All Roles' : formatStatusLabel(r)}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No user accounts match the current filter. Click "New User" or "Load Sample Data".
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <th className="py-3 px-4">User</th>
                            <th className="py-3 px-4">Department</th>
                            <th className="py-3 px-4">Assigned Role</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs">
                          {filteredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4">
                                <div>
                                  <p className="font-semibold text-slate-900">{u.name}</p>
                                  <p className="text-slate-500 font-mono">{u.email}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-700">{u.department}</td>
                              <td className="py-3 px-4 font-medium text-slate-900">
                                {formatStatusLabel(u.role)}
                              </td>
                              <td className="py-3 px-4">
                                <span className={getStatusTextClass(u.status)}>
                                  {formatStatusLabel(u.status)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditUserModal(u)}
                                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeManagedUser(
                                        firebaseUser.uid,
                                        actorName,
                                        activeRole,
                                        u
                                      ).then(() =>
                                        showNotification('success', `Deleted user ${u.name}.`)
                                      )
                                    }
                                    className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        System-Wide Settings & Configuration
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure JDBC connection pool limits, Servlet session timeouts, and workflow notification rules.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateSettingModal}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      Add Configuration Key
                    </button>
                  </div>

                  {settings.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No system settings configured yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <th className="py-3 px-4">Configuration Key</th>
                            <th className="py-3 px-4">Value</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Description</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs">
                          {settings.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                                {s.settingKey}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums text-blue-700 font-semibold">
                                {s.settingValue}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {formatStatusLabel(s.category)}
                              </td>
                              <td className="py-3 px-4 text-slate-600">{s.description}</td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => openEditSettingModal(s)}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                >
                                  Modify
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =====================================================================
          TASK COLLABORATION MODAL (COMMENTS & FILE ATTACHMENTS)
         ===================================================================== */}
      {activeCollabTask && (
        <TaskCollaborationModal
          task={activeCollabTask}
          initialTab={collabInitialTab}
          comments={comments}
          attachments={attachments}
          actorName={actorName}
          actorRole={activeRole}
          onClose={() => setCollabTaskId(null)}
          onAddComment={async (task, content) => {
            await addTaskComment(firebaseUser.uid, actorName, activeRole, task, content);
            showNotification('success', `Comment posted on "${task.title}".`);
          }}
          onDeleteComment={async (cmt) => {
            await removeTaskComment(firebaseUser.uid, actorName, activeRole, cmt);
            showNotification('success', 'Comment removed.');
          }}
          onAddAttachment={async (task, fileInput) => {
            await addTaskAttachment(firebaseUser.uid, actorName, activeRole, task, fileInput);
            showNotification('success', `Attached "${fileInput.fileName}" to "${task.title}".`);
          }}
          onDeleteAttachment={async (att) => {
            await removeTaskAttachment(firebaseUser.uid, actorName, activeRole, att);
            showNotification('success', `Removed attachment "${att.fileName}".`);
          }}
        />
      )}

      {/* =====================================================================
          MODAL 1: CREATE / EDIT USER ACCOUNT (ADMIN)
         ===================================================================== */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? 'Edit User Account' : 'Create User Account'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Corporate Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value={Role.ADMIN}>ADMIN</option>
                    <option value={Role.PROJECT_MANAGER}>PROJECT_MANAGER</option>
                    <option value={Role.TEAM_MEMBER}>TEAM_MEMBER</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={userForm.status}
                    onChange={(e) =>
                      setUserForm({ ...userForm, status: e.target.value as UserStatus })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value={UserStatus.ACTIVE}>ACTIVE</option>
                    <option value={UserStatus.SUSPENDED}>SUSPENDED</option>
                    <option value={UserStatus.ARCHIVED}>ARCHIVED</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={userForm.department}
                  onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CREATE / EDIT PROJECT
         ===================================================================== */}
      {projectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingProject ? 'Edit Project' : 'Create Project'}
              </h3>
              <button
                type="button"
                onClick={() => setProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProjectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project Title</label>
                <input
                  type="text"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                  minLength={3}
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Scope & Description
                </label>
                <textarea
                  rows={3}
                  value={projectForm.description}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                  minLength={5}
                  maxLength={1000}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={projectForm.startDate}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target End Date</label>
                  <input
                    type="date"
                    value={projectForm.endDate}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={projectForm.status}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        status: e.target.value as ProjectStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value={ProjectStatus.PLANNING}>PLANNING</option>
                    <option value={ProjectStatus.ACTIVE}>ACTIVE</option>
                    <option value={ProjectStatus.ON_HOLD}>ON_HOLD</option>
                    <option value={ProjectStatus.COMPLETED}>COMPLETED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Project Manager
                  </label>
                  <select
                    value={projectForm.managerId}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, managerId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value={firebaseUser.uid}>{actorName} (You)</option>
                    {managedUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({formatStatusLabel(u.role)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: CREATE / EDIT TASK
         ===================================================================== */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingTask ? 'Edit Task Assignment' : 'Assign New Task'}
              </h3>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTaskSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parent Project</label>
                <select
                  value={taskForm.projectId}
                  onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
                  disabled={Boolean(editingTask)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white disabled:bg-slate-100"
                  required
                >
                  <option value="">Select Project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Title</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                  minLength={3}
                  maxLength={140}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Acceptance Criteria & Instructions
                </label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                  minLength={5}
                  maxLength={1000}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assignee</label>
                  <select
                    value={taskForm.assigneeId}
                    onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value={firebaseUser.uid}>{actorName} (You)</option>
                    {managedUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({formatStatusLabel(u.role)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value={TaskPriority.LOW}>LOW</option>
                    <option value={TaskPriority.MEDIUM}>MEDIUM</option>
                    <option value={TaskPriority.HIGH}>HIGH</option>
                    <option value={TaskPriority.CRITICAL}>CRITICAL</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, status: e.target.value as TaskStatus })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                  >
                    <option value={TaskStatus.TODO}>TODO</option>
                    <option value={TaskStatus.IN_PROGRESS}>IN_PROGRESS</option>
                    <option value={TaskStatus.IN_REVIEW}>IN_REVIEW</option>
                    <option value={TaskStatus.DONE}>DONE</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Progress (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={taskForm.progress}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, progress: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: CREATE / EDIT SYSTEM SETTING (ADMIN)
         ===================================================================== */}
      {settingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingSetting ? 'Modify System Setting' : 'Add System Setting'}
              </h3>
              <button
                type="button"
                onClick={() => setSettingModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSettingSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Setting Key</label>
                <input
                  type="text"
                  value={settingForm.settingKey}
                  onChange={(e) =>
                    setSettingForm({ ...settingForm, settingKey: e.target.value })
                  }
                  disabled={Boolean(editingSetting)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono disabled:bg-slate-100"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Setting Value</label>
                <input
                  type="text"
                  value={settingForm.settingValue}
                  onChange={(e) =>
                    setSettingForm({ ...settingForm, settingValue: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={settingForm.category}
                  onChange={(e) =>
                    setSettingForm({
                      ...settingForm,
                      category: e.target.value as SettingCategory,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value={SettingCategory.SECURITY}>SECURITY</option>
                  <option value={SettingCategory.JDBC_POOL}>JDBC_POOL</option>
                  <option value={SettingCategory.WORKFLOW}>WORKFLOW</option>
                  <option value={SettingCategory.NOTIFICATIONS}>NOTIFICATIONS</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={settingForm.description}
                  onChange={(e) =>
                    setSettingForm({ ...settingForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSettingModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Save Setting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Project Management Tool · Kanban, Gantt, Collaboration & RBAC Workspace</span>
          <span>
            Backed by Cloud Firestore, Google Search Grounding & Java Servlet + JDBC Specification
          </span>
        </div>
      </footer>
    </div>
  );
}
