import {
  Role,
  UserStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  SettingCategory,
  ManagedUser,
  Project,
  Task,
  TaskComment,
  TaskAttachment,
  ActivityLog,
  SystemSetting,
} from '../types';

export function buildSampleWorkspaceData(ownerId: string): {
  managedUsers: Omit<ManagedUser, 'createdAt' | 'updatedAt'>[];
  projects: Omit<Project, 'createdAt' | 'updatedAt'>[];
  tasks: Omit<Task, 'createdAt' | 'updatedAt'>[];
  comments: Omit<TaskComment, 'createdAt' | 'updatedAt'>[];
  attachments: Omit<TaskAttachment, 'createdAt' | 'updatedAt'>[];
  activities: Omit<ActivityLog, 'createdAt' | 'updatedAt'>[];
  settings: Omit<SystemSetting, 'createdAt' | 'updatedAt'>[];
} {
  const pfx = ownerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'ws';

  const idEvelyn = `usr_${pfx}_evelyn`;
  const idMarcus = `usr_${pfx}_marcus`;
  const idPriya = `usr_${pfx}_priya`;
  const idDavid = `usr_${pfx}_david`;
  const idElena = `usr_${pfx}_elena`;

  const idPrjLedger = `prj_${pfx}_jdbc_ledger`;
  const idPrjRbac = `prj_${pfx}_rbac_servlet`;
  const idPrjAudit = `prj_${pfx}_soc2_audit`;

  const idTskDao = `tsk_${pfx}_prep_stmt`;
  const idTskIdx = `tsk_${pfx}_3nf_index`;
  const idTskFilter = `tsk_${pfx}_rbac_filter`;
  const idTskCsrf = `tsk_${pfx}_csrf_san`;

  const managedUsers: Omit<ManagedUser, 'createdAt' | 'updatedAt'>[] = [
    {
      id: idEvelyn,
      ownerId,
      name: 'Evelyn Vance',
      email: 'e.vance@enterprise-pmt.io',
      role: Role.ADMIN,
      department: 'Platform Governance',
      status: UserStatus.ACTIVE,
      avatarKey: 'director',
    },
    {
      id: idMarcus,
      ownerId,
      name: 'Marcus Chen',
      email: 'm.chen@enterprise-pmt.io',
      role: Role.PROJECT_MANAGER,
      department: 'Core Banking & Ledger',
      status: UserStatus.ACTIVE,
      avatarKey: 'manager',
    },
    {
      id: idPriya,
      ownerId,
      name: 'Priya Nair',
      email: 'p.nair@enterprise-pmt.io',
      role: Role.TEAM_MEMBER,
      department: 'Backend Engineering',
      status: UserStatus.ACTIVE,
      avatarKey: 'engineer',
    },
    {
      id: idDavid,
      ownerId,
      name: 'David Kowalski',
      email: 'd.kowalski@enterprise-pmt.io',
      role: Role.TEAM_MEMBER,
      department: 'Database Reliability',
      status: UserStatus.ACTIVE,
      avatarKey: 'manager',
    },
    {
      id: idElena,
      ownerId,
      name: 'Elena Rostova',
      email: 'e.rostova@enterprise-pmt.io',
      role: Role.PROJECT_MANAGER,
      department: 'Security & Identity',
      status: UserStatus.ACTIVE,
      avatarKey: 'director',
    },
  ];

  const projects: Omit<Project, 'createdAt' | 'updatedAt'>[] = [
    {
      id: idPrjLedger,
      ownerId,
      title: 'Core Settlement JDBC Connection Pool Migration',
      description:
        'Migrate legacy settlement servlets to HikariCP prepared statement pooling with strict 3NF schema validation and automatic transaction rollback.',
      startDate: '2026-09-25',
      endDate: '2026-11-15',
      status: ProjectStatus.ACTIVE,
      managerId: idMarcus,
      managerName: 'Marcus Chen',
    },
    {
      id: idPrjRbac,
      ownerId,
      title: 'Zero-Trust Servlet Session & RBAC Gateway',
      description:
        'Implement Jakarta EE servlet security filters, PBKDF2 password hashing, CSRF verification tokens, and role-segmented audit logging.',
      startDate: '2026-10-01',
      endDate: '2026-11-05',
      status: ProjectStatus.ACTIVE,
      managerId: idElena,
      managerName: 'Elena Rostova',
    },
    {
      id: idPrjAudit,
      ownerId,
      title: 'Q4 SOC2 Database & Access Control Audit',
      description:
        'Complete quarterly verification of relational foreign key constraints, prepared statement SQL injection defenses, and user role entitlements.',
      startDate: '2026-10-10',
      endDate: '2026-12-01',
      status: ProjectStatus.PLANNING,
      managerId: idMarcus,
      managerName: 'Marcus Chen',
    },
  ];

  const tasks: Omit<Task, 'createdAt' | 'updatedAt'>[] = [
    {
      id: idTskDao,
      ownerId,
      projectId: idPrjLedger,
      projectTitle: 'Core Settlement JDBC Connection Pool Migration',
      title: 'Refactor TaskDAO & ProjectDAO to Parameterized PreparedStatements',
      description:
        'Eliminate all string-concatenated SQL queries and wrap multi-table updates in explicit JDBC transactions with rollback on SQLException.',
      assigneeId: idPriya,
      assigneeName: 'Priya Nair',
      priority: TaskPriority.CRITICAL,
      status: TaskStatus.IN_PROGRESS,
      dueDate: '2026-10-22',
      progress: 75,
    },
    {
      id: idTskIdx,
      ownerId,
      projectId: idPrjLedger,
      projectTitle: 'Core Settlement JDBC Connection Pool Migration',
      title: 'Benchmark Composite Indexes on tasks(status, priority)',
      description:
        'Verify query execution plans for role dashboards under 50k concurrent task rows and document setup DDL in schema.sql.',
      assigneeId: idDavid,
      assigneeName: 'David Kowalski',
      priority: TaskPriority.HIGH,
      status: TaskStatus.DONE,
      dueDate: '2026-10-14',
      progress: 100,
    },
    {
      id: idTskFilter,
      ownerId,
      projectId: idPrjRbac,
      projectTitle: 'Zero-Trust Servlet Session & RBAC Gateway',
      title: 'Enforce HttpSession Role Guards on AdminServlet & ProjectServlet',
      description:
        'Reject unauthorized role mutations with HTTP 403 and log security events to activity_logs table.',
      assigneeId: idPriya,
      assigneeName: 'Priya Nair',
      priority: TaskPriority.CRITICAL,
      status: TaskStatus.IN_REVIEW,
      dueDate: '2026-10-19',
      progress: 90,
    },
    {
      id: idTskCsrf,
      ownerId,
      projectId: idPrjRbac,
      projectTitle: 'Zero-Trust Servlet Session & RBAC Gateway',
      title: 'Server-Side Form Input Validation & HTML Escaping Utility',
      description:
        'Validate field lengths, date boundaries, and email formats on the server before invoking service and DAO layers.',
      assigneeId: idDavid,
      assigneeName: 'David Kowalski',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: '2026-10-28',
      progress: 15,
    },
  ];

  const comments: Omit<TaskComment, 'createdAt' | 'updatedAt'>[] = [
    {
      id: `cmt_${pfx}_1`,
      ownerId,
      taskId: idTskDao,
      taskTitle: 'Refactor TaskDAO & ProjectDAO to Parameterized PreparedStatements',
      authorName: 'Priya Nair',
      authorRole: Role.TEAM_MEMBER,
      content:
        'Completed PreparedStatement refactoring for TaskDAO. Added explicit conn.rollback() inside the catch(SQLException) block.',
    },
    {
      id: `cmt_${pfx}_2`,
      ownerId,
      taskId: idTskDao,
      taskTitle: 'Refactor TaskDAO & ProjectDAO to Parameterized PreparedStatements',
      authorName: 'Marcus Chen',
      authorRole: Role.PROJECT_MANAGER,
      content:
        'Reviewed the transaction boundary. Please attach the HikariCP pool configuration snippet before moving to IN_REVIEW.',
    },
    {
      id: `cmt_${pfx}_3`,
      ownerId,
      taskId: idTskFilter,
      taskTitle: 'Enforce HttpSession Role Guards on AdminServlet & ProjectServlet',
      authorName: 'Elena Rostova',
      authorRole: Role.PROJECT_MANAGER,
      content:
        'Verified HTTP 403 rejection on unauthorized role escalation attempts in staging.',
    },
  ];

  const attachments: Omit<TaskAttachment, 'createdAt' | 'updatedAt'>[] = [
    {
      id: `att_${pfx}_1`,
      ownerId,
      taskId: idTskDao,
      taskTitle: 'Refactor TaskDAO & ProjectDAO to Parameterized PreparedStatements',
      fileName: 'hikaricp-jdbc-pool.properties',
      fileType: 'text/plain',
      fileSizeBytes: 642,
      uploadedBy: 'Priya Nair',
      contentPreview: `jdbcUrl=jdbc:postgresql://localhost:5432/pmt_db
maximumPoolSize=32
minimumIdle=8
autoCommit=false
dataSource.cachePrepStmts=true
dataSource.prepStmtCacheSize=250
dataSource.prepStmtCacheSqlLimit=2048`,
    },
    {
      id: `att_${pfx}_2`,
      ownerId,
      taskId: idTskFilter,
      taskTitle: 'Enforce HttpSession Role Guards on AdminServlet & ProjectServlet',
      fileName: 'rbac-security-matrix.json',
      fileType: 'application/json',
      fileSizeBytes: 518,
      uploadedBy: 'Elena Rostova',
      contentPreview: `{
  "roles": {
    "ADMIN": ["users:*", "projects:*", "tasks:*", "settings:*"],
    "PROJECT_MANAGER": ["projects:write", "tasks:*", "reports:read"],
    "TEAM_MEMBER": ["tasks:update_progress", "comments:write", "attachments:write"]
  }
}`,
    },
  ];

  const activities: Omit<ActivityLog, 'createdAt' | 'updatedAt'>[] = [
    {
      id: `act_${pfx}_1`,
      ownerId,
      actorName: 'Priya Nair',
      actorRole: Role.TEAM_MEMBER,
      referenceType: 'TASK',
      referenceId: idTskDao,
      message: 'Updated task "Refactor TaskDAO & ProjectDAO" progress to 75% (IN_PROGRESS).',
      readState: false,
    },
    {
      id: `act_${pfx}_2`,
      ownerId,
      actorName: 'Priya Nair',
      actorRole: Role.TEAM_MEMBER,
      referenceType: 'ATTACHMENT',
      referenceId: idTskDao,
      message: 'Attached file "hikaricp-jdbc-pool.properties" to task "Refactor TaskDAO & ProjectDAO".',
      readState: false,
    },
    {
      id: `act_${pfx}_3`,
      ownerId,
      actorName: 'Marcus Chen',
      actorRole: Role.PROJECT_MANAGER,
      referenceType: 'COMMENT',
      referenceId: idTskDao,
      message: 'Commented on "Refactor TaskDAO & ProjectDAO": Reviewed the transaction boundary.',
      readState: false,
    },
    {
      id: `act_${pfx}_4`,
      ownerId,
      actorName: 'Evelyn Vance',
      actorRole: Role.ADMIN,
      referenceType: 'SETTING',
      referenceId: `set_${pfx}_pool`,
      message: 'Verified JDBC prepared statement cache limit (250 statements per connection).',
      readState: true,
    },
  ];

  const settings: Omit<SystemSetting, 'createdAt' | 'updatedAt'>[] = [
    {
      id: `set_${pfx}_pool`,
      ownerId,
      settingKey: 'jdbc.pool.maxConnections',
      settingValue: '32',
      category: SettingCategory.JDBC_POOL,
      description: 'Maximum active JDBC connections in HikariCP DataSource pool.',
    },
    {
      id: `set_${pfx}_session`,
      ownerId,
      settingKey: 'security.servlet.sessionTimeoutMinutes',
      settingValue: '30',
      category: SettingCategory.SECURITY,
      description: 'HttpSession idle timeout before mandatory re-authentication.',
    },
    {
      id: `set_${pfx}_rbac`,
      ownerId,
      settingKey: 'security.rbac.enforceServerValidation',
      settingValue: 'true',
      category: SettingCategory.SECURITY,
      description: 'Enforce strict role and schema validation on every Servlet POST/PUT request.',
    },
    {
      id: `set_${pfx}_notify`,
      ownerId,
      settingKey: 'workflow.notifications.onTaskStatusChange',
      settingValue: 'ENABLED',
      category: SettingCategory.NOTIFICATIONS,
      description: 'Write an activity log notification whenever a team member updates task status.',
    },
  ];

  return { managedUsers, projects, tasks, comments, attachments, activities, settings };
}

