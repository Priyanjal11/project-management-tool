package com.pmt.dao;

import com.pmt.model.DomainModels.*;
import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * JDBC Data Access Layer using PreparedStatements and Explicit Transaction Management.
 * Reads connection settings strictly from environment variables (zero hardcoded secrets).
 */
public final class JdbcRepositories {

    public static final class DatabaseConnectionManager {
        private static final String JDBC_URL = System.getenv("PMT_JDBC_URL");
        private static final String JDBC_USER = System.getenv("PMT_JDBC_USER");
        private static final String JDBC_PASSWORD = System.getenv("PMT_JDBC_PASSWORD");

        public static Connection getConnection() throws SQLException {
            if (JDBC_URL == null || JDBC_URL.isBlank()) {
                throw new SQLException("Missing environment variable PMT_JDBC_URL");
            }
            return DriverManager.getConnection(JDBC_URL, JDBC_USER, JDBC_PASSWORD);
        }
    }

    public static final class TaskJdbcDAO {

        /**
         * Updates task status and progress atomically alongside an activity audit log entry
         * using PreparedStatement bindings and explicit JDBC transaction rollback on failure.
         */
        public void updateTaskStatusAndLogActivity(
                String taskId,
                TaskStatus newStatus,
                int newProgress,
                String actorUserId,
                String activityId,
                String auditMessage
        ) throws SQLException {
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
                    int affected = psTask.executeUpdate();
                    if (affected != 1) {
                        throw new SQLException("Task not found or concurrent modification failed for ID: " + taskId);
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
        }

        public List<Task> findTasksByAssignee(String assigneeId) throws SQLException {
            final String sql =
                "SELECT id, project_id, title, description, assignee_id, priority, status, due_date, progress, created_at, updated_at " +
                "FROM tasks WHERE assignee_id = ? ORDER BY due_date ASC";
            List<Task> results = new ArrayList<>();

            try (
                Connection conn = DatabaseConnectionManager.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)
            ) {
                ps.setString(1, assigneeId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        results.add(new Task(
                            rs.getString("id"),
                            rs.getString("project_id"),
                            rs.getString("title"),
                            rs.getString("description"),
                            rs.getString("assignee_id"),
                            TaskPriority.valueOf(rs.getString("priority")),
                            TaskStatus.valueOf(rs.getString("status")),
                            rs.getDate("due_date").toLocalDate(),
                            rs.getInt("progress"),
                            rs.getTimestamp("created_at").toInstant(),
                            rs.getTimestamp("updated_at").toInstant()
                        ));
                    }
                }
            }
            return results;
        }
    }
}
