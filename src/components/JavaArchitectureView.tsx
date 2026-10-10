import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { JAVA_ARCHITECTURE_DOCS } from '../data/sampleSeedData';

export const JavaArchitectureView: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<'sql' | 'jdbc' | 'servlet' | 'setup'>('sql');
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const getActiveCode = () => {
    if (activeLayer === 'sql') return JAVA_ARCHITECTURE_DOCS.sqlSchema;
    if (activeLayer === 'jdbc') return JAVA_ARCHITECTURE_DOCS.jdbcDao;
    if (activeLayer === 'servlet') return JAVA_ARCHITECTURE_DOCS.javaServlet;
    return `# Environment & Database Configuration (Zero Hardcoded Secrets)
export PMT_JDBC_URL="jdbc:postgresql://localhost:5432/pmt_db"
export PMT_JDBC_USER="pmt_app_user"
export PMT_JDBC_PASSWORD="<secret_from_vault>"
export GEMINI_API_KEY="<gemini_api_key>"

# Initialize Normalized 3NF Schema
psql -U postgres -d pmt_db -f java-backend/sql/schema.sql

# Compile & Package Java Servlet WAR or Run Full-Stack Node+Firebase Runtime
npm install
npm run dev`;
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Layered System Specification · Models · JDBC PreparedStatements · Servlets · 3NF SQL
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Java Backend, JDBC Data Access & Relational Schema Deliverables
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Inspect the layered Java OOP models, parameterized JDBC PreparedStatement DAOs with explicit transaction rollback, Jakarta EE Servlets, and 3NF PostgreSQL/MySQL schema stored in <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">/java-backend/</code>.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setActiveLayer('sql')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeLayer === 'sql' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            01. 3NF SQL Schema
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('jdbc')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeLayer === 'jdbc' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            02. JDBC PreparedStatement DAO
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('servlet')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeLayer === 'servlet' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            03. Java Servlets & RBAC
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('setup')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeLayer === 'setup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            04. Setup & Run Guide
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Architectural Layer Breakdown
          </h3>
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="pb-3 border-b border-slate-100">
              <p className="font-semibold text-slate-900">1. Encapsulated OOP Domain Models</p>
              <p className="mt-0.5">
                Abstract <code className="font-mono">BaseEntity</code> implementing <code className="font-mono">AuditableEntity</code>, with <code className="font-mono">User</code>, <code className="font-mono">Project</code>, and <code className="font-mono">Task</code> enforcing constructor and setter validation invariants.
              </p>
            </div>
            <div className="pb-3 border-b border-slate-100">
              <p className="font-semibold text-slate-900">2. Parameterized JDBC Data Access</p>
              <p className="mt-0.5">
                Uses <code className="font-mono">PreparedStatement</code> placeholders (<code className="font-mono">?</code>) to prevent SQL injection, paired with <code className="font-mono">conn.setAutoCommit(false)</code> and <code className="font-mono">conn.rollback()</code> for atomic task + activity log writes.
              </p>
            </div>
            <div className="pb-3 border-b border-slate-100">
              <p className="font-semibold text-slate-900">3. Servlet Session & RBAC Filters</p>
              <p className="mt-0.5">
                Validates <code className="font-mono">HttpSession</code> identity and <code className="font-mono">Role</code> permissions on both server endpoints and Firestore Zero-Trust ABAC rules.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">4. Secrets & Environment Isolation</p>
              <p className="mt-0.5">
                Database URLs, credentials, and API keys are read exclusively via environment variables (<code className="font-mono">System.getenv</code> / <code className="font-mono">process.env</code>).
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">
              {activeLayer === 'sql' && 'java-backend/sql/schema.sql'}
              {activeLayer === 'jdbc' && 'java-backend/src/main/java/com/pmt/dao/JdbcRepositories.java'}
              {activeLayer === 'servlet' && 'java-backend/src/main/java/com/pmt/servlet/ProjectManagementServlets.java'}
              {activeLayer === 'setup' && 'java-backend/README.md'}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(getActiveCode())}
              className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Source'}</span>
            </button>
          </div>
          <pre className="p-5 text-xs font-mono leading-relaxed overflow-x-auto flex-1">
            <code>{getActiveCode()}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
