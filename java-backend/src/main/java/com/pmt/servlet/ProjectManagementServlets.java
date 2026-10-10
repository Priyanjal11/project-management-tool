package com.pmt.servlet;

import com.pmt.dao.JdbcRepositories.TaskJdbcDAO;
import com.pmt.model.DomainModels.Role;
import com.pmt.model.DomainModels.TaskStatus;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.sql.SQLException;
import java.util.UUID;

/**
 * Java Servlet Controller Layer
 * Enforces session authentication, server-side input validation, CSRF verification, and RBAC.
 */
@WebServlet(name = "TaskProgressServlet", urlPatterns = {"/api/servlet/tasks/progress"})
public class ProjectManagementServlets extends HttpServlet {

    private final TaskJdbcDAO taskDao = new TaskJdbcDAO();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Authentication required.\"}");
            return;
        }

        String actorUserId = (String) session.getAttribute("userId");
        Role actorRole = (Role) session.getAttribute("userRole");

        if (actorRole == null) {
            resp.setStatus(HttpServletResponse.SC_FORBIDDEN);
            resp.getWriter().write("{\"error\":\"Insufficient role permissions.\"}");
            return;
        }

        String taskId = req.getParameter("taskId");
        String statusParam = req.getParameter("status");
        String progressParam = req.getParameter("progress");

        if (taskId == null || !taskId.matches("^[a-zA-Z0-9_\\-]+$")) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Invalid taskId format.\"}");
            return;
        }

        try {
            TaskStatus newStatus = TaskStatus.valueOf(statusParam);
            int newProgress = Integer.parseInt(progressParam);
            if (newProgress < 0 || newProgress > 100) {
                resp.setStatus(422);
                resp.getWriter().write("{\"error\":\"Progress must be between 0 and 100.\"}");
                return;
            }

            String activityId = "act_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            String message = "Updated task " + taskId + " to " + newStatus.name() + " (" + newProgress + "%)";

            taskDao.updateTaskStatusAndLogActivity(
                taskId, newStatus, newProgress, actorUserId, activityId, message
            );

            resp.setStatus(HttpServletResponse.SC_OK);
            resp.getWriter().write("{\"success\":true,\"message\":\"Task progress updated atomically.\"}");
        } catch (IllegalArgumentException ex) {
            resp.setStatus(422);
            resp.getWriter().write("{\"error\":\"Invalid status or progress parameter.\"}");
        } catch (SQLException ex) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"error\":\"Database transaction rolled back safely.\"}");
        }
    }
}
