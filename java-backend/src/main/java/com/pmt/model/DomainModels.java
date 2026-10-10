package com.pmt.model;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

/**
 * Core Object-Oriented Domain Layer
 * Demonstrates abstraction, encapsulation, inheritance, polymorphism, and strict domain invariants.
 */
public final class DomainModels {

    public enum Role {
        ADMIN, PROJECT_MANAGER, TEAM_MEMBER;

        public boolean canManageUsers() {
            return this == ADMIN;
        }

        public boolean canManageProjects() {
            return this == ADMIN || this == PROJECT_MANAGER;
        }
    }

    public enum ProjectStatus {
        PLANNING, ACTIVE, ON_HOLD, COMPLETED, ARCHIVED
    }

    public enum TaskPriority {
        LOW, MEDIUM, HIGH, CRITICAL
    }

    public enum TaskStatus {
        TODO, IN_PROGRESS, IN_REVIEW, DONE, ARCHIVED
    }

    public interface AuditableEntity {
        String getId();
        Instant getCreatedAt();
        Instant getUpdatedAt();
    }

    public static abstract class BaseEntity implements AuditableEntity {
        private final String id;
        private final Instant createdAt;
        private Instant updatedAt;

        protected BaseEntity(String id, Instant createdAt, Instant updatedAt) {
            if (id == null || !id.matches("^[a-zA-Z0-9_\\-]+$")) {
                throw new IllegalArgumentException("Entity ID must match ^[a-zA-Z0-9_\\-]+$");
            }
            this.id = id;
            this.createdAt = Objects.requireNonNull(createdAt, "createdAt cannot be null");
            this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt cannot be null");
        }

        @Override
        public String getId() { return id; }
        @Override
        public Instant getCreatedAt() { return createdAt; }
        @Override
        public Instant getUpdatedAt() { return updatedAt; }
        public void touch() { this.updatedAt = Instant.now(); }
    }

    public static final class User extends BaseEntity {
        private String name;
        private String email;
        private String passwordHash;
        private Role role;
        private String department;
        private String status;

        public User(String id, String name, String email, String passwordHash,
                    Role role, String department, String status, Instant createdAt, Instant updatedAt) {
            super(id, createdAt, updatedAt);
            setName(name);
            setEmail(email);
            this.passwordHash = Objects.requireNonNull(passwordHash);
            this.role = Objects.requireNonNull(role);
            this.department = Objects.requireNonNull(department);
            this.status = Objects.requireNonNull(status);
        }

        public String getName() { return name; }
        public void setName(String name) {
            if (name == null || name.trim().length() < 2 || name.trim().length() > 80) {
                throw new IllegalArgumentException("User name must be 2..80 characters");
            }
            this.name = name.trim();
            touch();
        }

        public String getEmail() { return email; }
        public void setEmail(String email) {
            if (email == null || !email.contains("@") || email.length() > 120) {
                throw new IllegalArgumentException("Invalid email address");
            }
            this.email = email.trim().toLowerCase();
            touch();
        }

        public String getPasswordHash() { return passwordHash; }
        public Role getRole() { return role; }
        public void setRole(Role role) { this.role = Objects.requireNonNull(role); touch(); }
        public String getDepartment() { return department; }
        public String getStatus() { return status; }
    }

    public static final class Project extends BaseEntity {
        private String title;
        private String description;
        private LocalDate startDate;
        private LocalDate endDate;
        private ProjectStatus status;
        private String managerId;

        public Project(String id, String title, String description, LocalDate startDate,
                       LocalDate endDate, ProjectStatus status, String managerId,
                       Instant createdAt, Instant updatedAt) {
            super(id, createdAt, updatedAt);
            if (endDate.isBefore(startDate)) {
                throw new IllegalArgumentException("endDate cannot be before startDate");
            }
            this.title = Objects.requireNonNull(title);
            this.description = Objects.requireNonNull(description);
            this.startDate = startDate;
            this.endDate = endDate;
            this.status = Objects.requireNonNull(status);
            this.managerId = Objects.requireNonNull(managerId);
        }

        public String getTitle() { return title; }
        public String getDescription() { return description; }
        public LocalDate getStartDate() { return startDate; }
        public LocalDate getEndDate() { return endDate; }
        public ProjectStatus getStatus() { return status; }
        public String getManagerId() { return managerId; }
    }

    public static final class Task extends BaseEntity {
        private final String projectId;
        private String title;
        private String description;
        private String assigneeId;
        private TaskPriority priority;
        private TaskStatus status;
        private LocalDate dueDate;
        private int progress;

        public Task(String id, String projectId, String title, String description,
                    String assigneeId, TaskPriority priority, TaskStatus status,
                    LocalDate dueDate, int progress, Instant createdAt, Instant updatedAt) {
            super(id, createdAt, updatedAt);
            if (progress < 0 || progress > 100) {
                throw new IllegalArgumentException("Task progress must be 0..100");
            }
            this.projectId = Objects.requireNonNull(projectId);
            this.title = Objects.requireNonNull(title);
            this.description = Objects.requireNonNull(description);
            this.assigneeId = Objects.requireNonNull(assigneeId);
            this.priority = Objects.requireNonNull(priority);
            this.status = Objects.requireNonNull(status);
            this.dueDate = Objects.requireNonNull(dueDate);
            this.progress = progress;
        }

        public String getProjectId() { return projectId; }
        public String getTitle() { return title; }
        public String getDescription() { return description; }
        public String getAssigneeId() { return assigneeId; }
        public TaskPriority getPriority() { return priority; }
        public TaskStatus getStatus() { return status; }
        public LocalDate getDueDate() { return dueDate; }
        public int getProgress() { return progress; }
    }
}