export const JAVA_ARCHITECTURE_DOCS = {
  sqlSchema: `-- Normalized 3NF Relational Schema (PostgreSQL / MySQL 8+)
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER')),
    department VARCHAR(60) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED')),
    manager_id VARCHAR(64) NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_projects_dates CHECK (end_date >= start_date)
);

CREATE TABLE tasks (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON UPDATE CASCADE ON DELETE CASCADE,
    title VARCHAR(140) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    assignee_id VARCHAR(64) NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    priority VARCHAR(12) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'ARCHIVED')),
    due_date DATE NOT NULL,
    progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
  jdbcDao: `// JDBC Data Access Object with PreparedStatements & Transaction Rollback
public void updateTaskStatusAndLogActivity(
        String taskId, TaskStatus newStatus, int newProgress,
        String actorUserId, String activityId, String auditMessage) throws SQLException {

    final String updateTaskSql =
        "UPDATE tasks SET status = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    final String insertActivitySql =
        "INSERT INTO activity_logs (id, user_id, reference_type, reference_id, message, read_state) " +
        "VALUES (?, ?, 'TASK', ?, ?, FALSE)";

    try (Connection conn = DatabaseConnectionManager.getConnection()) {
        conn.setAutoCommit(false);
        try (
            PreparedStatement psTask = conn.prepareStatement(updateTaskSql);
            PreparedStatement psAudit = conn.prepareStatement(insertActivitySql)
        ) {
            psTask.setString(1, newStatus.name());
            psTask.setInt(2, newProgress);
            psTask.setString(3, taskId);
            if (psTask.executeUpdate() != 1) {
                throw new SQLException("Task not found: " + taskId);
            }

            psAudit.setString(1, activityId);
            psAudit.setString(2, actorUserId);
            psAudit.setString(3, taskId);
            psAudit.setString(4, auditMessage);
            psAudit.executeUpdate();

            conn.commit();
        } catch (SQLException ex) {
            conn.rollback();
            throw ex;
        } finally {
            conn.setAutoCommit(true);
        }
    }
}`,
  javaServlet: `// Jakarta EE Servlet Controller with Session RBAC & Server-Side Input Validation
@WebServlet(name = "TaskProgressServlet", urlPatterns = {"/api/servlet/tasks/progress"})
public class ProjectManagementServlets extends HttpServlet {
    private final TaskJdbcDAO taskDao = new TaskJdbcDAO();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            resp.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Authentication required.");
            return;
        }
        String actorUserId = (String) session.getAttribute("userId");
        String taskId = req.getParameter("taskId");
        int progress = Integer.parseInt(req.getParameter("progress"));
        TaskStatus status = TaskStatus.valueOf(req.getParameter("status"));

        taskDao.updateTaskStatusAndLogActivity(
            taskId, status, progress, actorUserId,
            "act_" + UUID.randomUUID().toString().substring(0, 8),
            "Updated task " + taskId + " to " + status + " (" + progress + "%)"
        );
        resp.setStatus(HttpServletResponse.SC_OK);
    }
}`,
};
