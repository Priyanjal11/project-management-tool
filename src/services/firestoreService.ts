import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import {
  Role,
  UserStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  SettingCategory,
  OperationType,
  ActivityReferenceType,
  UserProfile,
  ManagedUser,
  Project,
  Task,
  TaskComment,
  TaskAttachment,
  ActivityLog,
} from '../types';
import { buildSampleWorkspaceData } from '../data/sampleSeedData';

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned.length > 0 && ID_REGEX.test(cleaned) ? cleaned : `id_${Date.now()}`;
}

function clampString(val: string, minLen: number, maxLen: number, fallback: string): string {
  const trimmed = (val || '').trim();
  if (trimmed.length < minLen) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}

export async function validateOnServer(
  entityType: 'USER' | 'PROJECT' | 'TASK' | 'PROFILE' | 'SETTING' | 'COMMENT' | 'ATTACHMENT',
  actorRole: Role,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await fetch('/api/validate/entity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityType, actorRole, payload }),
  });
  const data = (await response.json()) as { valid: boolean; errors?: string[]; message?: string };
  if (!response.ok || !data.valid) {
    throw new Error(data.errors?.join(' ') || 'Server validation rejected the request.');
  }
}

export async function logWorkspaceActivity(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  referenceType: ActivityReferenceType,
  referenceId: string,
  message: string
): Promise<void> {
  const actId = sanitizeId(`act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `activities/${actId}`;
  try {
    await setDoc(doc(db, 'activities', actId), {
      id: actId,
      ownerId: sanitizeId(ownerId),
      actorName: clampString(actorName, 2, 80, 'Workspace User'),
      actorRole,
      referenceType,
      referenceId: sanitizeId(referenceId),
      message: clampString(message, 4, 300, 'Workspace activity recorded.'),
      readState: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function ensureUserProfile(
  uid: string,
  name: string,
  email: string,
  existingProfile: UserProfile | null,
  onboardingPrefs?: { role?: Role; department?: string; customName?: string; customEmail?: string }
): Promise<void> {
  if (existingProfile) return;
  const path = `users/${uid}`;
  const chosenRole = onboardingPrefs?.role || Role.ADMIN;
  const chosenDept = onboardingPrefs?.department || 'Executive & Engineering';
  const chosenName = onboardingPrefs?.customName?.trim() || name;
  const chosenEmail = onboardingPrefs?.customEmail?.trim() || email;

  try {
    await setDoc(doc(db, 'users', uid), {
      uid: sanitizeId(uid),
      name: clampString(chosenName, 2, 80, 'Authenticated User'),
      email: clampString(chosenEmail, 3, 120, 'user@workspace.local'),
      role: chosenRole,
      department: clampString(chosenDept, 2, 60, 'Engineering'),
      passwordHashPreview: 'pbkdf2_sha256$310000$9f8e7d6c5b4a',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function applySmartSignupProfile(
  uid: string,
  input: {
    name: string;
    email: string;
    role: Role;
    department: string;
  }
): Promise<void> {
  const path = `users/${uid}`;
  const cleanName = clampString(input.name, 2, 80, 'Workspace User');
  const cleanEmail = clampString(input.email, 3, 120, 'user@enterprise-pmt.io');
  const cleanDept = clampString(input.department, 2, 60, 'Engineering');
  const hashPreview = `pbkdf2_sha256$310000$${Date.now().toString(16).slice(-8)}`;

  try {
    const userRef = doc(db, 'users', uid);
    const existingSnap = await getDoc(userRef);

    if (existingSnap.exists()) {
      await updateDoc(userRef, {
        name: cleanName,
        email: cleanEmail,
        role: input.role,
        department: cleanDept,
        passwordHashPreview: hashPreview,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, {
        uid: sanitizeId(uid),
        name: cleanName,
        email: cleanEmail,
        role: input.role,
        department: cleanDept,
        passwordHashPreview: hashPreview,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Also register/update this signed-up person in the workspace managedUsers directory
    const nameSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 24);
    const pfx = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'ws';
    const memberId = sanitizeId(`usr_${pfx}_${nameSlug || 'member'}`);
    const memberRef = doc(db, 'managedUsers', memberId);
    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      await updateDoc(memberRef, {
        name: cleanName,
        email: cleanEmail,
        role: input.role,
        department: cleanDept,
        status: UserStatus.ACTIVE,
        avatarKey: 'engineer',
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(memberRef, {
        id: memberId,
        ownerId: sanitizeId(uid),
        name: cleanName,
        email: cleanEmail,
        role: input.role,
        department: cleanDept,
        status: UserStatus.ACTIVE,
        avatarKey: 'engineer',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await logWorkspaceActivity(
      uid,
      cleanName,
      input.role,
      'USER',
      uid,
      `Smart Signup registered active session for ${cleanName} (${input.role}, ${cleanDept}).`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function switchActiveUserRole(uid: string, newRole: Role): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserProfileDetails(
  uid: string,
  actorRole: Role,
  input: { name: string; email: string; department: string; role?: Role; newPassword?: string }
): Promise<void> {
  await validateOnServer('PROFILE', actorRole, input);
  const path = `users/${uid}`;
  const hashSuffix = input.newPassword
    ? `pbkdf2_sha256$310000$rot_${Date.now().toString(16)}`
    : 'pbkdf2_sha256$310000$9f8e7d6c5b4a';

  try {
    const updatePayload: Record<string, unknown> = {
      name: clampString(input.name, 2, 80, 'Workspace User'),
      email: clampString(input.email, 3, 120, 'user@workspace.local'),
      department: clampString(input.department, 2, 60, 'Engineering'),
      passwordHashPreview: clampString(hashSuffix, 8, 100, 'pbkdf2_sha256$310000$default'),
      updatedAt: serverTimestamp(),
    };
    if (input.role) {
      updatePayload.role = input.role;
    }
    await updateDoc(doc(db, 'users', uid), updatePayload);
    await logWorkspaceActivity(
      uid,
      input.name,
      input.role || actorRole,
      'USER',
      uid,
      `Updated personal profile and security credentials for ${clampString(input.name, 2, 80, 'User')}.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveManagedUser(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  input: {
    id?: string;
    name: string;
    email: string;
    role: Role;
    department: string;
    status: UserStatus;
    avatarKey: string;
  },
  isEdit: boolean
): Promise<void> {
  await validateOnServer('USER', actorRole, input);
  const memberId = sanitizeId(input.id || `usr_${Date.now()}`);
  const path = `managedUsers/${memberId}`;

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'managedUsers', memberId), {
        name: clampString(input.name, 2, 80, 'Team Member'),
        email: clampString(input.email, 3, 120, 'member@enterprise-pmt.io'),
        role: input.role,
        department: clampString(input.department, 2, 60, 'Engineering'),
        status: input.status,
        avatarKey: clampString(input.avatarKey, 1, 40, 'engineer'),
        updatedAt: serverTimestamp(),
      });
      await logWorkspaceActivity(
        ownerId,
        actorName,
        actorRole,
        'USER',
        memberId,
        `Updated user account ${input.name} (${input.role}, ${input.status}).`
      );
    } else {
      await setDoc(doc(db, 'managedUsers', memberId), {
        id: memberId,
        ownerId: sanitizeId(ownerId),
        name: clampString(input.name, 2, 80, 'Team Member'),
        email: clampString(input.email, 3, 120, 'member@enterprise-pmt.io'),
        role: input.role,
        department: clampString(input.department, 2, 60, 'Engineering'),
        status: input.status,
        avatarKey: clampString(input.avatarKey, 1, 40, 'engineer'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logWorkspaceActivity(
        ownerId,
        actorName,
        actorRole,
        'USER',
        memberId,
        `Created user account ${input.name} with role ${input.role}.`
      );
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function removeManagedUser(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  user: ManagedUser
): Promise<void> {
  const path = `managedUsers/${user.id}`;
  try {
    await deleteDoc(doc(db, 'managedUsers', user.id));
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'USER',
      user.id,
      `Removed user account ${user.name} (${user.email}).`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveProject(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  input: {
    id?: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    status: ProjectStatus;
    managerId: string;
    managerName: string;
  },
  isEdit: boolean
): Promise<void> {
  await validateOnServer('PROJECT', actorRole, input);
  const projectId = sanitizeId(input.id || `prj_${Date.now()}`);
  const path = `projects/${projectId}`;

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'projects', projectId), {
        title: clampString(input.title, 3, 120, 'Untitled Project'),
        description: clampString(input.description, 5, 1000, 'Project scope description.'),
        startDate: input.startDate.slice(0, 10),
        endDate: input.endDate.slice(0, 10),
        status: input.status,
        managerId: sanitizeId(input.managerId),
        managerName: clampString(input.managerName, 2, 80, 'Project Manager'),
        updatedAt: serverTimestamp(),
      });
      await logWorkspaceActivity(
        ownerId,
        actorName,
        actorRole,
        'PROJECT',
        projectId,
        `Updated project "${input.title}" (${input.status}).`
      );
    } else {
      await setDoc(doc(db, 'projects', projectId), {
        id: projectId,
        ownerId: sanitizeId(ownerId),
        title: clampString(input.title, 3, 120, 'Untitled Project'),
        description: clampString(input.description, 5, 1000, 'Project scope description.'),
        startDate: input.startDate.slice(0, 10),
        endDate: input.endDate.slice(0, 10),
        status: input.status,
        managerId: sanitizeId(input.managerId),
        managerName: clampString(input.managerName, 2, 80, 'Project Manager'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logWorkspaceActivity(
        ownerId,
        actorName,
        actorRole,
        'PROJECT',
        projectId,
        `Created project "${input.title}" managed by ${input.managerName}.`
      );
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function removeProject(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  project: Project
): Promise<void> {
  const path = `projects/${project.id}`;
  try {
    await deleteDoc(doc(db, 'projects', project.id));
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'PROJECT',
      project.id,
      `Deleted project "${project.title}".`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTask(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  input: {
    id?: string;
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
  },
  isEdit: boolean
): Promise<void> {
  await validateOnServer('TASK', actorRole, input);
  const taskId = sanitizeId(input.id || `tsk_${Date.now()}`);
  const path = `tasks/${taskId}`;
  const boundedProgress = Math.max(0, Math.min(100, Math.round(Number(input.progress) || 0)));

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'tasks', taskId), {
        title: clampString(input.title, 3, 140, 'Untitled Task'),
        description: clampString(input.description, 5, 1000, 'Task description.'),
        projectTitle: clampString(input.projectTitle, 3, 120, 'Project'),
        assigneeId: sanitizeId(input.assigneeId),
        assigneeName: clampString(input.assigneeName, 2, 80, 'Team Member'),
        priority: input.priority,
        status: input.status,
        dueDate: input.dueDate.slice(0, 10),
        progress: boundedProgress,
        updatedAt: serverTimestamp(),
      });
      await logWorkspaceActivity(
        ownerId,
        actorName,
        actorRole,
        'TASK',
        taskId,
        `Updated task "${input.title}" assigned to ${input.assigneeName} (${input.status}, ${boundedProgress}%).`
      );
    } else {
      await setDoc(doc(db, 'tasks', taskId), {
        id: taskId,
        ownerId: sanitizeId(ownerId),
        projectId: sanitizeId(input.projectId),
        projectTitle: clampString(input.projectTitle, 3, 120, 'Project'),
        title: clampString(input.title, 3, 140, 'Untitled Task'),
        description: clampString(input.description, 5, 1000, 'Task description.'),
        assigneeId: sanitizeId(input.assigneeId),
        assigneeName: clampString(input.assigneeName, 2, 80, 'Team Member'),
        priority: input.priority,
        status: input.status,
        dueDate: input.dueDate.slice(0, 10),
        progress: boundedProgress,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logWorkspaceActivity(
        ownerId,
        actorName,
        actorRole,
        'TASK',
        taskId,
        `Assigned task "${input.title}" to ${input.assigneeName} (Due ${input.dueDate}).`
      );
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function updateTaskProgressAndStatus(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  task: Task,
  newStatus: TaskStatus,
  newProgress: number
): Promise<void> {
  const boundedProgress = Math.max(0, Math.min(100, Math.round(Number(newProgress) || 0)));
  const path = `tasks/${task.id}`;
  try {
    await updateDoc(doc(db, 'tasks', task.id), {
      status: newStatus,
      progress: boundedProgress,
      updatedAt: serverTimestamp(),
    });
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'TASK',
      task.id,
      `${actorName} moved "${task.title}" to ${newStatus} (${boundedProgress}%).`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTaskScheduleAndProgress(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  task: Task,
  newDueDate: string,
  newStatus: TaskStatus,
  newProgress: number
): Promise<void> {
  const boundedProgress = Math.max(0, Math.min(100, Math.round(Number(newProgress) || 0)));
  const path = `tasks/${task.id}`;
  try {
    await updateDoc(doc(db, 'tasks', task.id), {
      dueDate: newDueDate.slice(0, 10),
      status: newStatus,
      progress: boundedProgress,
      updatedAt: serverTimestamp(),
    });
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'TASK',
      task.id,
      `Rescheduled task "${task.title}" due date to ${newDueDate.slice(0, 10)} (${boundedProgress}%).`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeTask(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  task: Task
): Promise<void> {
  const path = `tasks/${task.id}`;
  try {
    await deleteDoc(doc(db, 'tasks', task.id));
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'TASK',
      task.id,
      `Removed task "${task.title}".`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addTaskComment(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  task: Task,
  content: string
): Promise<void> {
  await validateOnServer('COMMENT', actorRole, { taskId: task.id, content });
  const commentId = sanitizeId(`cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `taskComments/${commentId}`;

  try {
    await setDoc(doc(db, 'taskComments', commentId), {
      id: commentId,
      ownerId: sanitizeId(ownerId),
      taskId: sanitizeId(task.id),
      taskTitle: clampString(task.title, 3, 140, 'Task'),
      authorName: clampString(actorName, 2, 80, 'Workspace User'),
      authorRole: actorRole,
      content: clampString(content, 1, 1000, 'Comment added.'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'COMMENT',
      task.id,
      `${actorName} commented on "${task.title}": ${content.slice(0, 100)}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeTaskComment(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  comment: TaskComment
): Promise<void> {
  const path = `taskComments/${comment.id}`;
  try {
    await deleteDoc(doc(db, 'taskComments', comment.id));
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'COMMENT',
      comment.taskId,
      `${actorName} removed a comment on "${comment.taskTitle}".`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addTaskAttachment(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  task: Task,
  fileInput: {
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    contentPreview: string;
  }
): Promise<void> {
  await validateOnServer('ATTACHMENT', actorRole, {
    taskId: task.id,
    fileName: fileInput.fileName,
    fileSizeBytes: fileInput.fileSizeBytes,
  });
  const attachmentId = sanitizeId(`att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `taskAttachments/${attachmentId}`;

  try {
    await setDoc(doc(db, 'taskAttachments', attachmentId), {
      id: attachmentId,
      ownerId: sanitizeId(ownerId),
      taskId: sanitizeId(task.id),
      taskTitle: clampString(task.title, 3, 140, 'Task'),
      fileName: clampString(fileInput.fileName, 1, 120, 'attachment.txt'),
      fileType: clampString(fileInput.fileType || 'text/plain', 1, 80, 'text/plain'),
      fileSizeBytes: Math.max(0, Math.min(52428800, Math.round(fileInput.fileSizeBytes || 0))),
      uploadedBy: clampString(actorName, 2, 80, 'Workspace User'),
      contentPreview: clampString(
        fileInput.contentPreview,
        1,
        5000,
        `Attached binary/document file: ${fileInput.fileName}`
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'ATTACHMENT',
      task.id,
      `${actorName} attached "${fileInput.fileName}" to task "${task.title}".`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeTaskAttachment(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  attachment: TaskAttachment
): Promise<void> {
  const path = `taskAttachments/${attachment.id}`;
  try {
    await deleteDoc(doc(db, 'taskAttachments', attachment.id));
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'ATTACHMENT',
      attachment.taskId,
      `${actorName} removed attachment "${attachment.fileName}" from "${attachment.taskTitle}".`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSystemSetting(
  ownerId: string,
  actorName: string,
  actorRole: Role,
  input: {
    id?: string;
    settingKey: string;
    settingValue: string;
    category: SettingCategory;
    description: string;
  },
  isEdit: boolean
): Promise<void> {
  await validateOnServer('SETTING', actorRole, input);
  const settingId = sanitizeId(input.id || `set_${Date.now()}`);
  const path = `systemSettings/${settingId}`;

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'systemSettings', settingId), {
        settingValue: clampString(input.settingValue, 1, 250, 'true'),
        category: input.category,
        description: clampString(input.description, 5, 250, 'System setting parameter.'),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'systemSettings', settingId), {
        id: settingId,
        ownerId: sanitizeId(ownerId),
        settingKey: clampString(input.settingKey, 3, 80, 'system.config.key'),
        settingValue: clampString(input.settingValue, 1, 250, 'true'),
        category: input.category,
        description: clampString(input.description, 5, 250, 'System setting parameter.'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await logWorkspaceActivity(
      ownerId,
      actorName,
      actorRole,
      'SETTING',
      settingId,
      `Configured system setting ${input.settingKey} = ${input.settingValue}.`
    );
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function markActivityRead(activityId: string, readState: boolean): Promise<void> {
  const path = `activities/${activityId}`;
  try {
    await updateDoc(doc(db, 'activities', activityId), {
      readState,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllActivitiesRead(activities: ActivityLog[]): Promise<void> {
  const unread = activities.filter((a) => !a.readState);
  if (unread.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const act of unread) {
      batch.update(doc(db, 'activities', act.id), {
        readState: true,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'activities/markAllRead');
  }
}

export async function seedSampleWorkspace(ownerId: string): Promise<void> {
  const sample = buildSampleWorkspaceData(ownerId);
  try {
    // 1. First batch: managedUsers, projects, settings, activities
    const batch1 = writeBatch(db);
    for (const u of sample.managedUsers) {
      batch1.set(doc(db, 'managedUsers', u.id), {
        ...u,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const p of sample.projects) {
      batch1.set(doc(db, 'projects', p.id), {
        ...p,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const s of sample.settings) {
      batch1.set(doc(db, 'systemSettings', s.id), {
        ...s,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const a of sample.activities) {
      batch1.set(doc(db, 'activities', a.id), {
        ...a,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch1.commit();

    // 2. Second batch: tasks (requires parent projects to exist)
    const batch2 = writeBatch(db);
    for (const t of sample.tasks) {
      batch2.set(doc(db, 'tasks', t.id), {
        ...t,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch2.commit();

    // 3. Third batch: taskComments & taskAttachments (requires parent tasks to exist)
    const batch3 = writeBatch(db);
    for (const c of sample.comments) {
      batch3.set(doc(db, 'taskComments', c.id), {
        ...c,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const att of sample.attachments) {
      batch3.set(doc(db, 'taskAttachments', att.id), {
        ...att,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch3.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedSampleWorkspace');
  }
}

export async function clearWorkspaceData(ownerId: string): Promise<void> {
  const collectionsToClear = [
    'taskComments',
    'taskAttachments',
    'tasks',
    'projects',
    'managedUsers',
    'activities',
    'systemSettings',
  ];
  try {
    for (const colName of collectionsToClear) {
      const q = query(collection(db, colName), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'clearWorkspaceData');
  }
}
