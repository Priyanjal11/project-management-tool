export enum Role {
  ADMIN = 'ADMIN',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  TEAM_MEMBER = 'TEAM_MEMBER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  ARCHIVED = 'ARCHIVED',
}

export enum SettingCategory {
  SECURITY = 'SECURITY',
  JDBC_POOL = 'JDBC_POOL',
  WORKFLOW = 'WORKFLOW',
  NOTIFICATIONS = 'NOTIFICATIONS',
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  passwordHashPreview: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ManagedUser {
  id: string;
  ownerId: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  status: UserStatus;
  avatarKey: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  managerId: string;
  managerName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Task {
  id: string;
  ownerId: string;
  projectId: string;
  projectTitle: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  progress: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TaskComment {
  id: string;
  ownerId: string;
  taskId: string;
  taskTitle: string;
  authorName: string;
  authorRole: Role;
  content: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TaskAttachment {
  id: string;
  ownerId: string;
  taskId: string;
  taskTitle: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  contentPreview: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ActivityReferenceType =
  | 'PROJECT'
  | 'TASK'
  | 'USER'
  | 'SETTING'
  | 'COMMENT'
  | 'ATTACHMENT';

export interface ActivityLog {
  id: string;
  ownerId: string;
  actorName: string;
  actorRole: Role;
  referenceType: ActivityReferenceType;
  referenceId: string;
  message: string;
  readState: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SystemSetting {
  id: string;
  ownerId: string;
  settingKey: string;
  settingValue: string;
  category: SettingCategory;
  description: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ResearchResult {
  summary: string;
  sources: GroundingSource[];
  timestamp: string;
}
