import React, { useState } from 'react';
import { Search, ExternalLink, Plus, Loader2 } from 'lucide-react';
import { Project, ResearchResult } from '../types';

interface SearchGroundingViewProps {
  projects: Project[];
  onCreateTaskFromResearch: (projectId: string, suggestedTitle: string, suggestedDescription: string) => void;
}

const PRESET_QUERIES = [
  'Java 21 Jakarta Servlet 6 and HikariCP JDBC PreparedStatement pooling best practices 2026',
  'OWASP Top 10 web application security controls for role-based access control and session management',
  'Software engineering sprint velocity benchmarks and deadline risk mitigation strategies',
  'PostgreSQL 3NF indexing strategies for high-concurrency task management systems',
];

export const SearchGroundingView: React.FC<SearchGroundingViewProps> = ({
  projects,
  onCreateTaskFromResearch,
}) => {
  const [queryText, setQueryText] = useState(PRESET_QUERIES[0]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleRunSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText.trim(),
          projectContext: selectedProject
            ? `${selectedProject.title} (${selectedProject.status}): ${selectedProject.description}`
            : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve search-grounded insights.');
      }
      setResult(data as ResearchResult);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Search grounding request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Live Web Intelligence · Google Search Grounding
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Technical Standards & Project Benchmark Research
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Query live industry benchmarks, Java/JDBC architecture specifications, and security compliance standards grounded with verifiable Google Search citations.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <form onSubmit={handleRunSearch} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label htmlFor="research-query" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Research Query or Technical Standard
              </label>
              <input
                id="research-query"
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="e.g., OWASP session management rules for Java Servlets..."
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            <div>
              <label htmlFor="research-project" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Project Context (Optional)
              </label>
              <select
                id="research-project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">General Organization Research</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Quick topics:</span>
              {PRESET_QUERIES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setQueryText(preset)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Topic {idx + 1}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{loading ? 'Searching Live Web...' : 'Run Grounded Search'}</span>
            </button>
          </div>
        </form>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
            <strong className="font-semibold">Error:</strong> {errorMsg}
          </div>
        )}
      </div>

      {result && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Grounded Research Brief
              </h3>
              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                Generated {new Date(result.timestamp).toLocaleTimeString()} · {result.sources.length} Verified Web Sources
              </p>
            </div>

            {projects.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const targetProjId = selectedProjectId || projects[0].id;
                  onCreateTaskFromResearch(
                    targetProjId,
                    `Implement findings: ${queryText.slice(0, 75)}`,
                    result.summary.slice(0, 650)
                  );
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Project Task from Findings</span>
              </button>
            )}
          </div>

          <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap leading-relaxed text-sm">
            {result.summary}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-semibold text-slate-700 mb-3">
              Google Search Grounding Citations
            </h4>
            {result.sources.length === 0 ? (
              <p className="text-xs text-slate-500">
                Synthesized from foundational technical documentation.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {result.sources.map((src, index) => (
                  <a
                    key={index}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate group-hover:underline">
                        {src.title}
                      </p>
                      <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
                        {src.uri}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
