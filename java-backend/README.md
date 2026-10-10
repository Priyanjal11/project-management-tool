# Project Management Tool — Architecture, Configuration & Run Guide

## 1. System Overview & Layered Architecture
This full-stack Project Management Tool implements a clean, five-layer enterprise architecture:
1. **Domain Model Layer (`/java-backend/src/main/java/com/pmt/model/DomainModels.java` & `/src/types.ts`)**: Encapsulated entities (`User`, `Project`, `Task`, `ActivityLog`, `SystemSetting`) enforcing strict domain invariants, role enums (`ADMIN`, `PROJECT_MANAGER`, `TEAM_MEMBER`), and audit timestamps.
2. **Data Access Layer (`/java-backend/src/main/java/com/pmt/dao/JdbcRepositories.java` & `/src/services/firestoreService.ts`)**: Parameterized `PreparedStatement` queries with explicit transaction management (`setAutoCommit(false)`, `commit()`, `rollback()`) alongside real-time Cloud Firestore persistence secured by Zero-Trust ABAC `firestore.rules`.
3. **Service & Grounding Layer (`/server.ts`)**: Server-side input validation, role-based access enforcement, and live Google Search Grounding via `@google/genai` (`tools: [{ googleSearch: {} }]`).
4. **Controller / Servlet Layer (`/java-backend/src/main/java/com/pmt/servlet/ProjectManagementServlets.java` & `/server.ts`)**: Session/token validation, HTTP 403/422 error handling, and atomic state mutation endpoints.
5. **Responsive Web Interface (`/src/App.tsx`)**: Tailored role dashboards for **Administrators**, **Project Managers**, and **Team Members**.

## 2. Database Setup Instructions (PostgreSQL / MySQL)
1. Provision a PostgreSQL 15+ or MySQL 8+ instance.
2. Execute the normalized 3NF schema script:
   ```bash
   psql -U postgres -d pmt_db -f java-backend/sql/schema.sql
   ```
3. Configure environment variables (never hardcode credentials in source code):
   ```bash
   export PMT_JDBC_URL="jdbc:postgresql://localhost:5432/pmt_db"
   export PMT_JDBC_USER="pmt_app_user"
   export PMT_JDBC_PASSWORD="your_secure_password"
   export GEMINI_API_KEY="your_gemini_api_key"
   ```

## 3. Running the Full-Stack Web Application
```bash
npm install
npm run dev
```
The server starts on `http://localhost:3000` with Firebase Authentication, Cloud Firestore real-time persistence, server-side input validation, and Google Search Grounding.
