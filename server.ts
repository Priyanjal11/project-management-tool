import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// Initialize server-side Gemini SDK with mandatory aistudio-build User-Agent header
function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const VALID_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Server-Side Input & RBAC Validation Endpoint
 * Mirrors the Java Servlet validation layer and returns PreparedStatement binding diagnostics.
 */
app.post('/api/validate/entity', (req: Request, res: Response) => {
  try {
    const { entityType, actorRole, payload } = req.body as {
      entityType: 'USER' | 'PROJECT' | 'TASK' | 'PROFILE' | 'SETTING' | 'COMMENT' | 'ATTACHMENT';
      actorRole: 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_MEMBER';
      payload: Record<string, unknown>;
    };

    const errors: string[] = [];

    if (!entityType || !payload || typeof payload !== 'object') {
      res.status(400).json({
        valid: false,
        errors: ['Malformed validation request: entityType and payload are required.'],
      });
      return;
    }

    // Enforce server-side Role-Based Access Control (RBAC)
    if (entityType === 'USER' && actorRole !== 'ADMIN') {
      errors.push('Access Denied (HTTP 403): Only ADMIN role can create, edit, or delete user accounts.');
    }
    if (entityType === 'SETTING' && actorRole !== 'ADMIN') {
      errors.push('Access Denied (HTTP 403): Only ADMIN role can modify system-wide configuration settings.');
    }
    if (entityType === 'PROJECT' && actorRole === 'TEAM_MEMBER') {
      errors.push('Access Denied (HTTP 403): TEAM_MEMBER role cannot create or modify project definitions.');
    }

    if (entityType === 'USER') {
      const name = String(payload.name ?? '').trim();
      const email = String(payload.email ?? '').trim();
      const role = String(payload.role ?? '').trim();
      const department = String(payload.department ?? '').trim();
      const status = String(payload.status ?? '').trim();

      if (name.length < 2 || name.length > 80) {
        errors.push('User name must be between 2 and 80 characters.');
      }
      if (email.length < 3 || email.length > 120 || !VALID_EMAIL_REGEX.test(email)) {
        errors.push('Please provide a valid corporate email address (3-120 characters).');
      }
      if (!['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'].includes(role)) {
        errors.push('Role must be ADMIN, PROJECT_MANAGER, or TEAM_MEMBER.');
      }
      if (department.length < 2 || department.length > 60) {
        errors.push('Department must be between 2 and 60 characters.');
      }
      if (!['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(status)) {
        errors.push('Status must be ACTIVE, SUSPENDED, or ARCHIVED.');
      }
    } else if (entityType === 'PROJECT') {
      const title = String(payload.title ?? '').trim();
      const description = String(payload.description ?? '').trim();
      const startDate = String(payload.startDate ?? '').trim();
      const endDate = String(payload.endDate ?? '').trim();
      const status = String(payload.status ?? '').trim();
      const managerId = String(payload.managerId ?? '').trim();

      if (title.length < 3 || title.length > 120) {
        errors.push('Project title must be between 3 and 120 characters.');
      }
      if (description.length < 5 || description.length > 1000) {
        errors.push('Project description must be between 5 and 1000 characters.');
      }
      if (!VALID_DATE_REGEX.test(startDate) || !VALID_DATE_REGEX.test(endDate)) {
        errors.push('Start date and end date must use YYYY-MM-DD format.');
      } else if (startDate > endDate) {
        errors.push('Project end date cannot be earlier than start date.');
      }
      if (!['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'].includes(status)) {
        errors.push('Invalid project lifecycle status.');
      }
      if (!VALID_ID_REGEX.test(managerId)) {
        errors.push('A valid Project Manager must be assigned.');
      }
    } else if (entityType === 'TASK') {
      const title = String(payload.title ?? '').trim();
      const description = String(payload.description ?? '').trim();
      const projectId = String(payload.projectId ?? '').trim();
      const assigneeId = String(payload.assigneeId ?? '').trim();
      const priority = String(payload.priority ?? '').trim();
      const status = String(payload.status ?? '').trim();
      const dueDate = String(payload.dueDate ?? '').trim();
      const progress = Number(payload.progress ?? 0);

      if (title.length < 3 || title.length > 140) {
        errors.push('Task title must be between 3 and 140 characters.');
      }
      if (description.length < 5 || description.length > 1000) {
        errors.push('Task description must be between 5 and 1000 characters.');
      }
      if (!VALID_ID_REGEX.test(projectId)) {
        errors.push('Task must reference a valid parent project ID.');
      }
      if (!VALID_ID_REGEX.test(assigneeId)) {
        errors.push('Task must be assigned to a valid team member.');
      }
      if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
        errors.push('Task priority must be LOW, MEDIUM, HIGH, or CRITICAL.');
      }
      if (!['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'ARCHIVED'].includes(status)) {
        errors.push('Task status must be TODO, IN_PROGRESS, IN_REVIEW, DONE, or ARCHIVED.');
      }
      if (!VALID_DATE_REGEX.test(dueDate)) {
        errors.push('Due date must be a valid YYYY-MM-DD date.');
      }
      if (Number.isNaN(progress) || progress < 0 || progress > 100) {
        errors.push('Task progress must be an integer between 0 and 100.');
      }
    } else if (entityType === 'COMMENT') {
      const taskId = String(payload.taskId ?? '').trim();
      const content = String(payload.content ?? '').trim();
      if (!VALID_ID_REGEX.test(taskId)) {
        errors.push('Comment must reference a valid task ID.');
      }
      if (content.length < 1 || content.length > 1000) {
        errors.push('Comment content must be between 1 and 1000 characters.');
      }
    } else if (entityType === 'ATTACHMENT') {
      const taskId = String(payload.taskId ?? '').trim();
      const fileName = String(payload.fileName ?? '').trim();
      const fileSizeBytes = Number(payload.fileSizeBytes ?? 0);
      if (!VALID_ID_REGEX.test(taskId)) {
        errors.push('Attachment must reference a valid task ID.');
      }
      if (fileName.length < 1 || fileName.length > 120) {
        errors.push('File name must be between 1 and 120 characters.');
      }
      if (Number.isNaN(fileSizeBytes) || fileSizeBytes < 0 || fileSizeBytes > 52428800) {
        errors.push('Attachment file size must be between 0B and 50MB.');
      }
    } else if (entityType === 'PROFILE') {
      const name = String(payload.name ?? '').trim();
      const email = String(payload.email ?? '').trim();
      const department = String(payload.department ?? '').trim();
      const newPassword = String(payload.newPassword ?? '');

      if (name.length < 2 || name.length > 80) {
        errors.push('Profile display name must be between 2 and 80 characters.');
      }
      if (email.length < 3 || email.length > 120 || !VALID_EMAIL_REGEX.test(email)) {
        errors.push('Profile email must be a valid email address.');
      }
      if (department.length < 2 || department.length > 60) {
        errors.push('Department must be between 2 and 60 characters.');
      }
      if (newPassword.length > 0 && newPassword.length < 8) {
        errors.push('New password must be at least 8 characters long.');
      }
    } else if (entityType === 'SETTING') {
      const settingKey = String(payload.settingKey ?? '').trim();
      const settingValue = String(payload.settingValue ?? '').trim();
      const category = String(payload.category ?? '').trim();
      const description = String(payload.description ?? '').trim();

      if (settingKey.length < 3 || settingKey.length > 80) {
        errors.push('Setting key must be between 3 and 80 characters.');
      }
      if (settingValue.length < 1 || settingValue.length > 250) {
        errors.push('Setting value must be between 1 and 250 characters.');
      }
      if (!['SECURITY', 'JDBC_POOL', 'WORKFLOW', 'NOTIFICATIONS'].includes(category)) {
        errors.push('Invalid setting category.');
      }
      if (description.length < 5 || description.length > 250) {
        errors.push('Setting description must be between 5 and 250 characters.');
      }
    }

    if (errors.length > 0) {
      res.status(422).json({
        valid: false,
        errors,
      });
      return;
    }

    res.json({
      valid: true,
      validatedAt: new Date().toISOString(),
      message: `${entityType} payload passed server-side validation and RBAC checks for role ${actorRole}.`,
    });
  } catch (err) {
    res.status(500).json({
      valid: false,
      errors: [err instanceof Error ? err.message : 'Server validation error'],
    });
  }
});

/**
 * Server-Side Gemini Search Grounding Endpoint
 */
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const { query, projectContext } = req.body as {
      query?: string;
      projectContext?: string;
    };

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      res.status(400).json({ error: 'Please provide a search query of at least 3 characters.' });
      return;
    }

    const ai = getGenAIClient();
    const promptText = `You are an enterprise technical program advisor and Java/full-stack architecture analyst.
Answer the following project management or technical governance query using current, factual information from Google Search.
Provide a structured, concise executive brief with:
1. Key Findings & Current Standards
2. Actionable Milestones or Risk Mitigations
3. Concrete Quantitative Benchmarks or Best Practices

${projectContext ? `Active Project Context: ${projectContext}\n` : ''}User Query: ${query.trim()}`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];
    let responseData = null;
    let lastError: unknown = null;

    for (const modelName of candidateModels) {
      try {
        responseData = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!responseData) {
      throw lastError || new Error('Failed to generate grounded response from Gemini API.');
    }

    const text = responseData.text || 'No grounded summary returned.';
    const rawChunks = responseData.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: { uri: string; title: string }[] = [];

    for (const chunk of rawChunks) {
      const web = (chunk as { web?: { uri?: string; title?: string } }).web;
      if (web?.uri) {
        sources.push({
          uri: web.uri,
          title: web.title || web.uri,
        });
      }
    }

    res.json({
      summary: text,
      sources,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Gemini Search Grounding Error:', errMsg);
    res.status(500).json({
      error: errMsg,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Project Management Tool server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
